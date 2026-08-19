import { describe, expect, it } from "vitest";
import { rollWithProfile } from "../../src/index.js";

// profiles/yze_alien.yaml e profiles/yze_wdu.yaml: mesma estrutura (pool
// base + Estresse), 6 = sucesso nos dois pools. O 1 no Estresse dispara o
// evento da linha — Panico no Alien, Descontrole no Walking Dead — em
// QUALQUER rolagem, nao so na empurrada (ao contrario do bane do FBL).

const inputs = (over: Record<string, number> = {}) => ({
  base: 3,
  estresse: 2,
  dificuldade: 1,
  sucessos_anteriores: 0,
  ...over,
});

describe("profile: yze_alien", () => {
  it("6 conta como sucesso nos dois pools", async () => {
    const result = await rollWithProfile("yze_alien", inputs({ dificuldade: 2 }), {
      deterministic: [6, 3, 2, 6, 4],
    });
    expect(result.notation).toBe("{3d6} + {2d6}");
    expect(result.groups["base"]!.total).toBe(1);
    expect(result.groups["estresse"]!.total).toBe(1);
    expect(result.outcome).toBe("success");
    expect(result.outcome_flags).toEqual(["success"]);
  });

  it("fail quando a soma nao alcanca a dificuldade", async () => {
    const result = await rollWithProfile("yze_alien", inputs({ dificuldade: 2 }), {
      deterministic: [6, 3, 2, 5, 4],
    });
    expect(result.outcome).toBe("fail");
  });

  it("1 no Estresse dispara panico junto com o sucesso", async () => {
    const result = await rollWithProfile("yze_alien", inputs(), {
      deterministic: [6, 3, 2, 1, 4],
    });
    expect(result.outcome).toBe("success");
    expect(result.outcome_flags).toEqual(["success", "yze_panico"]);
  });

  it("1 na Base nao e panico — o bane so existe no Estresse", async () => {
    const result = await rollWithProfile("yze_alien", inputs(), {
      deterministic: [1, 1, 6, 4, 4],
    });
    expect(result.outcome_flags).toEqual(["success"]);
  });

  it("panico vale mesmo em rolagem que nao foi empurrada e que falhou", async () => {
    const result = await rollWithProfile("yze_alien", inputs(), {
      deterministic: [2, 3, 4, 1, 5],
    });
    expect(result.outcome).toBe("fail");
    expect(result.outcome_flags).toEqual(["fail", "yze_panico"]);
  });

  it("push: sucessos travados entram na contagem da Base", async () => {
    const result = await rollWithProfile(
      "yze_alien",
      inputs({ base: 2, estresse: 3, dificuldade: 3, sucessos_anteriores: 2 }),
      { deterministic: [4, 5, 6, 2, 3] },
    );
    expect(result.groups["base"]!.total).toBe(2);
    expect(result.groups["estresse"]!.total).toBe(1);
    expect(result.outcome).toBe("success");
  });

  it("estresse 0 (estado inicial) nao quebra a notacao", async () => {
    const result = await rollWithProfile("yze_alien", inputs({ estresse: 0 }), {
      deterministic: [6, 2, 3, 4],
    });
    expect(result.groups["estresse"]!.rolls).toEqual([]);
    expect(result.outcome).toBe("success");
    expect(result.outcome_flags).toEqual(["success"]);
  });
});

describe("profile: yze_wdu", () => {
  it("mesmo pool do Alien, mas o 1 no Estresse e descontrole", async () => {
    const result = await rollWithProfile("yze_wdu", inputs(), {
      deterministic: [6, 3, 2, 1, 4],
    });
    expect(result.profile).toBe("yze_wdu");
    expect(result.outcome).toBe("success");
    expect(result.outcome_flags).toEqual(["success", "yze_descontrole"]);
  });

  it("sem 1 no Estresse nao ha descontrole", async () => {
    const result = await rollWithProfile("yze_wdu", inputs({ dificuldade: 2 }), {
      deterministic: [6, 3, 2, 6, 4],
    });
    expect(result.outcome).toBe("success");
    expect(result.outcome_flags).toEqual(["success"]);
  });
});
