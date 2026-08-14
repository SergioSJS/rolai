import { describe, expect, it } from "vitest";
import { NotationError, parseNotation, roll } from "../src/index.js";

// Casos minimos exigidos por docs/roll-notation.md: pool simples,
// modificador, keep/drop, reroll condicional, adv/dis e o operador de
// grupo "{...} vs {...}" com arrays separados.

describe("parseNotation", () => {
  it("pool simples: 2d6", () => {
    const ast = parseNotation("2d6");
    expect(ast.groups).toHaveLength(1);
    expect(ast.groups[0]).toMatchObject({
      name: "roll",
      dice: { count: 2, sides: 6, modifier: 0, hasModifier: false },
    });
  });

  it("dado unico sem quantidade: d20", () => {
    const ast = parseNotation("d20");
    expect(ast.groups[0]!.dice).toMatchObject({ count: 1, sides: 20 });
  });

  it("com modificador: 2d6+3 e 2d6-1", () => {
    const plus = parseNotation("2d6+3");
    expect(plus.groups[0]!.dice).toMatchObject({ modifier: 3, hasModifier: true });
    const minus = parseNotation("2d6-1");
    expect(minus.groups[0]!.dice).toMatchObject({ modifier: -1, hasModifier: true });
  });

  it("keep/drop: kh, kl, dh, dl", () => {
    for (const [notation, type, count] of [
      ["4d6kh3", "kh", 3],
      ["4d6kl1", "kl", 1],
      ["4d6dh1", "dh", 1],
      ["4d6dl1", "dl", 1],
    ] as const) {
      const ast = parseNotation(notation);
      expect(ast.groups[0]!.dice.keepDrop).toEqual({ type, count });
    }
  });

  it("reroll condicional: 4d6!r<2", () => {
    const ast = parseNotation("4d6!r<2");
    expect(ast.groups[0]!.dice.reroll).toEqual({ op: "<", value: 2 });
  });

  it("reroll aceita todos os operadores", () => {
    for (const op of ["<", ">", "<=", ">=", "="] as const) {
      const ast = parseNotation(`4d6!r${op}2`);
      expect(ast.groups[0]!.dice.reroll).toEqual({ op, value: 2 });
    }
  });

  it("acucar adv: 1d20adv expande para 2d20kh1", () => {
    const ast = parseNotation("1d20adv");
    expect(ast.groups[0]!.dice).toMatchObject({
      count: 2,
      sides: 20,
      keepDrop: { type: "kh", count: 1 },
    });
  });

  it("acucar dis: 1d20dis expande para 2d20kl1", () => {
    const ast = parseNotation("1d20dis");
    expect(ast.groups[0]!.dice).toMatchObject({
      count: 2,
      sides: 20,
      keepDrop: { type: "kl", count: 1 },
    });
  });

  it("grupo: {1d6+2} vs {2d10} nomeia action e challenge", () => {
    const ast = parseNotation("{1d6+2} vs {2d10}");
    expect(ast.groups.map((g) => g.name)).toEqual(["action", "challenge"]);
    expect(ast.groups[0]!.dice).toMatchObject({ count: 1, sides: 6, modifier: 2 });
    expect(ast.groups[1]!.dice).toMatchObject({ count: 2, sides: 10 });
  });

  it("grupo: {2d10} + {2d10} produz N grupos independentes (roll_type multi)", () => {
    const ast = parseNotation("{2d10} + {2d10}");
    expect(ast.groups.map((g) => g.name)).toEqual(["group0", "group1"]);
    expect(ast.groups[0]!.dice).toMatchObject({ count: 2, sides: 10 });
    expect(ast.groups[1]!.dice).toMatchObject({ count: 2, sides: 10 });
  });

  it("grupo: aceita mais de dois blocos com +", () => {
    const ast = parseNotation("{1d6} + {2d8} + {1d20+1}");
    expect(ast.groups).toHaveLength(3);
    expect(ast.groups[2]!.dice).toMatchObject({ count: 1, sides: 20, modifier: 1 });
  });

  it("rejeita notacao invalida", () => {
    for (const bad of [
      "",
      "d6x",
      "2d",
      "x2d6",
      "2d6kh",
      "{1d6} vs",
      "0d6",
      "2d1",
      "{1d6} + {2d8} vs {1d20}",
    ]) {
      expect(() => parseNotation(bad), bad).toThrow(NotationError);
    }
  });
});

