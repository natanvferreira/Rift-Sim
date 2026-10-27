// Interface: estado da página, renderização e eventos.

const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const img = (t) => esc((t.image || "").replace(/^http:/, "https:"));
// "cblol_split_3_2026" -> "CBLOL Split 3 2026"; "worlds_2026" -> "Mundial 2026"
const tourName = (t) =>
  `${state.league} ${t.slug.split("_").slice(1).join(" ")}`.replace(/\b[a-z]/g, (c) => c.toUpperCase());

const store = {
  get: (k) => {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

const state = {
  tours: {}, // liga -> torneios
  league: "Mundial",
  tour: null,
  stages: null,
  picks: {},
  lastPos: new Map(), // posições da renderização anterior, para as setas ▲▼
  active: null, // partida clicada por último: mostra os botões de placar
};

// ---------- peças ----------

function teamHTML(m, i, open) {
  const t = m.teams[i];
  if (isTBD(t)) {
    return `<button class="team tbd" disabled><span class="logo"></span><span class="code">A definir</span></button>`;
  }
  const result = !m.winner ? "" : m.winner.id === t.id ? (m.picked ? "win picked" : "win") : "lose";
  return `<button class="team ${result}" ${open ? "" : "disabled"} data-m="${esc(m.id)}" data-t="${esc(t.id)}" title="${esc(t.name)}">
    <img class="logo" src="${img(t)}" alt="" loading="lazy">
    <span class="code">${esc(t.code)}</span>
    <span class="score">${m.score ? m.score[i] : ""}</span></button>`;
}

// placares possíveis do vencedor numa série md3/md5 (ex.: 3-0, 3-1, 3-2), na partida selecionada
function scoresHTML(m) {
  if (m.id !== state.active || !m.winner || m.bo < 3) return "";
  const need = Math.ceil(m.bo / 2);
  const current = m.score && (m.winner === m.teams[0] ? m.score : [...m.score].reverse()).join("-");
  const chips = [...Array(need)].map((_, lost) => {
    const s = `${need}-${lost}`;
    return `<button class="chip ${s === current ? "on" : ""}" data-m="${esc(m.id)}" data-t="${esc(m.winner.id)}" data-s="${s}">${s}</button>`;
  });
  return `<div class="scores"><span>${esc(m.winner.code)}</span>${chips.join("")}</div>`;
}

function matchHTML(m) {
  const open = !isTBD(m.teams[0]) && !isTBD(m.teams[1]);
  const active = m.id === state.active ? " active" : "";
  return `<div class="match${active}">${teamHTML(m, 0, open)}${teamHTML(m, 1, open)}${scoresHTML(m)}</div>`;
}

const matchesHTML = (ms) => ms.map(matchHTML).join("");

const col = (title, body, cls = "") =>
  `<div class="col ${cls}"><h4>${esc(title)}</h4><div class="col-body">${body}</div></div>`;

const drawButton = (key, label) =>
  `<button class="redraw" data-draw="${key}">🎲 ${label}</button>`;

function tableHTML(rows, key, rowClass = () => "") {
  const before = state.lastPos.get(key);
  state.lastPos.set(key, new Map(rows.map((r, i) => [r.team.id, i])));
  const arrow = (id, i) => {
    const p = before?.get(id);
    if (p === undefined || p === i) return "";
    return p > i ? `<span class="up">▲${p - i}</span>` : `<span class="down">▼${i - p}</span>`;
  };
  return `<table class="standings">
    <thead><tr><th>#</th><th>Time</th><th>V-D</th><th>Saldo</th></tr></thead>
    <tbody>${rows
      .map(
        (r, i) => `<tr class="${rowClass(r)}">
      <td class="pos">${i + 1}${arrow(r.team.id, i)}</td>
      <td><span class="name"><img class="logo" src="${img(r.team)}" alt="" loading="lazy">${esc(r.team.name)}</span></td>
      <td>${r.w}-${r.l}</td><td>${r.gd > 0 ? "+" : ""}${r.gd}</td></tr>`,
      )
      .join("")}</tbody></table>`;
}

// ---------- chaveamentos ----------

// troféu só na última fase com final; nas anteriores o vencedor apenas se classifica
function finalHTML(m, title, isChampionStage) {
  const champ = m.winner
    ? `<div class="champ"><img class="logo" src="${img(m.winner)}" alt=""><span>${isChampionStage ? "🏆" : "Classificado:"} ${esc(m.winner.name)}</span></div>`
    : "";
  return col(title, matchHTML(m) + champ, "final");
}

const narrow = matchMedia("(max-width: 720px)"); // mesmo ponto de quebra do CSS

// eliminação simples: os dois lados afunilam até a final no centro
const TREE_NAMES = ["Semifinal", "Quartas de final", "Oitavas de final"];

function treeHTML(sec, isChampionStage) {
  const levels = (i, lvl = 0, out = []) => {
    (out[lvl] ??= []).push(sec.matches[i]);
    sec.links[i].forEach((s) => s && levels(s.from, lvl + 1, out));
    return out;
  };
  const [left, right] = sec.links.at(-1).map((src) => levels(src.from));
  const final = finalHTML(sec.matches.at(-1), "Final", isChampionStage);
  const column = (ms, lvl) => col(TREE_NAMES[lvl] ?? "Rodada", matchesHTML(ms));
  // celular: sem espelhar, os dois lados juntos em cada rodada, terminando na final
  if (narrow.matches) {
    const merged = left.map((ms, lvl) => [...ms, ...(right[lvl] || [])]);
    return `<div class="bracket">${merged.map(column).reverse().join("")}${final}</div>`;
  }
  return `<div class="bracket tree">${left.map(column).reverse().join("")}${final}${right.map(column).join("")}</div>`;
}

// eliminação dupla: chave superior e inferior convergem para a grande final
function doubleElimHTML(sec, isChampionStage) {
  const { matches, links } = sec;
  const last = matches.length - 1;
  const lower = [];
  const depth = [];
  links.forEach((l, i) => {
    lower[i] = l.some((s) => s && (!s.won || lower[s.from]));
    const prev = l.filter((s) => s?.won && lower[s.from] === lower[i]);
    depth[i] = 1 + Math.max(0, ...prev.map((s) => depth[s.from]));
  });
  const row = (isLower, label) => {
    const idx = matches.map((_, i) => i).filter((i) => i !== last && lower[i] === isLower);
    const max = Math.max(0, ...idx.map((i) => depth[i]));
    return [...Array(max)]
      .map((_, d) => {
        const ms = idx.filter((i) => depth[i] === d + 1).map((i) => matches[i]);
        return col(d + 1 === max ? `Final ${label}` : `Rodada ${d + 1}`, matchesHTML(ms));
      })
      .join("");
  };
  return `<div class="bracket double">
    <div class="rows">
      <div class="row"><span class="row-label">Chave superior</span><div class="cols">${row(false, "superior")}</div></div>
      <div class="row"><span class="row-label">Chave inferior</span><div class="cols">${row(true, "inferior")}</div></div>
    </div>
    ${finalHTML(matches[last], "Grande final", isChampionStage)}</div>`;
}

// formatos avulsos (ex.: duas partidas independentes): colunas por rodada
function depthColumnsHTML(sec) {
  const depth = [];
  sec.links.forEach(
    (l, i) => (depth[i] = 1 + Math.max(0, ...l.filter(Boolean).map((s) => depth[s.from]))),
  );
  const max = Math.max(...depth);
  return `<div class="bracket cols">${[...Array(max)]
    .map((_, d) => col(`Rodada ${d + 1}`, matchesHTML(sec.matches.filter((_, i) => depth[i] === d + 1))))
    .join("")}</div>`;
}

// chave com final de verdade: a última partida junta dois vencedores
const hasFinal = (sec) => sec.matches.length > 0 && sec.links.at(-1).every((s) => s?.won);

function bracketHTML(sec, isChampionStage) {
  if (!sec.matches.length) return '<p class="muted">Ainda sem jogos.</p>';
  if (!hasFinal(sec)) return depthColumnsHTML(sec);
  const hasLowerBracket = sec.links.some((l) => l.some((s) => s && !s.won));
  return hasLowerBracket ? doubleElimHTML(sec, isChampionStage) : treeHTML(sec, isChampionStage);
}

// ---------- fases ----------

const sectionTitle = (out, sec) =>
  out.sections.length > 1 ? `<h3>${esc(sec.name)}</h3>` : "";

function rrHTML(out, si) {
  return out.sections
    .map(
      (sec, i) => `${sectionTitle(out, sec)}
      <div class="rr">${tableHTML(sec.table, `${si}-${i}`)}<div class="rr-matches">${matchesHTML(sec.matches)}</div></div>`,
    )
    .join("");
}

function swissHTML(out, si) {
  const rowClass = (r) => (r.w === 3 ? "in" : r.l === 3 ? "out" : "");
  const rounds = out.rounds.map((round, i) => {
    const groups = {};
    for (const m of round.matches) (groups[m.record ?? ""] ??= []).push(m);
    const simulated = round.drawn != null;
    const body =
      (simulated ? drawButton(round.drawn, "Sortear de novo") : "") +
      Object.entries(groups)
        .map(([rec, ms]) => `<div class="bucket">${rec ? `<span class="tag">${rec}</span>` : ""}${matchesHTML(ms)}</div>`)
        .join("");
    return col(`Rodada ${i + 1}${simulated ? " · simulada" : ""}`, body, "swiss-round");
  });
  const table = out.table.length ? tableHTML(out.table, `${si}`, rowClass) : "";
  return `<div class="swiss">${table}<div class="bracket cols">${rounds.join("")}</div></div>`;
}

function stageHTML(out, si, all) {
  const { st } = out;
  const isChampionStage =
    si === all.findLastIndex((o) => o.st.kind === "bracket" && o.sections.some(hasFinal));
  const body =
    st.kind === "rr"
      ? rrHTML(out, si)
      : st.kind === "swiss"
        ? swissHTML(out, si)
        : out.sections.map((sec) => sectionTitle(out, sec) + bracketHTML(sec, isChampionStage)).join("");
  const extras =
    (out.dirty ? `<span class="badge">com palpites</span>` : "") +
    (out.drawn ? drawButton("ko", "Sortear chaveamento") : "");
  return `<section class="stage"><header><h2>${esc(st.name)}</h2>${extras}</header>${body}</section>`;
}

function render() {
  $("#tabs").innerHTML = Object.keys(LEAGUES)
    .map((k) => `<button class="${k === state.league ? "active" : ""}" data-league="${k}">${k}</button>`)
    .join("");
  $("#tour").innerHTML = (state.tours[state.league] || [])
    .slice(0, 9)
    .map((t, i) => `<option value="${i}" ${t === state.tour ? "selected" : ""}>${esc(tourName(t))}</option>`)
    .join("");
  if (!state.stages) {
    $("#view").innerHTML = '<p class="muted">Carregando…</p>';
    return;
  }
  // o innerHTML recria tudo: guarda a rolagem lateral das chaves para não voltar ao início a cada clique
  const scrolls = [...document.querySelectorAll(".bracket")].map((el) => el.scrollLeft);
  const roundsBefore = document.querySelectorAll(".swiss-round").length;
  $("#view").innerHTML = state.stages.length
    ? compute(state.stages, state.picks).map(stageHTML).join("")
    : '<p class="muted">Sem dados para este torneio ainda.</p>';
  document.querySelectorAll(".bracket").forEach((el, i) => (el.scrollLeft = scrolls[i] ?? 0));
  showTrail($("#view").querySelector(".team[data-t]:hover")?.dataset.t);
  // rodada nova da suíça nasce na última coluna, possivelmente fora da tela: leva a faixa até o fim
  const rounds = document.querySelectorAll(".swiss-round");
  if (roundsBefore && rounds.length > roundsBefore) {
    const strip = rounds[0].closest(".bracket");
    strip.scrollLeft = strip.scrollWidth;
  }
}

// ---------- navegação ----------

async function selectLeague(league) {
  state.league = league;
  history.replaceState(null, "", `#${league}`); // link direto para a liga
  const today = new Date().toISOString().slice(0, 10);
  const list = state.tours[league];
  await selectTour(list.find((t) => t.startDate <= today) || list[0]);
}

async function selectTour(tour) {
  Object.assign(state, { tour, stages: null, lastPos: new Map() });
  render();
  try {
    const stages = await loadStages(tour, state.tours[state.league], LEAGUES[state.league]);
    if (state.tour !== tour) return; // trocou de torneio enquanto carregava
    Object.assign(state, { stages, picks: store.get(`picks:${tour.id}`) || {} });
    render();
  } catch (e) {
    $("#view").innerHTML = `<p class="err">Erro ao carregar ${esc(tour.slug)}: ${esc(e.message)}</p>`;
  }
}

function savePicks() {
  store.set(`picks:${state.tour.id}`, state.picks);
  render();
}

// girar o celular / redimensionar troca o layout espelhado do mata-mata
narrow.addEventListener("change", () => state.stages && render());

// editar o #liga na URL ou usar o voltar do navegador troca a liga
addEventListener("hashchange", () => {
  const league = decodeURIComponent(location.hash.slice(1));
  if (LEAGUES[league] && league !== state.league) selectLeague(league);
});

$("#tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-league]");
  if (b) selectLeague(b.dataset.league);
});

