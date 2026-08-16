// Parser da notacao de dados camada 1 — ver docs/roll-notation.md.
// Produz o AST (NotationAST); a execucao fica em roller.ts.

export type ComparisonOp = "<" | "<=" | ">" | ">=" | "=";
export type KeepDropType = "kh" | "kl" | "dh" | "dl";

export interface RerollSpec {
  op: ComparisonOp;
  value: number;
}

export interface KeepDropSpec {
  type: KeepDropType;
  count: number;
}

export interface DiceSpec {
  count: number;
  sides: number;
  modifier: number;
  // Distingue "2d6" de "2d6+0" (profiles interpolam modificador mesmo zero):
  // a presenca explicita de modificador forca o calculo de `total`.
  hasModifier: boolean;
  keepDrop?: KeepDropSpec;
  reroll?: RerollSpec;
  // Dado Fudge/Fate ("4dF"): tres faces com valor -1, 0 e +1. `sides` fica 3
  // (tres resultados distintos, o que mantem keep/drop e o RNG coerentes);
  // quem mapeia pro intervalo [-1, 1] e o roller.
  fudge?: true;
  // Cartas de baralho ("2c"): valores 1..10 (ou 1..13).
  card?: true;
}

// Um termo de dado dentro de um grupo multi-termo ("2d6+1d4-1d20").
// `sign` aplica na soma do total; keep/drop/reroll ficam presos ao termo
// (nunca misturam dados de termos diferentes). O modificador numerico
// NAO vive no termo — numeros soltos agregam no modificador do grupo.
export interface DiceTerm {
  sign: 1 | -1;
  dice: DiceSpec;
}

export interface GroupSpec {
  name: string;
  // Primeiro termo + modificador agregado do grupo — leitura historica do
  // campo, mantida pra compatibilidade. Em grupo multi-termo, use `terms`.
  dice: DiceSpec;
  // Termos de dado em ordem. Sempre presente: grupo simples tem 1 termo.
  terms: DiceTerm[];
}

export interface NotationAST {
  groups: GroupSpec[];
}

export class NotationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotationError";
  }
}

const MAX_DICE = 100;
const MAX_SIDES = 1000;

const GROUP_PATTERN = /^\{([^{}]+)\}\s*vs\s*\{([^{}]+)\}$/i;
// N grupos independentes ("nao competem entre si", roll_type "multi" dos
// profiles — docs/system-profiles.md): "{2d10} + {2d10}". Sem "vs": os
// grupos aqui nunca sao comparados um com o outro pela gramatica.
const PLUS_GROUP_PATTERN = /^\{[^{}]+\}(?:\s*\+\s*\{[^{}]+\})+$/;
// "2d6", "d20", "4dF", "2c" (cartas de baralho).
const DICE_HEAD = /^(\d*)(?:d(\d+|f)|c)/i;
const NUMBER = /^(\d+)/;
const TOKEN_PATTERNS: [RegExp, string][] = [
  [/^(kh|kl|dh|dl)(\d+)/i, "keepdrop"],
  [/^!r(<=|>=|<|>|=)(\d+)/i, "reroll"],
  [/^(adv|dis)/i, "advantage"],
  [/^([+-])(\d+)/, "modifier"],
];

// Sufixos que NAO sao modificador numerico (keep/drop, reroll, adv/dis) —
// compartilhado entre o parser de expressao unica e o de termos.
const TERM_TOKEN_PATTERNS = TOKEN_PATTERNS.filter(([, kind]) => kind !== "modifier");

function parseHead(rest: string, expr: string): { spec: DiceSpec; rest: string } {
  const head = DICE_HEAD.exec(rest);
  if (!head) {
    throw new NotationError(`expressao de dados invalida: "${expr}"`);
  }
  const count = head[1] === "" ? 1 : Number(head[1]);
  const isCard = head[0].toLowerCase().endsWith("c");
  const fudge = !isCard && head[2]?.toLowerCase() === "f";
  const sides = isCard ? 13 : fudge ? 3 : Number(head[2]);
  if (!Number.isInteger(count) || count < 1 || count > MAX_DICE) {
    throw new NotationError(`quantidade de dados invalida em "${expr}"`);
  }
  if (!fudge && !isCard && (!Number.isInteger(sides) || sides < 2 || sides > MAX_SIDES)) {
    throw new NotationError(`numero de faces invalido em "${expr}"`);
  }
  const spec: DiceSpec = { count, sides, modifier: 0, hasModifier: false };
  if (fudge) spec.fudge = true;
  if (isCard) spec.card = true;
  return { spec, rest: rest.slice(head[0].length) };
}

