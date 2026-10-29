# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

### Adicionado

- Logo do Rift Sim no topo da página, como favicon e no README.
- Passar o mouse num time destaca todas as partidas dele (o caminho até onde chegou) e apaga as demais.
- Seletor de idioma (PT / EN): começa pelo idioma do navegador e fica salvo; os nomes das fases vêm da API no
  idioma escolhido.
- Botão "Compartilhar no X": abre um post com um link que carrega os seus palpites para quem abrir.
- Circuito Desafiante (aba "Desafiante", link `#Desafiante`).
- A aba CBLOL também traz os splits de 2025, quando o CBLOL virou a LTA Sul; a aba LCS, os da LTA Norte.
- Busca no menu de torneios (Select2): digite parte do nome, ex. "2021" ou "summer".
- Data e hora de cada partida (no fuso de quem está vendo), quando a API informa.
- Jogo ao vivo: selo "AO VIVO" e link para a transmissão; a página confere a cada minuto e atualiza os
  resultados quando um jogo começa ou termina.
- Time favorito: o menu de favorito, acima do torneio, fixa o time (um por liga) e deixa o caminho dele sempre
  marcado.
- Ícones ([Font Awesome](https://fontawesome.com)) nos botões, no ao vivo, no troféu e nas setas da tabela.
- "Compartilhar no X" agora gera uma imagem da última fase com os seus palpites: no celular vai direto pela
  folha de compartilhar; no computador é baixada para anexar no post que abre.
- Logos dos times guardados no site (`img/teams/`, baixados por `tools/logos.py`) para a imagem poder
  desenhá-los.

### Alterado

- "Limpar palpites" e o favorito saíram do topo e ficam numa barra logo acima do torneio; no celular o
  botão do X mostra só o ícone.

- Layout no celular: topo compacto e não fixo, abas ocupando a largura, colunas mais estreitas (duas rodadas
  lado a lado), grande final abaixo das chaves e mata-mata em sequência (quartas → semi → final) em vez de
  espelhado.

### Corrigido

- Palpite no play-in, em chaveamentos intermediários ou em qualquer fase de pontos corridos (inclusive grupos
  múltiplos da LCK e LPL) agora leva o time escolhido para a fase seguinte, no lugar do time real e sem herdar
  os resultados dele; enquanto a vaga não é decidida, aparece "A definir".
- Trocar o `#liga` na URL ou usar o voltar do navegador agora troca a liga sem recarregar a página.
- O menu de torneios mostrava só as 9 edições mais recentes; agora lista todas (ex.: CBLOL 2021).
- Topo no celular estourava a largura da tela: abas e botões agora quebram linha.

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
