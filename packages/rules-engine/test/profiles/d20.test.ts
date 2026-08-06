import { describe, expect, it } from "vitest";
import { rollWithProfile } from "../../src/index.js";

// profiles/d20.yaml — inclui o input "select" (vantagem/desvantagem), que
// interpola o acucar adv/dis direto na notacao.

describe("profile: d20", () => {
  it("success: total >= CD", async () => {
    const result = await rollWithProfile(
      "d20",
      { mode: "", mod: 3, dc: 15 },
      { deterministic: [14] },
    );
    expect(result.notation).toBe("1d20+3");
    expect(result.groups["roll"]!.total).toBe(17);
    expect(result.outcome).toBe("success");
    expect(result.outcome_flags).toEqual(["success"]);
  });

  it("fail: total < CD", async () => {
    const result = await rollWithProfile(
      "d20",
      { mode: "", mod: 0, dc: 15 },
      { deterministic: [7] },
    );
    expect(result.outcome).toBe("fail");
  });

  it("critical_success / critical_failure pelo dado natural", async () => {
    const crit = await rollWithProfile(
      "d20",
      { mode: "", mod: -5, dc: 30 },
      { deterministic: [20] },
    );
    expect(crit.outcome).toBe("critical_success");
    expect(crit.outcome_flags).toEqual(["critical_success"]);

    const fumble = await rollWithProfile(
      "d20",
      { mode: "", mod: 20, dc: 5 },
      { deterministic: [1] },
    );
    expect(fumble.outcome).toBe("critical_failure");
    expect(fumble.outcome_flags).toEqual(["critical_failure"]);
  });

  it("vantagem vira 2d20kh1 e mantem so o dado alto", async () => {
    const result = await rollWithProfile(
      "d20",
      { mode: "adv", mod: 0, dc: 10 },
      { deterministic: [4, 18] },
    );
    expect(result.notation).toBe("1d20adv+0");
    expect(result.groups["roll"]!.rolls).toEqual([18]);
    expect(result.outcome).toBe("success");
  });

  it("desvantagem mantem o dado baixo", async () => {
    const result = await rollWithProfile(
      "d20",
      { mode: "dis", mod: 0, dc: 10 },
      { deterministic: [4, 18] },
    );
    expect(result.groups["roll"]!.rolls).toEqual([4]);
    expect(result.outcome).toBe("fail");
  });

  it("rejeita valor fora das options do select", async () => {
    await expect(
      rollWithProfile("d20", { mode: "kh1", mod: 0, dc: 10 }, {}),
    ).rejects.toThrow(/valor invalido/);
  });
});
