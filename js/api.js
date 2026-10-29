// Acesso à API pública do lolesports.com (a mesma que o site oficial usa).

const API_URL = "https://esports-api.lolesports.com/persisted/gw/";
const API_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z"; // chave pública embutida no lolesports.com

const LEAGUES = {
  CBLOL: ["98767991332355509", "113475181634818701"], // em 2025 o CBLOL virou a LTA Sul
  Desafiante: "105549980953490846",
  LCK: "98767991310872058",
  LPL: "98767991314006698",
  LCS: ["98767991299243165", "113470291645289904"], // e em 2025 a LCS virou a LTA Norte
  "First Stand": "113464388705111224",
  EWC: "116838530616006090",
  MSI: "98767991325878492",
  Mundial: "98767975604431411",
};

async function api(path, params) {
  const query = new URLSearchParams({ hl: lang, ...params });
  const res = await fetch(`${API_URL}${path}?${query}`, {
    headers: { "x-api-key": API_KEY },
  });
  if (!res.ok) throw new Error(tr("API respondeu {0}", res.status));
  return (await res.json()).data;
}

// torneios da(s) liga(s), mais novo primeiro; cada um guarda o leagueId de onde veio
async function loadTournaments(ids) {
  const lists = await Promise.all(
    [ids].flat().map(async (leagueId) => {
      const data = await api("getTournamentsForLeague", { leagueId });
      return data.leagues[0].tournaments.map((t) => ({ ...t, leagueId }));
    }),
  );
  return lists.flat().sort((a, b) => b.startDate.localeCompare(a.startDate));
}

// chaveamento ainda "a definir": copia a estrutura da mesma fase na edição anterior
async function templateLinks(list, tour, slug, sectionIndex, size) {
  const prevTour = list[list.indexOf(tour) + 1];
  if (!prevTour) return null;
  try {
    const data = await api("getStandings", { tournamentId: prevTour.id });
    const sec = data.standings[0].stages.find((s) => s.slug === slug)
      ?.sections[sectionIndex];
    if (!sec || sec.matches.length !== size || sec.matches.some(hasTBD)) return null;
    return inferLinks(sec.matches);
  } catch {
    return null;
  }
}

// data e melhor-de-N das partidas, que só o calendário informa: a 1ª página do getSchedule cobre os
// próximos jogos da liga, o getCompletedEvents os já jogados do torneio (a API só guarda de 2024 em diante)
async function loadEvents(tour) {
  const lists = await Promise.all([
    api("getSchedule", { leagueId: tour.leagueId }).catch(() => null),
    api("getCompletedEvents", { tournamentId: tour.id }).catch(() => null),
  ]);
  return new Map(
    lists.flatMap((d) => d?.schedule.events || []).filter((e) => e.match).map((e) => [e.match.id, e]),
  );
}

// partidas acontecendo agora, de todas as ligas: idDaPartida -> evento (com as transmissões)
async function loadLive() {
  const data = await api("getLive");
  return new Map((data.schedule.events || []).filter((e) => e.match).map((e) => [e.match.id, e]));
}

// md de cada partida: calendário; senão o placar real (2-1 -> md3); senão o maior md da seção
function annotateEvents(sections, events) {
  for (const sec of sections) {
    const fromScore = (m) =>
      m.state === "completed" ? 2 * Math.max(...m.teams.map((t) => t.result?.gameWins ?? 0)) - 1 : 0;
    const fallback = Math.max(1, ...sec.matches.map(fromScore));
    for (const m of sec.matches) {
      const e = events.get(m.id);
      m.bo = e?.match.strategy?.count || fromScore(m) || fallback;
      m.start = e?.startTime;
    }
  }
}

// fases do torneio, já classificadas e com a estrutura dos chaveamentos
async function loadStages(tour, list) {
  const [data, events] = await Promise.all([
    api("getStandings", { tournamentId: tour.id }),
    loadEvents(tour),
  ]);
  const stages = data.standings[0]?.stages || [];
  for (const stage of stages) {
    stage.kind = stageKind(stage);
    annotateEvents(stage.sections, events);
    if (stage.kind !== "bracket") continue;
    for (const [i, sec] of stage.sections.entries()) {
      const open = sec.matches.some(hasTBD);
      sec.links =
        (open && (await templateLinks(list, tour, stage.slug, i, sec.matches.length))) ||
        inferLinks(sec.matches);
    }
  }
  return stages;
}
