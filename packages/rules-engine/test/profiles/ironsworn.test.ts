import { describe, expect, it } from "vitest";
import { rollWithProfile } from "../../src/index.js";

// Um caso por outcome_rule de profiles/ironsworn.yaml, incluindo o caso de
// borda "match" — evento independente do hit/miss que deve aparecer em
// outcome_flags junto do outcome principal.

describe("profile: ironsworn", () => {
  it("strong_hit: action total maior que os dois challenge", async () => {
    const result = await rollWithProfile("ironsworn", { attribute: 3 }, {
      deterministic: [6, 3, 4], // action d6=6 (+3 = 9), challenge 3 e 4
    });
    expect(result.profile).toBe("ironsworn");
    expect(result.notation).toBe("{1d6+3} vs {2d10}");
    expect(result.groups["action"]).toEqual({ rolls: [6], modifier: 3, total: 9 });
    expect(result.groups["challenge"]).toEqual({ rolls: [3, 4] });
    expect(result.outcome).toBe("strong_hit");
    expect(result.outcome_flags).toEqual(["strong_hit"]);
  });

  it("weak_hit: action total maior que exatamente um challenge", async () => {
    const result = await rollWithProfile("ironsworn", { attribute: 2 }, {
      deterministic: [3, 2, 8], // action 3+2=5, challenge 2 e 8
    });
    expect(result.outcome).toBe("weak_hit");
    expect(result.outcome_flags).toEqual(["weak_hit"]);
  });

  it("miss: action total menor ou igual aos dois challenge", async () => {
    const result = await rollWithProfile("ironsworn", { attribute: 1 }, {
      deterministic: [2, 5, 9], // action 2+1=3, challenge 5 e 9
    });
    expect(result.outcome).toBe("miss");
    expect(result.outcome_flags).toEqual(["miss"]);
  });

  it("match: challenge iguais aparece em outcome_flags junto do hit/miss", async () => {
    const result = await rollWithProfile("ironsworn", { attribute: 3 }, {
      deterministic: [6, 5, 5], // action 9, challenge 5 e 5 -> strong_hit + match
    });
    expect(result.outcome).toBe("strong_hit");
    expect(result.outcome_flags).toEqual(["strong_hit", "match"]);
  });

  it("match tambem ocorre num miss", async () => {
    const result = await rollWithProfile("ironsworn", { attribute: 1 }, {
      deterministic: [1, 7, 7], // action 2, challenge 7 e 7 -> miss + match
    });
    expect(result.outcome).toBe("miss");
    expect(result.outcome_flags).toEqual(["miss", "match"]);
  });

  it("challenge mantem array separado, sem total agregado pela gramatica", async () => {
    const result = await rollWithProfile("ironsworn", { attribute: 2 }, {
      deterministic: [4, 1, 10],
    });
    expect(result.groups["challenge"]!.rolls).toEqual([1, 10]);
    // compare_individually: true -> sem total
    expect(result.groups["challenge"]!.total).toBeUndefined();
  });

  it("exige o input declarado", async () => {
    await expect(rollWithProfile("ironsworn", {})).rejects.toThrow("attribute");
  });
});
