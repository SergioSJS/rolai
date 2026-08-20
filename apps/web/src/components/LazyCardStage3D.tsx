// Palco 3D das cartas carregado sob demanda.
//
// O CardStage3D arrasta a cena three.js (cardScene3D.ts), e importa-lo
// direto do App colocava o three INTEIRO no chunk de entrada: quem abre o
// app pra rolar um d20 e nunca puxa carta baixava ~150KB (gzip) de malha e
// textura sem usar nada disso. A dice-box ja e dinamica (renderers/diceBox.ts
// faz `await import`) — a carta era a unica coisa 3D presa na entrada.
//
// A cena so aparece quando ha carta na mesa, entao nao existe primeiro
// paint pra atrasar. Ainda assim o chunk e aquecido antes (preload), pra
// que a primeira puxada nao espere download nenhum.

import { lazy, Suspense } from "react";
import type { Card } from "@rolai/deck-engine";
import { CardStack } from "./CardStack";

const load = () => import("./CardStage3D").then((m) => ({ default: m.CardStage3D }));

const CardStage3D = lazy(load);

/**
 * Comeca a baixar o chunk antes de precisar dele. Chamado quando o baralho
 * entra em cena (o painel de cartas abriu) — a puxada vem logo depois, e a
 * animacao nao pode ficar esperando rede.
 *
 * Repetir e barato: o import dinamico e cacheado pelo proprio bundler.
 */
export function preloadCardStage3D(): void {
  void load().catch(() => {
    // Sem rede/chunk: o Suspense abaixo segura o flip 2D pra sempre, que e
    // exatamente o que se quer ver. Nao ha o que avisar aqui.
  });
}

export function LazyCardStage3D({ cards }: { cards: Card[] }) {
  // Enquanto o chunk nao chega, mostra o flip 2D — o mesmo pro qual o
  // proprio CardStage3D cai quando nao ha WebGL. Melhor que palco vazio:
  // a carta puxada aparece na hora de um jeito ou de outro.
  return (
    <Suspense fallback={<CardStack cards={cards} />}>
      <CardStage3D cards={cards} />
    </Suspense>
  );
}
