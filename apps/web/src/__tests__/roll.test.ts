import { describe, expect, it } from "vitest";
import { parseProfile, roll, rollWithProfile } from "@rolai/rules-engine";
import type { RollResult } from "@rolai/rules-engine";
import { displayGroups, summarizeResult } from "../format";
import fitdYaml from "@rolai/rules-engine/profiles/fitd.yaml?raw";
import pbtaYaml from "@rolai/rules-engine/profiles/pbta.yaml?raw";
import { coerceInputs, rollFromNotation, rollFromProfile } from "../roll";
import { diceFromResult, physicalDiceCount } from "../renderers/types";
import { buildBoxNotation } from "../renderers/diceBox";

// Profile minimo no schema real (docs/system-profiles.md) — montar a
// rolagem a partir dos inputs e a ponte UI -> rules-engine que esta sob
// teste aqui, nao o engine em si.
const PBTA_LIKE = parseProfile(`
system: pbta
label: "PbtA — Rolagem 2d6"
roll_type: simple
inputs:
  - id: mod
    label: "Modificador"
    type: number
fields:
  - id: roll
    dice: "2d6"
    modifier: "{input.mod}"
outcome_rules:
  - condition: "roll.total >= 10"
    result: strong_hit
  - condition: "roll.total >= 7"
    result: weak_hit
  - condition: "roll.total < 7"
    result: miss
`);

const IRONSWORN_LIKE = parseProfile(`
system: ironsworn
label: "Ironsworn — Ação"
roll_type: comparison
inputs:
  - id: attribute
    label: "Atributo"
    type: number
fields:
  - id: action
    dice: "1d6"
    modifier: "{input.attribute}"
  - id: challenge
    dice: "2d10"
    compare_individually: true
outcome_rules:
  - condition: "action.total > challenge[0] and action.total > challenge[1]"
    result: strong_hit
  - condition: "challenge[0] == challenge[1]"
    result: match
`);

describe("coerceInputs", () => {
  it("converte input numerico de string pra number", () => {
    expect(coerceInputs(PBTA_LIKE, { mod: "3" })).toEqual({ mod: 3 });
  });

  it("aceita modificador negativo", () => {
    expect(coerceInputs(PBTA_LIKE, { mod: "-1" })).toEqual({ mod: -1 });
  });

  it("rejeita valor vazio ou nao numerico com erro amigavel", () => {
    expect(() => coerceInputs(PBTA_LIKE, { mod: "" })).toThrow(
      /"Modificador" precisa ser um numero/,
    );
    expect(() => coerceInputs(PBTA_LIKE, { mod: "abc" })).toThrow(
      /precisa ser um numero/,
    );
  });
});

describe("rollFromProfile", () => {
  it("monta a rolagem a partir dos inputs do profile", async () => {
    const result = await rollFromProfile(PBTA_LIKE, { mod: "2" });
    expect(result.profile).toBe("pbta");
    expect(result.notation).toBe("2d6+2");
    expect(result.groups["roll"]?.rolls).toHaveLength(2);
    expect(result.groups["roll"]?.modifier).toBe(2);
    const total = result.groups["roll"]?.total ?? 0;
    expect(total).toBeGreaterThanOrEqual(4);
    expect(total).toBeLessThanOrEqual(14);
    expect(result.outcome).toBeDefined();
  });

  it("profile comparison gera notacao '{...} vs {...}' e grupos nomeados", async () => {
    const result = await rollFromProfile(IRONSWORN_LIKE, { attribute: "3" });
    expect(result.notation).toBe("{1d6+3} vs {2d10}");
    expect(result.groups["action"]?.rolls).toHaveLength(1);
    expect(result.groups["challenge"]?.rolls).toHaveLength(2);
  });
});

describe("diceFromResult", () => {
  it("extrai dados (faces + valor) casando notacao e grupos", async () => {
    const result = await rollFromProfile(IRONSWORN_LIKE, { attribute: "1" });
    const dice = diceFromResult(result);
    // 1d6 + 2d10 = 3 dados animados, na ordem dos grupos.
    expect(dice.map((d) => d.sides)).toEqual([6, 10, 10]);
    for (const die of dice) {
      expect(die.value).toBeGreaterThanOrEqual(1);
      expect(die.value).toBeLessThanOrEqual(die.sides);
    }
    // Os valores animados sao exatamente os do resultado — nunca re-sorteados.
    expect(dice.map((d) => d.value)).toEqual([
      ...result.groups["action"]!.rolls,
      ...result.groups["challenge"]!.rolls,
    ]);
  });

  it("funciona pra notacao livre com keep/drop (anima so os mantidos)", () => {
    const result = rollFromNotation("4d6kh3");
    const dice = diceFromResult(result);
    expect(dice).toHaveLength(3);
    expect(dice.every((d) => d.sides === 6)).toBe(true);
  });
});

