import { describe, expect, it } from "vitest";
import { rollWithProfile } from "../../src/index.js";

// Um caso por outcome_rule de profiles/fate.yaml. Os valores deterministicos
// do dado Fudge sao as proprias faces (-1, 0, +1).

describe("profile: fate", () => {
  it("success_with_style: 3 ou mais acima da dificuldade", async () => {
    const result = await rollWithProfile(
      "fate",
      { skill: 3, difficulty: 2 },
      { deterministic: [1, 1, 1, -1] },
    );
    expect(result.profile).toBe("fate");
    expect(result.notation).toBe("4dF+3");
    expect(result.groups["roll"]!.rolls).toEqual([1, 1, 1, -1]);
    expect(result.groups["roll"]!.total).toBe(5); // 2 + 3
    expect(result.outcome).toBe("success_with_style");
    expect(result.outcome_flags).toEqual(["success_with_style"]);
  });

  it("success: acima da dificuldade, menos de 3 de margem", async () => {
    const result = await rollWithProfile(
      "fate",
      { skill: 2, difficulty: 2 },
      { deterministic: [1, 0, 0, -1] },
    );
    expect(result.groups["roll"]!.total).toBe(2 + 0);
    expect(result.outcome).toBe("tie");

    const win = await rollWithProfile(
      "fate",
      { skill: 2, difficulty: 2 },
      { deterministic: [1, 1, 0, -1] },
    );
    expect(win.groups["roll"]!.total).toBe(3);
    expect(win.outcome).toBe("success");
    expect(win.outcome_flags).toEqual(["success"]);
  });

  it("fail: abaixo da dificuldade", async () => {
    const result = await rollWithProfile(
      "fate",
      { skill: 1, difficulty: 3 },
      { deterministic: [-1, -1, 0, 1] },
    );
    expect(result.groups["roll"]!.total).toBe(0);
    expect(result.outcome).toBe("fail");
    expect(result.outcome_flags).toEqual(["fail"]);
  });

  it("modificador negativo entra na notacao", async () => {
    const result = await rollWithProfile(
      "fate",
      { skill: -1, difficulty: 0 },
      { deterministic: [0, 0, 0, 0] },
    );
    expect(result.notation).toBe("4dF-1");
    expect(result.groups["roll"]!.total).toBe(-1);
  });
});
