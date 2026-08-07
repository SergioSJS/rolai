// Executor do AST de notacao — aplica reroll, keep/drop e modificador e
// produz o RollResult canonico (docs/roll-notation.md).

import { parseNotation } from "./parser.js";
import type { ComparisonOp, DiceSpec, GroupSpec, NotationAST } from "./parser.js";
import { cryptoRandomSource, rollDie } from "./rng.js";
import type { RandomSource, RollGroup, RollResult } from "./types.js";

export interface RollOptions {
  // Fonte de aleatoriedade; default crypto.getRandomValues.
  rng?: RandomSource;
  // Valores finais determinísticos por dado, consumidos em ordem (fila
  // compartilhada entre grupos). Uso: replay de um resultado recebido via
  // WS, ou animacao 3D convergindo pro valor ja decidido. Cada valor deve
  // ser inteiro em [1, faces] do dado que o consome; se a fila esvaziar,
  // os dados restantes usam o rng.
  deterministic?: number[];
  // Timestamp da rolagem; default: agora (ISO 8601).
  timestamp?: string;
}

// Estado mutavel de uma rolagem (fila deterministica + rng).
export interface RollState {
  rng: RandomSource;
  queue: number[];
}

export function createRollState(options: RollOptions = {}): RollState {
  return {
    rng: options.rng ?? cryptoRandomSource,
    queue: options.deterministic ? [...options.deterministic] : [],
  };
}

function matches(op: ComparisonOp, roll: number, value: number): boolean {
  switch (op) {
    case "<":
      return roll < value;
    case "<=":
      return roll <= value;
    case ">":
      return roll > value;
    case ">=":
      return roll >= value;
    case "=":
      return roll === value;
  }
}

// Dado Fudge: as tres faces valem -1, 0 e +1 (a fila deterministica usa o
// mesmo intervalo, e nao 1..3 — e o valor que aparece no RollResult).
function takeValue(state: RollState, spec: DiceSpec): number {
  const next = state.queue.shift();
  if (spec.fudge) {
    if (next === undefined) return rollDie(3, state.rng) - 2;
    if (!Number.isInteger(next) || next < -1 || next > 1) {
      throw new Error(
        `valor deterministico fora do intervalo [-1, 1] (dado Fudge): ${next}`,
      );
    }
    return next;
  }
  if (next === undefined) {
    return rollDie(spec.sides, state.rng);
  }
  if (!Number.isInteger(next) || next < 1 || next > spec.sides) {
    throw new Error(
      `valor deterministico fora do intervalo [1, ${spec.sides}]: ${next}`,
    );
  }
  return next;
}

// Rola um DiceSpec e produz o RollGroup. Exportado para o loader de
// profiles, que rola cada `field` separadamente e nomeia os grupos com os
// ids dos campos.
export function rollDice(spec: DiceSpec, state: RollState): RollGroup {
  const rolls: number[] = [];
  for (let i = 0; i < spec.count; i++) {
    rolls.push(takeValue(state, spec));
  }

  // Reroll condicional: uma unica rerrolagem por dado que bate na condicao.
  if (spec.reroll) {
    for (let i = 0; i < rolls.length; i++) {
      if (matches(spec.reroll.op, rolls[i]!, spec.reroll.value)) {
        rolls[i] = takeValue(state, spec);
      }
    }
  }

  // Keep/drop: `rolls` final contem apenas os dados mantidos, na ordem
  // original em que cairam.
  let kept = rolls;
  let dropped: number[] = [];
  if (spec.keepDrop) {
    const { type, count } = spec.keepDrop;
    const ranked = rolls
      .map((value, index) => ({ value, index }))
      .sort((a, b) => b.value - a.value || a.index - b.index);
    const keepSet = new Set<number>();
    if (type === "kh") {
      for (const entry of ranked.slice(0, count)) keepSet.add(entry.index);
    } else if (type === "kl") {
      for (const entry of ranked.slice(-count)) keepSet.add(entry.index);
    } else if (type === "dh") {
      for (const entry of ranked.slice(count)) keepSet.add(entry.index);
    } else {
      // dl
      for (const entry of ranked.slice(0, -count)) keepSet.add(entry.index);
    }
    kept = rolls.filter((_, index) => keepSet.has(index));
    dropped = rolls.filter((_, index) => !keepSet.has(index));
  }

  const group: RollGroup = { rolls: kept };
  // So quando houve descarte: campo ausente mantem o payload identico pra
  // quem nao usa keep/drop (e o JSON da sala menor).
  if (dropped.length > 0) {
    group.dropped = dropped;
  }
  if (spec.hasModifier) {
    group.modifier = spec.modifier;
  }
  // `total` ausente em grupos multi-dado sem operador de soma explicito
  // (modificador ou keep/drop) — ver docs/roll-notation.md.
  if (spec.hasModifier || spec.keepDrop || kept.length === 1) {
    group.total = kept.reduce((sum, v) => sum + v, 0) + spec.modifier;
  }
  return group;
}

// Rola um grupo do AST. Grupo de termo unico segue o caminho legado
// (mesmas regras de `total` de sempre — ver docs/roll-notation.md).
// Multi-termo ("2d6+1d4-1d20+3"): rola cada termo separado (keep/drop e
// reroll sao por termo), concatena os rolls mantidos NA ORDEM dos termos
// e sempre produz `total` = soma algebrica dos termos + modificador.
export function rollGroup(groupSpec: GroupSpec, state: RollState): RollGroup {
  if (groupSpec.terms.length === 1) {
    return rollDice(groupSpec.dice, state);
  }
  const rolls: number[] = [];
  // Descartados de TODOS os termos, concatenados. Sem isto, o keep/drop
  // dentro de pool misto ("4d6kh3+1d20") perdia o descartado no caminho —
  // o termo unico preservava, o multi-termo nao.
  const dropped: number[] = [];
  let total = 0;
  for (const term of groupSpec.terms) {
    const termGroup = rollDice(term.dice, state);
    rolls.push(...termGroup.rolls);
    if (termGroup.dropped) dropped.push(...termGroup.dropped);
    total += term.sign * termGroup.rolls.reduce((sum, v) => sum + v, 0);
  }
  const group: RollGroup = { rolls, total };
  if (dropped.length > 0) {
    group.dropped = dropped;
  }
  if (groupSpec.dice.hasModifier) {
    group.modifier = groupSpec.dice.modifier;
    group.total = total + groupSpec.dice.modifier;
  }
  return group;
}

export function rollAST(
  ast: NotationAST,
  notation: string,
  options: RollOptions = {},
): RollResult {
  const state = createRollState(options);
  const groups: Record<string, RollGroup> = {};
  for (const groupSpec of ast.groups) {
    groups[groupSpec.name] = rollGroup(groupSpec, state);
  }
  return {
    notation,
    groups,
    timestamp: options.timestamp ?? new Date().toISOString(),
  };
}

// Rola uma notacao camada 1 livre (sem profile, sem outcome).
export function roll(notation: string, options: RollOptions = {}): RollResult {
  return rollAST(parseNotation(notation), notation, options);
}