describe("profiles versionados — tiers exclusivos (regressao FitD/PbtA)", () => {
  it("fitd: critical nao arrasta partial_success nas flags", async () => {
    const profile = parseProfile(fitdYaml);
    const result = await rollWithProfile(profile, { pool_size: 4 }, {
      deterministic: [6, 6, 2, 3],
    });
    expect(result.outcome).toBe("critical");
    expect(result.outcome_flags).toEqual(["critical"]);
  });

  it("fitd: partial_success exige zero 6", async () => {
    const profile = parseProfile(fitdYaml);
    const result = await rollWithProfile(profile, { pool_size: 4 }, {
      deterministic: [5, 4, 2, 1],
    });
    expect(result.outcome).toBe("partial_success");
    expect(result.outcome_flags).toEqual(["partial_success"]);
  });

  it("pbta: strong_hit nao arrasta weak_hit nas flags", async () => {
    const profile = parseProfile(pbtaYaml);
    const result = await rollWithProfile(profile, { mod: 1 }, {
      deterministic: [6, 4],
    });
    expect(result.outcome).toBe("strong_hit");
    expect(result.outcome_flags).toEqual(["strong_hit"]);
  });
});

describe("pool misto (multi-termo)", () => {
  it("roll agrega termos e diceFromResult mapeia cada dado pro tipo certo", () => {
    const result = rollFromNotation("2d6+1d4+3");
    // deterministico via engine: refaz com fila pra assercao exata
    const fixed = roll("2d6+1d4+3", { deterministic: [4, 5, 2] });
    expect(fixed.groups["roll"]).toEqual({ rolls: [4, 5, 2], modifier: 3, total: 14 });
    const dice = diceFromResult(fixed);
    expect(dice).toEqual([
      { sides: 6, value: 4 },
      { sides: 6, value: 5 },
      { sides: 4, value: 2 },
    ]);
    expect(result.groups["roll"]?.total).toBeDefined();
  });

  it("keep/drop por termo: so os mantidos do termo viram dados animados", () => {
    const fixed = roll("4d6kh3+1d20", { deterministic: [1, 6, 3, 4, 12] });
    expect(fixed.groups["roll"]).toEqual({ rolls: [6, 3, 4, 12], total: 25 });
    expect(diceFromResult(fixed)).toEqual([
      { sides: 6, value: 6 },
      { sides: 6, value: 3 },
      { sides: 6, value: 4 },
      { sides: 20, value: 12 },
    ]);
  });

  it("d100 misturado com d6: par dezenas/unidades + d6, corpos contados certo", () => {
    const fixed = roll("1d100+1d6", { deterministic: [57, 3] });
    const dice = diceFromResult(fixed);
    expect(dice).toEqual([
      { sides: 100, value: 57 },
      { sides: 6, value: 3 },
    ]);
    expect(physicalDiceCount(dice)).toBe(3);
    expect(buildBoxNotation(dice)).toBe("1d100+1d10+1d6@5,7,3");
  });
});

// Regressao: rolagem que chega pela sala traz os campos opcionais como
// `null` explicito (Pydantic) — a UI imprimia "= null — null".
describe("campos opcionais nulos vindos da sala", () => {
  const fromServer = {
    notation: "2d6",
    groups: { roll: { rolls: [1, 3], modifier: null, total: null } },
    profile: null,
    outcome: null,
    outcome_flags: null,
    timestamp: "2026-08-05T12:00:00.000Z",
  } as unknown as RollResult;

  it("summarizeResult nao imprime null", () => {
    const text = summarizeResult(fromServer);
    expect(text).not.toContain("null");
    expect(text).toBe("[1, 3]");
  });

  it("displayGroups zera modificador/total nulos", () => {
    const [group] = displayGroups(fromServer);
    expect(group!.modifier).toBeUndefined();
    expect(group!.total).toBeUndefined();
  });
});
