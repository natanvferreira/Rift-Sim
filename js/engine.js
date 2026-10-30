// Motor do simulador: junta resultados reais + palpites e calcula cada fase.
// Só funções puras (sem DOM), testadas em tests/engine.test.js.

const isTBD = (t) => !t || t.id === "0" || t.tbd;
const hasTBD = (m) => m.teams.some(isTBD);
const loserOf = (m) => m.winner && m.teams.find((t) => t.id !== m.winner.id);
const pairKey = (a, b) => [a.id, b.id].sort().join("-");
const recordOf = (row) => `${row.w}-${row.l}`;

// ordem padrão de chaveamento: 1º só encontra 2º na final
const seedOrder = (n) =>
  n === 2 ? [0, 1] : seedOrder(n / 2).flatMap((s) => [s, n - 1 - s]);

// aleatório com semente (mulberry32): o mesmo sorteio se repete a cada renderização
const seededRandom = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const shuffle = (list, rand) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const stageKind = (stage) =>
  stage.slug === "swiss"
    ? "swiss"
    : stage.sections.every((s) => s.rankings?.length)
      ? "rr"
      : "bracket";

// ---------- partidas e tabelas ----------

// palpite salvo: "idDoTime" ou "idDoTime 3-1" (placar do vencedor primeiro)
function parsePick(pick) {
  if (!pick) return null;
  const [team, score] = String(pick).split(" ");
  const games = score?.split("-").map(Number);
  return { team, games: games?.length === 2 && games.every(Number.isInteger) ? games : null };
}

// resultado real vale se os dois times batem com o jogo real; palpite do usuário sobrescreve
// (inclusive só o placar, mantendo o vencedor real)
function resolve(id, a, b, real, picks, bo = 1) {
  const m = { id, bo, start: real?.start, teams: [a, b], winner: null, score: null, picked: false };
  if (isTBD(a) || isTBD(b)) return m;
  const rt = real && [a, b].map((t) => real.teams.find((x) => x.id === t.id));
  if (rt?.every((t) => t?.result) && real.state === "completed") {
    const w = rt.findIndex((t) => t.result?.outcome === "win");
    if (w >= 0) {
      m.winner = m.teams[w];
      m.score = rt.map((t) => t.result.gameWins);
    }
  }
  const p = parsePick(picks[id]);
  if (!p || (p.team !== a.id && p.team !== b.id)) return m;
  const winner = p.team === a.id ? a : b;
  const score = p.games && (winner === a ? p.games : [...p.games].reverse());
  const sameWinner = winner.id === m.winner?.id;
  if (!sameWinner || (score && score.join() !== m.score?.join())) {
    Object.assign(m, { winner, score: score ?? null, picked: true });
  }
  return m;
}

const newRow = (team, seed = 0) => ({ team, w: 0, l: 0, gd: 0, seed });

function tally(rows, m) {
  if (!m.winner) return;
  const w = rows.get(m.winner.id);
  const l = rows.get(loserOf(m).id);
  w.w++;
  l.l++;
  if (m.score) {
    const diff = Math.abs(m.score[0] - m.score[1]);
    w.gd += diff;
    l.gd -= diff;
  }
}

// shortcut: desempate por vitórias > derrotas > saldo > ordem oficial, sem confronto direto
const sortRows = (rows, official = []) =>
  [...rows.values()].sort(
    (x, y) =>
      y.w - x.w ||
      x.l - y.l ||
      y.gd - x.gd ||
      official.indexOf(x.team.id) - official.indexOf(y.team.id) ||
      x.seed - y.seed,
  );

const status = (all) => ({
  dirty: all.some((m) => m.picked),
  complete: all.every((m) => m.winner),
});

// ---------- pontos corridos ----------

