import { describe, expect, it } from "vitest";
import { rollWithProfile } from "../../src/index.js";

describe("profile: trophy_dark", () => {
  it("6 geral da sucesso completo (full success)", async () => {
    const result = await rollWithProfile(
      "trophy_dark",
      { claros: 2, escuros: 1, ruina: 3 },
      { deterministic: [6, 2, 3] },
    );
    expect(result.notation).toBe("{2d6} + {1d6}");
    expect(result.groups["claros"]?.rolls).toEqual([6, 2]);
    expect(result.groups["claros"]?.slot).toBe(1);
    expect(result.groups["escuros"]?.rolls).toEqual([3]);
    expect(result.groups["escuros"]?.slot).toBe(2);
    expect(result.outcome).toBe("success");
    expect(result.outcome_flags).toEqual(["success"]);
  });

  it("4 ou 5 geral da sucesso parcial (weak hit)", async () => {
    const result = await rollWithProfile(
      "trophy_dark",
      { claros: 1, escuros: 1, ruina: 4 },
      { deterministic: [5, 2] },
    );
    expect(result.outcome).toBe("weak_hit");
    expect(result.outcome_flags).toEqual(["weak_hit"]);
  });

  it("1 a 3 geral da falha (miss)", async () => {
    const result = await rollWithProfile(
      "trophy_dark",
      { claros: 1, escuros: 1, ruina: 2 },
      { deterministic: [3, 1] },
    );
    expect(result.outcome).toBe("miss");
    expect(result.outcome_flags).toEqual(["miss"]);
  });

  it("dado escuro maior ou igual a Ruina e sendo o maior dispara aumento de ruina", async () => {
    const result = await rollWithProfile(
      "trophy_dark",
      { claros: 2, escuros: 1, ruina: 3 },
      { deterministic: [2, 1, 4] },
    );
    expect(result.outcome).toBe("weak_hit");
    expect(result.outcome_flags).toEqual(["weak_hit", "trophy_ruina_aumenta"]);
  });

  it("dado escuro que empata no topo com dado claro e bate a Ruina aumenta Ruina", async () => {
    const result = await rollWithProfile(
      "trophy_dark",
      { claros: 1, escuros: 1, ruina: 5 },
      { deterministic: [6, 6] },
    );
    expect(result.outcome).toBe("success");
    expect(result.outcome_flags).toEqual(["success", "trophy_ruina_aumenta"]);
  });

  it("dado escuro alto mas MENOR que a Ruina atual nao aumenta Ruina", async () => {
    const result = await rollWithProfile(
      "trophy_dark",
      { claros: 1, escuros: 1, ruina: 5 },
      { deterministic: [2, 4] },
    );
    expect(result.outcome).toBe("weak_hit");
    expect(result.outcome_flags).toEqual(["weak_hit"]);
  });

  it("rolagem so de dados escuros (ex: teste de Ruina) avalia corretamente", async () => {
    const result = await rollWithProfile(
      "trophy_dark",
      { claros: 0, escuros: 1, ruina: 3 },
      { deterministic: [5] },
    );
    expect(result.outcome).toBe("weak_hit");
    expect(result.outcome_flags).toEqual(["weak_hit", "trophy_ruina_aumenta"]);
  });
});

describe("profile: trophy_gold", () => {
  it("funciona identico com tema e outcomes corretos", async () => {
    const result = await rollWithProfile(
      "trophy_gold",
      { claros: 2, escuros: 2, ruina: 2 },
      { deterministic: [6, 3, 5, 2] },
    );
    expect(result.groups["claros"]?.slot).toBe(1);
    expect(result.groups["escuros"]?.slot).toBe(2);
    expect(result.outcome).toBe("success");
    expect(result.outcome_flags).toEqual(["success"]);
  });
});
