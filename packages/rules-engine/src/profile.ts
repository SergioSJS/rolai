// Carregamento e avaliacao de profiles de sistema (camada 2) —
// docs/system-profiles.md. Profiles versionados ficam em profiles/*.yaml;
// profiles custom chegam como conteudo YAML (string) e passam pela mesma
// validacao antes de serem usados.

import { parseExpression, evaluateExpression, matchesCondition } from "./expression.js";
import type { ExpressionScope } from "./expression.js";
import { parseNotation } from "./parser.js";
import type { DiceSpec, NotationAST } from "./parser.js";
import { createRollState, roll, rollDice } from "./roller.js";
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
  // false = jogador pode deixar em branco (ex: "valor testado" do roll
  // under sem meta, "dificuldade" do WoD sem alvo — so rola, sem outcome).
  // Default true: todo input existente antes disso continua obrigatorio.
  required: boolean;
  // Hint de UI: valor pre-preenchido no formulario (string crua, mesmo
  // formato de ProfileInputs). So aparencia — nao afeta required/validacao;
  // um "mod" de modificador comeca em "0" em vez de forcar o jogador a
  // digitar antes da primeira rolagem.
  default?: string;
}

export interface ProfileField {
  id: string;
  dice: string;
  modifier: string | null;
  compareIndividually: boolean;
  // Mesma minilinguagem do 2o argumento de count(), mas SEM as aspas
  // (aqui e a string toda, nao um literal embutido numa expressao maior):
  // ex. ">=5", nao "'>=5'". Quando setado, `group.total` vira a CONTAGEM
  // de dados que batem a condicao (sucessos), em vez da soma automatica —
  // e o que faz "[2, 5, 6, 1] = 2" aparecer pro jogador sem ele ter que
  // contar os dados na mao (pool_d6/Shadowrun).
  successRule: string | null;
  // Notacao alternativa quando o campo de dados interpolado da CONTAGEM
  // zero ou negativa (ex. "{input.pool_size}d6" com pool_size 0) — a
  // notacao normal quebraria ("0d6" nao e valido). FitD: pool 0 rola
  // "2d6kl1" (2d6, mantem o menor) em vez de nao rolar nada.
  zeroDiceFallback: string | null;
}

export interface OutcomeRule {
  condition: string;
  result: string;
}

