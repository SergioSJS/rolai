import { describe, expect, it } from "vitest";
import { NotationError, parseNotation, roll } from "../src/index.js";

// Dado Fudge/Fate ("4dF"): tres faces valendo -1, 0 e +1. No AST vira
// sides: 3 + fudge: true; o mapeamento pro intervalo e do roller.

describe("notacao: dado Fudge", () => {
  it("parseia dF com sides 3 e flag fudge", () => {
    const ast = parseNotation("4dF");
    const spec = ast.groups[0]!.dice;
    expect(spec.count).toBe(4);
    expect(spec.sides).toBe(3);
    expect(spec.fudge).toBe(true);
  });

  it("aceita minusculo e modificador", () => {
    const spec = parseNotation("4df+2").groups[0]!.dice;
    expect(spec.fudge).toBe(true);
    expect(spec.modifier).toBe(2);
  });

  it("rola so valores -1, 0 e 1", () => {
    for (let i = 0; i < 50; i++) {
      for (const value of roll("4dF").groups["roll"]!.rolls) {
        expect([-1, 0, 1]).toContain(value);
      }
    }
  });

  it("soma o total com modificador", () => {
    const result = roll("4dF+3", { deterministic: [1, 1, 0, -1] });
    expect(result.groups["roll"]!.rolls).toEqual([1, 1, 0, -1]);
    expect(result.groups["roll"]!.total).toBe(4);
  });

  it("valor deterministico fora de [-1, 1] e erro", () => {
    expect(() => roll("4dF", { deterministic: [3, 0, 0, 0] })).toThrow(
      /\[-1, 1\]/,
    );
  });

  it("keep/drop funciona; reroll nao se aplica", () => {
    const kept = roll("4dFkh2", { deterministic: [1, -1, 0, 1] });
    expect(kept.groups["roll"]!.rolls).toEqual([1, 1]);
    expect(() => parseNotation("4dF!r<2")).toThrow(NotationError);
  });

  it("mistura com outros dados no mesmo pool", () => {
    const result = roll("4dF+1d6", { deterministic: [1, 0, 0, 1, 4] });
    expect(result.groups["roll"]!.rolls).toEqual([1, 0, 0, 1, 4]);
    expect(result.groups["roll"]!.total).toBe(6);
  });
});