// Consome sufixos de um termo. `allowModifier`: so o caminho de expressao
// unica (legado) aceita "+3"/"-1" como sufixo; no caminho multi-termo um
// sinal de +/- sempre inicia o proximo termo.
function consumeSuffixes(
  spec: DiceSpec,
  start: string,
  expr: string,
  allowModifier: boolean,
): string {
  let rest = start;
  const patterns = allowModifier ? TOKEN_PATTERNS : TERM_TOKEN_PATTERNS;
  while (rest.trim().length > 0) {
    rest = rest.trimStart();
    let matched = false;
    for (const [pattern, kind] of patterns) {
      const m = pattern.exec(rest);
      if (!m) continue;
      matched = true;
      rest = rest.slice(m[0].length);
      switch (kind) {
        case "keepdrop": {
          if (spec.keepDrop) {
            throw new NotationError(`keep/drop duplicado em "${expr}"`);
          }
          const n = Number(m[2]);
          if (!Number.isInteger(n) || n < 1) {
            throw new NotationError(`keep/drop invalido em "${expr}"`);
          }
          spec.keepDrop = { type: m[1]!.toLowerCase() as KeepDropType, count: n };
          break;
        }
        case "reroll": {
          if (spec.reroll) {
            throw new NotationError(`reroll duplicado em "${expr}"`);
          }
          if (spec.fudge) {
            // As faces do dado Fudge sao -1/0/+1: o alvo numerico do "!r"
            // (que exige inteiro >= 1) nao tem significado aqui.
            throw new NotationError(`reroll nao se aplica a dado Fudge em "${expr}"`);
          }
          const value = Number(m[2]);
          if (!Number.isInteger(value) || value < 1 || value > spec.sides) {
            throw new NotationError(`reroll invalido em "${expr}"`);
          }
          spec.reroll = { op: m[1] as ComparisonOp, value };
          break;
        }
        case "advantage": {
          // Acucar: NdXadv -> (N+1)dX kh N; NdXdis -> (N+1)dX kl N.
          if (spec.keepDrop) {
            throw new NotationError(`adv/dis combinado com keep/drop em "${expr}"`);
          }
          const kind2 = m[1]!.toLowerCase();
          spec.keepDrop = { type: kind2 === "adv" ? "kh" : "kl", count: spec.count };
          spec.count = spec.count + 1;
          break;
        }
        case "modifier": {
          if (spec.hasModifier) {
            throw new NotationError(`modificador duplicado em "${expr}"`);
          }
          spec.modifier = m[1] === "-" ? -Number(m[2]) : Number(m[2]);
          spec.hasModifier = true;
          break;
        }
      }
      break;
    }
    if (!matched) {
      if (allowModifier) {
        throw new NotationError(`token inesperado em "${expr}": "${rest}"`);
      }
      // Multi-termo: parar no que nao e sufixo — o chamador decide.
      return rest;
    }
  }
  return rest;
}

// Parseia uma expressao de dados isolada: "2d6", "4d6kh3", "4d6!r<2",
// "1d20adv", "2d6+3", e combinacoes desses sufixos em qualquer ordem.
export function parseDiceExpression(expr: string): DiceSpec {
  const trimmed = expr.trim();
  const { spec, rest } = parseHead(trimmed, expr);
  const leftover = consumeSuffixes(spec, rest, trimmed, true);
  if (leftover.trim().length > 0) {
    throw new NotationError(`token inesperado em "${expr}": "${leftover}"`);
  }
  return spec;
}

