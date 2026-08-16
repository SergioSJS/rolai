// Palco 3D do baralho (tier 3D completo/leve — specs/08-baralho.md). So
// gerencia o ciclo de vida da cena three.js (CardScene3D): monta/desmonta
// no container, e repassa `cards` pra tocar o arremesso de novo a cada
// puxada nova (array novo = referencia nova = efeito dispara).
//
// Sem WebGL (mesmo caso do dado — dice-box tambem pode falhar): cai pro
// flip CSS (CardStack), igual ao renderer do dado cair pro texto puro.

import { useEffect, useRef, useState } from "react";
import type { Card } from "@rolai/deck-engine";
import { CardScene3D } from "../cardScene3D";
import { CardStack } from "./CardStack";

export function CardStage3D({ cards }: { cards: Card[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CardScene3D | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let scene: CardScene3D;
    try {
      scene = new CardScene3D();
      scene.mount(container);
    } catch (err) {
      console.warn("[rolai] malha 3D de carta falhou, caindo pro flip 2D:", err);
      setFailed(true);
      return;
    }
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (failed) return;
    sceneRef.current?.playCards(cards);
  }, [cards, failed]);

  if (failed) return <CardStack cards={cards} />;
  return <div className="card-stage-3d" ref={containerRef} aria-hidden />;
}
