// Carta com flip 3D via CSS — tier "2D" (texto puro nao usa isto; tier 3D
// usa CardStage3D/cardScene3D.ts, malha three.js de verdade). Nasce virada
// pro verso e flipa pra face na entrada; `delayMs` escalona um leque
// quando varias cartas chegam juntas (specs/08-baralho.md).

import { useEffect, useState } from "react";
import type { Card } from "@rolai/deck-engine";
import { CardBack, cardComponent } from "../cardFormat";

export function CardFlip({ card, delayMs = 0 }: { card: Card; delayMs?: number }) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setFlipped(false);
    const timer = setTimeout(() => setFlipped(true), 40 + delayMs);
    return () => clearTimeout(timer);
  }, [card.id, delayMs]);

  const Face = cardComponent(card);

  return (
    <div className={`card-flip${flipped ? " is-flipped" : ""}`}>
      <div className="card-flip-inner">
        <CardBack className="card-flip-face card-flip-back" aria-hidden />
        <Face
          className="card-flip-face card-flip-front"
          title={card.suit === "joker" ? "Curinga" : `${card.rank} de ${card.suit}`}
        />
      </div>
    </div>
  );
}
