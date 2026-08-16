import { describe, expect, it } from "vitest";
import { rollWithProfile } from "../../src/index.js";

describe("profile: firelights", () => {
  it("strong_hit: action total (2d6 + mod) maior que as duas cartas de desafio (2c)", async () => {
    const result = await rollWithProfile("firelights", { modifier: 2 }, {
      deterministic: [4, 5, 3, 7], // action 2d6=[4, 5] (+2 = 11), challenge 2c=[3, 7]
    });
    expect(result.profile).toBe("firelights");
    expect(result.notation).toBe("{2d6+2} vs {2c}");
    expect(result.groups["action"]).toEqual({ rolls: [4, 5], modifier: 2, total: 11 });
    expect(result.groups["challenge"]).toEqual({ rolls: [3, 7] });
    expect(result.outcome).toBe("strong_hit");
    expect(result.outcome_flags).toEqual(["strong_hit"]);
  });

  it("weak_hit: action total maior que exatamente uma carta de desafio", async () => {
    const result = await rollWithProfile("firelights", { modifier: 1 }, {
      deterministic: [2, 3, 4, 8], // action 2+3+1=6, challenge 2c=[4, 8] -> bate 4, perde pra 8
    });
    expect(result.outcome).toBe("weak_hit");
    expect(result.outcome_flags).toEqual(["weak_hit"]);
  });

  it("miss: action total menor ou igual as duas cartas de desafio", async () => {
    const result = await rollWithProfile("firelights", { modifier: 0 }, {
      deterministic: [1, 2, 5, 6], // action 1+2=3, challenge 2c=[5, 6]
    });
    expect(result.outcome).toBe("miss");
    expect(result.outcome_flags).toEqual(["miss"]);
  });

  it("match: cartas iguais aparece em outcome_flags junto do hit/miss", async () => {
    const result = await rollWithProfile("firelights", { modifier: 2 }, {
      deterministic: [5, 5, 8, 8], // action 5+5+2=12, challenge 2c=[8, 8] -> strong_hit + match
    });
    expect(result.outcome).toBe("strong_hit");
    expect(result.outcome_flags).toEqual(["strong_hit", "match"]);
  });

  it("match tambem ocorre num miss", async () => {
    const result = await rollWithProfile("firelights", { modifier: 0 }, {
      deterministic: [1, 2, 6, 6], // action 3, challenge 2c=[6, 6] -> miss + match
    });
    expect(result.outcome).toBe("miss");
    expect(result.outcome_flags).toEqual(["miss", "match"]);
  });

  it("suporta cartas de figuras (Valete=11, Dama=12, Rei=13, As=1)", async () => {
    const result = await rollWithProfile("firelights", { modifier: 3 }, {
      deterministic: [6, 6, 11, 13], // action 6+6+3=15, challenge 2c=[11 (J), 13 (K)] -> vence ambos
    });
    expect(result.outcome).toBe("strong_hit");
    expect(result.groups["challenge"]?.rolls).toEqual([11, 13]);
  });

  it("exige o input declarado", async () => {
    await expect(rollWithProfile("firelights", {})).rejects.toThrow("modifier");
  });
});
