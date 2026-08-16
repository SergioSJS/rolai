// API publica do @rolai/deck-engine — ver specs/08-baralho.md.
// Pacote puro: sem rede, sem DOM, sem renderizacao.

export * from "./types.js";
export {
  DeckError,
  DEFAULT_CONFIG,
  standardCards,
  shuffle,
  createDeck,
  updateConfig,
  reshuffleDeck,
  draw,
} from "./deck.js";
export type { ShuffleOptions } from "./deck.js";
export { cryptoRandomSource } from "./rng.js";
