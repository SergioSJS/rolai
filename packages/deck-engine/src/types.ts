// Contrato canonico de baralho — ver specs/08-baralho.md.
// Todo evento de deck (draw/shuffle/config) que trafega pelo WS usa estas formas.

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface Card {
  id: string;
  suit: Suit | "joker";
  rank: Rank | "joker";
}

export interface DeckConfig {
  includeJokers: boolean;
  /**
   * "permanent": carta puxada sai de circulacao (vai pro descarte) ate
   * reembaralhar. "returns": carta volta pro monte na hora e ele reembaralha
   * — cada draw() vira independente, com reposicao (modo leitura tipo tarô).
   */
  removalMode: "permanent" | "returns";
  /**
   * Monte esvaziou (removalMode "permanent") e falta carta pro draw pedido:
   * true recolhe o descarte e reembaralha sozinho; false recusa o draw
   * (nunca draw parcial silencioso — specs/08-baralho.md).
   */
  autoReshuffleOnEmpty: boolean;
}

export interface DeckState {
  config: DeckConfig;
  /** Indice 0 = topo do monte. */
  drawPile: Card[];
  /** Cartas ja vistas, so cresce em removalMode "permanent". */
  discardPile: Card[];
}

export interface DrawResult {
  cards: Card[];
  remaining: number;
  /** true se autoReshuffleOnEmpty disparou pra completar este draw. */
  reshuffled: boolean;
}

// Fonte de RNG injetavel — default deve usar crypto.getRandomValues.
// Nunca Math.random() puro (ver docs/security.md).
export type RandomSource = () => number;
