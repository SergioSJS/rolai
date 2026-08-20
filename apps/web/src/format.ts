// Formatacao de resultados pra exibicao textual (resumo, historico, tier
// de texto puro). Sem logica de regras — so apresentacao do RollResult.

import { parseNotation } from "@rolai/rules-engine";
import type { RollResult } from "@rolai/rules-engine";
// Tabelas puras, num modulo sem dependencia nenhuma — ver outcomeTables.ts
// pro motivo (o bundle headless do Android nao pode enxergar React).
import { GROUP_LABELS, OUTCOME_LABELS, OUTCOME_TONES } from "./outcomeTables";
import type { OutcomeTone } from "./outcomeTables";

export type { OutcomeTone } from "./outcomeTables";
export { GROUP_LABELS, OUTCOME_LABELS, OUTCOME_TONES } from "./outcomeTables";

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? outcome;
}

export function groupLabel(name: string): string {
  const match = /^group(\d+)$/i.exec(name);
  if (match) {
    const num = Number(match[1]) + 1;
    return `grupo ${num}`;
  }
  return GROUP_LABELS[name.toLowerCase()] ?? name;
}

export function outcomeTone(outcome: string): OutcomeTone {
  return OUTCOME_TONES[outcome] ?? "neutral";
}

// Campo opcional que pode chegar como `null` (JSON de outro cliente/servidor)
// em vez de ausente. Vira undefined pra UI nunca imprimir "null".
function optionalNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" ? value : undefined;
}

// So os dados: "[4, 5] + 3 = 12" ou "[4, 2] + 2 = 8 vs [A♥, 4♦]". Separado
// do outcome porque a UI precisa pintar o outcome (sucesso/falha) sem pintar
// os numeros junto.
export function summarizeDice(result: RollResult): string {
  const groups = displayGroups(result);
  const isVsNotation = result.notation.includes(" vs ");
  const joiner = isVsNotation ? " vs " : " + ";
  const isSumNotation = !isVsNotation && (result.notation.includes("+") || groups.length > 1);
  const parts = groups.map((g) => {
    // Pool de zero dados (Forçar do Year Zero pode zerar um deles): o motor
    // rola e descarta um dado so pra ter notacao valida — "[]" no historico
    // fica com cara de bug, e mostrar o dado descartado seria pior ainda.
    const rolls =
      g.rolls.length === 0
        ? "—"
        : `[${g.rolls
            .map((r) => `${dieFaceLabel(r.value, r.fudge, r.card)}${r.symbol ?? ""}`)
            .join(", ")}]`;
    const mod = g.modifier;
    const modifier =
      mod !== undefined && mod !== 0
        ? mod > 0
          ? ` + ${mod}`
          : ` − ${Math.abs(mod)}`
        : "";
    const groupTotal =
      g.total ??
      (isSumNotation && typeof result.outcome !== "string"
        ? g.rolls.reduce((sum, r) => sum + r.value, 0) + (g.modifier ?? 0)
        : undefined);
    const total = groupTotal !== undefined ? ` = ${groupTotal}` : "";
    return `${rolls}${modifier}${total}`;
  });
  let text = parts.join(joiner);
  if (isSumNotation && groups.length > 1 && typeof result.outcome !== "string") {
    const grandTotal = groups.reduce(
      (sum, g) =>
        sum +
        (g.total ?? g.rolls.reduce((s, r) => s + r.value, 0) + (g.modifier ?? 0)),
      0,
    );
    text += ` = ${grandTotal}`;
  }
  return text === "" ? result.notation : text;
}

// Resumo curto de uma linha: "2d6+3: [4, 5] + 3 = 12" (mais outcome, se houver).
export function summarizeResult(result: RollResult): string {
  const base = summarizeDice(result);
  return typeof result.outcome === "string"
    ? `${base} — ${outcomeLabel(result.outcome)}`
    : base;
}

export function wod5Successes(result: RollResult): number {
  const regRolls = result.groups["regular"]?.rolls ?? [];
  const hungRolls = result.groups["hunger"]?.rolls ?? [];
  const regTens = regRolls.filter((r) => r === 10).length;
  const hungTens = hungRolls.filter((r) => r === 10).length;
  const totalTens = regTens + hungTens;
  const baseSuccesses =
    regRolls.filter((r) => r >= 6).length + hungRolls.filter((r) => r >= 6).length;
  const critBonus = Math.floor(totalTens / 2) * 2;
  return baseSuccesses + critBonus;
}

import { cardFromRollValue, isRedSuit, SUIT_SYMBOL } from "./cardFormat";

