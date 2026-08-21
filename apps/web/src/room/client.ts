// Cliente da sala: REST pra criar sala + WS com reconexao simples
// (backoff exponencial capado). Protocolo em services/backend/app/rooms.py.

import type { RollResult } from "@rolai/rules-engine";
import type { Card, DeckConfig } from "@rolai/deck-engine";
import { apiBaseUrl, roomWsUrl } from "../config";
import { rememberRoomTtl } from "../roomTtl";
import type { DiceStyle, DiceStyles } from "../settings";
import type { HistoryEntry, RoomEvent, RosterMember } from "./reducer";

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;

// Cria sala no backend e devolve o codigo.
export async function createRoom(): Promise<string> {
  const response = await fetch(`${apiBaseUrl()}/rooms`, { method: "POST" });
  if (!response.ok) {
    throw new Error(`falha ao criar sala (HTTP ${response.status})`);
  }
  const data = (await response.json()) as { code?: string; ttl_seconds?: number };
  if (typeof data.code !== "string") {
    throw new Error("resposta invalida ao criar sala");
  }
  // O TTL vem de graca aqui e a UI avisa com ele; quem ENTRA numa sala nunca
  // ve este corpo e acaba pegando o valor do /stats (ver ../roomTtl.ts).
  rememberRoomTtl(data.ttl_seconds);
  return data.code;
}

type EventHandler = (event: RoomEvent) => void;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

// Roster do servidor: [{name, style|null, styles|null}]. Tolera a forma antiga (lista de
// strings) pra nao quebrar com um backend defasado.
function parseRoster(raw: unknown[]): RosterMember[] {
  return raw.map((item) => {
    if (typeof item === "string") return { name: item };
    if (isRecord(item) && typeof item["name"] === "string") {
      const style = item["style"];
      const styles = item["styles"];
      const member: RosterMember = { name: item["name"] };
      if (isRecord(style)) member.style = style as unknown as DiceStyle;
      if (isRecord(styles)) member.styles = styles as unknown as DiceStyles;
      return member;
    }
    return { name: String(item) };
  });
}

// Historico do snapshot: cada item ja vem com "type" (roll ou deck_*) —
// mesma forma que os eventos de broadcast, so repassa. Tolera item sem
// "type" reconhecido (cliente novo, backend velho) descartando-o em vez de
// quebrar o snapshot inteiro.
function parseHistory(raw: unknown[]): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  for (const item of raw) {
    const event = parseDataEvent(item);
    if (event !== null) entries.push(event);
  }
  return entries;
}

// Interpreta um item que carrega dado (roll/deck_draw/deck_shuffle/
// deck_config) — usado tanto pro historico do snapshot quanto pro broadcast
// ao vivo, mesma forma nos dois.
function parseDataEvent(data: unknown): HistoryEntry | null {
  if (!isRecord(data)) return null;
  const entry = parseDataEventBody(data);
  if (entry === null) return null;
  // Carimbo do servidor: vem no broadcast E no snapshot. Ausente em entrada
  // gravada antes do campo existir — quem consome cai no timestamp do
  // payload (specs/09-limpar-historico.md).
  const receivedAt = data["received_at"];
  if (typeof receivedAt === "string") entry.receivedAt = receivedAt;
  return entry;
}

function parseDataEventBody(data: Record<string, unknown>): HistoryEntry | null {
  switch (data["type"]) {
    case "roll": {
      const player = data["player"];
      const result = data["result"];
      if (typeof player !== "string" || !isRecord(result)) return null;
      const style = data["style"];
      const styles = data["styles"];
      const entry: HistoryEntry = {
        type: "roll",
        player,
        result: result as unknown as RollResult,
      };
      if (isRecord(style)) entry.style = style as unknown as DiceStyle;
      if (isRecord(styles)) entry.styles = styles as unknown as DiceStyles;
      return entry;
    }
    case "deck_draw": {
      const player = data["player"];
      const cards = data["cards"];
      const remaining = data["remaining"];
      const timestamp = data["timestamp"];
      if (
        typeof player !== "string" ||
        !Array.isArray(cards) ||
        typeof remaining !== "number" ||
        typeof timestamp !== "string"
      ) {
        return null;
      }
      return { type: "deck_draw", player, cards: cards as unknown as Card[], remaining, timestamp };
    }
    case "deck_shuffle": {
      const player = data["player"];
      const timestamp = data["timestamp"];
      if (typeof player !== "string" || typeof timestamp !== "string") return null;
      return { type: "deck_shuffle", player, timestamp };
    }
    case "deck_config": {
      const player = data["player"];
      const timestamp = data["timestamp"];
      if (typeof player !== "string" || typeof timestamp !== "string") return null;
      const entry: HistoryEntry = { type: "deck_config", player, timestamp };
      const includeJokers = data["include_jokers"];
      if (typeof includeJokers === "boolean") entry.includeJokers = includeJokers;
      const removalMode = data["removal_mode"];
      if (removalMode === "permanent" || removalMode === "returns") {
        entry.removalMode = removalMode;
      }
      const autoReshuffleOnEmpty = data["auto_reshuffle_on_empty"];
      if (typeof autoReshuffleOnEmpty === "boolean") {
        entry.autoReshuffleOnEmpty = autoReshuffleOnEmpty;
      }
      return entry;
    }
    default:
      return null;
  }
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
        history: parseHistory(history),
      };
    }
    case "roster": {
      const roster = data["roster"];
      if (!Array.isArray(roster)) return null;
      return { type: "roster", roster: parseRoster(roster) };
    }
    case "history_cleared": {
      const player = data["player"];
      const receivedAt = data["received_at"];
      if (typeof player !== "string" || typeof receivedAt !== "string") return null;
      return { type: "historyCleared", player, receivedAt };
    }
    case "error": {
      const message = data["message"];
      return {
        type: "serverError",
        message: typeof message === "string" ? message : "erro desconhecido",
      };
    }
    default:
      return parseDataEvent(data);
  }
}

