import type { Card, DeckConfig, Suit, Rank } from "@rolai/deck-engine";
import * as playingCards from "@letele/playing-cards";
import type { CardSvgComponent } from "@letele/playing-cards";

export const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
export const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export const SUIT_SYMBOL: Record<Card["suit"], string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
  joker: "🃏",
};

export function cardFromRollValue(value: number, cardIndex: number = 0): Card {
  const rankIdx = Math.max(1, Math.min(13, value)) - 1;
  const rank = RANKS[rankIdx] ?? "10";
  const suit = SUITS[(value + cardIndex * 2) % SUITS.length]!;
  return {
    id: `${rank}-${suit}`,
    rank,
    suit,
  };
}

export function cardLabel(card: Card): string {
  if (card.suit === "joker") return "Curinga";
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}

// Naipe vermelho pinta o chip — mesma leitura visual de um baralho fisico.
export function isRedSuit(card: Card): boolean {
  return card.suit === "hearts" || card.suit === "diamonds";
}

const SUIT_LETTER: Record<Exclude<Card["suit"], "joker">, "C" | "D" | "H" | "S"> = {
  clubs: "C",
  diamonds: "D",
  hearts: "H",
  spades: "S",
};

// @letele/playing-cards nomeia rank em minusculo pras figuras/As ("Ca",
// "Cj") e mantem digito pros numericos ("C10") — convencao da lib, nao
// nossa (ver types/letele-playing-cards.d.ts).
const RANK_KEY: Record<Card["rank"], string> = {
  A: "a",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  "10": "10",
  J: "j",
  Q: "q",
  K: "k",
  joker: "",
};

// Componente SVG da face da carta (tier 2D/3D — texto puro nao usa isto).
export function cardComponent(card: Card): CardSvgComponent {
  if (card.suit === "joker") {
    return card.id === "joker-2" ? playingCards.J2 : playingCards.J1;
  }
  const key = `${SUIT_LETTER[card.suit]}${RANK_KEY[card.rank]}`;
  const component = (playingCards as unknown as Record<string, CardSvgComponent>)[key];
  if (!component) {
    throw new Error(`sem componente de carta pra ${card.id} (chave "${key}")`);
  }
  return component;
}

// Verso da carta — mesmo componente pra toda carta virada pra baixo.
export const CardBack: CardSvgComponent = playingCards.B1;

// Resumo legivel de uma mudanca de config pro log da sala (HistoryList) —
// so os campos presentes entram, igual ao evento deck_config em si.
export function deckConfigChangeLabel(changes: Partial<DeckConfig>): string {
  const parts: string[] = [];
  if (changes.includeJokers !== undefined) {
    parts.push(changes.includeJokers ? "com curinga" : "sem curinga");
  }
  if (changes.removalMode !== undefined) {
    parts.push(
      changes.removalMode === "returns" ? "carta volta na hora" : "carta some até reembaralhar",
    );
  }
  if (changes.autoReshuffleOnEmpty !== undefined) {
    parts.push(
      changes.autoReshuffleOnEmpty ? "reembaralha sozinho quando vazio" : "trava quando vazio",
    );
  }
  return parts.join(", ");
}
