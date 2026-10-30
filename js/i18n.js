// Idioma: o texto em português é a própria chave; EN guarda a tradução em inglês.

const EN = {
  Mundial: "Worlds",
  "LTA Sul": "LTA South",
  "LTA Norte": "LTA North",
  "Nenhum torneio encontrado": "No tournament found",
  "Buscar torneio": "Search tournament",
  "AO VIVO": "LIVE",
  Assistir: "Watch",
  "Sem favorito": "No favorite",
  "Nenhum time encontrado": "No team found",
  "Buscar time": "Search team",
  "Time favorito": "Favorite team",
  "A definir": "TBD",
  Time: "Team",
  "V-D": "W-L",
  Saldo: "Diff",
  "Classificado:": "Qualified:",
  Classificados: "Qualified",
  Eliminados: "Eliminated",
  Final: "Final",
  Semifinal: "Semifinal",
  "Quartas de final": "Quarterfinal",
  "Oitavas de final": "Round of 16",
  Rodada: "Round",
  "Rodada {0}": "Round {0}",
  "Final superior": "Upper final",
  "Final inferior": "Lower final",
  "Chave superior": "Upper bracket",
  "Chave inferior": "Lower bracket",
  "Grande final": "Grand final",
  "Disputa de 3º lugar": "Third-place match",
  "Ainda sem jogos.": "No matches yet.",
  "Sortear de novo": "Redraw",
  simulada: "simulated",
  "com palpites": "with picks",
  "Sortear chaveamento": "Draw bracket",
  "Carregando…": "Loading…",
  "Sem dados para este torneio ainda.": "No data for this tournament yet.",
  "Erro ao carregar {0}: {1}": "Failed to load {0}: {1}",
  "Não consegui carregar os dados ({0}). Tente recarregar.": "Couldn't load the data ({0}). Try reloading.",
  "API respondeu {0}": "API returned {0}",
  "Minha simulação do {0} no Rift Sim": "My {0} simulation on Rift Sim",
  "Este link tem uma simulação compartilhada. Substituir seus palpites deste torneio por ela?":
    "This link has a shared simulation. Replace your picks for this tournament with it?",
  // index.html
  "Limpar palpites": "Clear picks",
  "Compartilhar no X": "Share on X",
  Competição: "Competition",
  Torneio: "Tournament",
  Idioma: "Language",
  "Clique no time para escolher o vencedor (de novo para desfazer). Em md3/md5, escolha o placar logo abaixo — ele conta no saldo da tabela. Passe o mouse num time para ver o caminho dele.":
    "Click a team to pick the winner (again to undo). In Bo3/Bo5, pick the score right below — it counts toward the standings diff. Hover a team to see its path.",
  "Resultado real": "Actual result",
  "Seu palpite": "Your pick",
  "Dados ao vivo da API do lolesports.com. Projeto de fã, sem ligação com a Riot Games.":
    "Live data from the lolesports.com API. Fan project, not affiliated with Riot Games.",
};

let lang = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem("lang")); // gravado pelo store do ui.js, em JSON
    if (saved === "pt-BR" || saved === "en-US") return saved;
  } catch {}
  return navigator.language.startsWith("pt") ? "pt-BR" : "en-US";
})();

// tr("Rodada {0}", 2) -> "Rodada 2" / "Round 2"
const tr = (s, ...args) =>
  ((lang === "en-US" && EN[s]) || s).replace(/\{(\d)\}/g, (_, i) => args[i]);

// textos fixos do index.html: data-i18n (conteúdo) e data-i18n-label (aria-label), com o português guardado no próprio atributo
function translatePage() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.dataset.i18n ||= el.textContent.trim();
    el.textContent = tr(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll("[data-i18n-label]")) {
    el.dataset.i18nLabel ||= el.getAttribute("aria-label");
    el.setAttribute("aria-label", tr(el.dataset.i18nLabel));
  }
}