describe("roll", () => {
  it("pool simples com valores deterministicos", () => {
    const result = roll("2d6", { deterministic: [3, 4] });
    expect(result.notation).toBe("2d6");
    expect(result.groups["roll"]!.rolls).toEqual([3, 4]);
    // multi-dado sem operador de soma explicito: total ausente
    expect(result.groups["roll"]!.total).toBeUndefined();
    expect(result.groups["roll"]!.modifier).toBeUndefined();
  });

  it("modificador soma rolls + modifier em total", () => {
    const result = roll("2d6+3", { deterministic: [3, 4] });
    expect(result.groups["roll"]).toEqual({ rolls: [3, 4], modifier: 3, total: 10 });
  });

  it("modificador negativo", () => {
    const result = roll("2d6-1", { deterministic: [3, 4] });
    expect(result.groups["roll"]).toEqual({ rolls: [3, 4], modifier: -1, total: 6 });
  });

  it("keep highest: 4d6kh3", () => {
    const result = roll("4d6kh3", { deterministic: [2, 6, 1, 4] });
    // `dropped` guarda o que caiu fora: a UI mostra os 4 dados, com o
    // descartado apagado. Sem isso, "4d6kh3" exibia so 3 e escondia metade
    // do que aconteceu.
    expect(result.groups["roll"]).toEqual({ rolls: [2, 6, 4], dropped: [1], total: 12 });
  });

  it("keep lowest: 4d6kl1", () => {
    const result = roll("4d6kl1", { deterministic: [2, 6, 1, 4] });
    expect(result.groups["roll"]).toEqual({ rolls: [1], dropped: [2, 6, 4], total: 1 });
  });

  it("drop highest: 4d6dh1", () => {
    const result = roll("4d6dh1", { deterministic: [2, 6, 1, 4] });
    expect(result.groups["roll"]).toEqual({ rolls: [2, 1, 4], dropped: [6], total: 7 });
  });

  it("drop lowest: 4d6dl1", () => {
    const result = roll("4d6dl1", { deterministic: [2, 6, 1, 4] });
    expect(result.groups["roll"]).toEqual({ rolls: [2, 6, 4], dropped: [1], total: 12 });
  });

  it("sem keep/drop nao existe campo dropped", () => {
    // Payload identico ao de antes pra quem nao usa keep/drop — e o JSON
    // que trafega na sala fica menor.
    expect(roll("2d6", { deterministic: [3, 4] }).groups["roll"]).toEqual({
      rolls: [3, 4],
    });
  });

  it("pool grande mostra tudo que rolou", () => {
    // O caso que motivou: 10d6kh1 exibia 1 dado de 10.
    const dados = [3, 1, 6, 2, 5, 4, 6, 1, 2, 3];
    const result = roll("10d6kh1", { deterministic: dados });
    const grupo = result.groups["roll"]!;
    expect(grupo.rolls.length + grupo.dropped!.length).toBe(10);
    expect(grupo.total).toBe(6);
  });

  it("reroll condicional rerola uma vez quem bate a condicao", () => {
    // 1 e 2 caem <2... so o 1 (<2); recebe o proximo valor da fila (5).
    const result = roll("4d6!r<2", { deterministic: [3, 1, 6, 4, 5] });
    expect(result.groups["roll"]!.rolls).toEqual([3, 5, 6, 4]);
  });

  it("adv mantem o maior; dis mantem o menor", () => {
    // O dado perdedor fica em `dropped`: vantagem sem mostrar os dois d20
    // esconde justamente o que torna a rolagem interessante.
    const adv = roll("1d20adv", { deterministic: [7, 15] });
    expect(adv.groups["roll"]).toEqual({ rolls: [15], dropped: [7], total: 15 });
    const dis = roll("1d20dis", { deterministic: [7, 15] });
    expect(dis.groups["roll"]).toEqual({ rolls: [7], dropped: [15], total: 7 });
  });

  it("grupo vs: arrays separados, sem soma entre grupos", () => {
    // Bate com o exemplo de docs/roll-notation.md.
    const result = roll("{1d6+2} vs {2d10}", { deterministic: [4, 7, 3] });
    expect(result.groups["action"]).toEqual({ rolls: [4], modifier: 2, total: 6 });
    expect(result.groups["challenge"]).toEqual({ rolls: [7, 3] });
    expect(result.groups["challenge"]!.total).toBeUndefined();
  });

  it("produz timestamp ISO 8601", () => {
    const result = roll("2d6", { deterministic: [1, 2] });
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it("rejeita valor deterministico fora do intervalo do dado", () => {
    expect(() => roll("2d6", { deterministic: [7, 2] })).toThrow();
    expect(() => roll("2d6", { deterministic: [0, 2] })).toThrow();
  });

  it("usa rng injetado quando a fila deterministica esvazia", () => {
    const rolls = [0.0, 0.999]; // -> 1 e 6 num d6
    let i = 0;
    const result = roll("2d6", { rng: () => rolls[i++]! });
    expect(result.groups["roll"]!.rolls).toEqual([1, 6]);
  });
});

describe("pool misto (extensao multi-termo)", () => {
  it("parse: 2d6+1d4 guarda os termos em ordem com sinal", () => {
    const ast = parseNotation("2d6+1d4");
    const group = ast.groups[0]!;
    expect(group.terms).toHaveLength(2);
    expect(group.terms[0]).toMatchObject({ sign: 1, dice: { count: 2, sides: 6 } });
    expect(group.terms[1]).toMatchObject({ sign: 1, dice: { count: 1, sides: 4 } });
    // Campo legado `dice` continua sendo o primeiro termo.
    expect(group.dice).toMatchObject({ count: 2, sides: 6, hasModifier: false });
  });

  it("parse: termo numerico agrega no modificador do grupo", () => {
    const ast = parseNotation("2d6+1d4+3");
    const group = ast.groups[0]!;
    expect(group.terms).toHaveLength(2);
    expect(group.dice).toMatchObject({ modifier: 3, hasModifier: true });
  });

  it("parse: subtracao de termo de dado guarda sign -1", () => {
    const ast = parseNotation("1d20-1d4");
    expect(ast.groups[0]!.terms[1]).toMatchObject({
      sign: -1,
      dice: { count: 1, sides: 4 },
    });
  });

  it("parse: keep/drop fica preso ao termo a que esta anexado", () => {
    const ast = parseNotation("4d6kh3+1d20");
    const [first, second] = ast.groups[0]!.terms;
    expect(first!.dice.keepDrop).toEqual({ type: "kh", count: 3 });
    expect(second!.dice.keepDrop).toBeUndefined();
  });

  it("roll: concatena rolls na ordem dos termos e soma tudo no total", () => {
    const result = roll("2d6+1d4+3", { deterministic: [4, 5, 2] });
    expect(result.groups["roll"]).toEqual({
      rolls: [4, 5, 2],
      modifier: 3,
      total: 14, // 4+5+2+3
    });
  });

  it("roll: termo subtraido desconta do total", () => {
    const result = roll("1d20-1d4", { deterministic: [15, 3] });
    expect(result.groups["roll"]).toEqual({ rolls: [15, 3], total: 12 });
  });

  it("roll: keep/drop por termo nao mistura dados de termos diferentes", () => {
    // 4d6kh3 mantem os 3 maiores do PRIMEIRO termo; o d20 nao participa.
    // O descartado do termo aparece em `dropped` (pra UI mostrar o pool
    // inteiro) sem entrar no total.
    const result = roll("4d6kh3+1d20", { deterministic: [1, 6, 3, 4, 12] });
    expect(result.groups["roll"]).toEqual({
      rolls: [6, 3, 4, 12],
      dropped: [1],
      total: 25,
    });
  });

  it("roll: multi-termo sempre tem total, mesmo sem modificador", () => {
    const result = roll("2d6+1d4", { deterministic: [1, 2, 3] });
    expect(result.groups["roll"]!.total).toBe(6);
  });

  it("casos legados nao mudam: 2d6 sem operador continua sem total", () => {
    const result = roll("2d6", { deterministic: [3, 4] });
    expect(result.groups["roll"]).toEqual({ rolls: [3, 4] });
    expect(result.groups["roll"]!.total).toBeUndefined();
  });

  it("vs aceita multi-termo em cada lado", () => {
    const ast = parseNotation("{1d6+1d4} vs {2d10}");
    expect(ast.groups[0]!.terms).toHaveLength(2);
    expect(ast.groups[1]!.terms).toHaveLength(1);
  });
});