function computeRR(st, picks) {
  const sections = st.sections.map((sec) => {
    const matches = sec.matches.map((r) =>
      resolve(r.id, r.teams[0], r.teams[1], r, picks, r.bo),
    );
    const rows = new Map();
    for (const t of matches.flatMap((m) => m.teams))
      if (!isTBD(t) && !rows.has(t.id)) rows.set(t.id, newRow(t));
    matches.forEach((m) => tally(rows, m));
    const official = (sec.rankings || []).flatMap((r) =>
      r.teams.map((t) => t.id),
    );
    return { name: sec.name, matches, official, table: sortRows(rows, official) };
  });
  return { sections, ...status(sections.flatMap((s) => s.matches)) };
}

// ---------- fase suíça ----------

// 3 vitórias classifica, 3 derrotas elimina: o tamanho das rodadas é fixo (16 times -> 8,8,8,6,3)
function swissSizes(n) {
  let buckets = { "0-0": n };
  const sizes = [];
  while (true) {
    const next = {};
    const add = (k, c) => (next[k] = (next[k] || 0) + c);
    let size = 0;
    for (const [k, c] of Object.entries(buckets)) {
      const [w, l] = k.split("-").map(Number);
      if (w === 3 || l === 3) {
        add(k, c);
        continue;
      }
      size += c / 2;
      add(`${w + 1}-${l}`, c / 2);
      add(`${w}-${l + 1}`, c / 2);
    }
    if (!size) return sizes;
    sizes.push(size);
    buckets = next;
  }
}

// pareia a lista sem repetir confronto; se o sorteado já enfrentou, tenta o próximo (backtracking)
function pairUp(list, met) {
  if (!list.length) return [];
  const [a, ...rest] = list;
  for (let i = rest.length - 1; i >= 0; i--) {
    if (met.has(pairKey(a, rest[i]))) continue;
    const sub = pairUp(
      rest.filter((_, j) => j !== i),
      met,
    );
    if (sub) return [[a, rest[i]], ...sub];
  }
  return null;
}

// rodadas 2+: sorteio entre times com o mesmo recorde, sem revanche (regra do Mundial)
// shortcut: a 1ª rodada nunca é sorteada aqui (Tier 1 x Tier 3, Tier 2 x Tier 2, sem mesma região),
// porque a API não informa tiers; ela sempre vem do sorteio real da Riot
function pairSwiss(alive, met, rand) {
  const buckets = {};
  alive
    .sort((p, q) => q.w - p.w || p.l - q.l || p.seed - q.seed)
    .forEach((x) => (buckets[recordOf(x)] ??= []).push(x.team));
  return Object.values(buckets).flatMap((b) => {
    const drawn = shuffle(b, rand);
    return pairUp(drawn, met) || pairUp(drawn, new Set());
  });
}

function computeSwiss(st, picks) {
  const real = st.sections[0].matches;
  const teams = [];
  // vaga ainda indefinida (fase anterior simulada) conta como time, para o tamanho das rodadas
  for (const t of real.flatMap((m) => m.teams))
    if (t && t.id !== "0" && !teams.some((x) => x.id === t.id)) teams.push(t);
  const sizes = swissSizes(teams.length);

  // sorteio da 1ª rodada ainda não saiu: mostra os jogos como estão
  if (!sizes.length || real.slice(0, sizes[0]).some(hasTBD)) {
    const matches = real.slice(0, sizes[0] || real.length).map((r) => resolve(r.id, ...r.teams, r, picks, r.bo));
    return { rounds: [{ matches }], table: [], qualifiers: [], dirty: false, complete: false };
  }

  let start = 0;
  const realRounds = sizes.map((s) => real.slice(start, (start += s)));
  const rows = new Map(teams.map((t, i) => [t.id, newRow(t, i)]));
  const met = new Set();
  const rounds = [];
  let clean = true;

  for (const [r, realRound] of realRounds.entries()) {
    const alive = [...rows.values()].filter((x) => x.w < 3 && x.l < 3);
    // rodada real só vale se tudo antes dela bate com a realidade
    const useReal = clean && realRound.length > 0 && !realRound.some(hasTBD);
    const pairs = useReal
      ? realRound.map((m) => [...m.teams, m])
      : pairSwiss(alive, met, seededRandom(picks[`draw:${r}`] ?? r + 1));
    const matches = pairs.map(([a, b, rm]) => {
      const row = rows.get(a.id);
      // jogo valendo vaga ou eliminação é md3, o resto md1 (regra do Mundial)
      const bo = row.w === 2 || row.l === 2 ? 3 : 1;
      const id = rm ? rm.id : `s${r}-${pairKey(a, b)}`;
      return { ...resolve(id, a, b, rm, picks, bo), record: recordOf(row) };
    });
    rounds.push({ matches, drawn: useReal ? null : r });
    for (const m of matches) {
      met.add(pairKey(...m.teams));
      tally(rows, m);
    }
    if (matches.some((m) => m.picked)) clean = false;
    if (matches.some((m) => !m.winner)) break;
  }

  const table = sortRows(rows);
  return {
    rounds,
    table,
    dirty: !clean,
    qualifiers: table.filter((x) => x.w === 3),
    complete: table.every((x) => x.w === 3 || x.l === 3),
  };
}

