# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

### Adicionado

- Logo do Rift Sim no topo da página, como favicon e no README.

## [1.0.0] - 2026-10-27

Primeira versão publicada.

### Adicionado

- Dados reais ao vivo da API do lolesports para CBLOL, LCK, LPL, LCS, MSI e Mundial, com seleção de split/edição.
- Palpites por clique: o vencedor escolhido sobrescreve o resultado real; clicar de novo desfaz.
- Placar da série (md3/md5) escolhido pelo usuário, contando no saldo da tabela; vale também para mudar só o
  placar de um resultado real.
- Melhor-de-N de cada partida pelo calendário oficial, pelo placar real ou pela regra da fase.
- Tabelas de pontos corridos recalculadas a cada palpite, com setas ▲▼ de quem subiu ou desceu.
- Playoffs do CBLOL e da LCS reordenados quando a fase de pontos muda.
- Fase suíça do Mundial: rodadas não sorteadas são geradas pelos palpites, entre times com a mesma campanha,
  sem revanche; botão "Sortear de novo".
- Sorteio das quartas do Mundial pela regra oficial (3-0 contra 3-2, em lados opostos); botão
  "Sortear chaveamento".
- Estrutura dos chaveamentos deduzida dos jogos reais, com a edição anterior como molde para chaves "a definir".
- Layout de chave que afunila até a final centralizada (eliminação simples) e chave superior/inferior
  convergindo para a grande final (eliminação dupla).
- Troféu só na última fase com final; nas anteriores o vencedor aparece como "Classificado".
- Palpites e sorteios salvos no navegador por torneio; botão "Limpar palpites".
- Link direto por liga (`#CBLOL`, `#Mundial`, ...).
- Layout responsivo (celular até 390px) e rolagem lateral preservada entre cliques, levando até a rodada nova
  da suíça quando ela aparece.
- Testes da lógica com `node --test`.
