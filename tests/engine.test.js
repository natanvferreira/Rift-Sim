// Rodar com: node --test
const test = require("node:test");
const assert = require("node:assert");
const E = require("../js/engine.js");

const team = (n) => ({ id: `t${n}`, code: `T${n}`, name: `Time ${n}` });
const played = (id, a, b, aWins = true) => ({
  id,
  state: "completed",
  teams: [
    { ...a, result: { outcome: aWins ? "win" : "loss", gameWins: aWins ? 1 : 0 } },
    { ...b, result: { outcome: aWins ? "loss" : "win", gameWins: aWins ? 0 : 1 } },
  ],
});
const TBD = { id: "0", code: "TBD" };

test("palpite sobrescreve o resultado real; palpite igual ao real é ignorado", () => {
  const [a, b] = [team(1), team(2)];
  const real = played("m1", a, b);
  assert.equal(E.resolve("m1", a, b, real, {}).winner.id, "t1");
  const flipped = E.resolve("m1", a, b, real, { m1: "t2" });
  assert.equal(flipped.winner.id, "t2");
  assert.ok(flipped.picked);
  assert.ok(!E.resolve("m1", a, b, real, { m1: "t1" }).picked);
});

test("placar escolhido entra no saldo da tabela, inclusive mudando só o placar de um resultado real", () => {
  const [a, b, c] = [team(1), team(2), team(3)];
  const real = played("m1", a, b); // a venceu 1-0 de verdade
  const stage = {
    slug: "regular",
    sections: [{ rankings: [{ teams: [a, b, c] }], matches: [{ ...real, bo: 5 }, { id: "m2", state: "unstarted", teams: [b, c], bo: 5 }] }],
  };
  stage.kind = E.stageKind(stage);
  const rowOf = (out, t) => out[0].sections[0].table.find((r) => r.team.id === t.id);

  // vencedor é o 2º time da partida: placar "3-1" precisa virar [1, 3]
  const out = E.compute([stage], { m1: "t1 3-2", m2: "t3 3-1" });
  assert.deepEqual(out[0].sections[0].matches[1].score, [1, 3]);
  assert.equal(rowOf(out, c).gd, 2);
  assert.equal(rowOf(out, a).gd, 1); // 3-2 em vez do 1-0 real
  assert.ok(out[0].sections[0].matches[0].picked);
  assert.ok(!E.resolve("m1", a, b, real, { m1: "t1 1-0" }).picked); // mesmo placar do real: não é palpite
});

test("estrutura do chaveamento é deduzida dos jogos reais", () => {
  const t = [1, 2, 3, 4].map(team);
  const links = E.inferLinks([
    played("a", t[0], t[1]),
    played("b", t[2], t[3]),
    played("c", t[0], t[2]),
  ]);
  assert.deepEqual(links[2], [{ from: 0, won: true }, { from: 1, won: true }]);
});

test("eliminados: do primeiro ao último a cair, sem quem ainda joga a chave inferior", () => {
  const t = [1, 2, 3, 4].map(team);
  // partida já calculada, como sai do compute
  const out = (ms) => ({ matches: ms.map((m) => ({ ...m, winner: m.teams.find((x) => x.result?.outcome === "win") })), links: E.inferLinks(ms) });
  // chave dupla de 4: superior (a, b), final superior (c), inferior (d), final inferior (lf), grande final (gf)
  const matches = [
    played("a", t[0], t[1]),
    played("b", t[2], t[3]),
    played("c", t[0], t[2]),
    played("d", t[1], t[3]),
    played("lf", t[1], t[2]),
    played("gf", t[0], t[1]),
  ];
  assert.deepEqual(E.eliminated(out(matches)).map((x) => x.id), ["t4", "t3", "t2"]);

  // inferior ainda "a definir" sem origem conhecida: quem perdeu na superior não está fora
  const open = [matches[0], matches[1], { id: "d", teams: [TBD, TBD] }];
  assert.deepEqual(E.eliminated(out(open)), []);

  // disputa de 3º (EWC): o 4º lugar cai antes do vice
  const ewc = [played("a", t[0], t[1]), played("b", t[2], t[3]), played("f", t[0], t[2]), played("3", t[1], t[3])];
  assert.deepEqual(E.eliminated(out(ewc)).map((x) => x.id), ["t4", "t3"]);
});

