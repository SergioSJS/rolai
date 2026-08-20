// Modo stream/OBS (`?room=CODIGO&stream=1`, ver docs/handoff.md): a pagina
// desenha SÓ o palco de dados full-viewport — sem menu, sem painel de
// rolagem, sem historico — pra ser cadastrada como Browser Source do OBS.
// Fundo transparente de verdade (alpha) por padrao; `&chroma=rrggbb` pinta
// cor solida pra quem nao pode usar alpha.
//
// O cliente entra na sala como ESPECTADOR (spectator=1 no handshake): so
// recebe e anima as rolagens dos outros (na cor do dado de quem rolou),
// nunca rola, nao aparece no roster e nao conta no teto de membros. O
// resultado tambem aparece (overlay na base central) e some sozinho depois
// de alguns segundos pra nao ficar permanente na stream.

import { useCallback, useEffect, useRef, useState } from "react";
import type { RollResult } from "@rolai/rules-engine";
import type { Card } from "@rolai/deck-engine";
import { loadDiceStyle, loadQualityTier, loadDiceScale, isQualityTier, DEFAULT_DICE_STYLES } from "./settings";
import { DICE_PRESETS } from "./settings";
import type { DiceStyle, DiceStyles } from "./settings";
import type { RollRenderer } from "./renderers/types";
import { exceedsAnimationCap, cardsFromResult } from "./renderers/types";
import { createRenderer } from "./renderers";
import { TextRenderer } from "./renderers/text";
import { RoomClient } from "./room/client";
import type { RoomEvent } from "./room/reducer";
import { ResultDisplay } from "./components/ResultDisplay";
import { CardStack } from "./components/CardStack";
import { CardStage3D } from "./components/CardStage3D";
import { cardLabel, isRedSuit } from "./cardFormat";
import { useStageFloor } from "./stage/floor";
import type { StreamOptions } from "./stream";

// Tempo com o resultado (e os dados parados) na tela antes de limpar. Na
// stream ninguem clica pra dispensar — a saida tem que ser automatica.
export const STREAM_RESULT_MS = 8_000;

export interface StreamBridge {
  play(result: RollResult | string, style?: DiceStyle | null, styles?: DiceStyles | null): void;
  // Baralho (specs/08-baralho.md): mesmo espirito do play(), mas pra
  // cartas — segue a mesma escada de qualidade (tier 2D usa CardStack,
  // 3D usa CardStage3D).
  playCard(cards: Card[] | string): void;
  // Tira os dados/cartas da tela agora (o overlay Android chama no toque).
  clear(): void;
}

declare global {
  interface Window {
    rolaiStream?: StreamBridge;
  }
}

// O resultado na tela mais o numero da rolagem que o colocou ali. O numero
// so existe pra virar `key` no DOM: sem ele o React reusa o mesmo no na
// rolagem seguinte, a animacao CSS nao reinicia, e quem rolou durante o
// fade out herdava a animacao ja terminada — `forwards` prende em
// opacity 0 e o resultado nunca mais aparece (cada rolagem nova reagenda o
// clear, entao o no tambem nunca desmonta pra se recuperar sozinho).
interface Shown {
  result: RollResult;
  // Quem rolou (vazio = rolagem local via window.rolaiStream, sem "dono"
  // pra mostrar) e a cor do dado dela, pro card de resultado combinar com
  // o dado que caiu — mesma logica do app principal (App.tsx).
  player: string;
  style: DiceStyle | null;
  styles?: DiceStyles | null;
  seq: number;
}

