// Cartas puxadas em pilha "escada": cada carta desce um pouco por cima da
// anterior, sem tampar o indice (canto) de quem ficou embaixo — mesma
// leitura de segurar um punhado de cartas na mao. Compartilhado entre o
// palco principal (App.tsx) e o modo stream (StreamApp.tsx).
//
// A sobreposicao entre cartas e CALCULADA, nao fixa: um passo fixo (via
// CSS puro) cabia bem com poucas cartas mas so CORTAVA na tela com muitas
// (puxar 10 cartas ultrapassava a viewport em vez de comprimir mais) —
// specs/08-baralho.md. Mede a largura real da carta renderizada e ajusta
// quanto cada uma cobre da anterior pra o total sempre caber na tela,
// nunca menos que uma tira minima do indice.

import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Card } from "@rolai/deck-engine";
import { CardFlip } from "./CardFlip";

// Fracao MINIMA da carta que fica sempre visivel (onde o indice mora) —
// mesmo com dezenas de cartas, nunca tampa tudo.
const MIN_REVEAL_RATIO = 0.16;
// Margem de seguranca pras bordas da tela nao ficarem coladas na pilha.
const VIEWPORT_PADDING = 32;

export function CardStack({ cards }: { cards: Card[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [overlap, setOverlap] = useState(0);

  // useLayoutEffect (nao useEffect): mede e ajusta ANTES do navegador
  // pintar — sem isso have um frame com a pilha esparramada antes de
  // encolher, visivel como um pulo.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || cards.length < 2) {
      setOverlap(0);
      return;
    }

    function recompute() {
      const first = container?.firstElementChild;
      if (!(first instanceof HTMLElement)) return;
      const cardWidth = first.getBoundingClientRect().width;
      if (cardWidth <= 0) return;
      const budget = window.innerWidth - VIEWPORT_PADDING;
      const n = cards.length;
      const naturalWidth = cardWidth * n;
      if (naturalWidth <= budget) {
        setOverlap(0);
        return;
      }
      // total = cardWidth + (n-1)*passo <= budget → passo = quanto cada
      // carta ALEM da primeira soma de espaco novo na fileira.
      const step = Math.max(
        cardWidth * MIN_REVEAL_RATIO,
        (budget - cardWidth) / (n - 1),
      );
      setOverlap(cardWidth - step);
    }

    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [cards]);

  return (
    <div className="card-stack" ref={containerRef}>
      {cards.map((card, i) => (
        <div
          key={`${card.id}-${i}`}
          className="card-stack-item"
          style={
            i === 0
              ? undefined
              : ({
                  marginLeft: `-${overlap}px`,
                  transform: `translateY(${i * 10}px)`,
                } as CSSProperties)
          }
        >
          <CardFlip card={card} delayMs={i * 120} />
        </div>
      ))}
    </div>
  );
}
