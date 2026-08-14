import { describe, expect, it } from "vitest";
import { applyInputQuirks } from "./profileInputQuirks.js";
import { getProfile } from "./profiles.js";

describe("applyInputQuirks", () => {
  const fractal = getProfile("fractal")!;

  it("soma fatos_aplicaveis + vantagem quando ha pelo menos 1 fato", () => {
    const out = applyInputQuirks(fractal, { fatos_aplicaveis: 2, vantagem: "sim" });
    expect(out["dice_total"]).toBe(3);
  });

  it("capa fatos_aplicaveis em 3 antes de somar a vantagem", () => {
    const out = applyInputQuirks(fractal, { fatos_aplicaveis: 5, vantagem: "sim" });
    expect(out["dice_total"]).toBe(4);
  });

  it("ignora vantagem quando fatos_aplicaveis e 0 (regra: vantagem exige fato)", () => {
    const out = applyInputQuirks(fractal, { fatos_aplicaveis: 0, vantagem: "sim" });
    expect(out["dice_total"]).toBe(0);
  });

  it("sem vantagem informada, so conta os fatos", () => {
    const out = applyInputQuirks(fractal, { fatos_aplicaveis: 1 });
    expect(out["dice_total"]).toBe(1);
  });

  it("outros profiles nao sao tocados", () => {
    const d20 = getProfile("d20")!;
    const out = applyInputQuirks(d20, { dc: 15, mode: "adv" });
    expect(out).toEqual({ dc: 15, mode: "adv" });
  });
});
