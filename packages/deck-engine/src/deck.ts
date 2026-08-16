import { cryptoRandomSource } from "./rng.js";
import type { Card, DeckConfig, DeckState, DrawResult, RandomSource, Rank, Suit } from "./types.js";

export class DeckError extends Error {}

export const DEFAULT_CONFIG: DeckConfig = {
  includeJokers: false,
  removalMode: "permanent",
  autoReshuffleOnEmpty: false,
};

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

// Baralho padrao de 52 cartas, +2 curingas se pedido. Ordem de geracao nao
// importa — shuffle() decide a ordem real do monte.
export function standardCards(includeJokers: boolean): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: `${suit}-${rank}`, suit, rank });
    }
  }
  if (includeJokers) {
    cards.push({ id: "joker-1", suit: "joker", rank: "joker" });
    cards.push({ id: "joker-2", suit: "joker", rank: "joker" });
  }
  return cards;
}

export interface ShuffleOptions {
  rng?: RandomSource;
  /**
   * Ordem final do monte, ignora rng — mesmo papel do `deterministic` de
   * RollOptions no rules-engine: permite comparar o resultado exato sem
   * depender de RNG (parity test Android vs bundle web, ver
   * HeadlessRollerParityTest.kt).
   */
  deterministicOrder?: Card[];
}

// Fisher-Yates com fonte injetavel.
export function shuffle(cards: Card[], options: ShuffleOptions = {}): Card[] {
  if (options.deterministicOrder) {
    return [...options.deterministicOrder];
  }
  const rng = options.rng ?? cryptoRandomSource;
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = result[i]!;
    const b = result[j]!;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

export function createDeck(
  config: Partial<DeckConfig> = {},
  shuffleOptions: ShuffleOptions = {},
): DeckState {
  const fullConfig: DeckConfig = { ...DEFAULT_CONFIG, ...config };
  const cards = standardCards(fullConfig.includeJokers);
  return {
    config: fullConfig,
    drawPile: shuffle(cards, shuffleOptions),
    discardPile: [],
  };
}

// Atualiza config em vigor. removalMode/autoReshuffleOnEmpty valem pro
// proximo draw(). includeJokers NAO muda a composicao do monte atual —
// reshuffleDeck() so reordena as cartas que ja existem (nunca adiciona ou
// remove), entao ligar/desligar curinga so tem efeito visivel num monte
// criado do zero (createDeck). Quem chama e responsavel por decidir se
// isso pede um createDeck novo em vez de so guardar a preferencia.
export function updateConfig(state: DeckState, config: Partial<DeckConfig>): void {
  state.config = { ...state.config, ...config };
}

// Reembaralha manualmente: recolhe o descarte pro monte e reordena.
export function reshuffleDeck(state: DeckState, shuffleOptions: ShuffleOptions = {}): void {
  const all = [...state.drawPile, ...state.discardPile];
  state.drawPile = shuffle(all, shuffleOptions);
  state.discardPile = [];
}

// Puxa `count` cartas do topo. Sem cartas suficientes: recusa (nunca draw
// parcial silencioso) a menos que autoReshuffleOnEmpty esteja ligado, caso
// em que reembaralha o descarte de volta antes de completar o pedido.
export function draw(
  state: DeckState,
  count: number,
  shuffleOptions: ShuffleOptions = {},
): DrawResult {
  if (!Number.isInteger(count) || count < 1) {
    throw new DeckError(`quantidade invalida: ${count}`);
  }
  let reshuffled = false;
  if (count > state.drawPile.length) {
    if (state.config.removalMode !== "permanent" || !state.config.autoReshuffleOnEmpty) {
      const falta = count - state.drawPile.length;
      throw new DeckError(`faltam ${falta} carta(s) no monte — reembaralhe pra continuar`);
    }
    reshuffleDeck(state, shuffleOptions);
    reshuffled = true;
    if (count > state.drawPile.length) {
      throw new DeckError(
        `baralho tem so ${state.drawPile.length} carta(s), mesmo apos reembaralhar`,
      );
    }
  }
  const cards = state.drawPile.splice(0, count);
  if (state.config.removalMode === "permanent") {
    state.discardPile.push(...cards);
  } else {
    // returns: volta pro monte e reembaralha na hora — cada draw() e
    // independente, com reposicao.
    state.drawPile.push(...cards);
    state.drawPile = shuffle(state.drawPile, shuffleOptions);
  }
  return { cards, remaining: state.drawPile.length, reshuffled };
}