export function StreamApp({ options }: { options: StreamOptions }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<RollRenderer | null>(null);
  const clientRef = useRef<RoomClient | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Reserva a faixa do pe do palco com a placa JA na tela e so entao rola.
  const queueRoll = useStageFloor(stageRef, overlayRef, rendererRef);

  // Fundo: alpha real (padrao) ou chroma solido. A classe desliga o fundo
  // de tema do body (ver styles.css).
  useEffect(() => {
    const { body } = document;
    body.classList.add("stream-mode");
    body.style.background = options.chroma ?? "transparent";
    return () => {
      body.classList.remove("stream-mode");
      body.style.background = "";
    };
  }, [options.chroma]);

  // Renderer 3D: mesmo tier salvo no app (a Browser Source tem localStorage
  // proprio — o default 3d-light ja serve). Falha de WebGL cai pro texto.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let disposed = false;
    // Precedencia: parametros explicitos > preset por id > salvo aqui.
    const base =
      DICE_PRESETS.find((preset) => preset.id === options.styleId)?.style ??
      loadDiceStyle(window.localStorage);
    const style = options.style === null ? base : { ...base, ...options.style };
    // Qualidade e tamanho: URL do embutidor (overlay Android) vence; sem
    // parametro, vale o que estiver salvo neste navegador.
    const tier = isQualityTier(options.quality)
      ? options.quality
      : loadQualityTier(window.localStorage);
    const scale = options.scale > 0 ? options.scale : loadDiceScale(window.localStorage);
    const renderer = createRenderer(tier, style, scale, options.sound);
    renderer.init(stage).catch((err: unknown) => {
      console.warn("[rolai] renderer falhou, caindo pra texto puro:", err);
      if (disposed) return;
      const fallback = new TextRenderer();
      rendererRef.current = fallback;
      void fallback.init(stage);
    });
    rendererRef.current = renderer;
    return () => {
      disposed = true;
      renderer.dispose();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [options.styleId, options.quality, options.scale, options.style, options.sound]);

  // Agenda a limpeza automatica: resultado e dados nao ficam permanentes.
  const scheduleClear = useCallback(() => {
    if (fadeTimerRef.current !== null) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      fadeTimerRef.current = null;
      rendererRef.current?.clear();
      setShown(null);
    }, STREAM_RESULT_MS);
  }, []);

  // Baralho na stream: cartas puxadas aparecem no palco igual ao dado, so
  // que sem malha 3D propria (CardFlip, ver components/CardFlip.tsx) — e
  // um overlay PARALELO ao `shown` de dado, nao o mesmo estado, porque a
  // limpeza de um nao deveria derrubar o outro se algum dia os dois
  // coexistirem na tela.
  const [shownCards, setShownCards] = useState<{ cards: Card[]; seq: number } | null>(null);
  const cardFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleCardClear = useCallback(() => {
    if (cardFadeTimerRef.current !== null) clearTimeout(cardFadeTimerRef.current);
    cardFadeTimerRef.current = setTimeout(() => {
      cardFadeTimerRef.current = null;
      setShownCards(null);
    }, STREAM_RESULT_MS);
  }, []);

  const animateCards = useCallback(
    (cards: Card[]) => {
      rendererRef.current?.clear();
      setShown(null);
      setShownCards((prev) => ({ cards, seq: (prev?.seq ?? 0) + 1 }));
      scheduleCardClear();
    },
    [scheduleCardClear],
  );

  // Sincroniza as variáveis CSS para chips dos slots 1, 2 e 3
  useEffect(() => {
    const root = document.documentElement;
    for (const [slot, defaultStyle] of Object.entries(DEFAULT_DICE_STYLES)) {
      root.style.setProperty(`--dice-${slot}-body`, defaultStyle.body);
      root.style.setProperty(`--dice-${slot}-number`, defaultStyle.number);
      root.style.setProperty(`--dice-${slot}-outline`, defaultStyle.outline);
    }
  }, []);

  const animate = useCallback(
    (result: RollResult, style?: DiceStyle | null, player?: string, styles?: DiceStyles | null) => {
      // Atualiza variáveis CSS se estilos customizados foram passados
      const root = document.documentElement;
      if (styles) {
        for (const [slot, s] of Object.entries(styles)) {
          if (s) {
            root.style.setProperty(`--dice-${slot}-body`, s.body);
            root.style.setProperty(`--dice-${slot}-number`, s.number);
            root.style.setProperty(`--dice-${slot}-outline`, s.outline);
          }
        }
      } else if (style) {
        root.style.setProperty("--dice-1-body", style.body);
        root.style.setProperty("--dice-1-number", style.number);
        root.style.setProperty("--dice-1-outline", style.outline);
      }

      // Dados da rolagem anterior saem antes da nova entrar: sem ninguem
      // clicando pra dispensar, eles se acumulariam na mesa.
      rendererRef.current?.clear();
      // seq+1 troca a `key` do overlay: no novo, animacao do zero.
      setShown((prev) => ({
        result,
        player: player ?? "",
        style: style ?? null,
        styles: styles ?? null,
        seq: (prev?.seq ?? 0) + 1,
      }));
      const cards = cardsFromResult(result);
      if (cards.length > 0) {
        setShownCards((prev) => ({ cards, seq: (prev?.seq ?? 0) + 1 }));
        scheduleCardClear();
      } else {
        setShownCards(null);
      }
      if (!exceedsAnimationCap(result)) {
        // Depois do commit: a placa precisa estar na tela pra ser medida.
        queueRoll(() => {
          rendererRef.current?.roll(result, style, styles).catch((err: unknown) => {
            console.warn("[rolai] animacao falhou:", err);
          });
        });
      }
      scheduleClear();
    },
    [scheduleClear, scheduleCardClear, queueRoll],
  );

  // Espectador: rolagem/puxada dos outros anima; qualquer erro vira
  // mensagem minima (sala invalida nao pode derrubar a Browser Source).
  useEffect(() => {
    // Sem sala nao e erro: e o modo local (overlay do Android offline), em
    // que quem manda a rolagem pro palco e o host, via window.rolaiStream.
    if (options.room === "") return;
    const onEvent = (event: RoomEvent) => {
      if (event.type === "roll") {
        animate(event.result, event.style, event.player, event.styles);
      } else if (event.type === "deck_draw") {
        animateCards(event.cards);
      } else if (event.type === "snapshot") {
        setStatus(null);
      } else if (event.type === "serverError") {
        setStatus(event.message);
      } else if (event.type === "disconnected" && !event.willReconnect) {
        setStatus((prev) => prev ?? "desconectado da sala");
      }
    };
    // Sem limite de tentativas: ninguem esta olhando a Browser Source do OBS
    // pra recarregar a pagina se a reconexao desistir (ver client.ts).
    const client = new RoomClient(options.room, "stream", onEvent, undefined, true, Infinity);
    clientRef.current = client;
    client.connect();
    return () => {
      clientRef.current = null;
      client.leave();
    };
  }, [options.room, animate, animateCards]);

  // Ponte pro host que embute esta pagina (a WebView do overlay Android):
  // `window.rolaiStream.play(resultado)` anima uma rolagem JA CALCULADA,
  // sem rede nenhuma — e o que faz o overlay funcionar offline e sem sala.
  // Aceita o RollResult como objeto ou como JSON em string (evaluateJavascript
  // do Android entrega string). `playCard` e o equivalente pra baralho.
  useEffect(() => {
    const bridge: StreamBridge = {
      play(result, style, styles) {
        const parsed: unknown = typeof result === "string" ? JSON.parse(result) : result;
        const parsedStyles: unknown = typeof styles === "string" ? JSON.parse(styles) : styles;
        animate(parsed as RollResult, style ?? null, undefined, parsedStyles as DiceStyles | null);
      },
      playCard(cards) {
        const parsed: unknown = typeof cards === "string" ? JSON.parse(cards) : cards;
        animateCards(parsed as Card[]);
      },
      clear() {
        if (fadeTimerRef.current !== null) {
          clearTimeout(fadeTimerRef.current);
          fadeTimerRef.current = null;
        }
        if (cardFadeTimerRef.current !== null) {
          clearTimeout(cardFadeTimerRef.current);
          cardFadeTimerRef.current = null;
        }
        rendererRef.current?.clear();
        setShown(null);
        setShownCards(null);
      },
    };
    window.rolaiStream = bridge;
    return () => {
      if (window.rolaiStream === bridge) delete window.rolaiStream;
    };
  }, [animate, animateCards]);

  // Mesmo calculo do tier usado pro renderer do dado (useEffect acima) —
  // aqui so pra decidir se a carta anima (CardFlip) ou fica so no texto.
  const cardTier = isQualityTier(options.quality)
    ? options.quality
    : loadQualityTier(window.localStorage);

  return (
    <main className="stream-root">
      {options.scrim > 0 && shown !== null && (
        <div
          key={shown.seq}
          className="stream-scrim"
          style={{ background: `rgba(0, 0, 0, ${options.scrim})` }}
        />
      )}
      <div className="stage" ref={stageRef} aria-label="Palco de rolagem" />
      {/* Carta animada fica SOLTA por cima de tudo, sem caixa — mesma
          camada do dado caindo. A caixa (.stream-result) abaixo mostra so
          o valor em texto. */}
      {shownCards !== null && cardTier !== "text" && (
        <div className="card-stage" aria-hidden>
          {cardTier === "2d" ? (
            <CardStack cards={shownCards.cards} />
          ) : (
            <CardStage3D cards={shownCards.cards} />
          )}
        </div>
      )}
      <div className="stage-overlay" ref={overlayRef}>
        {shown !== null && (
          <div key={shown.seq} className="stream-result">
            <ResultDisplay
              result={shown.result}
              player={shown.player}
              playerStyle={shown.style}
              playerStyles={shown.styles}
              showDismissHint={false}
            />
          </div>
        )}
        {shownCards !== null && shown === null && (
          <div key={shownCards.seq} className="stream-result">
            <div className="result-chips">
              {shownCards.cards.map((card, i) => (
                <span
                  key={`${card.id}-${i}`}
                  className={`die-chip card-chip${isRedSuit(card) ? " is-red" : ""}`}
                >
                  {cardLabel(card)}
                </span>
              ))}
            </div>
          </div>
        )}
        {status !== null && <p className="stream-status">{status}</p>}
      </div>
    </main>
  );
}
