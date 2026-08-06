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
import { loadDiceStyle, loadQualityTier, loadDiceScale, isQualityTier } from "./settings";
import { DICE_PRESETS } from "./settings";
import type { DiceStyle } from "./settings";
import type { RollRenderer } from "./renderers/types";
import { exceedsAnimationCap } from "./renderers/types";
import { createRenderer } from "./renderers";
import { TextRenderer } from "./renderers/text";
import { RoomClient } from "./room/client";
import type { RoomEvent } from "./room/reducer";
import { ResultDisplay } from "./components/ResultDisplay";
import type { StreamOptions } from "./stream";

// Tempo com o resultado (e os dados parados) na tela antes de limpar. Na
// stream ninguem clica pra dispensar — a saida tem que ser automatica.
export const STREAM_RESULT_MS = 8_000;

export interface StreamBridge {
  play(result: RollResult | string, style?: DiceStyle | null): void;
  // Tira os dados da tela agora (o overlay Android chama no toque).
  clear(): void;
}

declare global {
  interface Window {
    rolaiStream?: StreamBridge;
  }
}

export function StreamApp({ options }: { options: StreamOptions }) {
  const [lastResult, setLastResult] = useState<RollResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<RollRenderer | null>(null);
  const clientRef = useRef<RoomClient | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const renderer = createRenderer(tier, style, scale);
    renderer.init(stage).catch((err: unknown) => {
      console.warn("renderer falhou, caindo pra texto puro:", err);
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
  }, [options.styleId, options.quality, options.scale, options.style]);

  // Agenda a limpeza automatica: resultado e dados nao ficam permanentes.
  const scheduleClear = useCallback(() => {
    if (fadeTimerRef.current !== null) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      fadeTimerRef.current = null;
      rendererRef.current?.clear();
      setLastResult(null);
    }, STREAM_RESULT_MS);
  }, []);

  const animate = useCallback(
    (result: RollResult, style?: DiceStyle | null) => {
      // Dados da rolagem anterior saem antes da nova entrar: sem ninguem
      // clicando pra dispensar, eles se acumulariam na mesa.
      rendererRef.current?.clear();
      setLastResult(result);
      if (!exceedsAnimationCap(result)) {
        rendererRef.current?.roll(result, style).catch((err: unknown) => {
          console.warn("animacao falhou:", err);
        });
      }
      scheduleClear();
    },
    [scheduleClear],
  );

  // Espectador: rolagem dos outros anima; qualquer erro vira mensagem
  // minima (sala invalida nao pode derrubar a Browser Source).
  useEffect(() => {
    // Sem sala nao e erro: e o modo local (overlay do Android offline), em
    // que quem manda a rolagem pro palco e o host, via window.rolaiStream.
    if (options.room === "") return;
    const onEvent = (event: RoomEvent) => {
      if (event.type === "roll") {
        animate(event.result, event.style);
      } else if (event.type === "snapshot") {
        setStatus(null);
      } else if (event.type === "serverError") {
        setStatus(event.message);
      } else if (event.type === "disconnected" && !event.willReconnect) {
        setStatus((prev) => prev ?? "desconectado da sala");
      }
    };
    const client = new RoomClient(options.room, "stream", onEvent, undefined, true);
    clientRef.current = client;
    client.connect();
    return () => {
      clientRef.current = null;
      client.leave();
    };
  }, [options.room, animate]);

  // Ponte pro host que embute esta pagina (a WebView do overlay Android):
  // `window.rolaiStream.play(resultado)` anima uma rolagem JA CALCULADA,
  // sem rede nenhuma — e o que faz o overlay funcionar offline e sem sala.
  // Aceita o RollResult como objeto ou como JSON em string (evaluateJavascript
  // do Android entrega string).
  useEffect(() => {
    const bridge: StreamBridge = {
      play(result, style) {
        const parsed: unknown = typeof result === "string" ? JSON.parse(result) : result;
        animate(parsed as RollResult, style ?? null);
      },
      clear() {
        if (fadeTimerRef.current !== null) {
          clearTimeout(fadeTimerRef.current);
          fadeTimerRef.current = null;
        }
        rendererRef.current?.clear();
        setLastResult(null);
      },
    };
    window.rolaiStream = bridge;
    return () => {
      if (window.rolaiStream === bridge) delete window.rolaiStream;
    };
  }, [animate]);

  return (
    <main className="stream-root">
      {options.scrim > 0 && lastResult !== null && (
        <div
          className="stream-scrim"
          style={{ background: `rgba(0, 0, 0, ${options.scrim})` }}
        />
      )}
      <div className="stage" ref={stageRef} aria-label="Palco de rolagem" />
      <div className="stage-overlay">
        {lastResult !== null && (
          <div className="stream-result">
            <ResultDisplay result={lastResult} showDismissHint={false} />
          </div>
        )}
        {status !== null && <p className="stream-status">{status}</p>}
      </div>
    </main>
  );
}
