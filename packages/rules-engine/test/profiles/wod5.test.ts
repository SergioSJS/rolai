import { describe, expect, it } from "vitest";
import { rollWithProfile } from "../../src/index.js";

// profiles/wod5.yaml: pool regular + Fome/Ira, ambos d10 (roll_type "multi").
// 6-9/10 = sucesso; par de 10s (regular+fome) = critico (limpo sem 10 na
// fome, messy com); zero sucessos + 1 na fome = bestial; "difficulty" e
// opcional (success/fail so aparecem quando informada).

describe("profile: wod5", () => {
  it("critico limpo: par de 10 sem nenhum na fome", async () => {
    const result = await rollWithProfile(
      "wod5",
      { regular: 3, hunger: 2 },
      { deterministic: [10, 10, 2, 3, 4] },
    );
    expect(result.profile).toBe("wod5");
    expect(result.notation).toBe("{3d10} + {2d10}");
    expect(result.groups["regular"]!.rolls).toEqual([10, 10, 2]);
    expect(result.groups["regular"]!.total).toBe(2);
    expect(result.groups["hunger"]!.rolls).toEqual([3, 4]);
    expect(result.groups["hunger"]!.total).toBe(0);
    expect(result.outcome).toBe("critical");
    expect(result.outcome_flags).toEqual(["critical"]);
  });

  it("critico messy: par de 10 com um deles na fome", async () => {
    const result = await rollWithProfile(
      "wod5",
      { regular: 3, hunger: 2 },
      { deterministic: [10, 2, 3, 10, 1] },
    );
    expect(result.groups["regular"]!.total).toBe(1);
    expect(result.groups["hunger"]!.total).toBe(1);
    expect(result.outcome).toBe("messy_critical");
    expect(result.outcome_flags).toEqual(["messy_critical"]);
  });

  it("critico dobra sucessos dos 10s para bater dificuldade 4", async () => {
    // 2 dez = 4 sucessos (2 base + 2 bonus de par de 10) -> bate dificuldade 4
    const result = await rollWithProfile(
      "wod5",
      { regular: 2, hunger: 1, difficulty: 4 },
      { deterministic: [10, 10, 2] },
    );
    expect(result.outcome).toBe("critical");
    expect(result.outcome_flags).toEqual(["critical", "success"]);
  });

  it("fracasso bestial: zero sucessos com 1 na fome", async () => {
    const result = await rollWithProfile(
      "wod5",
      { regular: 3, hunger: 2 },
      { deterministic: [2, 3, 4, 1, 4] },
    );
    expect(result.outcome).toBe("bestial_failure");
    expect(result.outcome_flags).toEqual(["bestial_failure"]);
  });

  it("fracasso comum (com dificuldade): zero sucessos, sem 1 na fome", async () => {
    const result = await rollWithProfile(
      "wod5",
      { regular: 2, hunger: 2, difficulty: 1 },
      { deterministic: [2, 3, 4, 2] },
    );
    expect(result.outcome).toBe("fail");
    expect(result.outcome_flags).toEqual(["fail"]);
  });

  it("sucesso vs dificuldade", async () => {
    const result = await rollWithProfile(
      "wod5",
      { regular: 2, hunger: 1, difficulty: 2 },
      { deterministic: [6, 7, 3] },
    );
    expect(result.outcome).toBe("success");
    expect(result.outcome_flags).toEqual(["success"]);
  });

  it("falha por nao bater a dificuldade (com sucesso parcial)", async () => {
    const result = await rollWithProfile(
      "wod5",
      { regular: 2, hunger: 2, difficulty: 3 },
      { deterministic: [6, 2, 3, 3] },
    );
    expect(result.outcome).toBe("fail");
  });

  it("sem dificuldade: so rola, sem success/fail (eventos intrinsecos continuam ativos)", async () => {
    const result = await rollWithProfile(
      "wod5",
      { regular: 2, hunger: 2 },
      { deterministic: [2, 3, 4, 2] },
    );
    expect(result.outcome).toBeUndefined();
    expect(result.outcome_flags).toBeUndefined();
  });
});