export interface DisplayRoll {
  value: number;
  sides: number | null;
  // Dado Fudge (4dF): o valor e sinal (-1/0/+1), nao numero de face.
  fudge?: boolean;
  // Carta de baralho (Firelights, notacao 'c', etc).
  card?: boolean;
  isRed?: boolean;
  symbol?: string;
  slot?: number;
  theme?: string;
}

// Grupo pronto pra exibicao: junta os rolls do resultado com as faces
// parseadas da notacao (o RollGroup nao carrega o tipo do dado).
export interface DisplayGroup {
  name: string;
  rolls: DisplayRoll[];
  /** Descartados pelo keep/drop — exibidos apagados, sem entrar no total. */
  dropped?: DisplayRoll[];
  modifier?: number;
  total?: number;
  slot?: number;
  theme?: string;
}

// Valor de um dado ou carta como o jogador le: dado Fudge vira sinal, carta vira A/J/Q/K.
export function dieFaceLabel(value: number, fudge?: boolean, card?: boolean): string {
  if (card) {
    if (value === 1) return "A";
    if (value === 11) return "J";
    if (value === 12) return "Q";
    if (value === 13) return "K";
    return String(value);
  }
  if (!fudge) return String(value);
  return value > 0 ? "+" : value < 0 ? "−" : "0";
}

export function displayGroups(result: RollResult): DisplayGroup[] {
  let ast;
  try {
    ast = parseNotation(result.notation);
  } catch {
    ast = null;
  }

  const rawGroups = Object.entries(result.groups);
  let totalCardCount = 0;

  return rawGroups.map(([name, group], gi) => {
    const groupSpec = ast?.groups[gi];
    const rolls: DisplayRoll[] = [];
    const dropped: DisplayRoll[] = [];

    const theme = group.theme;
    const slot = group.slot ?? groupSpec?.slot;

    if (groupSpec && groupSpec.terms.length > 0) {
      let rollCursor = 0;
      let dropCursor = 0;
      for (const term of groupSpec.terms) {
        const spec = term.dice;
        const kd = spec.keepDrop;
        const kept = kd
          ? kd.type === "kh" || kd.type === "kl"
            ? kd.count
            : spec.count - kd.count
          : spec.count;
        const dropCount = spec.count - kept;

        const termRolls = group.rolls.slice(rollCursor, rollCursor + kept);
        for (const v of termRolls) {
          const item: DisplayRoll = {
            value: v,
            sides: spec.sides ?? null,
            fudge: spec.fudge === true,
            card: spec.card === true,
          };
          if (slot !== undefined) item.slot = slot;
          if (theme) item.theme = theme;
          if (spec.card) {
            const card = cardFromRollValue(v, totalCardCount++);
            item.isRed = isRedSuit(card);
            item.symbol = SUIT_SYMBOL[card.suit];
          }
          rolls.push(item);
        }
        rollCursor += kept;

        if (group.dropped && dropCount > 0) {
          const termDropped = group.dropped.slice(dropCursor, dropCursor + dropCount);
          for (const v of termDropped) {
            const item: DisplayRoll = {
              value: v,
              sides: spec.sides ?? null,
              fudge: spec.fudge === true,
              card: spec.card === true,
            };
            if (slot !== undefined) item.slot = slot;
            if (theme) item.theme = theme;
            if (spec.card) {
              const card = cardFromRollValue(v, totalCardCount++);
              item.isRed = isRedSuit(card);
              item.symbol = SUIT_SYMBOL[card.suit];
            }
            dropped.push(item);
          }
          dropCursor += dropCount;
        }
      }
      if (rollCursor < group.rolls.length) {
        for (let j = rollCursor; j < group.rolls.length; j++) {
          const item: DisplayRoll = {
            value: group.rolls[j]!,
            sides: null,
          };
          if (slot !== undefined) item.slot = slot;
          if (theme) item.theme = theme;
          rolls.push(item);
        }
      }
    } else {
      for (const v of group.rolls) {
        const item: DisplayRoll = {
          value: v,
          sides: null,
        };
        if (slot !== undefined) item.slot = slot;
        if (theme) item.theme = theme;
        rolls.push(item);
      }
      if (group.dropped) {
        for (const v of group.dropped) {
          const item: DisplayRoll = {
            value: v,
            sides: null,
          };
          if (slot !== undefined) item.slot = slot;
          if (theme) item.theme = theme;
          dropped.push(item);
        }
      }
    }

    const display: DisplayGroup = {
      name,
      rolls,
    };
    if (slot !== undefined) display.slot = slot;
    if (theme) display.theme = theme;
    if (dropped.length > 0) display.dropped = dropped;
    const modifier = optionalNumber(group.modifier);
    const total = optionalNumber(group.total);
    if (modifier !== undefined) display.modifier = modifier;
    if (total !== undefined) display.total = total;
    return display;
  });
}
