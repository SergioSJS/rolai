import { describe, expect, it } from "vitest";
import {
  ExpressionError,
  evaluateExpression,
} from "../src/index.js";

const scope = {
  action: { rolls: [5], total: 7, modifier: 2 },
  challenge: { rolls: [3, 8] },
  pool: { rolls: [6, 6, 2, 3] },
};

describe("evaluateExpression", () => {
  it("aritmetica com precedencia", () => {
    expect(evaluateExpression("1 + 2 * 3 == 7", {})).toBe(true);
    expect(evaluateExpression("(1 + 2) * 3 == 9", {})).toBe(true);
    expect(evaluateExpression("10 / 4 == 2.5", {})).toBe(true);
    expect(evaluateExpression("-2 + 5 == 3", {})).toBe(true);
  });

  it("acesso a campo, membro e indice", () => {
    expect(evaluateExpression("action.total == 7", scope)).toBe(true);
    expect(evaluateExpression("action.modifier == 2", scope)).toBe(true);
    expect(evaluateExpression("challenge[1] == 8", scope)).toBe(true);
    expect(evaluateExpression("challenge[0] == 3", scope)).toBe(true);
  });

  it("and / or / xor / not com precedencia correta", () => {
    expect(evaluateExpression("action.total > 6 and challenge[0] == 3", scope)).toBe(true);
    expect(evaluateExpression("action.total > 6 and challenge[0] == 4", scope)).toBe(false);
    expect(evaluateExpression("action.total > 10 or challenge[0] == 3", scope)).toBe(true);
    // xor: exatamente um lado verdadeiro
    expect(evaluateExpression("action.total > 6 xor challenge[0] == 4", scope)).toBe(true);
    expect(evaluateExpression("action.total > 6 xor challenge[0] == 3", scope)).toBe(false);
    // not liga mais forte que and: "not a and b" == "(not a) and b"
    expect(evaluateExpression("not action.total > 10 and challenge[0] == 3", scope)).toBe(true);
    expect(evaluateExpression("not (action.total > 6 and challenge[0] == 3)", scope)).toBe(false);
  });

  it("count com condicao string", () => {
    expect(evaluateExpression("count(pool, '>=6') == 2", scope)).toBe(true);
    expect(evaluateExpression("count(pool, '<3') == 1", scope)).toBe(true);
  });

  it("max e min", () => {
    expect(evaluateExpression("max(pool) == 6", scope)).toBe(true);
    expect(evaluateExpression("min(pool) == 2", scope)).toBe(true);
  });

  it("rejeita campo/membro/indice desconhecido", () => {
    expect(() => evaluateExpression("nope.total > 1", scope)).toThrow(ExpressionError);
    expect(() => evaluateExpression("action.nope > 1", scope)).toThrow(ExpressionError);
    expect(() => evaluateExpression("challenge[5] > 1", scope)).toThrow(ExpressionError);
    expect(() => evaluateExpression("challenge.total > 1", scope)).toThrow(ExpressionError);
  });

  it("rejeita qualquer funcao fora de count/max/min (sem eval)", () => {
    expect(() => evaluateExpression("globalThis()", scope)).toThrow(ExpressionError);
    expect(() => evaluateExpression("eval('1')", scope)).toThrow(ExpressionError);
    expect(() => evaluateExpression("constructor.constructor('return 1')()", scope)).toThrow(
      ExpressionError,
    );
  });

  it("rejeita sintaxe invalida", () => {
    expect(() => evaluateExpression("action.total >", scope)).toThrow(ExpressionError);
    expect(() => evaluateExpression("1 = = 2", scope)).toThrow(ExpressionError);
    expect(() => evaluateExpression("count(pool, 'abc') > 1", scope)).toThrow(ExpressionError);
  });
});