export interface SystemProfile {
  system: string;
  label: string;
  // simple: 1 field. comparison: 2 fields, notacao "{a} vs {b}" (rolagem
  // desafia outra). multi: >=2 fields INDEPENDENTES, notacao "{a} + {b}"
  // (nao competem entre si — ex: dado regular + dado de Fome do WoD5, ou
  // par verbo/substantivo do oraculo de ideias do Infaernum). overlay: ZERO
  // fields — nao rola dado proprio, so avalia outcome_rules sobre uma
  // rolagem externa (roll_under: aplica "<= target" em cima do que o
  // composer de notacao livre montar). Usar rollOverlay, nunca
  // rollWithProfile, pra esse tipo.
  rollType: "simple" | "comparison" | "multi" | "overlay";
  // roll_under: numero MENOR e melhor (roll.total <= target) — o oposto do
  // que "adv"/"dis" significa nas outras profiles (maior e melhor, como
  // d20). Aqui "Vantagem" tem que manter o dado BAIXO, entao o token
  // literal do parser sai invertido — ver applyOverlayMode.
  modeFavorsLow?: boolean;
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
    const requiredRaw = item["required"];
    if (requiredRaw !== undefined && typeof requiredRaw !== "boolean") {
      throw new ProfileError(`${where}: "required" deve ser boolean`);
    }
    const defaultRaw = item["default"];
    if (defaultRaw !== undefined && typeof defaultRaw !== "string") {
      throw new ProfileError(`${where}: "default" deve ser string`);
    }
    const input: ProfileInput = {
      id: requireString(item, "id", where),
      label: requireString(item, "label", where),
      type,
      required: requiredRaw ?? true,
    };
    if (defaultRaw !== undefined) input.default = defaultRaw;
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
  // Lista vazia e valida pra roll_type "overlay" (sem dado proprio) — a
  // contagem certa por roll_type e checada em parseProfile, depois que o
  // roll_type ja foi lido.
  if (!Array.isArray(raw)) {
    throw new ProfileError('profile: "fields" deve ser uma lista');
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
    const successRule = item["success_rule"];
    if (successRule !== undefined && successRule !== null && typeof successRule !== "string") {
      throw new ProfileError(`${where}: "success_rule" deve ser string ou null`);
    }
    const zeroDiceFallback = item["zero_dice_fallback"];
    if (
      zeroDiceFallback !== undefined &&
      zeroDiceFallback !== null &&
      typeof zeroDiceFallback !== "string"
    ) {
      throw new ProfileError(`${where}: "zero_dice_fallback" deve ser string ou null`);
    }
    return {
      id: requireString(item, "id", where),
      dice: requireString(item, "dice", where),
      modifier: modifier ?? null,
      compareIndividually: compare ?? false,
      successRule: successRule ?? null,
      zeroDiceFallback: zeroDiceFallback ?? null,
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
  if (
    rollType !== "simple" &&
    rollType !== "comparison" &&
    rollType !== "multi" &&
    rollType !== "overlay"
  ) {
    throw new ProfileError(
      'profile: "roll_type" deve ser "simple", "comparison", "multi" ou "overlay"',
    );
  }
  const modeFavorsLowRaw = raw["mode_favors_low"];
  if (modeFavorsLowRaw !== undefined && typeof modeFavorsLowRaw !== "boolean") {
    throw new ProfileError('profile: "mode_favors_low" deve ser boolean');
  }
  const profile: SystemProfile = {
    system: requireString(raw, "system", "profile"),
    label: requireString(raw, "label", "profile"),
    rollType,
    inputs: validateInputs(raw["inputs"]),
    fields: validateFields(raw["fields"]),
    outcomeRules: validateOutcomeRules(raw["outcome_rules"]),
  };
  if (modeFavorsLowRaw === true) profile.modeFavorsLow = true;
  if (profile.rollType === "comparison" && profile.fields.length !== 2) {
    throw new ProfileError(
      `profile "${profile.system}": roll_type "comparison" exige exatamente 2 field(s)`,
    );
  }
  if (profile.rollType === "simple" && profile.fields.length !== 1) {
    throw new ProfileError(
      `profile "${profile.system}": roll_type "simple" exige exatamente 1 field(s)`,
    );
  }
  if (profile.rollType === "multi" && profile.fields.length < 2) {
    throw new ProfileError(
      `profile "${profile.system}": roll_type "multi" exige pelo menos 2 fields`,
    );
  }
  if (profile.rollType === "overlay" && profile.fields.length !== 0) {
    throw new ProfileError(
      `profile "${profile.system}": roll_type "overlay" nao aceita fields (a rolagem vem de fora)`,
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
  let dice = interpolate(field.dice, inputs, `field "${field.id}"`).trim();
  // Contagem interpolada <= 0 (ex.: pool_size 0) quebraria a notacao
  // ("0d6" nao existe) — troca pela alternativa antes de parsear.
  const countMatch = /^(-?\d+)d/i.exec(dice);
  if (countMatch && Number(countMatch[1]) <= 0 && field.zeroDiceFallback !== null) {
    dice = field.zeroDiceFallback;
  }
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
    // Campo de CONTAGEM (success_rule) com modificador zero nao ganha
    // "+0" na notacao: ali o modificador sao sucessos que vieram de uma
    // rolagem forcada, e "sem nenhum" e o caso normal — "{4d6+0} + {3d6+0}"
    // no historico so polui. O total nao depende disso (success_rule
    // sempre calcula), ao contrario de um "2d6+0" do PbtA, onde o
    // modificador zero e o que garante que o total exista.
    if (field.successRule !== null && n === 0) {
      modifierSuffix = "";
    } else {
      modifier = n;
      modifierSuffix = n >= 0 ? `+${n}` : `${n}`;
    }
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

// ids de input opcional que o jogador deixou em branco nesta rolagem —
// qualquer outcome_rule cuja condition os referencie e pulada em vez de
// estourar erro (roll_under sem "target" so rola, sem outcome).
function referencesAny(condition: string, ids: ReadonlySet<string>): boolean {
  if (ids.size === 0) return false;
  for (const m of condition.matchAll(INPUT_REF)) {
    if (ids.has(m[1]!)) return true;
  }
  return false;
}

// Avalia as outcome_rules em ordem contra os grupos ja rolados.
// Retorna a primeira regra que bate (outcome) e a lista de TODAS as que
// bateram (flags) — o "match" do Ironsworn e independente do hit/miss.
export function evaluateOutcomeRules(
  rules: OutcomeRule[],
  groups: Record<string, RollGroup>,
  inputs: ProfileInputs = {},
  optionalMissing: ReadonlySet<string> = new Set(),
): { outcome?: string; flags: string[] } {
  const scope = buildScope(groups);
  const flags: string[] = [];
  for (const rule of rules) {
    if (referencesAny(rule.condition, optionalMissing)) continue;
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

// Valida os inputs do jogador contra os declarados no profile. Devolve os
// ids de input OPCIONAL que vieram ausentes — evaluateOutcomeRules pula
// toda outcome_rule que os referencia, em vez de estourar erro. Uso
// compartilhado entre rollWithProfile e rollOverlay.
function validateProfileInputs(
  resolved: SystemProfile,
  inputs: ProfileInputs,
): Set<string> {
  const optionalMissing = new Set<string>();
  for (const input of resolved.inputs) {
    const value = inputs[input.id];
    if (value === undefined) {
      if (input.required === false) {
        optionalMissing.add(input.id);
        continue;
      }
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
  return optionalMissing;
}

// Rola um profile com os inputs do jogador. Aceita um SystemProfile ja
// carregado, um id de sistema (Node) ou conteudo YAML (string).
export async function rollWithProfile(
  profile: SystemProfile | string,
  inputs: ProfileInputs,
  options: RollOptions = {},
): Promise<RollResult> {
  const resolved = typeof profile === "string" ? await loadProfile(profile) : profile;

  if (resolved.rollType === "overlay") {
    throw new ProfileError(
      `profile "${resolved.system}": roll_type "overlay" nao rola por conta propria — use rollOverlay`,
    );
  }

  const optionalMissing = validateProfileInputs(resolved, inputs);

  const state = createRollState(options);
  const groups: Record<string, RollGroup> = {};
  const notations: string[] = [];
  for (const field of resolved.fields) {
    const { spec, notation } = fieldSpec(field, inputs);
    const group = rollDice(spec, state);
    if (field.successRule !== null) {
      // Sucessos: CONTAGEM de dados que batem a regra, nao a soma —
      // "[2, 5, 6, 1] = 2" em vez do jogador ter que contar na mao
      // (pool_d6/Shadowrun).
      //
      // O modificador, quando existe, SOMA na contagem em vez de somar nos
      // valores dos dados: sao "sucessos que ja estavam na mesa", nao um
      // dado a mais. E o que permite o push do Year Zero mostrar
      // "[6, 3, 4] + 2 = 3" (2 sucessos travados na rolagem anterior) em
      // vez de obrigar o jogador a somar de cabeca com o chip do lado.
      group.total =
        group.rolls.filter((v) => matchesCondition(v, field.successRule!)).length +
        (group.modifier ?? 0);
    } else if (!field.compareIndividually && group.total === undefined) {
      // compare_individually: false (default) = soma — garante total mesmo
      // sem modificador; true mantem o array pra comparacao elemento a
      // elemento (docs/system-profiles.md).
      group.total = group.rolls.reduce((sum, v) => sum + v, 0) + (group.modifier ?? 0);
    }
    groups[field.id] = group;
    notations.push(notation);
  }

  const notation =
    resolved.rollType === "comparison"
      ? `{${notations[0]!}} vs {${notations[1]!}}`
      : resolved.rollType === "multi"
        ? notations.map((n) => `{${n}}`).join(" + ")
        : notations[0]!;

  const { outcome, flags } = evaluateOutcomeRules(
    resolved.outcomeRules,
    groups,
    inputs,
    optionalMissing,
  );

  const result: RollResult = {
    notation,
    groups,
    profile: resolved.system,
    timestamp: options.timestamp ?? new Date().toISOString(),
  };
  if (outcome !== undefined) result.outcome = outcome;
  if (flags.length > 0) result.outcome_flags = flags;
  const tested = testedInputs(resolved, inputs, optionalMissing);
  if (tested.length > 0) result.tested = tested;
  return result;
}

// Rola uma notacao camada 1 QUALQUER (o composer de dados livre monta o
// que o jogador escolheu, sem saber de profile nenhum) e avalia as
// outcome_rules de um profile "overlay" sobre o resultado — roll_under
// aplica "<= target" em cima de "1d20", "3d6", etc, o que o jogador tiver
// montado. Aceita um SystemProfile ja carregado, um id de sistema (Node)
// ou conteudo YAML (string), igual rollWithProfile.
// Input "mode" (adv/dis) na notacao LIVRE do overlay (roll_under): mesmo
// acucar NdXadv/NdXdis que d20/pbta aplicam via "{input.mode}" num field
// fixo, so que aqui a notacao nao pertence ao profile — vem de fora, do
// composer. So aplica quando a notacao e UM grupo de UM termo so ("1d20",
// "3d6"): em "2d6+1d4" ou "{a} vs {b}" nao ha como saber qual dado vira
// vantagem, entao fica intocada e o "mode" e ignorado (o proximo roll com
// notacao simples volta a funcionar sozinho).
function applyOverlayMode(
  notation: string,
  inputs: ProfileInputs,
  profile: SystemProfile,
): string {
  const mode = inputs["mode"];
  if (mode !== "adv" && mode !== "dis") return notation;
  let ast: NotationAST;
  try {
    ast = parseNotation(notation);
  } catch {
    return notation;
  }
  if (ast.groups.length !== 1 || ast.groups[0]!.terms.length !== 1) return notation;
  // profile.modeFavorsLow (roll_under): "Vantagem" tem que manter o dado
  // BAIXO, entao o token literal do parser (adv = fica com o maior) sai
  // trocado pelo oposto.
  const token = profile.modeFavorsLow ? (mode === "adv" ? "dis" : "adv") : mode;
  return `${notation}${token}`;
}

// Inputs do profile citados nas outcome_rules (o "quanto precisava tirar")
// — CD, pericia, valor testado, limite... "mod"/"mode" nunca aparecem
// dentro de uma condition (eles mudam a rolagem, nao a comparacao), entao
// ficam de fora sozinhos, sem lista de exclusao a mao.
function testedInputs(
  profile: SystemProfile,
  inputs: ProfileInputs,
  optionalMissing: ReadonlySet<string>,
): { label: string; value: number | string }[] {
  const ids = new Set<string>();
  for (const rule of profile.outcomeRules) {
    for (const m of rule.condition.matchAll(INPUT_REF)) ids.add(m[1]!);
  }
  const result: { label: string; value: number | string }[] = [];
  for (const input of profile.inputs) {
    if (!ids.has(input.id) || optionalMissing.has(input.id)) continue;
    const value = inputs[input.id];
    if (value === undefined) continue;
    result.push({ label: input.label, value });
  }
  return result;
}

export async function rollOverlay(
  profile: SystemProfile | string,
  notation: string,
  inputs: ProfileInputs,
  options: RollOptions = {},
): Promise<RollResult> {
  const resolved = typeof profile === "string" ? await loadProfile(profile) : profile;
  if (resolved.rollType !== "overlay") {
    throw new ProfileError(
      `profile "${resolved.system}": rollOverlay exige roll_type "overlay"`,
    );
  }

  const optionalMissing = validateProfileInputs(resolved, inputs);
  const rolled = roll(applyOverlayMode(notation, inputs, resolved), options);

  // roll() so preenche `total` com operador de soma explicito (modificador
  // ou keep/drop) ou grupo de 1 dado (docs/roll-notation.md) — um "3d6"
  // solto do composer nao teria total, e as outcome_rules do overlay
  // (ex.: "roll.total <= {input.target}") precisam de um numero sempre.
  const groups: Record<string, RollGroup> = {};
  for (const [id, group] of Object.entries(rolled.groups)) {
    groups[id] =
      group.total === undefined
        ? { ...group, total: group.rolls.reduce((sum, v) => sum + v, 0) + (group.modifier ?? 0) }
        : group;
  }

  const { outcome, flags } = evaluateOutcomeRules(
    resolved.outcomeRules,
    groups,
    inputs,
    optionalMissing,
  );

  const result: RollResult = { ...rolled, groups, profile: resolved.system };
  if (outcome !== undefined) result.outcome = outcome;
  if (flags.length > 0) result.outcome_flags = flags;
  const tested = testedInputs(resolved, inputs, optionalMissing);
  if (tested.length > 0) result.tested = tested;
  return result;
}
