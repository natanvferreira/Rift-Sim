<p align="center"><img src="img/logo.png" alt="Rift Sim" width="160" /></p>

# Rift Sim

Simulador de campeonatos de League of Legends com **dados reais**: CBLOL, LCK, LPL, LCS, MSI e Mundial.
Você clica no time que vence, escolhe o placar da série e vê a tabela, a fase suíça e o chaveamento se
recalcularem até o campeão.

Site 100% estático: roda no GitHub Pages ou abrindo o `index.html` direto no navegador, sem build e sem
dependências.

## Como usar

- **Abas:** escolha a competição; no menu ao lado, o split ou a edição (o torneio em andamento abre por padrão).
- **Vencedor:** clique no time. Verde = resultado real, dourado = seu palpite. Clicar de novo no mesmo time desfaz.
- **Placar:** em séries md3/md5, depois de clicar aparecem os placares possíveis (ex.: 3-0, 3-1, 3-2). O placar
  entra no saldo da tabela. Dá para mudar só o placar de um resultado real.
- **Fase suíça:** rodadas que a Riot ainda não sorteou são geradas pelos seus palpites ("Rodada N · simulada").
  Use 🎲 **Sortear de novo** para outro sorteio.
- **Mata-mata do Mundial:** quando as quartas ainda não existem (ou você mudou a suíça), o chaveamento é sorteado
  pela regra oficial; 🎲 **Sortear chaveamento** refaz.
- **Limpar palpites:** volta tudo ao resultado real. Os palpites ficam salvos no navegador, por torneio.
- **Link direto:** `index.html#CBLOL`, `#LCK`, `#LPL`, `#LCS`, `#MSI`, `#Mundial`.

## Regras simuladas

| Fase | Como funciona |
| --- | --- |
| Pontos corridos | Tabela por vitórias, derrotas e saldo de jogos. Mudar resultados reordena os playoffs (CBLOL e LCS). |
| Fase suíça | 3 vitórias classifica, 3 derrotas elimina. Rodadas 2+ sorteiam times com a mesma campanha, sem revanche. Jogo valendo vaga/eliminação é md3, o resto md1. |
| Quartas do Mundial | Cada 3-0 pega um 3-2, em lados opostos da chave; os demais são sorteio livre. |
| Chaveamentos | A estrutura (quem vem de qual partida) é deduzida dos jogos reais; chaves ainda "a definir" usam a mesma fase da edição anterior como molde. |

## Publicar no GitHub Pages

```bash
git init
git add .
git commit -m "Rift Sim"
git branch -M main
git remote add origin https://github.com/<seu-usuario>/rift-sim.git
git push -u origin main
```

No GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
O site fica em `https://<seu-usuario>.github.io/rift-sim/`.

## Estrutura

```
index.html          página
css/style.css       visual
img/                logo (original e versão 192px usada no site e no favicon)
js/engine.js        lógica pura: resultados reais + palpites -> tabelas, suíça, chaveamentos
js/api.js           acesso à API do lolesports
js/ui.js            estado, renderização e eventos
tests/engine.test.js
```

Os scripts são carregados em ordem (`engine` → `api` → `ui`) como scripts comuns, sem módulos, para o
`index.html` funcionar também aberto direto do disco.

## Testes

```bash
node --test
```

Testam a lógica com dados fictícios (sem internet): palpites e placares, dedução do chaveamento, fase suíça
completa sem revanches e sorteio das quartas. Requer Node 18+.

## Dados

Vêm ao vivo da API pública do [lolesports.com](https://lolesports.com), a mesma usada pelo site oficial
(`getTournamentsForLeague`, `getStandings`, `getSchedule`). A chave em `js/api.js` é a pública embutida no
próprio lolesports.com; se a Riot trocá-la, o site para de carregar até ela ser atualizada.

## Limitações conhecidas

- Desempate não considera confronto direto.
- A 1ª rodada da suíça sempre vem do sorteio real (a API não informa os tiers dos times).
- Mudar resultados em grupos múltiplos (LCK, LPL) ou no play-in não muda quem entra no chaveamento seguinte.
- Palpite só de vencedor, sem placar, não altera o saldo.

---

Projeto de fã, sem ligação com a Riot Games.
