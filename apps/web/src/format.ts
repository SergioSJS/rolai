// Formatacao de resultados pra exibicao textual (resumo, historico, tier
// de texto puro). Sem logica de regras — so apresentacao do RollResult.

import { parseNotation } from "@rolai/rules-engine";
import type { RollGroup, RollResult } from "@rolai/rules-engine";

// Labels pt-BR pros outcomes conhecidos dos profiles versionados
// (packages/rules-engine/profiles/*.yaml). Outcome desconhecido (profile
// custom) cai no id cru.
const OUTCOME_LABELS: Record<string, string> = {
  strong_hit: "sucesso forte",
  weak_hit: "sucesso parcial",
  miss: "falha",
  match: "match!",
  critical: "crítico",
  full_success: "sucesso total",
  partial_success: "sucesso parcial",
  // fate
  success_with_style: "sucesso com estilo",
  success: "sucesso",
  tie: "empate",
  fail: "falha",
  // d20
  critical_success: "acerto crítico",
  critical_failure: "falha crítica",
  // d100 (BRP)
  extreme_success: "sucesso extremo",
  hard_success: "sucesso difícil",
  regular_success: "sucesso",
  fumble: "desastre",
};

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? outcome;
}

// Campo opcional que pode chegar como `null` (JSON de outro cliente/servidor)
// em vez de ausente. Vira undefined pra UI nunca imprimir "null".
function optionalNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export function formatGroup(group: RollGroup): string {
  const rolls = `[${group.rolls.join(", ")}]`;
  const mod = optionalNumber(group.modifier);
  const modifier =
    mod !== undefined && mod !== 0
      ? mod > 0
        ? ` + ${mod}`
        : ` − ${Math.abs(mod)}`
      : "";
  const groupTotal = optionalNumber(group.total);
  const total = groupTotal !== undefined ? ` = ${groupTotal}` : "";
  return `${rolls}${modifier}${total}`;
}

// Resumo curto de uma linha: "2d6+3: [4, 5] + 3 = 12" (mais outcome, se houver).
export function summarizeResult(result: RollResult): string {
  const groups = Object.values(result.groups).map(formatGroup).join(" vs ");
  const base = groups === "" ? result.notation : groups;
  return typeof result.outcome === "string"
    ? `${base} — ${outcomeLabel(result.outcome)}`
    : base;
}

// Grupo pronto pra exibicao: junta os rolls do resultado com as faces
// parseadas da notacao (o RollGroup nao carrega o tipo do dado).
export interface DisplayGroup {
  name: string;
  sides: number | null;
  rolls: number[];
  /** Descartados pelo keep/drop — exibidos apagados, sem entrar no total. */
  dropped?: number[];
  // Grupo de dado Fudge: o valor e sinal (-1/0/+1), nao numero de face.
  fudge?: boolean;
  modifier?: number;
  total?: number;
}

// Valor de um dado como o jogador le: dado Fudge vira sinal.
export function dieFaceLabel(value: number, fudge?: boolean): string {
  if (!fudge) return String(value);
  return value > 0 ? "+" : value < 0 ? "−" : "0";
}

export function displayGroups(result: RollResult): DisplayGroup[] {
  let specs: { sides: number | null; fudge: boolean }[] = [];
  try {
    specs = parseNotation(result.notation).groups.map((g) => ({
      sides: g.dice.sides,
      fudge: g.dice.fudge === true,
    }));
  } catch {
    specs = [];
  }
  return Object.entries(result.groups).map(([name, group], i) => {
    const spec = specs[i];
    const display: DisplayGroup = {
      name,
      sides: spec?.sides ?? null,
      rolls: group.rolls,
    };
    // Rolagem inteira na tela: "4d6kh3" mostrando so 3 dados esconde
    // metade do que aconteceu, e "10d6kh1" mostrava 1 de 10.
    const dropped = Array.isArray(group.dropped) ? group.dropped : undefined;
    if (dropped !== undefined && dropped.length > 0) display.dropped = dropped;
    if (spec?.fudge) display.fudge = true;
    const modifier = optionalNumber(group.modifier);
    const total = optionalNumber(group.total);
    if (modifier !== undefined) display.modifier = modifier;
    if (total !== undefined) display.total = total;
    return display;
  });
}
