import { describe, expect, it } from "vitest";
import type { RollResult } from "@rolai/rules-engine";
import { isYzeSystem, planYzePush } from "../yzePush";

function result(
  profile: string,
  groups: Record<
    string,
    { rolls: number[]; dropped?: number[]; modifier?: number; total?: number }
  >,
): RollResult {
  return {
    notation: "irrelevante",
    groups,
    profile,
    timestamp: "2026-08-19T00:00:00.000Z",
  };
}

describe("yzePush — quem trava o que", () => {
  it("generico: o 6 fica na mesa, todo o resto rerrola", () => {
    const plan = planYzePush(
      "yze",
      result("yze", { pool: { rolls: [6, 1, 4, 6, 2], modifier: 0, total: 2 } }),
      { pool_size: "5", dificuldade: "1", sucessos_anteriores: "0" },
    );
    expect(plan).not.toBeNull();
    // 2 seis travam; o 1 NAO trava aqui (isso e Forbidden Lands).
    expect(plan!.inputs["pool_size"]).toBe("3");
    expect(plan!.inputs["sucessos_anteriores"]).toBe("2");
    expect(plan!.dadosRerrolados).toBe(3);
    expect(plan!.sucessosTravados).toBe(2);
  });

  it("generico: sucessos ja travados de um push anterior nao se perdem", () => {
    const plan = planYzePush(
      "yze",
      result("yze", { pool: { rolls: [6, 3, 2], modifier: 2, total: 3 } }),
      { pool_size: "3", dificuldade: "3", sucessos_anteriores: "2" },
    );
    expect(plan!.inputs["sucessos_anteriores"]).toBe("3");
    expect(plan!.inputs["pool_size"]).toBe("2");
  });

  it("forbidden lands: 6 e 1 travam na Base/Equipamento, Perícia só trava o 6", () => {
    const plan = planYzePush(
      "yze_fbl",
      result("yze_fbl", {
        base: { rolls: [6, 1, 3], modifier: 0, total: 1 },
        pericia: { rolls: [1, 5], total: 0 },
        equipamento: { rolls: [1, 4], total: 0 },
      }),
      {
        base: "3",
        pericia: "2",
        equipamento: "2",
        dificuldade: "1",
        sucessos_anteriores: "0",
      },
    );
    expect(plan!.inputs["base"]).toBe("1");
    // 1 de Perícia não é bane no FBL: rerrola junto com o 5 (2 dados).
    expect(plan!.inputs["pericia"]).toBe("2");
    expect(plan!.inputs["equipamento"]).toBe("1");
    expect(plan!.inputs["sucessos_anteriores"]).toBe("1");
    // 1 de Perícia nunca vira dano — so Base e Equipamento sao contados.
    expect(plan!.inputs["push_banes_base"]).toBe("1");
    expect(plan!.inputs["push_banes_equip"]).toBe("1");
    expect(plan!.dadosRerrolados).toBe(4);
  });

  it("forbidden lands: 1s travados acumulam com os de um push anterior", () => {
    const plan = planYzePush(
      "yze_fbl",
      result("yze_fbl", {
        base: { rolls: [1, 2], modifier: 1, total: 1 },
        pericia: { rolls: [], total: 0 },
        equipamento: { rolls: [3], total: 0 },
      }),
      {
        base: "2",
        pericia: "0",
        equipamento: "1",
        dificuldade: "1",
        sucessos_anteriores: "1",
        push_banes_base: "2",
        push_banes_equip: "1",
      },
    );
    expect(plan!.inputs["push_banes_base"]).toBe("3");
    expect(plan!.inputs["push_banes_equip"]).toBe("1");
    expect(plan!.inputs["sucessos_anteriores"]).toBe("1");
  });

  it("forbidden lands: rolagem normal (sem 1s travados no form) comeca a contagem do zero", () => {
    const plan = planYzePush(
      "yze_fbl",
      result("yze_fbl", {
        base: { rolls: [1, 1, 5], modifier: 0, total: 0 },
        pericia: { rolls: [2], total: 0 },
        equipamento: { rolls: [6], total: 1 },
      }),
      { base: "3", pericia: "1", equipamento: "1", sucessos_anteriores: "0" },
    );
    // Os campos opcionais estavam em branco: viram numero agora, e e isso
    // que liga as outcome_rules de dano na proxima rolagem.
    expect(plan!.inputs["push_banes_base"]).toBe("2");
    expect(plan!.inputs["push_banes_equip"]).toBe("0");
  });

  it("alien: 1 nao trava e o push acrescenta um dado de Estresse", () => {
    const plan = planYzePush(
      "yze_alien",
      result("yze_alien", {
        base: { rolls: [6, 1, 3], modifier: 0, total: 1 },
        estresse: { rolls: [1, 4], total: 0 },
      }),
      { base: "3", estresse: "2", dificuldade: "1", sucessos_anteriores: "0" },
    );
    expect(plan!.inputs["base"]).toBe("2");
    // 2 dados de estresse, nenhum 6 -> 2 rerrolam + 1 do push.
    expect(plan!.inputs["estresse"]).toBe("3");
    expect(plan!.inputs["sucessos_anteriores"]).toBe("1");
  });

  it("walking dead: mesma conta do Alien", () => {
    const plan = planYzePush(
      "yze_wdu",
      result("yze_wdu", {
        base: { rolls: [6, 6, 2], modifier: 1, total: 3 },
        estresse: { rolls: [5], total: 0 },
      }),
      { base: "3", estresse: "1", dificuldade: "1", sucessos_anteriores: "1" },
    );
    expect(plan!.inputs["base"]).toBe("1");
    expect(plan!.inputs["estresse"]).toBe("2");
    expect(plan!.inputs["sucessos_anteriores"]).toBe("3");
  });

  it("pool vazio: o dado descartado do zero_dice_fallback nao conta como dado na mesa", () => {
    const plan = planYzePush(
      "yze",
      result("yze", { pool: { rolls: [], dropped: [4], modifier: 2, total: 2 } }),
      { pool_size: "0", dificuldade: "1", sucessos_anteriores: "2" },
    );
    expect(plan!.inputs["pool_size"]).toBe("0");
    expect(plan!.inputs["sucessos_anteriores"]).toBe("2");
  });

  it("nao empurra resultado de outro sistema", () => {
    expect(planYzePush("yze", result("pbta", { roll: { rolls: [3, 4], total: 7 } }), {})).toBeNull();
    expect(planYzePush("pbta", result("pbta", { roll: { rolls: [3, 4], total: 7 } }), {})).toBeNull();
  });

  it("isYzeSystem so aceita os quatro profiles da linha", () => {
    expect(isYzeSystem("yze")).toBe(true);
    expect(isYzeSystem("yze_fbl")).toBe(true);
    expect(isYzeSystem("yze_alien")).toBe(true);
    expect(isYzeSystem("yze_wdu")).toBe(true);
    expect(isYzeSystem("pool_d6")).toBe(false);
    expect(isYzeSystem(undefined)).toBe(false);
  });
});
