// Estado da sala como reducer puro (testavel sem DOM nem rede).
// Protocolo WS do backend — ver docstring em services/backend/app/rooms.py:
// ao conectar chega {"type":"snapshot", roster, history}; rolagens chegam
// como {"type":"roll", player, result} pra TODOS, incluindo o remetente
// (echo/ack — a deduplicacao da animacao fica em echo.ts, aqui o historico
// segue a ordem canonica do servidor: toda rolagem entra, echo ou nao).

import type { RollResult } from "@rolai/rules-engine";
import type { DiceStyle } from "../settings";

export interface HistoryEntry {
  player: string;
  result: RollResult;
  // Aparencia dos dados de quem rolou (pode faltar: cliente antigo ou
  // estilo invalido) — usada pra colorir o nome e animar na cor certa.
  style?: DiceStyle | null;
}

export interface RosterMember {
  name: string;
  style?: DiceStyle | null;
}

export type ConnectionStatus =
  | "idle" // sem sala — modo padrao (docs/architecture.md)
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed";

export interface RoomState {
  code: string | null;
  status: ConnectionStatus;
  roster: RosterMember[];
  history: HistoryEntry[];
  error: string | null;
}

export type RoomEvent =
  | { type: "joining"; code: string }
  | { type: "snapshot"; roster: RosterMember[]; history: HistoryEntry[] }
  | { type: "roster"; roster: RosterMember[] }
  | { type: "roll"; player: string; result: RollResult; style?: DiceStyle | null }
  | { type: "serverError"; message: string }
  // Recusa no handshake (sala inexistente, cheia, origem barrada): nunca
  // chegamos a entrar, entao o estado de sala tem que sumir — senao a UI
  // mostra "em sala - CODIGO" desconectado pra uma sala em que nunca
  // estivemos, sem saida a nao ser recarregar.
  | { type: "rejected"; message: string }
  | { type: "disconnected"; willReconnect: boolean }
  | { type: "left" };

export const initialRoomState: RoomState = {
  code: null,
  status: "idle",
  roster: [],
  history: [],
  error: null,
};

export function roomReducer(state: RoomState, event: RoomEvent): RoomState {
  switch (event.type) {
    case "joining":
      return {
        code: event.code,
        status: state.status === "reconnecting" ? "reconnecting" : "connecting",
        roster: [],
        history: [],
        error: null,
      };
    case "snapshot":
      if (state.code === null) return state;
      return {
        ...state,
        status: "connected",
        roster: event.roster,
        history: event.history,
        error: null,
      };
    case "roster":
      if (state.code === null) return state;
      return { ...state, roster: event.roster };
    case "roll": {
      if (state.status !== "connected") return state;
      const entry: HistoryEntry = { player: event.player, result: event.result };
      if (event.style) entry.style = event.style;
      return { ...state, history: [...state.history, entry] };
    }
    case "serverError":
      return { ...state, error: event.message };
    case "rejected":
      return { ...initialRoomState, error: event.message };
    case "disconnected":
      if (state.code === null) return state;
      return {
        ...state,
        status: event.willReconnect ? "reconnecting" : "closed",
      };
    case "left":
      return initialRoomState;
  }
}
