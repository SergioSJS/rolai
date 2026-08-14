import { describe, expect, it } from "vitest";
import { rollWithProfile } from "../../src/index.js";

// profiles/pool_d6.yaml: acerto em 5 ou 6, exposto como `pool.total` via
// success_rule (contagem, nao soma). Glitch = mais da metade do pool em 1
// (critico se, alem disso, zero acertos). "threshold" opcional.

describe("profile: pool_d6", () => {
  it("critical_glitch: mais da metade em 1, zero acertos", async () => {
    const result = await rollWithProfile("pool_d6", { pool_size: 4 }, {
      deterministic: [1, 1, 1, 2],
    });
    expect(result.profile).toBe("pool_d6");
    expect(result.notation).toBe("4d6");
    expect(result.groups["pool"]!.rolls).toEqual([1, 1, 1, 2]);
    expect(result.groups["pool"]!.total).toBe(0);
    expect(result.outcome).toBe("critical_glitch");
    expect(result.outcome_flags).toEqual(["critical_glitch"]);
  });

  it("glitch: mais da metade em 1, mas com acerto", async () => {
    const result = await rollWithProfile("pool_d6", { pool_size: 4 }, {
      deterministic: [1, 1, 1, 6],
    });
    expect(result.groups["pool"]!.total).toBe(1);
    expect(result.outcome).toBe("glitch");
    expect(result.outcome_flags).toEqual(["glitch"]);
  });

  it("success: acertos >= limite", async () => {
    const result = await rollWithProfile("pool_d6", { pool_size: 4, threshold: 2 }, {
      deterministic: [5, 6, 2, 3],
    });
    expect(result.groups["pool"]!.total).toBe(2);
    expect(result.outcome).toBe("success");
    expect(result.outcome_flags).toEqual(["success"]);
  });

  it("fail: acertos < limite", async () => {
    const result = await rollWithProfile("pool_d6", { pool_size: 4, threshold: 2 }, {
      deterministic: [5, 2, 3, 3],
    });
    expect(result.groups["pool"]!.total).toBe(1);
    expect(result.outcome).toBe("fail");
    expect(result.outcome_flags).toEqual(["fail"]);
  });

  it("sem limite: a contagem de acertos existe (pool.total), sem success/fail", async () => {
    const result = await rollWithProfile("pool_d6", { pool_size: 3 }, {
      deterministic: [2, 3, 4],
    });
    expect(result.groups["pool"]!.rolls).toEqual([2, 3, 4]);
    expect(result.groups["pool"]!.total).toBe(0);
    expect(result.outcome).toBeUndefined();
    expect(result.outcome_flags).toBeUndefined();
  });

  it("interpola o tamanho do pool na notacao e conta os acertos certos", async () => {
    const result = await rollWithProfile("pool_d6", { pool_size: 6 }, {
      deterministic: [1, 2, 3, 4, 5, 6],
    });
    expect(result.notation).toBe("6d6");
    expect(result.groups["pool"]!.total).toBe(2);
  });
});
