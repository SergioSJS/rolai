// Formatacao de resultados pra exibicao textual (resumo, historico, tier
// de texto puro). Sem logica de regras — so apresentacao do RollResult.

import { parseNotation } from "@rolai/rules-engine";
import type { RollResult } from "@rolai/rules-engine";

// Labels pt-BR pros outcomes conhecidos dos profiles versionados
// (packages/rules-engine/profiles/*.yaml). Outcome desconhecido (profile
// custom) cai no id cru.
const OUTCOME_LABELS: Record<string, string> = {
  strong_hit: "sucesso completo",
  weak_hit: "sucesso parcial",
  miss: "falha",
  match: "combinação!",
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
  // fractal — pool de d6, maior dado decide. success/fail reusam fate/pool_d6
  // (ja mapeados acima). Impulso conta os seis ALEM do primeiro; ruptura
  // conta os dados em 1 (evento paralelo, nunca outcome primario).
  sucesso_impulso_x2: "sucesso com 1 impulso extra",
  sucesso_impulso_x3: "sucesso com 2 impulsos extras",
  sucesso_impulso_x4: "sucesso com 3 impulsos extras",
  ruptura_x1: "ruptura: 1 fato quebrado",
  ruptura_x2: "ruptura: 2 fatos quebrados",
  ruptura_x3: "ruptura: 3 fatos quebrados",
  ruptura_x4: "ruptura: 4 fatos quebrados",
  // year zero (yze/yze_fbl/yze_alien/yze_wdu) — success/fail reusam os do
  // fate, ja mapeados acima. Dano e evento PARALELO ao sucesso (o 1 conta
  // na rolagem empurrada mesmo quando ela acerta), e o x3 e "3 ou mais".
  yze_dano_atributo_x1: "1 dano de atributo",
  yze_dano_atributo_x2: "2 danos de atributo",
  yze_dano_atributo_x3: "3+ danos de atributo",
  yze_dano_equipamento_x1: "1 dano de equipamento",
  yze_dano_equipamento_x2: "2 danos de equipamento",
  yze_dano_equipamento_x3: "3+ danos de equipamento",
  yze_panico: "pânico!",
  yze_descontrole: "descontrole!",
};

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? outcome;
}

const GROUP_LABELS: Record<string, string> = {
  action: "ação",
  challenge: "desafio",
  verb: "verbo",
  noun: "substantivo",
  regular: "regulares",
  hunger: "fome/ira",
  pool: "pool",
  roll: "rolagem",
  // year zero
  base: "base",
  pericia: "perícia",
  equipamento: "equipamento",
  estresse: "estresse",
};

export function groupLabel(name: string): string {
  return GROUP_LABELS[name.toLowerCase()] ?? name;
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
  // fractal: impulso e sucesso "mais forte", mesma cor do sucesso normal —
  // igual critical_success do d20, a distincao e so no texto do label.
  sucesso_impulso_x2: "success",
  sucesso_impulso_x3: "success",
  sucesso_impulso_x4: "success",
  // Ironsworn: "match" e os dois dados de desafio iguais — um EVENTO que
  // pode acontecer junto de acerto ou de falha, entao nao tem tom proprio.
  match: "neutral",
  // fractal: ruptura e complicacao PARALELA (Fato quebrado) — pode vir
  // junto de sucesso ou falha, entao tambem nao tem tom proprio.
  ruptura_x1: "neutral",
  ruptura_x2: "neutral",
  ruptura_x3: "neutral",
  ruptura_x4: "neutral",
  // year zero: dano, panico e descontrole sao paralelos ao sucesso/falha,
  // mas nenhum deles e ambiguo do jeito que o "match" do Ironsworn e — sao
  // preju, ponto. Neutro os pintava com a cor de acento (verde neste tema)
  // e um "2 danos de atributo" tinha a mesma cara de um acerto. Vermelho,
  // mesmo quando a rolagem em si deu sucesso.
  yze_dano_atributo_x1: "failure",
  yze_dano_atributo_x2: "failure",
  yze_dano_atributo_x3: "failure",
  yze_dano_equipamento_x1: "failure",
  yze_dano_equipamento_x2: "failure",
  yze_dano_equipamento_x3: "failure",
  yze_panico: "failure",
  yze_descontrole: "failure",
};

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
  const joiner = result.notation.includes(" + ") ? " + " : " vs ";
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
    const total = g.total !== undefined ? ` = ${g.total}` : "";
    return `${rolls}${modifier}${total}`;
  });
  const text = parts.join(joiner);
  return text === "" ? result.notation : text;
}

// Resumo curto de uma linha: "2d6+3: [4, 5] + 3 = 12" (mais outcome, se houver).
export function summarizeResult(result: RollResult): string {
  const base = summarizeDice(result);
  return typeof result.outcome === "string"
    ? `${base} — ${outcomeLabel(result.outcome)}`
    : base;
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
          rolls.push({
            value: group.rolls[j]!,
            sides: null,
          });
        }
      }
    } else {
      for (const v of group.rolls) {
        rolls.push({
          value: v,
          sides: null,
        });
      }
      if (group.dropped) {
        for (const v of group.dropped) {
          dropped.push({
            value: v,
            sides: null,
          });
        }
      }
    }

    const display: DisplayGroup = {
      name,
      rolls,
    };
    if (dropped.length > 0) display.dropped = dropped;
    const modifier = optionalNumber(group.modifier);
    const total = optionalNumber(group.total);
    if (modifier !== undefined) display.modifier = modifier;
    if (total !== undefined) display.total = total;
    return display;
  });
}
