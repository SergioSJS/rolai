import { describe, expect, it } from "vitest";
import { rollWithProfile } from "../../src/index.js";

// profiles/yze_fbl.yaml: tres pools independentes (Base/Perícia/
// Equipamento), 6 = sucesso em qualquer um. 1 so machuca em Base (dano de
// atributo) e Equipamento (dano no item), e SO em rolagem empurrada — o
// que a UI sinaliza preenchendo os inputs opcionais de "1s travados".

const inputs = (over: Record<string, number> = {}) => ({
  base: 3,
  pericia: 2,
  equipamento: 1,
  dificuldade: 1,
  sucessos_anteriores: 0,
  ...over,
});

describe("profile: yze_fbl", () => {
  it("soma os sucessos dos tres pools", async () => {
    const result = await rollWithProfile("yze_fbl", inputs({ dificuldade: 2 }), {
      deterministic: [6, 2, 3, 6, 4, 5],
    });
    expect(result.profile).toBe("yze_fbl");
    expect(result.notation).toBe("{3d6} + {2d6} + {1d6}");
    expect(result.groups["base"]!.total).toBe(1);
    expect(result.groups["pericia"]!.total).toBe(1);
    expect(result.groups["equipamento"]!.total).toBe(0);
    expect(result.outcome).toBe("success");
  });

  it("fail quando a soma nao alcanca a dificuldade", async () => {
    const result = await rollWithProfile("yze_fbl", inputs({ dificuldade: 2 }), {
      deterministic: [6, 2, 3, 4, 4, 5],
    });
    expect(result.outcome).toBe("fail");
  });

  it("rolagem NAO empurrada: 1s aparecem nos dados mas nao viram dano", async () => {
    const result = await rollWithProfile("yze_fbl", inputs(), {
      deterministic: [1, 1, 6, 1, 2, 1],
    });
    expect(result.groups["base"]!.rolls).toEqual([1, 1, 6]);
    expect(result.outcome).toBe("success");
    expect(result.outcome_flags).toEqual(["success"]);
  });

  it("empurrada: 1s da Base viram dano de atributo, 1 da Perícia nunca conta", async () => {
    const result = await rollWithProfile(
      "yze_fbl",
      inputs({ push_banes_base: 0, push_banes_equip: 0 }),
      { deterministic: [1, 1, 6, 1, 2, 4] },
    );
    expect(result.outcome).toBe("success");
    expect(result.outcome_flags).toEqual(["success", "yze_dano_atributo_x2"]);
  });

  it("empurrada: 1s travados da rolagem anterior somam nos novos", async () => {
    const result = await rollWithProfile(
      "yze_fbl",
      inputs({
        sucessos_anteriores: 1,
        push_banes_base: 2,
        push_banes_equip: 1,
      }),
      { deterministic: [1, 4, 5, 2, 3, 1] },
    );
    // Base: 1 novo + 2 travados = 3+ ; Equipamento: 1 novo + 1 travado = 2.
    expect(result.groups["base"]!.total).toBe(1); // so o sucesso travado
    expect(result.outcome).toBe("success");
    expect(result.outcome_flags).toEqual([
      "success",
      "yze_dano_atributo_x3",
      "yze_dano_equipamento_x2",
    ]);
  });

  it("pool zerado (sem pericia/equipamento) nao quebra a notacao", async () => {
    const result = await rollWithProfile(
      "yze_fbl",
      inputs({ pericia: 0, equipamento: 0 }),
      { deterministic: [6, 2, 3, 4, 5] },
    );
    expect(result.groups["pericia"]!.rolls).toEqual([]);
    expect(result.groups["equipamento"]!.rolls).toEqual([]);
    expect(result.groups["base"]!.total).toBe(1);
    expect(result.outcome).toBe("success");
  });
});
