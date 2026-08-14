import { describe, expect, it } from "vitest";
import { rollOverlay, rollWithProfile } from "../../src/index.js";

// profiles/roll_under.yaml: roll_type "overlay" — sem dado proprio, aplica
// "<= target" em cima de QUALQUER notacao que o composer livre montar
// (1d20, 3d6, ...). success (total <= target), fail (total > target), e
// o caso sem "target" (opcional) — so rola, sem outcome.

describe("profile: roll_under", () => {
  it("success: total <= target", async () => {
    const result = await rollOverlay("roll_under", "1d20", { target: 10 }, {
      deterministic: [10],
    });
    expect(result.profile).toBe("roll_under");
    expect(result.notation).toBe("1d20");
    expect(result.groups["roll"]).toEqual({ rolls: [10], total: 10 });
    expect(result.outcome).toBe("success");
    expect(result.outcome_flags).toEqual(["success"]);
  });

  it("fail: total > target", async () => {
    const result = await rollOverlay("roll_under", "1d20", { target: 10 }, {
      deterministic: [11],
    });
    expect(result.outcome).toBe("fail");
    expect(result.outcome_flags).toEqual(["fail"]);
  });

  it("borda exata: total == target e success", async () => {
    const result = await rollOverlay("roll_under", "1d6", { target: 3 }, {
      deterministic: [3],
    });
    expect(result.outcome).toBe("success");
  });

  it("sem target: so rola, sem outcome", async () => {
    const result = await rollOverlay("roll_under", "1d20", {}, {
      deterministic: [15],
    });
    expect(result.notation).toBe("1d20");
    expect(result.groups["roll"]).toEqual({ rolls: [15], total: 15 });
    expect(result.outcome).toBeUndefined();
    expect(result.outcome_flags).toBeUndefined();
  });

  it("qualquer pool que o composer montar funciona (3d6, pool misto)", async () => {
    const result = await rollOverlay("roll_under", "3d6", { target: 10 }, {
      deterministic: [3, 3, 4],
    });
    expect(result.notation).toBe("3d6");
    expect(result.groups["roll"]!.total).toBe(10);
    expect(result.outcome).toBe("success");
  });

  it("rollWithProfile rejeita roll_type overlay", async () => {
    await expect(rollWithProfile("roll_under", { target: 10 })).rejects.toThrow(
      /roll_type "overlay"/,
    );
  });
});
