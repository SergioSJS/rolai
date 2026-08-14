// Formatacao de resultados pra exibicao textual (resumo, historico, tier
// de texto puro). Sem logica de regras — so apresentacao do RollResult.

import { parseNotation } from "@rolai/rules-engine";
import type { RollGroup, RollResult } from "@rolai/rules-engine";

// Labels pt-BR pros outcomes conhecidos dos profiles versionados
// (packages/rules-engine/profiles/*.yaml). Outcome desconhecido (profile
// custom) cai no id cru.
const OUTCOME_LABELS: Record<string, string> = {
  strong_hit: "sucesso completo",
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
  // roll_under e wod5/pool_d6 (vs dificuldade/limite) reusam success/fail
  // do fate, ja mapeados acima.
  // infaernum — sim ou não
  sim: "sim",
  nao: "não",
  // infaernum — rolagem padrão (3d6 individual, quantizado: pool fixo em
  // 3 dados, cada categoria so ocorre 0 a 3 vezes).
  desgraca_x1: "1 desgraça",
  desgraca_x2: "2 desgraças",
  desgraca_x3: "3 desgraças",
  vislumbre_x1: "1 vislumbre",
  vislumbre_x2: "2 vislumbres",
  vislumbre_x3: "3 vislumbres",
  facanha_x1: "1 façanha",
  facanha_x2: "2 façanhas",
  facanha_x3: "3 façanhas",
  milagre_x1: "1 milagre",
  milagre_x2: "2 milagres",
  milagre_x3: "3 milagres",
  // wod5 — pool Fome/Ira (critical reusa o do fitd, ja mapeado acima)
  messy_critical: "crítico manchado",
  bestial_failure: "fracasso bestial",
  // pool_d6 (Shadowrun-style)
  glitch: "pane",
  critical_glitch: "pane crítica",
};

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? outcome;
}

/**
 * Tom do resultado, pra UI pintar sucesso e falha diferente.
 *
 * Ate aqui TODO outcome saia verde — uma falha crítica no d20 tinha
 * exatamente a mesma cara de um acerto crítico, e quem le de longe (ou na
 * stream) so via "deu alguma coisa".
 *
 * `neutral` e a resposta honesta pra outcome que este mapa nao conhece
 * (profile custom, versao nova de um profile): pintar de verde uma falha e
 * pior do que nao pintar. Fica com a cor de acento, como antes.
 *
 * Isto e APRESENTACAO, nao regra: quem decide o outcome sao as
 * `outcome_rules` do profile (packages/rules-engine/profiles/*.yaml). Por
 * isso mora aqui e nao no motor — e por isso o bundle headless do Android
 * nao muda por causa dele.
 */
export type OutcomeTone = "success" | "partial" | "failure" | "neutral";

const OUTCOME_TONES: Record<string, OutcomeTone> = {
  // Falha: e o que precisava de vermelho.
  miss: "failure",
  fail: "failure",
  critical_failure: "failure",
  fumble: "failure",
  // Infaernum (3d6 individual): desgraca e sempre o lado ruim, em qualquer
  // quantidade.
  desgraca_x1: "failure",
  desgraca_x2: "failure",
  desgraca_x3: "failure",
  // wod5: fracasso com custo extra — ainda fracasso.
  bestial_failure: "failure",
  // pool_d6 (Shadowrun-style): glitch e sempre revés, mesmo o nao-critico.
  glitch: "failure",
  critical_glitch: "failure",
  // Infaernum — oraculo sim ou não.
  nao: "failure",
  // Meio do caminho — sucesso com custo, ou empate. Nem verde, nem vermelho.
  weak_hit: "partial",
  partial_success: "partial",
  tie: "partial",
  vislumbre_x1: "partial",
  vislumbre_x2: "partial",
  vislumbre_x3: "partial",
  // Sucesso.
  strong_hit: "success",
  full_success: "success",
  success: "success",
  success_with_style: "success",
  critical_success: "success",
  critical: "success",
  extreme_success: "success",
  hard_success: "success",
  regular_success: "success",
  facanha_x1: "success",
  facanha_x2: "success",
  facanha_x3: "success",
  milagre_x1: "success",
  milagre_x2: "success",
  milagre_x3: "success",
  // wod5: critico "sujo" — ainda um sucesso, so com custo narrativo.
  messy_critical: "success",
  // Infaernum — oraculo sim ou não.
  sim: "success",
  // Ironsworn: "match" e os dois dados de desafio iguais — um EVENTO que
  // pode acontecer junto de acerto ou de falha, entao nao tem tom proprio.
  match: "neutral",
};

export function outcomeTone(outcome: string): OutcomeTone {
  return OUTCOME_TONES[outcome] ?? "neutral";
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

// So os dados: "[4, 5] + 3 = 12". Separado do outcome porque a UI precisa
// pintar o outcome (sucesso/falha) sem pintar os numeros junto.
export function summarizeDice(result: RollResult): string {
  // roll_type "multi" tem grupos independentes ("+" na notacao, nao "vs")
  // — usar sempre " vs " rotulava campo que nao compete como se competisse.
  const joiner = result.notation.includes(" + ") ? " + " : " vs ";
  const groups = Object.values(result.groups).map(formatGroup).join(joiner);
  return groups === "" ? result.notation : groups;
}

// Resumo curto de uma linha: "2d6+3: [4, 5] + 3 = 12" (mais outcome, se houver).
export function summarizeResult(result: RollResult): string {
  const base = summarizeDice(result);
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
