import { describe, expect, it } from "vitest";
import { rollWithProfile } from "../../src/index.js";

// profiles/yze.yaml: pool de d6, 6 = sucesso (success_rule), sem bane.
// "sucessos_anteriores" e o push: entra como modificador da CONTAGEM, nao
// como dado a mais.

describe("profile: yze (generico)", () => {
  it("conta os 6 e compara com a dificuldade", async () => {
    const result = await rollWithProfile(
      "yze",
      { pool_size: 5, dificuldade: 1, sucessos_anteriores: 0 },
      { deterministic: [6, 3, 1, 4, 2] },
    );
    expect(result.profile).toBe("yze");
    expect(result.notation).toBe("5d6");
    expect(result.groups["pool"]!.rolls).toEqual([6, 3, 1, 4, 2]);
    expect(result.groups["pool"]!.total).toBe(1);
    expect(result.outcome).toBe("success");
  });

  it("fail quando os 6 nao chegam na dificuldade", async () => {
    const result = await rollWithProfile(
      "yze",
      { pool_size: 4, dificuldade: 2, sucessos_anteriores: 0 },
      { deterministic: [6, 5, 4, 1] },
    );
    expect(result.groups["pool"]!.total).toBe(1);
    expect(result.outcome).toBe("fail");
  });

  it("push: sucessos travados somam na CONTAGEM, nao nos valores", async () => {
    const result = await rollWithProfile(
      "yze",
      { pool_size: 3, dificuldade: 3, sucessos_anteriores: 2 },
      { deterministic: [6, 4, 3] },
    );
    // 1 seis novo + 2 travados = 3 sucessos (nao 6+4+3+2).
    expect(result.groups["pool"]!.total).toBe(3);
    expect(result.groups["pool"]!.modifier).toBe(2);
    expect(result.outcome).toBe("success");
  });

  it("push sem dado sobrando: pool 0 nao quebra a notacao e mantem os travados", async () => {
    const result = await rollWithProfile(
      "yze",
      { pool_size: 0, dificuldade: 1, sucessos_anteriores: 2 },
      { deterministic: [4] },
    );
    expect(result.groups["pool"]!.rolls).toEqual([]);
    expect(result.groups["pool"]!.total).toBe(2);
    expect(result.outcome).toBe("success");
  });

  it("sem dificuldade: so a contagem, sem success/fail", async () => {
    const result = await rollWithProfile(
      "yze",
      { pool_size: 3, sucessos_anteriores: 0 },
      { deterministic: [6, 6, 2] },
    );
    expect(result.groups["pool"]!.total).toBe(2);
    expect(result.outcome).toBeUndefined();
    expect(result.outcome_flags).toBeUndefined();
  });
});
