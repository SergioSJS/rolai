import { describe, expect, it } from "vitest";
import { rollWithProfile } from "../../src/index.js";

// profiles/infaernum.yaml: cada dado do 3d6 e lido individualmente —
// 1=desgraca, 2-3=vislumbre, 4-5=facanha, 6=milagre. Pool fixo em 3 dados:
// cada categoria quantiza em x1/x2/x3 (nunca mais que 3, nunca 0 sem flag).
// Flags independentes: uma rolagem pode acionar varias ao mesmo tempo, e a
// ordem (milagre/desgraca antes de facanha/vislumbre) decide o destaque.

describe("profile: infaernum", () => {
  it("desgraca_x1: um dado mostra 1 (sem milagre no meio)", async () => {
    const result = await rollWithProfile("infaernum", {}, {
      deterministic: [1, 4, 4],
    });
    expect(result.profile).toBe("infaernum");
    expect(result.notation).toBe("3d6");
    expect(result.groups["pool"]!.rolls).toEqual([1, 4, 4]);
    expect(result.outcome).toBe("desgraca_x1");
    expect(result.outcome_flags).toEqual(["desgraca_x1", "facanha_x2"]);
  });

  it("vislumbre_x2 + facanha_x1: facanha (extremo mais proximo) vira o destaque", async () => {
    const result = await rollWithProfile("infaernum", {}, {
      deterministic: [2, 3, 5],
    });
    expect(result.outcome).toBe("facanha_x1");
    expect(result.outcome_flags).toEqual(["facanha_x1", "vislumbre_x2"]);
  });

  it("facanha_x3: os tres dados 4 ou 5", async () => {
    const result = await rollWithProfile("infaernum", {}, {
      deterministic: [4, 5, 5],
    });
    expect(result.outcome).toBe("facanha_x3");
    expect(result.outcome_flags).toEqual(["facanha_x3"]);
  });

  it("milagre_x2 vira o destaque sobre facanha_x1", async () => {
    const result = await rollWithProfile("infaernum", {}, {
      deterministic: [6, 6, 4],
    });
    expect(result.outcome).toBe("milagre_x2");
    expect(result.outcome_flags).toEqual(["milagre_x2", "facanha_x1"]);
  });

  it("milagre_x1 e desgraca_x1 juntos: milagre vira o destaque", async () => {
    const result = await rollWithProfile("infaernum", {}, {
      deterministic: [1, 3, 6],
    });
    expect(result.outcome).toBe("milagre_x1");
    expect(result.outcome_flags).toEqual(["milagre_x1", "desgraca_x1", "vislumbre_x1"]);
  });

  it("milagre_x3: os tres dados 6", async () => {
    const result = await rollWithProfile("infaernum", {}, {
      deterministic: [6, 6, 6],
    });
    expect(result.outcome).toBe("milagre_x3");
    expect(result.outcome_flags).toEqual(["milagre_x3"]);
  });

  it("nao precisa de nenhum input", async () => {
    const result = await rollWithProfile("infaernum", {}, {
      deterministic: [2, 2, 2],
    });
    expect(result.outcome_flags).toEqual(["vislumbre_x3"]);
  });
});
