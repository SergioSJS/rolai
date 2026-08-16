// Contrato dos renderizadores de rolagem — a escada de qualidade de
// docs/architecture.md ("3D completo / 3D leve / 2D animado / texto puro")
// fica isolada atras desta interface. O fluxo de dados (calcular local,
// propagar via WS, animar o valor ja decidido) independe do tier ativo.

import { parseNotation } from "@rolai/rules-engine";
import type { RollResult } from "@rolai/rules-engine";
import type { DiceStyle } from "../settings";

export interface RenderedDie {
  sides: number;
  value: number;
  // Dado Fudge (4dF): o valor ja vem como -1, 0 ou +1.
  fudge?: boolean;
}

export interface RollRenderer {
  // Prepara o renderer dentro do container (criar canvas/WebGL, etc).
  init(container: HTMLElement): Promise<void>;
  // Anima o resultado ja decidido. Resolve quando a animacao termina
  // (texto puro resolve imediatamente). `style` e a aparencia dos dados de
  // QUEM ROLOU (vem junto da rolagem pela sala) — sem ela, vale a do dono
  // da tela.
  roll(result: RollResult, style?: DiceStyle | null): Promise<void>;
  // Tira os dados da tela sem destruir o renderer (clique pra dispensar).
  clear(): void;
  // Avisa que o container mudou de tamanho (a faixa reservada no pe do palco
  // cresceu — ver stage/floor.ts). Opcional: so o tier 3D tem mundo fisico
  // pra reconstruir, e a dice-box nao observa o container sozinha. NUNCA
  // chamar com dado no ar: as paredes andam por baixo dos dados em voo.
  resize?(): void;
  dispose(): void;
}

// Teto de dados animados. O rules-engine ja limita a rolagem em 100 dados,
// mas animar 100 corpos fisicos (ou 100 elementos DOM) trava o browser —
// acima deste teto o App cai pro resultado textual naquela rolagem.
export const MAX_ANIMATED_DICE = 20;

// Quantidade de dados mantidos por um termo (keep/drop reduz; reroll nao
// muda a contagem — substitui valores).
function keptCount(spec: {
  count: number;
  keepDrop?: { type: string; count: number };
}): number {
  const kd = spec.keepDrop;
  if (!kd) return spec.count;
  if (kd.type === "kh" || kd.type === "kl") return kd.count;
  return spec.count - kd.count; // dh / dl
}

import type { Card } from "@rolai/deck-engine";
import { cardFromRollValue } from "../cardFormat";

// Extrai as cartas de baralho (saque de cartas / termos 'c') de um RollResult.
export function cardsFromResult(result: RollResult): Card[] {
  let ast;
  try {
    ast = parseNotation(result.notation);
  } catch {
    return [];
  }
  const groups = Object.values(result.groups);
  const cards: Card[] = [];
  ast.groups.forEach((groupSpec, i) => {
    const rolled = groups[i];
    if (!rolled) return;
    let cursor = 0;
    for (const term of groupSpec.terms) {
      const count = keptCount(term.dice);
      if (term.dice.card) {
        const values = rolled.rolls.slice(cursor, cursor + count);
        values.forEach((v) => {
          cards.push(cardFromRollValue(v, cards.length));
        });
      }
      cursor += count;
    }
  });
  return cards;
}

// Extrai os dados (faces + valor final) de um RollResult, casando os
// termos da notacao parseada com os rolls flat dos grupos: cada termo
// consome `keptCount(termo)` valores na ordem (a mesma ordem em que o
// roller concatenou). Termos de carta (card: true) sao pulados — cartas
// animam no palco de cartas, nao como dados 3D na mesa.
export function diceFromResult(result: RollResult): RenderedDie[] {
  const ast = parseNotation(result.notation);
  const groups = Object.values(result.groups);
  const dice: RenderedDie[] = [];
  ast.groups.forEach((groupSpec, i) => {
    const rolled = groups[i];
    if (!rolled) return;
    let cursor = 0;
    for (const term of groupSpec.terms) {
      const count = keptCount(term.dice);
      if (!term.dice.card) {
        for (const value of rolled.rolls.slice(cursor, cursor + count)) {
          const die: RenderedDie = { sides: term.dice.sides, value };
          if (term.dice.fudge) die.fudge = true;
          dice.push(die);
        }
      }
      cursor += count;
    }
    // Os DESCARTADOS tambem rolam no palco: em "10d6kh1" caia 1 dado na
    // tela, o que nao parece a rolagem que a pessoa pediu. O keep/drop
    // sempre pertence a um termo unico (a gramatica nao permite espalhar),
    // entao todos saem com as faces do primeiro termo do grupo.
    const dropped = Array.isArray(rolled.dropped) ? rolled.dropped : [];
    const primeiro = groupSpec.terms.find((t) => !t.dice.card)?.dice;
    if (primeiro) {
      for (const value of dropped) {
        const die: RenderedDie = { sides: primeiro.sides, value };
        if (primeiro.fudge) die.fudge = true;
        dice.push(die);
      }
    }
  });
  return dice;
}

// Face exibida nos renderers 2D/texto: dado Fudge mostra sinal, nao numero.
export function faceLabel(die: RenderedDie): string {
  if (!die.fudge) return String(die.value);
  return die.value > 0 ? "+" : die.value < 0 ? "−" : "0";
}

// Contagem de corpos fisicos que a animacao vai criar. Um d100 vira DOIS
// dados fisicos (dezenas + unidades — ver diceBox.ts), entao conta dobrado.
export function physicalDiceCount(dice: RenderedDie[]): number {
  return dice.reduce(
    (total, die) => total + (die.sides === 100 || die.sides === 66 ? 2 : 1),
    0,
  );
}

// true se a rolagem estoura o teto de animacao. Notacao que nao parseia
// (nao deveria acontecer — o engine produziu) conta como zero: o renderer
// de texto cuida dela pelo caminho normal de fallback.
export function exceedsAnimationCap(result: RollResult): boolean {
  let dice: RenderedDie[];
  try {
    dice = diceFromResult(result);
  } catch {
    return false;
  }
  return physicalDiceCount(dice) > MAX_ANIMATED_DICE;
}
