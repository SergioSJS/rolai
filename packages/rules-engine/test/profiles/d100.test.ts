import { describe, expect, it } from "vitest";
import { rollWithProfile } from "../../src/index.js";

// profiles/d100.yaml — rolagem por baixo com tiers derivados da pericia
// (extremo = 1/5, dificil = 1/2). Cada caso cobre uma outcome_rule.

describe("profile: d100", () => {
  it("critical: 1", async () => {
    const result = await rollWithProfile("d100", { skill: 60 }, {
      deterministic: [1],
    });
    expect(result.notation).toBe("1d100");
    expect(result.outcome).toBe("critical");
    expect(result.outcome_flags).toEqual(["critical"]);
  });

  it("extreme / hard / regular seguem as fracoes da pericia", async () => {
    const extreme = await rollWithProfile("d100", { skill: 60 }, {
      deterministic: [12],
    });
    expect(extreme.outcome).toBe("extreme_success");

    const hard = await rollWithProfile("d100", { skill: 60 }, {
      deterministic: [30],
    });
    expect(hard.outcome).toBe("hard_success");

    const regular = await rollWithProfile("d100", { skill: 60 }, {
      deterministic: [55],
    });
    expect(regular.outcome).toBe("regular_success");
    expect(regular.outcome_flags).toEqual(["regular_success"]);
  });

  it("arredonda pra baixo como o livro (pericia 55 -> dificil ate 27)", async () => {
    const hard = await rollWithProfile("d100", { skill: 55 }, {
      deterministic: [27],
    });
    expect(hard.outcome).toBe("hard_success");

    const regular = await rollWithProfile("d100", { skill: 55 }, {
      deterministic: [28],
    });
    expect(regular.outcome).toBe("regular_success");
  });

  it("fail acima da pericia", async () => {
    const result = await rollWithProfile("d100", { skill: 60 }, {
      deterministic: [61],
    });
    expect(result.outcome).toBe("fail");
    expect(result.outcome_flags).toEqual(["fail"]);
  });

  it("fumble: 100 sempre; 96-99 so com pericia < 50", async () => {
    const hundred = await rollWithProfile("d100", { skill: 90 }, {
      deterministic: [100],
    });
    expect(hundred.outcome).toBe("fumble");
    expect(hundred.outcome_flags).toEqual(["fumble"]);

    const lowSkill = await rollWithProfile("d100", { skill: 30 }, {
      deterministic: [97],
    });
    expect(lowSkill.outcome).toBe("fumble");
    expect(lowSkill.outcome_flags).toEqual(["fumble"]);

    const highSkill = await rollWithProfile("d100", { skill: 70 }, {
      deterministic: [97],
    });
    expect(highSkill.outcome).toBe("fail");
    expect(highSkill.outcome_flags).toEqual(["fail"]);
  });
});
