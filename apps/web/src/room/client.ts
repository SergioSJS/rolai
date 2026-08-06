// Cliente da sala: REST pra criar sala + WS com reconexao simples
// (backoff exponencial capado). Protocolo em services/backend/app/rooms.py.

import type { RollResult } from "@rolai/rules-engine";
import { apiBaseUrl, roomWsUrl } from "../config";
import type { DiceStyle } from "../settings";
import type { HistoryEntry, RoomEvent, RosterMember } from "./reducer";

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 500;

// Cria sala no backend e devolve o codigo.
export async function createRoom(): Promise<string> {
  const response = await fetch(`${apiBaseUrl()}/rooms`, { method: "POST" });
  if (!response.ok) {
    throw new Error(`falha ao criar sala (HTTP ${response.status})`);
  }
  const data = (await response.json()) as { code?: string };
  if (typeof data.code !== "string") {
    throw new Error("resposta invalida ao criar sala");
  }
  return data.code;
}

type EventHandler = (event: RoomEvent) => void;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

// Roster do servidor: [{name, style|null}]. Tolera a forma antiga (lista de
// strings) pra nao quebrar com um backend defasado.
function parseRoster(raw: unknown[]): RosterMember[] {
  return raw.map((item) => {
    if (typeof item === "string") return { name: item };
    if (isRecord(item) && typeof item["name"] === "string") {
      const style = item["style"];
      const member: RosterMember = { name: item["name"] };
      if (isRecord(style)) member.style = style as unknown as DiceStyle;
      return member;
    }
    return { name: String(item) };
  });
}

// Interpreta uma mensagem do servidor. Mensagens fora do protocolo sao
// ignoradas (retorno null) — o backend e o unico emissor, mas o parse e
// defensivo mesmo assim.
export function parseServerMessage(raw: string): RoomEvent | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  switch (data["type"]) {
    case "snapshot": {
      const roster = data["roster"];
      const history = data["history"];
      if (!Array.isArray(roster) || !Array.isArray(history)) return null;
      return {
        type: "snapshot",
        roster: parseRoster(roster),
        history: history as HistoryEntry[],
      };
    }
    case "roster": {
      const roster = data["roster"];
      if (!Array.isArray(roster)) return null;
      return { type: "roster", roster: parseRoster(roster) };
    }
    case "roll": {
      const player = data["player"];
      const result = data["result"];
      if (typeof player !== "string" || !isRecord(result)) return null;
      const style = data["style"];
      const event: RoomEvent = {
        type: "roll",
        player,
        result: result as unknown as RollResult,
      };
      if (isRecord(style)) event.style = style as unknown as DiceStyle;
      return event;
    }
    case "error": {
      const message = data["message"];
      return {
        type: "serverError",
        message: typeof message === "string" ? message : "erro desconhecido",
      };
    }
    default:
      return null;
  }
}

export class RoomClient {
  private ws: WebSocket | null = null;
  private manualClose = false;
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly code: string,
    private readonly name: string,
    private readonly onEvent: EventHandler,
    // Aparencia dos dados deste jogador, anunciada no join.
    private readonly style?: DiceStyle,
    // Modo stream/OBS: entra como espectador — recebe e anima as rolagens
    // dos outros, nunca rola (o backend tambem rejeita roll de espectador).
    private readonly spectator = false,
  ) {}

  connect(): void {
    this.manualClose = false;
    this.open();
  }

  send(result: RollResult): void {
    // Espectador nunca rola — guarda local (o backend rejeitaria de
    // qualquer jeito, mas nem chega a sair do cliente).
    if (this.spectator) return;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "roll", result }));
    }
  }

  leave(): void {
    this.manualClose = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.onEvent({ type: "left" });
  }

  private open(): void {
    const ws = new WebSocket(roomWsUrl(this.code, this.name, this.style, this.spectator));
    this.ws = ws;

    ws.onmessage = (msg: MessageEvent) => {
      const event = parseServerMessage(String(msg.data));
      if (event === null) return;
      if (event.type === "snapshot") this.attempts = 0;
      this.onEvent(event);
    };

    ws.onclose = (event: CloseEvent) => {
      if (this.manualClose) return;
      // 4404 = sala inexistente; 1008 = rate limit — nao reconecta.
      if (event.code === 4404 || event.code === 1008) {
        this.onEvent({
          type: "serverError",
          message:
            event.code === 4404 ? "sala não encontrada" : "rate limit excedido",
        });
        this.onEvent({ type: "disconnected", willReconnect: false });
        return;
      }
      if (this.attempts >= MAX_RECONNECT_ATTEMPTS) {
        this.onEvent({ type: "disconnected", willReconnect: false });
        return;
      }
      const delay = BASE_BACKOFF_MS * 2 ** this.attempts;
      this.attempts += 1;
      this.onEvent({ type: "disconnected", willReconnect: true });
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.open();
      }, delay);
    };

    ws.onerror = () => {
      // O close event vem em seguida e cuida da reconexao.
    };
  }
}
