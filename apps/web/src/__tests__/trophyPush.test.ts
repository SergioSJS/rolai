import { describe, expect, it } from "vitest";
import type { RollResult } from "@rolai/rules-engine";
import { isTrophy, planTrophyPush } from "../trophyPush";

function mockResult(over: Partial<RollResult> = {}): RollResult {
  return {
    notation: "{2d6} + {1d6}",
    profile: "trophy_dark",
    outcome: "weak_hit",
    groups: {
      claros: { rolls: [4, 2], theme: "light" },
      escuros: { rolls: [3], theme: "dark" },
    },
    timestamp: "2026-08-19T00:00:00Z",
    ...over,
  };
}

describe("trophyPush", () => {
  it("identifica sistemas Trophy", () => {
    expect(isTrophy("trophy_dark")).toBe(true);
    expect(isTrophy("trophy_gold")).toBe(true);
    expect(isTrophy("yze")).toBe(false);
  });

  it("acrescenta +1 dado escuro ao forcar", () => {
    const res = mockResult({ outcome: "weak_hit" });
    const inputs = { claros: 2, escuros: 1, ruina: 3 };
    const next = planTrophyPush(res, inputs);

    expect(next).toEqual({
      claros: 2,
      escuros: 2,
      ruina: 3,
    });
  });

  it("nao permite forcar se ja tirou sucesso completo (6)", () => {
    const res = mockResult({ outcome: "success" });
    const inputs = { claros: 2, escuros: 1, ruina: 3 };
    const next = planTrophyPush(res, inputs);

    expect(next).toBeNull();
  });

  it("permite forcar em falhas (miss)", () => {
    const res = mockResult({ outcome: "miss" });
    const inputs = { claros: 1, escuros: 0, ruina: 2 };
    const next = planTrophyPush(res, inputs);

    expect(next).toEqual({
      claros: 1,
      escuros: 1,
      ruina: 2,
    });
  });
});
