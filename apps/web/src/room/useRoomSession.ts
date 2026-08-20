// A sala inteira do App num hook: cliente WS, roster/histórico, echo da
// própria rolagem, apelido, e o `?room=` da barra de endereços.
//
// Era ~200 linhas espalhadas pelo App.tsx, entre os refs de renderer e os
// handlers de UI — cinco refs (`clientRef`, `pendingRef`, `pendingDeckRef`,
// `selfNameRef`, `autoJoinedRef`) que só faziam sentido juntos, e cada
// handler tinha que lembrar de mexer nos certos na ordem certa.
//
// Regra que o App não precisa mais conhecer: "tem cliente" NÃO é "está
// conectado" (AGENTS.md). Todo envio aqui checa `status === "connected"`
// antes de mandar, e devolve `false` quando a rolagem ficou só no local —
// é o que evita a rolagem sumir em silêncio com a sala fora do ar.

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { RollResult } from "@rolai/rules-engine";
import type { Card, DeckConfig, DrawResult } from "@rolai/deck-engine";
import type { DiceStyle, DiceStyles } from "../settings";
import { clearRoomCode, loadRoomCode, loadPlayerName, savePlayerName, saveRoomCode } from "../settings";
import { initialRoomState, roomReducer } from "./reducer";
import type { HistoryEntry, RoomEvent, RoomState } from "./reducer";
import { createRoom, RoomClient } from "./client";
import { PendingDeckDraws, PendingRolls } from "./echo";

/** Código que veio no link (`?room=`), pra pré-preencher o campo da Sala. */
export function roomParamFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("room") ?? "";
}