// ---------- chaveamentos ----------

// cada vaga vem do vencedor/perdedor da partida anterior do time; null = time entra direto (seed)
function inferLinks(matches) {
  const last = {};
  return matches.map((m, i) => {
    const src = m.teams.map((t) => (isTBD(t) ? null : (last[t.id] ?? null)));
    for (const t of m.teams)
      if (!isTBD(t)) last[t.id] = { from: i, won: t.result?.outcome === "win" };
    return src;
  });
}

// sorteio das quartas do Mundial: cada 3-0 pega um 3-2, em lados opostos; o resto é livre
// shortcut: assume a chave de 8 com semis 0x1 e 2x3 (formato 2025); outros tamanhos usam seedOrder
function drawKnockout(qualifiers, n, rand) {
  const group = (l) =>
    shuffle(
      qualifiers.filter((r) => r.l === l).map((r) => r.team),
      rand,
    );
  const unbeaten = group(0);
  const lastChance = group(2);
  if (n !== 8 || qualifiers.length !== 8 || unbeaten.length !== 2 || lastChance.length < 2) {
    const byLosses = qualifiers.map((r) => r.team);
    return seedOrder(n).map((i) => byLosses[i] ?? null);
  }
  const slots = Array(8).fill(null);
  [slots[0], slots[1]] = [unbeaten[0], lastChance[0]];
  [slots[4], slots[5]] = [unbeaten[1], lastChance[1]];
  const rest = shuffle([...lastChance.slice(2), ...group(1)], rand);
  return slots.map((t) => t ?? rest.shift());
}

// quem entra direto no chaveamento: time real se a fase anterior não mudou; senão, o resultado simulado
function bracketSeeds(sec, prev, picks) {
  const reals = [];
  sec.matches.forEach((m, i) =>
    sec.links[i].forEach((src, j) => !src && reals.push(m.teams[j])),
  );
  const real = (t) => (isTBD(t) ? null : t);

  if (prev?.st.kind === "swiss" && (prev.dirty || reals.some(isTBD))) {
    if (!prev.complete) return { teams: reals.map(() => null) };
    const rand = seededRandom(picks["draw:ko"] ?? 1);
    return { teams: drawKnockout(prev.qualifiers, reals.length, rand), drawn: true };
  }
  // vindo de pontos corridos ou de outro chaveamento, os times já chegam trocados (trackSwaps)
  return { teams: reals.map(real) };
}

