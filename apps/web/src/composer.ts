// Compositor de rolagem: monta notacao camada 1 a partir de botoes de
// dados + stepper de modificador. Pool misto e suportado pela extensao
// multi-termo da gramatica (docs/roll-notation.md): clicar d4 depois de
// 2d6 acumula -> "2d6+1d4". A notacao gerada e sempre parseavel pelo
// rules-engine.

import { parseNotation } from "@rolai/rules-engine";

// Tipo de dado no compositor: numero de faces, ou "F" pro dado Fudge/Fate
// (faces -1/0/+1, notacao "4dF").
export type DieKind = number | "F";

export interface ComposerTerm {
  count: number;
  sides: number;
  fudge?: true;
}

export interface ComposerState {
  terms: ComposerTerm[];
  modifier: number;
}

export const COMPOSER_DICE: readonly DieKind[] = [4, 6, 8, 10, 12, 20, 100, "F"];

// Mesmo teto de dados do parser (MAX_DICE em parser.ts) — somado entre
// todos os termos do pool.
export const MAX_COMPOSER_COUNT = 100;
export const MAX_COMPOSER_MODIFIER = 99;

export const DEFAULT_COMPOSER: ComposerState = {
  terms: [{ count: 1, sides: 6 }],
  modifier: 0,
};

// Pool vazio e um estado valido: e o que "Limpar" produz e o que sobra ao
// remover o ultimo dado. A notacao vira "" e o botao Rolar fica desativado
// ate ter dado — melhor que reaparecer um 1d6 fantasma que o usuario nao pediu.
export const EMPTY_COMPOSER: ComposerState = { terms: [], modifier: 0 };

export function dieKind(term: ComposerTerm): DieKind {
  return term.fudge ? "F" : term.sides;
}

// Rotulo de um tipo de dado: "d6", "dF".
export function dieKindLabel(kind: DieKind): string {
  return kind === "F" ? "dF" : `d${kind}`;
}

function makeTerm(kind: DieKind, count: number): ComposerTerm {
  // Dado Fudge tem 3 faces distintas no AST (ver parser.ts).
  return kind === "F" ? { count, sides: 3, fudge: true } : { count, sides: kind };
}

export function totalDice(state: ComposerState): number {
  return state.terms.reduce((sum, term) => sum + term.count, 0);
}

export function termNotation(term: ComposerTerm): string {
  return `${term.count}${dieKindLabel(dieKind(term))}`;
}

export function toNotation(state: ComposerState): string {
  if (state.terms.length === 0) return "";
  const dice = state.terms.map(termNotation).join("+");
  if (state.modifier > 0) return `${dice}+${state.modifier}`;
  if (state.modifier < 0) return `${dice}${state.modifier}`;
  return dice;
}

// Interpreta uma notacao como estado do compositor. Retorna null quando a
// notacao usa recursos fora do compositor (keep/drop, reroll, vs, termo
// subtraido, invalida) — nesse caso o texto digitado continua sendo a
// fonte de verdade e os botoes recomeçam do zero no proximo clique.
// String vazia e um estado valido: pool vazio.
export function fromNotation(notation: string): ComposerState | null {
  if (notation.trim() === "") return { terms: [], modifier: 0 };
  let ast;
  try {
    ast = parseNotation(notation);
  } catch {
    return null;
  }
  if (ast.groups.length !== 1) return null;
  const group = ast.groups[0]!;
  const terms: ComposerTerm[] = [];
  for (const term of group.terms) {
    if (term.sign !== 1 || term.dice.keepDrop || term.dice.reroll) return null;
    terms.push(
      makeTerm(term.dice.fudge ? "F" : term.dice.sides, term.dice.count),
    );
  }
  return {
    terms,
    modifier: group.dice.hasModifier ? group.dice.modifier : 0,
  };
}

// Clique num botao de dado: mesmo tipo incrementa o termo; tipo diferente
// ACUMULA um termo novo no pool (2d6 + clique em d4 -> 2d6+1d4).
export function addDie(state: ComposerState, kind: DieKind): ComposerState {
  if (totalDice(state) >= MAX_COMPOSER_COUNT) return state;
  const existing = state.terms.find((t) => dieKind(t) === kind);
  if (existing) {
    return {
      ...state,
      terms: state.terms.map((t) =>
        dieKind(t) === kind ? { ...t, count: t.count + 1 } : t,
      ),
    };
  }
  return { ...state, terms: [...state.terms, makeTerm(kind, 1)] };
}

// Remove UM dado do tipo; o termo some ao zerar. Ligado ao botao "−" do
// slot do dado.
export function removeDie(state: ComposerState, kind: DieKind): ComposerState {
  return {
    ...state,
    terms: state.terms
      .map((t) => (dieKind(t) === kind ? { ...t, count: t.count - 1 } : t))
      .filter((t) => t.count > 0),
  };
}

// Remove o termo inteiro de uma vez. Ligado ao "×" do chip no resumo do pool.
export function removeTerm(state: ComposerState, kind: DieKind): ComposerState {
  return { ...state, terms: state.terms.filter((t) => dieKind(t) !== kind) };
}

export function adjustModifier(state: ComposerState, delta: number): ComposerState {
  const modifier = Math.max(
    -MAX_COMPOSER_MODIFIER,
    Math.min(MAX_COMPOSER_MODIFIER, state.modifier + delta),
  );
  return { ...state, modifier };
}

export function clearComposer(): ComposerState {
  return { terms: [], modifier: 0 };
}
