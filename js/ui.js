// Interface: estado da página, renderização e eventos.

const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const img = (t) => esc((t.image || "").replace(/^http:/, "https:"));
// "cblol_split_3_2026" -> "CBLOL Split 3 2026"; "worlds_2026" -> "Mundial 2026"; "circuito_desafiante_split_2_2026" -> "Desafiante Split 2 2026"; "lta_s_split_1_2025" -> "LTA Sul Split 1 2025"
const LTA = { lta_s_: "LTA Sul", lta_n_: "LTA Norte" };
const tourName = (t) =>
  `${tr(LTA[t.slug.slice(0, 6)] || state.league)} ${t.slug.replace(/^(lta_[sn]|circuito_desafiante|[^_]+)_/, "").replaceAll("_", " ")}`.replace(/\b[a-z]/g, (c) => c.toUpperCase());

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
  live: new Map(), // partidas ao vivo agora (getLive)
  fav: null, // time favorito da liga: caminho sempre marcado
};

// ---------- peças ----------

function teamHTML(m, i, open) {
  const t = m.teams[i];
  if (isTBD(t)) {
    return `<button class="team tbd" disabled><span class="logo"></span><span class="code">${tr("A definir")}</span></button>`;
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

// transmissão no idioma da página, senão a primeira; sem nenhuma, a página ao vivo do lolesports
function streamURL(e) {
  const s = e.streams?.find((s) => s.locale === lang) || e.streams?.[0];
  const p = encodeURIComponent(s?.parameter || "");
  if (s?.provider === "twitch") return `https://www.twitch.tv/${p}`;
  if (s?.provider === "youtube") return `https://www.youtube.com/watch?v=${p}`;
  return `https://lolesports.com/live/${encodeURIComponent(e.league?.slug || "")}`;
}

// ao vivo: selo + link da transmissão; senão "dom., 20/07, 17:00" no fuso de quem está vendo
function whenHTML(m) {
  const live = state.live.get(m.id);
  if (live) {
    return `<div class="when live"><span><i class="fa-solid fa-tower-broadcast" aria-hidden="true"></i> ${tr("AO VIVO")}</span><a href="${esc(streamURL(live))}" target="_blank" rel="noopener">${tr("Assistir")} <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a></div>`;
  }
  return m.start
    ? `<time class="when" datetime="${esc(m.start)}">${new Date(m.start).toLocaleString(lang, { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>`
    : "";
}

function matchHTML(m) {
  const open = !isTBD(m.teams[0]) && !isTBD(m.teams[1]);
  const active = m.id === state.active ? " active" : "";
  return `<div class="match${active}">${whenHTML(m)}${teamHTML(m, 0, open)}${teamHTML(m, 1, open)}${scoresHTML(m)}</div>`;
}

const matchesHTML = (ms) => ms.map(matchHTML).join("");

const col = (title, body, cls = "") =>
  `<div class="col ${cls}"><h4>${esc(title)}</h4><div class="col-body">${body}</div></div>`;

const drawButton = (key, label) =>
  `<button class="redraw" data-draw="${key}"><i class="fa-solid fa-dice" aria-hidden="true"></i><span>${label}</span></button>`;

function tableHTML(rows, key, rowClass = () => "") {
  const before = state.lastPos.get(key);
  state.lastPos.set(key, new Map(rows.map((r, i) => [r.team.id, i])));
  const arrow = (id, i) => {
    const p = before?.get(id);
    if (p === undefined || p === i) return "";
    return p > i ? `<span class="up"><i class="fa-solid fa-caret-up" aria-hidden="true"></i>${p - i}</span>` : `<span class="down"><i class="fa-solid fa-caret-down" aria-hidden="true"></i>${i - p}</span>`;
  };
  return `<table class="standings">
    <thead><tr><th>#</th><th>${tr("Time")}</th><th>${tr("V-D")}</th><th>${tr("Saldo")}</th></tr></thead>
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
    ? `<div class="champ"><img class="logo" src="${img(m.winner)}" alt=""><span>${isChampionStage ? '<i class="fa-solid fa-trophy" aria-hidden="true"></i>' : tr("Classificado:")} ${esc(m.winner.name)}</span></div>`
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
  const final = finalHTML(sec.matches.at(-1), tr("Final"), isChampionStage);
  const column = (ms, lvl) => col(tr(TREE_NAMES[lvl] ?? "Rodada"), matchesHTML(ms));
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
        return col(d + 1 === max ? tr(`Final ${label}`) : tr("Rodada {0}", d + 1), matchesHTML(ms));
      })
      .join("");
  };
  return `<div class="bracket double">
    <div class="rows">
      <div class="row"><span class="row-label">${tr("Chave superior")}</span><div class="cols">${row(false, "superior")}</div></div>
      <div class="row"><span class="row-label">${tr("Chave inferior")}</span><div class="cols">${row(true, "inferior")}</div></div>
    </div>
    ${finalHTML(matches[last], tr("Grande final"), isChampionStage)}</div>`;
}

// formatos avulsos (ex.: duas partidas independentes): colunas por rodada
function depthColumnsHTML(sec) {
  const depth = [];
  sec.links.forEach(
    (l, i) => (depth[i] = 1 + Math.max(0, ...l.filter(Boolean).map((s) => depth[s.from]))),
  );
  const max = Math.max(...depth);
  return `<div class="bracket cols">${[...Array(max)]
    .map((_, d) => col(tr("Rodada {0}", d + 1), matchesHTML(sec.matches.filter((_, i) => depth[i] === d + 1))))
    .join("")}</div>`;
}

// chave com final de verdade: a última partida junta dois vencedores
const hasFinal = (sec) => sec.matches.length > 0 && sec.links.at(-1).every((s) => s?.won);

function bracketHTML(sec, isChampionStage) {
  if (!sec.matches.length) return `<p class="muted">${tr("Ainda sem jogos.")}</p>`;
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
      (simulated ? drawButton(round.drawn, tr("Sortear de novo")) : "") +
      Object.entries(groups)
        .map(([rec, ms]) => `<div class="bucket">${rec ? `<span class="tag">${rec}</span>` : ""}${matchesHTML(ms)}</div>`)
        .join("");
    return col(tr("Rodada {0}", i + 1) + (simulated ? ` · ${tr("simulada")}` : ""), body, "swiss-round");
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
    (out.dirty ? `<span class="badge">${tr("com palpites")}</span>` : "") +
    (out.drawn ? drawButton("ko", tr("Sortear chaveamento")) : "");
  return `<section class="stage"><header><h2>${esc(st.name)}</h2>${extras}</header>${body}</section>`;
}

function render() {
  $("#tabs").innerHTML = Object.keys(LEAGUES)
    .map((k) => `<button class="${k === state.league ? "active" : ""}" data-league="${k}">${tr(k)}</button>`)
    .join("");
  $("#tour").innerHTML = (state.tours[state.league] || [])
    .map((t, i) => `<option value="${i}" ${t === state.tour ? "selected" : ""}>${esc(tourName(t))}</option>`)
    .join("");
  window.jQuery?.("#tour").trigger("change.select2"); // innerHTML não avisa o select2
  // times do torneio aberto, em qualquer formato (o MSI, por exemplo, não tem tabela)
  const teams = new Map();
  for (const m of (state.stages || []).flatMap((st) => st.sections.flatMap((s) => s.matches))) {
    for (const t of m.teams) if (!isTBD(t)) teams.set(t.id, t);
  }
  $("#fav").innerHTML = `<option value="">${tr("Sem favorito")}</option>` + [...teams.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => `<option value="${esc(t.id)}" ${t.id === state.fav ? "selected" : ""}>${esc(t.name)}</option>`)
    .join("");
  $("#tourbar").hidden = !state.stages?.length;
  if (!state.stages) {
    $("#view").innerHTML = `<p class="muted">${tr("Carregando…")}</p>`;
    return;
  }
  // o innerHTML recria tudo: guarda a rolagem lateral das chaves para não voltar ao início a cada clique
  const scrolls = [...document.querySelectorAll(".bracket")].map((el) => el.scrollLeft);
  const roundsBefore = document.querySelectorAll(".swiss-round").length;
  $("#view").innerHTML = state.stages.length
    ? compute(state.stages, state.picks).map(stageHTML).join("")
    : `<p class="muted">${tr("Sem dados para este torneio ainda.")}</p>`;
  document.querySelectorAll(".bracket").forEach((el, i) => (el.scrollLeft = scrolls[i] ?? 0));
  if (state.fav) {
    for (const el of $("#view").querySelectorAll(`.team[data-t="${CSS.escape(state.fav)}"]`)) {
      el.classList.add("fav");
      el.closest(".match").classList.add("fav");
    }
  }
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
  state.fav = store.get(`fav:${league}`);
  history.replaceState(null, "", `${location.pathname}#${league}`); // link direto para a liga (e tira o ?tour=&picks= de um link compartilhado)
  const today = new Date().toISOString().slice(0, 10);
  const list = state.tours[league];
  await selectTour(list.find((t) => t.startDate <= today) || list[0]);
}

async function selectTour(tour, shared) {
  Object.assign(state, { tour, stages: null, lastPos: new Map() });
  render();
  try {
    const stages = await loadStages(tour, state.tours[state.league]);
    if (state.tour !== tour) return; // trocou de torneio enquanto carregava
    Object.assign(state, { stages, picks: shared || store.get(`picks:${tour.id}`) || {} });
    if (shared) savePicks();
    else render();
  } catch (e) {
    $("#view").innerHTML = `<p class="err">${esc(tr("Erro ao carregar {0}: {1}", tour.slug, e.message))}</p>`;
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

const onTour = (e) => {
  const tour = state.tours[state.league][e.target.value];
  if (tour !== state.tour) selectTour(tour); // o select2 dispara change até ao clicar no torneio já aberto
};
// select2 (menu com busca) dispara o change pelo jQuery, que não chega ao addEventListener; sem a CDN fica o select comum
if (window.jQuery?.fn.select2) {
  jQuery("#tour")
    .select2({
      width: "auto",
      dropdownAutoWidth: true,
      language: { noResults: () => tr("Nenhum torneio encontrado"), search: () => tr("Buscar torneio") },
    })
    .on("change", onTour);
  // o select2 nomeia a caixa só pelo torneio escolhido; junta o rótulo "Torneio" antes
  $(".select2-selection").setAttribute("aria-labelledby", "tour-label select2-tour-container");
} else $("#tour").addEventListener("change", onTour);

// troca o idioma: os nomes das fases vêm traduzidos da API, então recarrega o torneio
$("#lang").addEventListener("change", (e) => {
  lang = e.target.value;
  store.set("lang", lang);
  translatePage();
  if (state.tour) selectTour(state.tour);
  else render();
});

$("#fav").addEventListener("change", (e) => {
  state.fav = e.target.value || null;
  store.set(`fav:${state.league}`, state.fav);
  render();
});

$("#reset").addEventListener("click", () => {
  state.picks = {};
  savePicks();
});

// PNG da última fase (onde sai o campeão) com os palpites; os logos vêm de img/teams (tools/logos.py),
// porque os do lolesports não liberam CORS e o canvas não exportaria
async function stageImage() {
  const stage = [...document.querySelectorAll("#view .stage")].at(-1);
  if (!stage || !window.html2canvas) return null;
  const width = Math.max(stage.offsetWidth, ...[...stage.querySelectorAll(".bracket")].map((b) => b.scrollWidth + 40));
  const canvas = await html2canvas(stage, {
    width,
    windowWidth: Math.max(innerWidth, width),
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    onclone: (doc, el) => {
      el.style.width = `${width}px`;
      for (const b of el.querySelectorAll(".bracket")) b.style.overflow = "visible";
      for (const x of el.querySelectorAll(".redraw, .scores")) x.remove();
      const h2 = el.querySelector("h2");
      h2.textContent = `${tourName(state.tour)} · ${h2.textContent}`;
      // img nova: o html2canvas lê o currentSrc, que na original continua sendo o logo remoto
      const logos = [...el.querySelectorAll("img.logo")].map((im) => {
        const local = Object.assign(doc.createElement("img"), { className: im.className, src: `img/teams/${im.src.split("/").pop()}` });
        im.replaceWith(local);
        return local.decode().catch(() => {}); // logo que falta só fica em branco
      });
      return Promise.all(logos);
    },
  });
  return new Promise((ok) => canvas.toBlob(ok, "image/png"));
}

// os palpites vão no próprio link: quem abrir vê a mesma simulação; a imagem vai junto
$("#share").addEventListener("click", async () => {
  if (!state.tour) return;
  const url = new URL(location.pathname, location.href);
  url.search = new URLSearchParams({ tour: state.tour.id, picks: JSON.stringify(state.picks) });
  url.hash = state.league;
  const text = tr("Minha simulação do {0} no Rift Sim", tourName(state.tour));
  const intent = `https://twitter.com/intent/tweet?${new URLSearchParams({ text, url })}`;
  // celular: a folha de compartilhar do sistema manda a imagem direto para o app do X
  const probe = new File([""], "x.png", { type: "image/png" });
  const native = matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [probe] });
  // computador: a aba abre já no clique (depois do await o navegador bloquearia o pop-up) e a imagem é baixada para anexar
  const tab = native ? null : open("about:blank", "_blank");
  const blob = await stageImage().catch(() => null);
  const file = blob && new File([blob], "rift-sim.png", { type: "image/png" });
  if (native && file) {
    try {
      return await navigator.share({ files: [file], text: `${text} ${url}` });
    } catch (e) {
      if (e.name === "AbortError") return; // a pessoa fechou a folha de compartilhar
    }
  }
  if (file) {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(file), download: file.name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }
  if (tab) {
    tab.opener = null;
    tab.location = intent;
  } else location.href = intent;
});

// palpites vindos de um link: só aceita { idDaPartida: "idDoTime [placar]" | número do sorteio }
function parseShared(raw) {
  try {
    const p = JSON.parse(raw);
    const ok = p && typeof p === "object" && !Array.isArray(p) &&
      Object.values(p).every((v) => typeof v === "string" || Number.isFinite(v));
    return ok ? p : null;
  } catch {
    return null;
  }
}

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

// de minuto em minuto vê o que está ao vivo; quando muda (começou ou acabou um jogo), recarrega os resultados
async function refreshLive() {
  if (document.hidden) return;
  const live = await loadLive().catch(() => null);
  if (!live) return;
  const before = state.live;
  state.live = live;
  if (!state.stages) return;
  // só conta jogo do torneio aberto (o getLive traz todas as ligas), na ordem das fases
  const ids = state.stages.flatMap((st) => st.sections.flatMap((s) => s.matches.map((m) => m.id)));
  const key = (l) => ids.filter((id) => l.has(id)).join();
  if (key(before) === key(live)) return;
  const tour = state.tour;
  const stages = await loadStages(tour, state.tours[state.league]).catch(() => null);
  if (stages && state.tour === tour) state.stages = stages;
  render();
}
setInterval(refreshLive, 60_000);
document.addEventListener("visibilitychange", refreshLive);

(async function init() {
  $("#lang").value = lang;
  translatePage();
  try {
    const lists = await Promise.all(Object.values(LEAGUES).map(loadTournaments));
    Object.keys(LEAGUES).forEach((k, i) => (state.tours[k] = lists[i]));
    const params = new URLSearchParams(location.search);
    const shared = parseShared(params.get("picks"));
    const league = shared && Object.keys(state.tours).find((k) => state.tours[k].some((t) => t.id === params.get("tour")));
    if (league) {
      const tour = state.tours[league].find((t) => t.id === params.get("tour"));
      const mine = store.get(`picks:${tour.id}`);
      // não apaga os palpites da pessoa sem perguntar
      const replace = !mine || !Object.keys(mine).length || JSON.stringify(mine) === JSON.stringify(shared) ||
        confirm(tr("Este link tem uma simulação compartilhada. Substituir seus palpites deste torneio por ela?"));
      Object.assign(state, { league, fav: store.get(`fav:${league}`) });
      history.replaceState(null, "", `${location.pathname}#${league}`);
      await selectTour(tour, replace ? shared : undefined);
    } else {
      const fromHash = decodeURIComponent(location.hash.slice(1));
      await selectLeague(LEAGUES[fromHash] ? fromHash : state.league);
    }
    refreshLive();
  } catch (e) {
    $("#view").innerHTML = `<p class="err">${esc(tr("Não consegui carregar os dados ({0}). Tente recarregar.", e.message))}</p>`;
  }
})();