// Mantem `?room=` na barra de enderecos em sincronia com a sala atual.
// Sem isto a URL fica presa na sala com que a pagina foi carregada: criar
// ou trocar de sala pelo modal muda o estado por dentro, mas quem olhar a
// barra (ou copiar dali, ou so der F5) ve/volta pra sala ERRADA — inclusive
// uma que ja nao existe mais, derrubando de novo uma sala boa por cima.
function setRoomUrlParam(code: string | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (code === null) {
    url.searchParams.delete("room");
  } else {
    url.searchParams.set("room", code);
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export interface RoomSessionOptions {
  /** Anima a rolagem de OUTRO jogador (a própria já animou no disparo). */
  animate: (
    result: RollResult,
    style?: DiceStyle | null,
    player?: string,
    styles?: DiceStyles | null,
  ) => void;
  /** Mesmo papel do `animate`, para cartas puxadas por outro jogador. */
  animateCards: (cards: Card[], player?: string) => void;
  /** Aparência anunciada no handshake — a mesa vê o dado de cada um. */
  diceStyle: DiceStyle;
  diceStyles: DiceStyles;
}

export interface RoomSession {
  room: RoomState;
  playerName: string;
  /** Rolagens/puxadas feitas fora de sala (ou com a sala fora do ar). */
  localHistory: HistoryEntry[];
  join: (code: string, name: string) => void;
  create: (name: string) => void;
  leave: () => void;
  rename: (name: string) => void;
  /** `false` = ficou só no histórico local; ninguém mais viu. */
  sendRoll: (result: RollResult) => boolean;
  sendDeckDraw: (result: DrawResult, timestamp: string) => void;
  sendDeckShuffle: () => void;
  sendDeckConfig: (changes: Partial<DeckConfig>) => void;
  /** Cor nova: reconecta, porque o estilo viaja no handshake. */
  restyle: (styles: DiceStyles) => void;
}

/**
 * Espera antes de reconectar por cor nova.
 *
 * `<input type="color">` dispara a cada movimento do seletor, e cada
 * mudanca reabre o WebSocket (a aparencia viaja no handshake). Arrastar a
 * cor gerava DEZENAS de conexoes em segundos — o suficiente pra estourar o
 * `ws_connect_limit_per_minute` do backend (30), levar um 4429 e o cliente
 * tratar como recusa definitiva: saia da sala sozinho e limpava o codigo
 * salvo. Quem mexeu na cor simplesmente perdia a mesa.
 */
const RESTYLE_DEBOUNCE_MS = 300;

export function useRoomSession(options: RoomSessionOptions): RoomSession {
  const { animate, animateCards, diceStyle, diceStyles } = options;

  const [room, dispatch] = useReducer(roomReducer, initialRoomState);
  const [playerName, setPlayerName] = useState<string>(
    () => loadPlayerName(window.localStorage) || "anonymous",
  );
  const [localHistory, setLocalHistory] = useState<HistoryEntry[]>([]);

  const clientRef = useRef<RoomClient | null>(null);
  const pendingRef = useRef(new PendingRolls());
  const pendingDeckRef = useRef(new PendingDeckDraws());
  const selfNameRef = useRef("anonymous");
  // Aparencia que a conexao ATUAL anunciou no handshake. Serve pra nao
  // reconectar quando a "mudanca" de cor nao mudou nada de fato.
  const announcedStylesRef = useRef<string>(JSON.stringify(diceStyles));
  const restyleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelRestyle = useCallback(() => {
    if (restyleTimerRef.current !== null) {
      clearTimeout(restyleTimerRef.current);
      restyleTimerRef.current = null;
    }
  }, []);

  // Reconexao agendada nao pode sobreviver ao componente.
  useEffect(() => cancelRestyle, [cancelRestyle]);

  // A sala está de pé AGORA? Não basta existir cliente.
  const connected = room.status === "connected";
  const liveClient = useCallback(
    () => (connected ? clientRef.current : null),
    [connected],
  );

  // Eventos WS vindos do RoomClient.
  const handleRoomEvent = useCallback(
    (event: RoomEvent) => {
      dispatch(event);
      if (event.type === "roll") {
        // Echo da propria rolagem: ja animada no disparo local — so entra
        // no historico (via reducer acima). Rolagem dos outros: anima com a
        // aparencia de dado de quem rolou.
        if (!pendingRef.current.consumeEcho(event.player, event.result)) {
          animate(event.result, event.style, event.player, event.styles);
        }
      } else if (event.type === "deck_draw") {
        // Mesma logica do roll acima, so que pro baralho (echo.ts).
        if (!pendingDeckRef.current.consumeEcho(event.player, event.timestamp)) {
          animateCards(event.cards, event.player);
        }
      } else if (event.type === "rejected") {
        // Codigo recusado (sala nao encontrada/cheia/origem barrada): nao
        // adianta guardar pra reentrar sozinho no proximo carregamento, nem
        // deixar a URL apontando pra ele.
        clearRoomCode(window.localStorage);
        setRoomUrlParam(null);
      }
    },
    [animate, animateCards],
  );

  const join = useCallback(
    (code: string, name: string) => {
      // Entrar de novo manda a aparencia atual — uma reconexao agendada por
      // cor viraria uma segunda conexao logo depois, sem motivo.
      cancelRestyle();
      announcedStylesRef.current = JSON.stringify(diceStyles);
      clientRef.current?.leave();
      selfNameRef.current = name;
      setPlayerName(name);
      savePlayerName(window.localStorage, name);
      saveRoomCode(window.localStorage, code);
      setRoomUrlParam(code);
      pendingRef.current = new PendingRolls();
      pendingDeckRef.current = new PendingDeckDraws();
      dispatch({ type: "joining", code });
      // O estilo do dado vai no join: a sala inteira anima a rolagem de
      // cada um com a cor de cada um.
      const client = new RoomClient(
        code,
        name,
        handleRoomEvent,
        diceStyle,
        false,
        5,
        diceStyles,
      );
      clientRef.current = client;
      client.connect();
    },
    [handleRoomEvent, diceStyle, diceStyles, cancelRestyle],
  );

  // Link de convite (?room=CODIGO) entra direto, sem passar pelo modal — com
  // o apelido salvo (ou "anonymous"), que da pra trocar depois em Sala. Sem
  // link, cai pra ultima sala em que a pessoa esteve (localStorage): reabrir
  // o app nao devia pedir pra digitar o codigo de novo — "sair da sala" e
  // que apaga isso (leave), senao reentraria numa sala que a pessoa deixou
  // por querer.
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (autoJoinedRef.current) return;
    const code = roomParamFromUrl() || loadRoomCode(window.localStorage);
    if (code === "") return;
    autoJoinedRef.current = true;
    join(code, playerName);
  }, [join, playerName]);

  // Trocar de apelido (ou de cor de dado) dentro da sala reconecta: nome e
  // estilo viajam no handshake do WS.
  const rename = useCallback(
    (name: string) => {
      const next = name.trim() || "anonymous";
      setPlayerName(next);
      savePlayerName(window.localStorage, next);
      if (room.code !== null) join(room.code, next);
    },
    [join, room.code],
  );

  const create = useCallback(
    (name: string) => {
      createRoom()
        .then((code) => join(code, name))
        .catch((err: unknown) =>
          dispatch({
            type: "serverError",
            message: err instanceof Error ? err.message : String(err),
          }),
        );
    },
    [join],
  );

  const leave = useCallback(() => {
    cancelRestyle();
    clientRef.current?.leave();
    clientRef.current = null;
    setLocalHistory([]);
    clearRoomCode(window.localStorage);
    setRoomUrlParam(null);
  }, [cancelRestyle]);

  const sendRoll = useCallback(
    (result: RollResult): boolean => {
      const client = liveClient();
      if (client === null) {
        setLocalHistory((prev) => [...prev, { type: "roll", player: "você", result }]);
        return false;
      }
      pendingRef.current.track(selfNameRef.current, result);
      client.send(result);
      return true;
    },
    [liveClient],
  );

  const sendDeckDraw = useCallback(
    (result: DrawResult, timestamp: string) => {
      const client = liveClient();
      if (client === null) {
        // Fora de sala (ou sem conexao agora): entra no historico local,
        // senao a puxada acontece e nao fica log nenhum em lugar nenhum.
        setLocalHistory((prev) => [
          ...prev,
          {
            type: "deck_draw",
            player: "você",
            cards: result.cards,
            remaining: result.remaining,
            timestamp,
          },
        ]);
        return;
      }
      pendingDeckRef.current.track(selfNameRef.current, timestamp);
      client.sendDeckDraw(result.cards, result.remaining, timestamp);
    },
    [liveClient],
  );

  const sendDeckShuffle = useCallback(() => {
    liveClient()?.sendDeckShuffle();
  }, [liveClient]);

  const sendDeckConfig = useCallback(
    (changes: Partial<DeckConfig>) => {
      liveClient()?.sendDeckConfig(changes);
    },
    [liveClient],
  );

  const restyle = useCallback(
    (next: DiceStyles) => {
      const serialized = JSON.stringify(next);
      // Mesma aparencia que a conexao ja anunciou: nao ha o que avisar.
      if (serialized === announcedStylesRef.current) return;
      if (room.code === null) {
        // Fora de sala nao ha handshake pra refazer — o proximo join ja
        // leva a cor nova.
        announcedStylesRef.current = serialized;
        return;
      }
      const code = room.code;
      cancelRestyle();
      restyleTimerRef.current = setTimeout(() => {
        restyleTimerRef.current = null;
        announcedStylesRef.current = serialized;
        clientRef.current?.leave();
        dispatch({ type: "joining", code });
        const client = new RoomClient(
          code,
          selfNameRef.current,
          handleRoomEvent,
          next["1"],
          false,
          5,
          // Os TRES slots, nao so o primeiro: reconectar mandando so
          // `next["1"]` fazia a mesa voltar a ver o dado 2 e 3 na cor antiga
          // ate o proximo join — a cor mudava aqui e nao mudava na tela dos
          // outros.
          next,
        );
        clientRef.current = client;
        client.connect();
      }, RESTYLE_DEBOUNCE_MS);
    },
    [handleRoomEvent, room.code, cancelRestyle],
  );

  return {
    room,
    playerName,
    localHistory,
    join,
    create,
    leave,
    rename,
    sendRoll,
    sendDeckDraw,
    sendDeckShuffle,
    sendDeckConfig,
    restyle,
  };
}
