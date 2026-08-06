import { describe, expect, it } from "vitest";
import {
  addDie,
  adjustModifier,
  clearComposer,
  DEFAULT_COMPOSER,
  EMPTY_COMPOSER,
  fromNotation,
  MAX_COMPOSER_COUNT,
  MAX_COMPOSER_MODIFIER,
  removeDie,
  removeTerm,
  toNotation,
  totalDice,
} from "../composer";

describe("toNotation", () => {
  it("monta pool simples", () => {
    expect(toNotation({ terms: [{ count: 3, sides: 6 }], modifier: 0 })).toBe("3d6");
  });

  it("monta pool misto acumulando tipos (2d6+1d4)", () => {
    expect(
      toNotation({
        terms: [
          { count: 2, sides: 6 },
          { count: 1, sides: 4 },
        ],
        modifier: 0,
      }),
    ).toBe("2d6+1d4");
  });

  it("inclui modificador positivo e negativo, omite zero", () => {
    expect(toNotation({ terms: [{ count: 1, sides: 20 }], modifier: 2 })).toBe("1d20+2");
    expect(toNotation({ terms: [{ count: 1, sides: 20 }], modifier: -1 })).toBe("1d20-1");
  });

  it("sempre gera notacao parseavel pelo engine (roundtrip)", () => {
    const state = {
      terms: [
        { count: 5, sides: 10 },
        { count: 1, sides: 4 },
      ],
      modifier: -3,
    };
    expect(fromNotation(toNotation(state))).toEqual(state);
  });
});

describe("fromNotation", () => {
  it("interpreta notacao simples", () => {
    expect(fromNotation("2d6+3")).toEqual({
      terms: [{ count: 2, sides: 6 }],
      modifier: 3,
    });
  });

  it("interpreta pool misto", () => {
    expect(fromNotation("2d6+1d4")).toEqual({
      terms: [
        { count: 2, sides: 6 },
        { count: 1, sides: 4 },
      ],
      modifier: 0,
    });
  });

  it("rejeita o que o compositor nao representa (keep/drop, reroll, vs, subtracao, lixo)", () => {
    expect(fromNotation("4d6kh3")).toBeNull();
    expect(fromNotation("2d6!r<2")).toBeNull();
    expect(fromNotation("{1d6} vs {2d10}")).toBeNull();
    expect(fromNotation("1d20-1d4")).toBeNull();
    expect(fromNotation("banana")).toBeNull();
  });
});

describe("addDie", () => {
  it("mesmo tipo incrementa o termo", () => {
    let state = DEFAULT_COMPOSER; // 1d6
    state = addDie(state, 6);
    state = addDie(state, 6);
    expect(toNotation(state)).toBe("3d6");
  });

  it("tipo diferente ACUMULA um termo novo (regressao: apagava o anterior)", () => {
    let state = addDie(DEFAULT_COMPOSER, 6); // 2d6
    state = addDie(state, 4);
    expect(toNotation(state)).toBe("2d6+1d4");
    state = addDie(state, 20);
    expect(toNotation(state)).toBe("2d6+1d4+1d20");
  });

  it("respeita o teto total de dados somando os termos", () => {
    let state = {
      terms: [
        { count: MAX_COMPOSER_COUNT - 1, sides: 6 },
        { count: 1, sides: 4 },
      ],
      modifier: 0,
    };
    expect(totalDice(state)).toBe(MAX_COMPOSER_COUNT);
    state = addDie(state, 6);
    expect(totalDice(state)).toBe(MAX_COMPOSER_COUNT);
  });
});

describe("removeDie", () => {
  it("decrementa o termo e o remove ao zerar", () => {
    let state = fromNotation("2d6+1d4")!;
    state = removeDie(state, 4);
    expect(toNotation(state)).toBe("2d6");
    state = removeDie(state, 6);
    expect(toNotation(state)).toBe("1d6");
  });

  it("zerar tudo deixa o pool vazio (notacao vazia)", () => {
    let state = fromNotation("1d6")!;
    state = removeDie(state, 6);
    expect(state.terms).toEqual([]);
    expect(toNotation(state)).toBe("");
  });

  it("ignora tipo que nao esta no pool", () => {
    const state = removeDie(fromNotation("2d6")!, 20);
    expect(toNotation(state)).toBe("2d6");
  });
});

describe("dado Fudge no compositor", () => {
  it("monta e interpreta 'dF' sem confundir com d3", () => {
    const state = addDie(EMPTY_COMPOSER, "F");
    expect(toNotation(addDie(state, "F"))).toBe("2dF");
    expect(fromNotation("4dF+2")).toEqual({
      terms: [{ count: 4, sides: 3, fudge: true }],
      modifier: 2,
    });
  });

  it("dF e d-numerico sao tipos distintos no pool", () => {
    let state = addDie(EMPTY_COMPOSER, "F");
    state = addDie(state, 6);
    expect(toNotation(state)).toBe("1dF+1d6");
    expect(toNotation(removeDie(state, "F"))).toBe("1d6");
  });
});

describe("removeTerm", () => {
  it("tira o tipo inteiro de uma vez, preservando os outros e o modificador", () => {
    const state = removeTerm(fromNotation("3d6+1d4+2")!, 6);
    expect(toNotation(state)).toBe("1d4+2");
  });
});

describe("adjustModifier / clearComposer", () => {
  it("soma e trava nos limites", () => {
    let state = DEFAULT_COMPOSER;
    state = adjustModifier(state, 1);
    state = adjustModifier(state, 1);
    expect(state.modifier).toBe(2);
    state = adjustModifier(state, -5);
    expect(state.modifier).toBe(-3);
    state = adjustModifier(state, -MAX_COMPOSER_MODIFIER * 3);
    expect(state.modifier).toBe(-MAX_COMPOSER_MODIFIER);
  });

  it("limpar esvazia o pool e o modificador", () => {
    expect(clearComposer()).toEqual({ terms: [], modifier: 0 });
    expect(toNotation(clearComposer())).toBe("");
  });
});