$("#tour").addEventListener("change", (e) =>
  selectTour(state.tours[state.league][e.target.value]),
);

$("#reset").addEventListener("click", () => {
  state.picks = {};
  savePicks();
});

$("#view").addEventListener("click", (e) => {
  const draw = e.target.closest("[data-draw]");
  const team = e.target.closest("[data-m]");
  const { picks } = state;
  if (draw) {
    picks[`draw:${draw.dataset.draw}`] = Math.floor(Math.random() * 1e9);
  } else if (team) {
    // palpite salvo como "idDoTime" ou "idDoTime 3-1"; clicar de novo no mesmo time desfaz
    const { m, t, s } = team.dataset;
    state.active = m;
    if (s) picks[m] = `${t} ${s}`;
    else if (picks[m]?.split(" ")[0] === t) delete picks[m];
    else picks[m] = t;
  } else return;
  savePicks();
});

// mouse em cima de um time destaca todas as partidas dele (o caminho até onde chegou)
function showTrail(id) {
  const view = $("#view");
  view.classList.toggle("tracing", Boolean(id));
  for (const el of view.querySelectorAll(".trail")) el.classList.remove("trail");
  if (!id) return;
  for (const el of view.querySelectorAll(`.team[data-t="${CSS.escape(id)}"]`)) {
    el.classList.add("trail");
    el.closest(".match").classList.add("trail");
  }
}

$("#view").addEventListener("mouseover", (e) =>
  showTrail(e.target.closest(".team[data-t]")?.dataset.t),
);
$("#view").addEventListener("mouseleave", () => showTrail(null));

(async function init() {
  try {
    const lists = await Promise.all(Object.values(LEAGUES).map(loadTournaments));
    Object.keys(LEAGUES).forEach((k, i) => (state.tours[k] = lists[i]));
    const fromHash = decodeURIComponent(location.hash.slice(1));
    await selectLeague(LEAGUES[fromHash] ? fromHash : state.league);
  } catch (e) {
    $("#view").innerHTML = `<p class="err">Não consegui carregar os dados (${esc(e.message)}). Tente recarregar.</p>`;
  }
})();