// Heartbeat do backend: {"type":"ping"} a cada N segundos ociosos
// (ws_heartbeat_seconds). O parseServerMessage ignora tipos desconhecidos,
// entao o ping e tratado aqui — responder pong mantem os dois sentidos da
// conexao quentes atras de proxies com timeout ocioso (Cloudflare ~100s).
export function isHeartbeatPing(raw: string): boolean {
  if (!raw.includes("ping")) return false;
  try {
    const data: unknown = JSON.parse(raw);
    return isRecord(data) && data["type"] === "ping";
  } catch {
    return false;
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
    // Quantas vezes reconectar antes de desistir de vez. Padrao 5 (~15s de
    // backoff) serve pra UI com gente na frente pra notar e agir. A Browser
    // Source do OBS passa Infinity: ninguem esta olhando pra recarregar a
    // pagina, e o backend recria sozinho sala de codigo durável no reconnect
    // (rooms.py) — desistir so trocaria "reconecta sozinho" por "trava até
    // alguem notar", que e o proprio bug reportado.
    private readonly maxReconnectAttempts: number = MAX_RECONNECT_ATTEMPTS,
    private readonly styles?: DiceStyles,
  ) {}

  connect(): void {
    this.manualClose = false;
    this.open();
  }

  private sendEnvelope(envelope: Record<string, unknown>): void {
    // Espectador nunca opera a mesa — guarda local (o backend rejeitaria de
    // qualquer jeito, mas nem chega a sair do cliente).
    if (this.spectator) return;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(envelope));
    }
  }

  send(result: RollResult): void {
    this.sendEnvelope({ type: "roll", result });
  }

  // Baralho (specs/08-baralho.md): mesmo esquema de confianca da rolagem —
  // o cliente ja calculou local (deck-engine), so avisa a sala pro log e
  // pro historico. Campos em snake_case no wire (mesma convencao do resto
  // do protocolo — ver services/backend/app/schemas.py).
  //
  // `timestamp` vem de FORA (App.tsx) em vez de gerado aqui: e a mesma
  // chave usada pra dedupe do echo (room/echo.ts) — se cada chamada gerasse
  // o proprio timestamp, o valor animado localmente nunca bateria com o
  // que volta no broadcast, e a propria puxada animaria duas vezes.
  sendDeckDraw(cards: Card[], remaining: number, timestamp: string): void {
    this.sendEnvelope({ type: "deck_draw", cards, remaining, timestamp });
  }

  // Apaga o historico da sala pra TODO MUNDO, sem undo — diferente do
  // "ocultar daqui pra tras", que e filtro local (specs/09-limpar-historico.md).
  // Espectador nao passa: sendEnvelope ja barra, e o backend barra de novo.
  clearHistory(): void {
    this.sendEnvelope({ type: "history_clear" });
  }

  sendDeckShuffle(): void {
    this.sendEnvelope({ type: "deck_shuffle", timestamp: new Date().toISOString() });
  }

  sendDeckConfig(changes: Partial<DeckConfig>): void {
    const payload: Record<string, unknown> = {
      type: "deck_config",
      timestamp: new Date().toISOString(),
    };
    if (changes.includeJokers !== undefined) payload["include_jokers"] = changes.includeJokers;
    if (changes.removalMode !== undefined) payload["removal_mode"] = changes.removalMode;
    if (changes.autoReshuffleOnEmpty !== undefined) {
      payload["auto_reshuffle_on_empty"] = changes.autoReshuffleOnEmpty;
    }
    this.sendEnvelope(payload);
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
    const ws = new WebSocket(
      roomWsUrl(this.code, this.name, this.style, this.spectator, this.styles),
    );
    this.ws = ws;

    ws.onmessage = (msg: MessageEvent) => {
      const raw = String(msg.data);
      if (isHeartbeatPing(raw)) {
        ws.send('{"type":"pong"}');
        return;
      }
      const event = parseServerMessage(raw);
      if (event === null) return;
      if (event.type === "snapshot") this.attempts = 0;
      this.onEvent(event);
    };

    ws.onclose = (event: CloseEvent) => {
      if (this.manualClose) return;
      // Recusa DEFINITIVA do servidor: pra um cliente com maxReconnectAttempts
      // finito (a UI, com gente na frente), reconectar so comeria cota do
      // limite de conexao sem chance real de dar certo — desistir na hora e
      // deixar a pessoa agir. O backend aceita o handshake antes de validar
      // justamente pra estes codigos chegarem aqui — fechar antes do accept
      // vira 1006 (erro generico) e o cliente nao distingue de queda de rede
      // (services/backend/app/rooms.py).
      const fatal: Record<number, string> = {
        4404: "sala não encontrada",
        4403: "origem não autorizada",
        4429: "sala cheia ou limite de conexões atingido",
        1008: "rate limit excedido",
      };
      const motivo = fatal[event.code];
      const semLimite = !Number.isFinite(this.maxReconnectAttempts);
      if (motivo !== undefined && !semLimite) {
        this.onEvent({ type: "rejected", message: motivo });
        return;
      }
      if (!semLimite && this.attempts >= this.maxReconnectAttempts) {
        this.onEvent({ type: "disconnected", willReconnect: false });
        return;
      }
      // Backoff capado: sem isto, um cliente sem limite (Infinity) que nunca
      // reseta `attempts` (porque a sala sumiu de vez) chegaria a esperar
      // horas entre tentativas.
      const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** this.attempts);
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
