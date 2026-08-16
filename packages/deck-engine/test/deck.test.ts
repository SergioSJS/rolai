import { describe, expect, it } from "vitest";
import {
  DeckError,
  createDeck,
  draw,
  reshuffleDeck,
  shuffle,
  standardCards,
  updateConfig,
} from "../src/index.js";
import type { Card } from "../src/index.js";

// Casos minimos exigidos por specs/08-baralho.md: shuffle sem duplicar/
// perder carta, draw respeitando removalMode e autoReshuffleOnEmpty (nunca
// draw parcial silencioso), toggle de curinga mudando o tamanho do monte,
// e deterministicOrder batendo com o valor pedido (mesmo uso do
// `deterministic` do rules-engine: parity test sem depender de RNG).

describe("standardCards", () => {
  it("52 cartas sem curinga, todas com id unico", () => {
    const cards = standardCards(false);
    expect(cards).toHaveLength(52);
    expect(new Set(cards.map((c) => c.id)).size).toBe(52);
  });

  it("54 cartas com curinga", () => {
    const cards = standardCards(true);
    expect(cards).toHaveLength(54);
    expect(cards.filter((c) => c.suit === "joker")).toHaveLength(2);
  });
});

describe("shuffle", () => {
  it("preserva o multiset de cartas (mesmo conjunto, so reordena)", () => {
    const cards = standardCards(true);
    const shuffled = shuffle(cards);
    expect(shuffled).toHaveLength(cards.length);
    expect(new Set(shuffled.map((c) => c.id))).toEqual(new Set(cards.map((c) => c.id)));
  });

  it("deterministicOrder ignora rng e devolve copia da ordem pedida", () => {
    const cards = standardCards(false);
    const forced: Card[] = [cards[5]!, cards[0]!, cards[10]!];
    const result = shuffle(cards, { deterministicOrder: forced });
    expect(result).toEqual(forced);
    expect(result).not.toBe(forced);
  });
});

describe("createDeck", () => {
  it("config default: sem curinga, permanent, sem auto-reembaralhar", () => {
    const deck = createDeck();
    expect(deck.config).toEqual({
      includeJokers: false,
      removalMode: "permanent",
      autoReshuffleOnEmpty: false,
    });
    expect(deck.drawPile).toHaveLength(52);
    expect(deck.discardPile).toHaveLength(0);
  });

  it("includeJokers muda o tamanho do monte (52 vs 54)", () => {
    expect(createDeck({ includeJokers: false }).drawPile).toHaveLength(52);
    expect(createDeck({ includeJokers: true }).drawPile).toHaveLength(54);
  });
});

describe("draw — removalMode permanent (default)", () => {
  it("puxa do topo, decrementa o monte, acumula no descarte", () => {
    const ordered = standardCards(false);
    const deck = createDeck({}, { deterministicOrder: ordered });
    const result = draw(deck, 2);
    expect(result.cards).toEqual([ordered[0], ordered[1]]);
    expect(result.remaining).toBe(50);
    expect(result.reshuffled).toBe(false);
    expect(deck.drawPile).toHaveLength(50);
    expect(deck.discardPile).toEqual([ordered[0], ordered[1]]);
  });

  it("pedir mais que o restante recusa sem autoReshuffleOnEmpty (sem draw parcial)", () => {
    const deck = createDeck({ includeJokers: false });
    draw(deck, 50);
    expect(() => draw(deck, 5)).toThrow(DeckError);
    // estado intacto: a tentativa recusada nao mexeu no monte nem no descarte
    expect(deck.drawPile).toHaveLength(2);
    expect(deck.discardPile).toHaveLength(50);
  });

  it("pedir mais que o restante com autoReshuffleOnEmpty recolhe o descarte e completa", () => {
    const deck = createDeck({ autoReshuffleOnEmpty: true });
    draw(deck, 50);
    const result = draw(deck, 5);
    expect(result.cards).toHaveLength(5);
    expect(result.reshuffled).toBe(true);
    expect(result.remaining).toBe(47); // 52 - 5
  });

  it("draw exato do restante nao dispara reembaralhar", () => {
    const deck = createDeck({ autoReshuffleOnEmpty: true });
    const result = draw(deck, 52);
    expect(result.reshuffled).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

describe("draw — removalMode returns", () => {
  it("carta volta pro monte na hora, descarte fica sempre vazio", () => {
    const deck = createDeck({ removalMode: "returns" });
    const result = draw(deck, 3);
    expect(result.cards).toHaveLength(3);
    expect(deck.drawPile).toHaveLength(52);
    expect(deck.discardPile).toHaveLength(0);
  });

  it("nunca recusa por falta de carta (reposicao garante sempre ter o suficiente)", () => {
    const deck = createDeck({ removalMode: "returns" });
    expect(() => draw(deck, 52)).not.toThrow();
    expect(deck.drawPile).toHaveLength(52);
  });
});

describe("draw — validacao", () => {
  it("quantidade invalida (<1 ou nao inteira) recusa", () => {
    const deck = createDeck();
    expect(() => draw(deck, 0)).toThrow(DeckError);
    expect(() => draw(deck, -1)).toThrow(DeckError);
    expect(() => draw(deck, 1.5)).toThrow(DeckError);
  });
});

describe("reshuffleDeck", () => {
  it("recolhe descarte pro monte e zera o descarte", () => {
    const deck = createDeck();
    draw(deck, 52);
    expect(deck.drawPile).toHaveLength(0);
    reshuffleDeck(deck);
    expect(deck.drawPile).toHaveLength(52);
    expect(deck.discardPile).toHaveLength(0);
  });
});

describe("updateConfig", () => {
  it("faz merge parcial sem tocar nas pilhas", () => {
    const deck = createDeck();
    const before = deck.drawPile;
    updateConfig(deck, { autoReshuffleOnEmpty: true });
    expect(deck.config).toEqual({
      includeJokers: false,
      removalMode: "permanent",
      autoReshuffleOnEmpty: true,
    });
    expect(deck.drawPile).toBe(before);
  });
});