test("fase suíça completa: 5 rodadas, sem revanche, sempre mesmo recorde, 8 classificados", () => {
  const teams = Array.from({ length: 16 }, (_, i) => team(i));
  const round1 = Array.from({ length: 8 }, (_, i) => played(`r1-${i}`, teams[i], teams[15 - i]));
  const later = Array.from({ length: 25 }, (_, i) => ({ id: `x${i}`, state: "unstarted", teams: [TBD, TBD] }));
  const stage = { slug: "swiss", sections: [{ matches: [...round1, ...later] }] };
  stage.kind = E.stageKind(stage);

  for (let seed = 0; seed < 50; seed++) {
    const picks = { "draw:1": seed, "draw:2": seed * 7, "draw:3": seed * 13, "draw:4": seed * 31 };
    let swiss;
    // palpita sempre no time da esquerda até a fase acabar
    for (let guard = 0; guard < 10; guard++) {
      [swiss] = E.compute([stage], picks);
      const open = swiss.rounds.flatMap((r) => r.matches).filter((m) => !m.winner);
      if (!open.length) break;
      open.forEach((m) => (picks[m.id] = m.teams[0].id));
    }
    assert.deepEqual(swiss.rounds.map((r) => r.matches.length), [8, 8, 8, 6, 3]);
    assert.equal(swiss.qualifiers.length, 8);
    const seen = new Set();
    const record = {};
    const rec = (t) => (record[t.id] ??= [0, 0]);
    for (const round of swiss.rounds) {
      for (const m of round.matches) {
        const key = E.pairKey(...m.teams);
        assert.ok(!seen.has(key), `revanche ${key}`);
        seen.add(key);
        assert.deepEqual(rec(m.teams[0]), rec(m.teams[1]), `recordes diferentes em ${key}`);
      }
      for (const m of round.matches) {
        rec(m.winner)[0]++;
        rec(E.loserOf(m))[1]++;
      }
    }
  }
});

test("sorteio das quartas: os dois 3-0 pegam 3-2 e ficam em lados opostos", () => {
  const rows = [0, 0, 1, 1, 1, 2, 2, 2].map((l, i) => ({ team: team(i), w: 3, l }));
  for (let seed = 0; seed < 50; seed++) {
    const slots = E.drawKnockout(rows, 8, E.seededRandom(seed));
    const losses = (t) => rows.find((r) => r.team === t).l;
    assert.equal(new Set(slots).size, 8);
    assert.equal(losses(slots[0]), 0);
    assert.equal(losses(slots[1]), 2);
    assert.equal(losses(slots[4]), 0);
    assert.equal(losses(slots[5]), 2);
  }
});

test("quem passa do play-in pelo palpite entra no lugar do time real na fase seguinte", () => {
  const [a, b, c] = [team(1), team(2), team(3)];
  const playIn = { slug: "play_ins", kind: "bracket", sections: [{ matches: [played("p1", a, b)], links: [[null, null]] }] };
  const main = { slug: "main", kind: "bracket", sections: [{ matches: [played("m1", a, c)], links: [[null, null]] }] };

  const m1 = (picks) => E.compute([playIn, main], picks)[1].sections[0].matches[0];
  assert.equal(m1({}).winner.id, "t1");
  // b passa no lugar de a, sem herdar a vitória real de a
  assert.deepEqual(m1({ p1: "t2" }).teams.map((t) => t.id), ["t2", "t3"]);
  assert.equal(m1({ p1: "t2" }).winner, null);
});

test("tabela mudada por palpite troca quem entra no chaveamento seguinte, por posição", () => {
  const [a, b, c] = [team(1), team(2), team(3)];
  const groups = { slug: "groups", kind: "rr", sections: [{ rankings: [{ teams: [a] }, { teams: [b] }], matches: [played("g1", a, b)] }] };
  const final = { slug: "final", kind: "bracket", sections: [{ matches: [played("f1", a, c)], links: [[null, null]] }] };

  const f1 = (picks) => E.compute([groups, final], picks)[1].sections[0].matches[0];
  assert.deepEqual(f1({ g1: "t2" }).teams.map((t) => t.id), ["t2", "t3"]);
  assert.equal(f1({ g1: "t2" }).winner, null);
});
