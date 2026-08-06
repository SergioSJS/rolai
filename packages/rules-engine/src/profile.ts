// Carregamento e avaliacao de profiles de sistema (camada 2) —
// docs/system-profiles.md. Profiles versionados ficam em profiles/*.yaml;
// profiles custom chegam como conteudo YAML (string) e passam pela mesma
// validacao antes de serem usados.

import { parseExpression, evaluateExpression } from "./expression.js";
import type { ExpressionScope } from "./expression.js";
import { parseNotation } from "./parser.js";
import type { DiceSpec } from "./parser.js";
import { createRollState, rollDice } from "./roller.js";
import type { RollOptions } from "./roller.js";
import type { RollGroup, RollResult } from "./types.js";
import { parse as parseYaml } from "yaml";

export class ProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileError";
  }
}

export interface ProfileOption {
  value: string;
  label: string;
}

export interface ProfileInput {
  id: string;
  label: string;
  type: "number" | "select";
  // Só para type "select": alternativas exibidas ao jogador. O `value` e
  // interpolado cru na notacao ("1d20{input.mode}" -> "1d20adv"), o `label`
  // e o que a UI mostra.
  options?: ProfileOption[];
}

export interface ProfileField {
  id: string;
  dice: string;
  modifier: string | null;
  compareIndividually: boolean;
}

export interface OutcomeRule {
  condition: string;
  result: string;
}

export interface SystemProfile {
  system: string;
  label: string;
  rollType: "simple" | "comparison";
  inputs: ProfileInput[];
  fields: ProfileField[];
  outcomeRules: OutcomeRule[];
}

export type ProfileInputs = Record<string, number | string>;

// ---------- Validacao do schema ----------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function requireString(obj: Record<string, unknown>, key: string, where: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.trim() === "") {
    throw new ProfileError(`${where}: campo "${key}" deve ser string nao vazia`);
  }
  return v;
}

function validateInputs(raw: unknown): ProfileInput[] {
  if (!Array.isArray(raw)) {
    throw new ProfileError('profile: "inputs" deve ser uma lista');
  }
  return raw.map((item, i) => {
    const where = `inputs[${i}]`;
    if (!isRecord(item)) throw new ProfileError(`${where}: entrada invalida`);
    const type = requireString(item, "type", where);
    if (type !== "number" && type !== "select") {
      throw new ProfileError(`${where}: type deve ser "number" ou "select"`);
    }
    const input: ProfileInput = {
      id: requireString(item, "id", where),
      label: requireString(item, "label", where),
      type,
    };
    const options = validateOptions(item["options"], where);
    if (options) input.options = options;
    if (type === "select" && !options) {
      throw new ProfileError(`${where}: input "select" exige "options"`);
    }
    return input;
  });
}

// options aceita string crua ("adv") ou par {value, label}. String vira
// value E label — util quando os dois coincidem.
function validateOptions(raw: unknown, where: string): ProfileOption[] | null {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ProfileError(`${where}: "options" deve ser uma lista nao vazia`);
  }
  return raw.map((item, i) => {
    if (typeof item === "string") return { value: item, label: item };
    if (!isRecord(item)) {
      throw new ProfileError(`${where}.options[${i}]: entrada invalida`);
    }
    const value = item["value"];
    if (typeof value !== "string") {
      throw new ProfileError(`${where}.options[${i}]: "value" deve ser string`);
    }
    return { value, label: requireString(item, "label", `${where}.options[${i}]`) };
  });
}

function validateFields(raw: unknown): ProfileField[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ProfileError('profile: "fields" deve ser uma lista nao vazia');
  }
  return raw.map((item, i) => {
    const where = `fields[${i}]`;
    if (!isRecord(item)) throw new ProfileError(`${where}: entrada invalida`);
    const modifier = item["modifier"];
    if (modifier !== undefined && modifier !== null && typeof modifier !== "string") {
      throw new ProfileError(`${where}: "modifier" deve ser string ou null`);
    }
    const compare = item["compare_individually"];
    if (compare !== undefined && typeof compare !== "boolean") {
      throw new ProfileError(`${where}: "compare_individually" deve ser boolean`);
    }
    return {
      id: requireString(item, "id", where),
      dice: requireString(item, "dice", where),
      modifier: modifier ?? null,
      compareIndividually: compare ?? false,
    };
  });
}

