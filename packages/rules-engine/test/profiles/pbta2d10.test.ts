import { describe, expect, it } from "vitest";
import { rollWithProfile } from "../../src/index.js";

// profiles/pbta2d10.yaml: strong_hit (>=15), weak_hit (10-14), miss (<=9).

describe("profile: pbta2d10", () => {
  it("strong_hit: total >= 15", async () => {
    const result = await rollWithProfile("pbta2d10", { mod: 1 }, {
      deterministic: [8, 7], // 8+7+1 = 16
    });
    expect(result.profile).toBe("pbta2d10");
    expect(result.notation).toBe("2d10+1");
    expect(result.groups["roll"]).toEqual({ rolls: [8, 7], modifier: 1, total: 16 });
    expect(result.outcome).toBe("strong_hit");
    expect(result.outcome_flags).toEqual(["strong_hit"]);
  });

  it("weak_hit: total >= 10 (borda exata)", async () => {
    const result = await rollWithProfile("pbta2d10", { mod: 0 }, {
      deterministic: [6, 4], // 10
    });
    expect(result.outcome).toBe("weak_hit");
    expect(result.outcome_flags).toEqual(["weak_hit"]);
  });

  it("weak_hit: borda superior (14)", async () => {
    const result = await rollWithProfile("pbta2d10", { mod: 0 }, {
      deterministic: [7, 7], // 14
    });
    expect(result.outcome).toBe("weak_hit");
  });

  it("miss: total < 10", async () => {
    const result = await rollWithProfile("pbta2d10", { mod: -1 }, {
      deterministic: [5, 4], // 8
    });
    expect(result.outcome).toBe("miss");
    expect(result.outcome_flags).toEqual(["miss"]);
  });
});