// Parseia um grupo possivelmente multi-termo: "2d6", "2d6+3",
// "2d6+1d4+3", "1d20-1d4", "4d6kh3+1d20". Termos numericos agregam no
// modificador do grupo; termos de dado guardam sinal e sufixos proprios.
function parseGroupDice(expr: string): { dice: DiceSpec; terms: DiceTerm[] } {
  // Caminho legado primeiro: tudo que a gramatica ja aceitava continua
  // com o mesmo AST de antes (modificador como sufixo, sufixos em
  // qualquer ordem). O multi-termo so entra no que antes era invalido.
  try {
    const spec = parseDiceExpression(expr);
    const termSpec: DiceSpec = { ...spec, modifier: 0, hasModifier: false };
    return { dice: spec, terms: [{ sign: 1, dice: termSpec }] };
  } catch (legacyError) {
    let rest = expr.trim();
    const terms: DiceTerm[] = [];
    let modifier = 0;
    let hasModifier = false;
    let sign: 1 | -1 = 1;
    let first = true;

    while (rest.length > 0) {
      rest = rest.trimStart();
      if (!first) {
        const signMatch = /^([+-])/.exec(rest);
        if (!signMatch) {
          throw new NotationError(`token inesperado em "${expr}": "${rest}"`);
        }
        sign = signMatch[1] === "-" ? -1 : 1;
        rest = rest.slice(1).trimStart();
      }
      if (DICE_HEAD.test(rest)) {
        const parsed = parseHead(rest, expr);
        const leftover = consumeSuffixes(parsed.spec, parsed.rest, expr, false);
        terms.push({ sign: first ? 1 : sign, dice: parsed.spec });
        rest = leftover;
      } else if (!first && NUMBER.test(rest)) {
        const numMatch = NUMBER.exec(rest)!;
        modifier += sign * Number(numMatch[1]);
        hasModifier = true;
        rest = rest.slice(numMatch[0].length);
      } else {
        throw legacyError;
      }
      first = false;
    }

    if (terms.length === 0) throw legacyError;
    const firstSpec = terms[0]!.dice;
    const dice: DiceSpec = { ...firstSpec, modifier, hasModifier };
    return { dice, terms };
  }
}

// Grupos "+" (PLUS_GROUP_PATTERN ja garantiu o formato inteiro da string —
// so blocos {...} separados por "+", nada mais): extrai cada bloco na
// ordem em que aparece. Nomes genericos ("group0", "group1", ...) bastam
// porque quem consome (rollWithProfile, displayGroups, diceFromResult)
// sempre zipa pelo INDICE do array, nunca pelo nome.
function parsePlusGroups(trimmed: string): NotationAST {
  const blocks = [...trimmed.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]!);
  return {
    groups: blocks.map((expr, i) => ({ name: `group${i}`, ...parseGroupDice(expr) })),
  };
}

// Parseia a notacao camada 1 completa.
//
// - Expressao unica ("2d6+3", "2d6+1d4+3") vira um unico grupo "roll".
// - "{...} vs {...}" produz dois grupos: "action" (esquerda) e
//   "challenge" (direita), resolvidos em arrays separados — a gramatica
//   nunca soma um grupo contra o outro.
// - "{...} + {...} + ..." produz N grupos independentes (roll_type "multi"
//   dos profiles) — tambem nunca somados entre si.
export function parseNotation(notation: string): NotationAST {
  const trimmed = notation.trim();
  if (trimmed === "") {
    throw new NotationError("notacao vazia");
  }
  const vs = GROUP_PATTERN.exec(trimmed);
  if (vs) {
    return {
      groups: [
        { name: "action", ...parseGroupDice(vs[1]!) },
        { name: "challenge", ...parseGroupDice(vs[2]!) },
      ],
    };
  }
  if (PLUS_GROUP_PATTERN.test(trimmed)) {
    return parsePlusGroups(trimmed);
  }
  if (/[{}]|\bvs\b/i.test(trimmed)) {
    throw new NotationError(`sintaxe de grupo invalida: "${notation}"`);
  }
  return { groups: [{ name: "roll", ...parseGroupDice(trimmed) }] };
}
