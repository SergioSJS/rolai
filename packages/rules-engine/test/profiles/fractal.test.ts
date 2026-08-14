import { describe, expect, it } from "vitest";
import { rollWithProfile } from "../../src/index.js";

// profiles/fractal.yaml: pool de d6, NAO soma — o maior dado decide
// sucesso/falha, e o patamar de sucesso muda conforme fatos_aplicaveis
// (5-6 com Fato aplicavel, so 6 sem nenhum). Ruptura (qualquer dado = 1) e
// evento paralelo, nunca vira o outcome primario.
//
// `dice_total` e o tamanho real da pool (fatos_aplicaveis limitado a 3,
// +1 se vantagem) — no app quem calcula isso e
// apps/web/src/profileInputQuirks.ts ANTES de chamar rollWithProfile; aqui
// no motor os dois valores sao passados direto, como o profile realmente
// os recebe.

describe("profile: fractal", () => {
  it("sucesso simples: 2 fatos, maior dado 6 (sem 2o seis)", async () => {
    const result = await rollWithProfile(
      "fractal",
      { fatos_aplicaveis: 2, dice_total: 2 },
      { deterministic: [3, 6] },
    );
    expect(result.profile).toBe("fractal");
    expect(result.groups["pool"]!.rolls).toEqual([3, 6]);
    expect(result.outcome).toBe("sucesso");
    expect(result.outcome_flags).toEqual(["sucesso"]);
  });

  it("falha simples: 1 fato, dado 3", async () => {
    const result = await rollWithProfile(
      "fractal",
      { fatos_aplicaveis: 1, dice_total: 1 },
      { deterministic: [3] },
    );
    expect(result.notation).toBe("1d6");
    expect(result.outcome).toBe("falha");
    expect(result.outcome_flags).toEqual(["falha"]);
  });

  it("sucesso com ruptura: 3 fatos + vantagem, um dos dados sai 1", async () => {
    const result = await rollWithProfile(
      "fractal",
      { fatos_aplicaveis: 3, dice_total: 4 },
      { deterministic: [1, 2, 4, 5] },
    );
    expect(result.outcome).toBe("sucesso");
    expect(result.outcome_flags).toEqual(["sucesso", "ruptura_x1"]);
  });

  it("sucesso com impulso: 2 seis na pool", async () => {
    const result = await rollWithProfile(
      "fractal",
      { fatos_aplicaveis: 2, dice_total: 3 },
      { deterministic: [6, 6, 3] },
    );
    expect(result.outcome).toBe("sucesso_impulso_x2");
    expect(result.outcome_flags).toEqual(["sucesso_impulso_x2"]);
  });

  it("impulso maximo: 4 seis (3 fatos + vantagem)", async () => {
    const result = await rollWithProfile(
      "fractal",
      { fatos_aplicaveis: 3, dice_total: 4 },
      { deterministic: [6, 6, 6, 6] },
    );
    expect(result.outcome).toBe("sucesso_impulso_x4");
    expect(result.outcome_flags).toEqual(["sucesso_impulso_x4"]);
  });

  it("sem fatos aplicaveis: dado 5 e falha (patamar sobe pra 6)", async () => {
    const result = await rollWithProfile(
      "fractal",
      { fatos_aplicaveis: 0, dice_total: 0 },
      { deterministic: [5] },
    );
    // zero_dice_fallback: "0d6" (dice_total=0) vira "1d6", nunca rola zero.
    expect(result.notation).toBe("1d6");
    expect(result.groups["pool"]!.rolls).toEqual([5]);
    expect(result.outcome).toBe("falha");
  });

  it("sem fatos aplicaveis: dado 6 ainda e sucesso (nao impulso, so 1 dado)", async () => {
    const result = await rollWithProfile(
      "fractal",
      { fatos_aplicaveis: 0, dice_total: 0 },
      { deterministic: [6] },
    );
    expect(result.outcome).toBe("sucesso");
    expect(result.outcome_flags).toEqual(["sucesso"]);
  });

  it("ruptura maxima: os 4 dados saem 1 (falha + ruptura_x4)", async () => {
    const result = await rollWithProfile(
      "fractal",
      { fatos_aplicaveis: 3, dice_total: 4 },
      { deterministic: [1, 1, 1, 1] },
    );
    expect(result.outcome).toBe("falha");
    expect(result.outcome_flags).toEqual(["falha", "ruptura_x4"]);
  });
});