function computeBracket(st, picks, prev) {
  let drawn = false;
  const sections = st.sections.map((sec) => {
    const seeds = bracketSeeds(sec, prev, picks);
    drawn ||= Boolean(seeds.drawn);
    const matches = [];
    let k = 0;
    sec.matches.forEach((real, i) => {
      const teams = sec.links[i].map((src) => {
        if (!src) return seeds.teams[k++];
        const from = matches[src.from];
        return src.won ? from.winner : loserOf(from);
      });
      matches.push(resolve(real.id, teams[0], teams[1], real, picks, real.bo));
    });
    return { name: sec.name, matches, links: sec.links };
  });
  return { sections, drawn, ...status(sections.flatMap((s) => s.matches)) };
}

// disputa de 3º lugar (ex.: EWC): a última partida junta dois perdedores, logo depois da final
const isThirdPlace = (sec) => sec.matches.length > 2 && sec.links.at(-1).every((s) => s && !s.won);

// eliminados da chave, do primeiro ao último a cair: perdedor cuja derrota não leva a outra partida.
// jogo "a definir" de origem desconhecida mais adiante pode ser a chave inferior: espera ele ter origem
function eliminated(sec) {
  const { matches, links } = sec;
  const order = matches.map((_, i) => i);
  // a disputa de 3º é a última da lista, mas o 4º lugar cai antes do vice
  if (isThirdPlace(sec)) order.splice(-2, 2, order.at(-1), order.at(-2));
  return order.flatMap((i) => {
    const m = matches[i];
    const goesOn = links.some((l) => l.some((s) => s?.from === i && !s.won));
    const unknown = matches.some((n, j) => j > i && links[j].some((s, k) => !s && isTBD(n.teams[k])));
    return m.winner && !goesOn && !unknown ? [loserOf(m)] : [];
  });
}

// ---------- torneio inteiro ----------

// fase com palpites: o time real de cada vaga (posição na tabela, ou saída de um chaveamento que não
// leva a outra partida) é substituído nas fases seguintes pelo simulado (ou "a definir")
function trackSwaps(real, sim, swap) {
  const set = (r, t) => r && r.id !== t?.id && swap.set(r.id, t || { id: `tbd-${r.id}`, tbd: true });
  if (sim.st.kind === "rr") {
    real.sections.forEach((sec, s) =>
      sec.table.forEach((row, k) => set(row.team, sim.complete && sim.sections[s].table[k].team)),
    );
    return;
  }
  real.sections.forEach((sec, s) =>
    sec.matches.forEach((m, i) =>
      [true, false].forEach((won) => {
        if (sec.links.some((l) => l.some((src) => src?.from === i && src.won === won))) return;
        const r = won ? m.winner : loserOf(m);
        const x = sim.sections[s].matches[i];
        set(r, won ? x.winner : loserOf(x));
      }),
    ),
  );
}

const swapTeams = (st, swap) => ({
  ...st,
  sections: st.sections.map((sec) => ({
    ...sec,
    matches: sec.matches.map((m) => ({
      ...m,
      // sem `result`: o resultado real era do time que saiu, não do que entrou
      teams: m.teams.map((t) => (t && swap.has(t.id) ? { ...swap.get(t.id), result: null } : t)),
    })),
  })),
});

function compute(stages, picks) {
  const real = Object.keys(picks).length ? compute(stages, {}) : null;
  const swap = new Map();
  let prev = null;
  return stages.map((orig, i) => {
    const st = swap.size ? swapTeams(orig, swap) : orig;
    const out =
      st.kind === "rr"
        ? computeRR(st, picks)
        : st.kind === "swiss"
          ? computeSwiss(st, picks)
          : computeBracket(st, picks, prev);
    // suíça -> mata-mata já é resorteado em bracketSeeds
    if (real && st.kind !== "swiss" && out.dirty) trackSwaps(real[i], { st, ...out }, swap);
    return (prev = { st, ...out });
  });
}

if (typeof module === "object") {
  module.exports = {
    seededRandom, stageKind, resolve, inferLinks, drawKnockout, compute, pairKey, loserOf, eliminated,
  };
}