function validateOutcomeRules(raw: unknown): OutcomeRule[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ProfileError('profile: "outcome_rules" deve ser uma lista nao vazia');
  }
  return raw.map((item, i) => {
    const where = `outcome_rules[${i}]`;
    if (!isRecord(item)) throw new ProfileError(`${where}: entrada invalida`);
    const condition = requireString(item, "condition", where);
    const result = requireString(item, "result", where);
    // Falha cedo em condition invalida, no carregamento e nao na rolagem.
    // `{input.x}` so vira numero na hora da rolagem — pra checagem de
    // sintaxe basta um placeholder numerico.
    try {
      parseExpression(condition.replace(INPUT_REF, "0"));
    } catch (err) {
      throw new ProfileError(
        `${where}: condition invalida — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return { condition, result };
  });
}

// Parseia e valida um profile a partir do conteudo YAML (string).
export function parseProfile(yamlContent: string): SystemProfile {
  let raw: unknown;
  try {
    raw = parseYaml(yamlContent);
  } catch (err) {
    throw new ProfileError(
      `YAML invalido: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!isRecord(raw)) {
    throw new ProfileError("profile: documento YAML deve ser um objeto");
  }
  const rollType = requireString(raw, "roll_type", "profile");
  if (rollType !== "simple" && rollType !== "comparison") {
    throw new ProfileError('profile: "roll_type" deve ser "simple" ou "comparison"');
  }
  const profile: SystemProfile = {
    system: requireString(raw, "system", "profile"),
    label: requireString(raw, "label", "profile"),
    rollType,
    inputs: validateInputs(raw["inputs"]),
    fields: validateFields(raw["fields"]),
    outcomeRules: validateOutcomeRules(raw["outcome_rules"]),
  };
  const expectedFields = profile.rollType === "comparison" ? 2 : 1;
  if (profile.fields.length !== expectedFields) {
    throw new ProfileError(
      `profile "${profile.system}": roll_type "${rollType}" exige exatamente ${expectedFields} field(s)`,
    );
  }
  return profile;
}

const SYSTEM_ID = /^[a-z0-9][a-z0-9_-]*$/i;

// Carrega um profile. Aceita o conteudo YAML como string (browser/WebView)
// ou um id de sistema ("ironsworn", "pbta", ...) lido de profiles/*.yaml —
// a leitura por id so funciona em ambiente Node.
export async function loadProfile(source: string): Promise<SystemProfile> {
  if (SYSTEM_ID.test(source.trim())) {
    const id = source.trim().toLowerCase();
    let readFile: (path: URL, encoding: "utf8") => Promise<string>;
    try {
      ({ readFile } = await import("node:fs/promises"));
    } catch {
      throw new ProfileError(
        `carregamento por id ("${id}") so e suportado em Node — passe o conteudo YAML`,
      );
    }
    const url = new URL(`../profiles/${id}.yaml`, import.meta.url);
    let content: string;
    try {
      content = await readFile(url, "utf8");
    } catch {
      throw new ProfileError(`profile nao encontrado: "${id}"`);
    }
    return parseProfile(content);
  }
  return parseProfile(source);
}

// ---------- Montagem de notacao a partir dos inputs ----------

const INPUT_REF = /\{input\.([A-Za-z_][A-Za-z0-9_]*)\}/g;

function interpolate(template: string, inputs: ProfileInputs, where: string): string {
  return template.replace(INPUT_REF, (_, id: string) => {
    const value = inputs[id];
    if (value === undefined) {
      throw new ProfileError(`${where}: input ausente: "${id}"`);
    }
    return String(value);
  });
}

function fieldSpec(
  field: ProfileField,
  inputs: ProfileInputs,
): { spec: DiceSpec; notation: string } {
  const dice = interpolate(field.dice, inputs, `field "${field.id}"`).trim();
  let modifierSuffix = "";
  let modifier: number | null = null;
  if (field.modifier !== null) {
    const raw = interpolate(field.modifier, inputs, `field "${field.id}"`).trim();
    const n = Number(raw);
    if (!Number.isInteger(n)) {
      throw new ProfileError(
        `field "${field.id}": modifier "${raw}" nao e um numero inteiro`,
      );
    }
    modifier = n;
    modifierSuffix = n >= 0 ? `+${n}` : `${n}`;
  }
  const ast = parseNotation(dice + modifierSuffix);
  const group = ast.groups[0];
  if (ast.groups.length !== 1 || !group || group.terms.length !== 1) {
    throw new ProfileError(`field "${field.id}": notacao deve ser um unico grupo de um unico termo`);
  }
  const spec: DiceSpec = { ...group.dice };
  if (modifier !== null) {
    // Garante que o modificador interpolado marque presenca mesmo quando
    // zero ("{input.mod}" -> 0 deve gerar total, ver docs/roll-notation.md).
    spec.modifier = modifier;
    spec.hasModifier = true;
  }
  return { spec, notation: dice + modifierSuffix };
}

// ---------- Avaliacao de outcome_rules ----------

function buildScope(groups: Record<string, RollGroup>): ExpressionScope {
  const scope: ExpressionScope = {};
  for (const [id, group] of Object.entries(groups)) {
    scope[id] = { rolls: group.rolls };
    if (group.total !== undefined) scope[id]!.total = group.total;
    if (group.modifier !== undefined) scope[id]!.modifier = group.modifier;
  }
  return scope;
}

// Avalia as outcome_rules em ordem contra os grupos ja rolados.
// Retorna a primeira regra que bate (outcome) e a lista de TODAS as que
// bateram (flags) — o "match" do Ironsworn e independente do hit/miss.
export function evaluateOutcomeRules(
  rules: OutcomeRule[],
  groups: Record<string, RollGroup>,
  inputs: ProfileInputs = {},
): { outcome?: string; flags: string[] } {
  const scope = buildScope(groups);
  const flags: string[] = [];
  for (const rule of rules) {
    // A condition tambem interpola inputs: "roll.total >= {input.cd}"
    // (dificuldade/CD/pericia sao dado do jogador, nao constante do sistema).
    const condition = interpolate(
      rule.condition,
      inputs,
      `outcome_rule "${rule.result}"`,
    );
    let matched: boolean;
    try {
      matched = evaluateExpression(condition, scope);
    } catch (err) {
      throw new ProfileError(
        `condition "${rule.condition}" falhou: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (matched) flags.push(rule.result);
  }
  const [outcome] = flags;
  return outcome === undefined ? { flags } : { outcome, flags };
}

// ---------- Rolagem via profile ----------

// Rola um profile com os inputs do jogador. Aceita um SystemProfile ja
// carregado, um id de sistema (Node) ou conteudo YAML (string).
export async function rollWithProfile(
  profile: SystemProfile | string,
  inputs: ProfileInputs,
  options: RollOptions = {},
): Promise<RollResult> {
  const resolved = typeof profile === "string" ? await loadProfile(profile) : profile;

  // Valida inputs declarados.
  for (const input of resolved.inputs) {
    const value = inputs[input.id];
    if (value === undefined) {
      throw new ProfileError(`input obrigatorio ausente: "${input.id}"`);
    }
    if (input.type === "number" && !Number.isFinite(Number(value))) {
      throw new ProfileError(`input "${input.id}" deve ser numerico`);
    }
    // Select so aceita um dos valores declarados — o valor e interpolado cru
    // na notacao, entao nao pode vir texto arbitrario do cliente.
    if (input.options && !input.options.some((o) => o.value === String(value))) {
      throw new ProfileError(`input "${input.id}": valor invalido "${String(value)}"`);
    }
  }

  const state = createRollState(options);
  const groups: Record<string, RollGroup> = {};
  const notations: string[] = [];
  for (const field of resolved.fields) {
    const { spec, notation } = fieldSpec(field, inputs);
    const group = rollDice(spec, state);
    // compare_individually: false (default) = soma — garante total mesmo
    // sem modificador; true mantem o array pra comparacao elemento a
    // elemento (docs/system-profiles.md).
    if (!field.compareIndividually && group.total === undefined) {
      group.total = group.rolls.reduce((sum, v) => sum + v, 0) + (group.modifier ?? 0);
    }
    groups[field.id] = group;
    notations.push(notation);
  }

  const notation =
    resolved.rollType === "comparison"
      ? `{${notations[0]!}} vs {${notations[1]!}}`
      : notations[0]!;

  const { outcome, flags } = evaluateOutcomeRules(
    resolved.outcomeRules,
    groups,
    inputs,
  );

  const result: RollResult = {
    notation,
    groups,
    profile: resolved.system,
    timestamp: options.timestamp ?? new Date().toISOString(),
  };
  if (outcome !== undefined) result.outcome = outcome;
  if (flags.length > 0) result.outcome_flags = flags;
  return result;
}
