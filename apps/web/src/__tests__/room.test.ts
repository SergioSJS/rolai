import { describe, expect, it } from "vitest";
import type { RollResult } from "@rolai/rules-engine";
import { initialRoomState, roomReducer } from "../room/reducer";
import { PendingRolls } from "../room/echo";
import { isHeartbeatPing, parseServerMessage } from "../room/client";
import { apiBaseUrl, roomWsUrl, wsBaseUrl } from "../config";

function makeResult(overrides: Partial<RollResult> = {}): RollResult {
  return {
    notation: "2d6",
    groups: { roll: { rolls: [3, 4], total: 7 } },
    timestamp: "2026-08-05T12:00:00.000Z",
    ...overrides,
  };
}

const STYLE = {
  body: "#aa1122",
  number: "#ffffff",
  outline: "#000000",
  texture: "marble" as const,
  material: "metal" as const,
};

const SNAPSHOT = {
  type: "snapshot" as const,
  roster: [{ name: "ana" }, { name: "bia", style: STYLE }],
  history: [{ player: "ana", result: makeResult() }],
};

describe("roomReducer", () => {
  it("joining zera o estado e marca connecting", () => {
    const state = roomReducer(initialRoomState, {
      type: "joining",
      code: "abc123",
    });
    expect(state).toEqual({
      code: "abc123",
      status: "connecting",
      roster: [],
      history: [],
      error: null,
    });
  });

  it("snapshot popula roster e historico e marca connected", () => {
    const joining = roomReducer(initialRoomState, {
      type: "joining",
      code: "abc123",
    });
    const state = roomReducer(joining, SNAPSHOT);
    expect(state.status).toBe("connected");
    expect(state.roster.map((m) => m.name)).toEqual(["ana", "bia"]);
    expect(state.roster[1]!.style).toEqual(STYLE);
    expect(state.history).toHaveLength(1);
  });

  it("evento roll entra no historico na ordem de chegada (ordem canonica)", () => {
    let state = roomReducer(initialRoomState, { type: "joining", code: "x" });
    state = roomReducer(state, { ...SNAPSHOT, history: [] });
    state = roomReducer(state, {
      type: "roll",
      player: "bia",
      result: makeResult({ timestamp: "2026-08-05T12:00:01.000Z" }),
    });
    state = roomReducer(state, {
      type: "roll",
      player: "ana",
      result: makeResult({ timestamp: "2026-08-05T12:00:02.000Z" }),
    });
    expect(state.history.map((e) => e.player)).toEqual(["bia", "ana"]);
  });

  it("roll fora de sala conectada e ignorado", () => {
    const state = roomReducer(initialRoomState, {
      type: "roll",
      player: "ana",
      result: makeResult(),
    });
    expect(state.history).toHaveLength(0);
  });

  it("disconnected com willReconnect marca reconnecting, senao closed", () => {
    let state = roomReducer(initialRoomState, { type: "joining", code: "x" });
    state = roomReducer(state, { type: "disconnected", willReconnect: true });
    expect(state.status).toBe("reconnecting");
    state = roomReducer(state, { type: "disconnected", willReconnect: false });
    expect(state.status).toBe("closed");
  });

  it("left volta ao estado inicial (modo sem sala)", () => {
    let state = roomReducer(initialRoomState, { type: "joining", code: "x" });
    state = roomReducer(state, SNAPSHOT);
    expect(roomReducer(state, { type: "left" })).toEqual(initialRoomState);
  });
});

describe("PendingRolls (dedupe do echo)", () => {
  it("echo da propria rolagem e consumido uma unica vez", () => {
    const pending = new PendingRolls();
    const result = makeResult();
    pending.track("eu", result);
    expect(pending.consumeEcho("eu", result)).toBe(true);
    // Segundo consume do mesmo evento (ou outro cliente com mesmo nome):
    // nao e mais echo rastreado.
    expect(pending.consumeEcho("eu", result)).toBe(false);
  });

  it("rolagem de outro jogador nunca casa com as nossas", () => {
    const pending = new PendingRolls();
    const result = makeResult();
    pending.track("eu", result);
    expect(pending.consumeEcho("outro", result)).toBe(false);
  });

  it("duas rolagens identicas no mesmo ms consomem dois echos", () => {
    const pending = new PendingRolls();
    const result = makeResult();
    pending.track("eu", result);
    pending.track("eu", result);
    expect(pending.consumeEcho("eu", result)).toBe(true);
    expect(pending.consumeEcho("eu", result)).toBe(true);
    expect(pending.consumeEcho("eu", result)).toBe(false);
  });
});

describe("parseServerMessage", () => {
  it("parseia snapshot do protocolo", () => {
    const event = parseServerMessage(JSON.stringify(SNAPSHOT));
    expect(event).toEqual(SNAPSHOT);
  });

  it("parseia evento roll", () => {
    const raw = JSON.stringify({
      type: "roll",
      player: "ana",
      result: makeResult(),
    });
    const event = parseServerMessage(raw);
    expect(event?.type).toBe("roll");
  });

  it("parseia erro do servidor", () => {
    expect(parseServerMessage('{"type":"error","message":"invalid_json"}')).toEqual({
      type: "serverError",
      message: "invalid_json",
    });
  });

  it("ignora JSON quebrado e envelopes desconhecidos", () => {
    expect(parseServerMessage("not json")).toBeNull();
    expect(parseServerMessage('{"type":"mystery"}')).toBeNull();
    expect(parseServerMessage('{"type":"roll","player":42}')).toBeNull();
  });
});

describe("isHeartbeatPing", () => {
  it("reconhece o ping do backend e so ele", () => {
    expect(isHeartbeatPing('{"type":"ping"}')).toBe(true);
    expect(isHeartbeatPing('{"type":"pong"}')).toBe(false);
    expect(isHeartbeatPing('{"type":"roll","player":"ana"}')).toBe(false);
    expect(isHeartbeatPing("not json")).toBe(false);
    // Nao bate em payload de rolagem que so mencione "ping" no meio.
    expect(isHeartbeatPing('{"type":"roll","player":"pinguim"}')).toBe(false);
  });
});

describe("protocolo: estilo do dado por jogador", () => {
  it("snapshot aceita roster com estilo e a forma antiga (lista de strings)", () => {
    const novo = parseServerMessage(
      JSON.stringify({
        type: "snapshot",
        roster: [{ name: "ana", style: STYLE }, { name: "bia", style: null }],
        history: [],
      }),
    );
    expect(novo).toEqual({
      type: "snapshot",
      roster: [{ name: "ana", style: STYLE }, { name: "bia" }],
      history: [],
    });

    const antigo = parseServerMessage(
      JSON.stringify({ type: "snapshot", roster: ["ana"], history: [] }),
    );
    expect(antigo).toEqual({ type: "snapshot", roster: [{ name: "ana" }], history: [] });
  });

  it("evento roster atualiza quem esta na sala", () => {
    let state = roomReducer(initialRoomState, { type: "joining", code: "x" });
    state = roomReducer(state, SNAPSHOT);
    state = roomReducer(state, {
      type: "roster",
      roster: [{ name: "ana" }, { name: "bia" }, { name: "caio", style: STYLE }],
    });
    expect(state.roster.map((m) => m.name)).toEqual(["ana", "bia", "caio"]);
  });

  it("roll carrega o estilo de quem rolou e ele entra no historico", () => {
    const event = parseServerMessage(
      JSON.stringify({
        type: "roll",
        player: "bia",
        result: makeResult(),
        style: STYLE,
      }),
    );
    expect(event).toEqual({
      type: "roll",
      player: "bia",
      result: makeResult(),
      style: STYLE,
    });

    let state = roomReducer(initialRoomState, { type: "joining", code: "x" });
    state = roomReducer(state, { ...SNAPSHOT, history: [] });
    state = roomReducer(state, event!);
    expect(state.history[0]!.style).toEqual(STYLE);
  });

  it("roll sem estilo (cliente antigo) continua valido", () => {
    const event = parseServerMessage(
      JSON.stringify({ type: "roll", player: "ana", result: makeResult(), style: null }),
    );
    expect(event).toEqual({ type: "roll", player: "ana", result: makeResult() });
  });
});

describe("roomWsUrl", () => {
  it("leva apelido e estilo no handshake", () => {
    const url = new URL(roomWsUrl("abc123", "Ana Maria", STYLE));
    expect(url.pathname).toBe("/rooms/abc123");
    expect(url.searchParams.get("name")).toBe("Ana Maria");
    expect(JSON.parse(url.searchParams.get("style")!)).toEqual(STYLE);
  });

  it("sem estilo, nao manda o parametro", () => {
    const url = new URL(roomWsUrl("abc123", "Ana"));
    expect(url.searchParams.has("style")).toBe(false);
  });
});

// Config de runtime: a MESMA imagem serve qualquer dominio, entao
// window.__ROLAI_CONFIG__ (escrito pelo entrypoint do container) tem que
// vencer o que o Vite inlinou no bundle.
describe("config de runtime", () => {
  const env = { VITE_WS_URL: "wss://build.example", VITE_API_URL: "https://build.example" };

  it("runtime vence o valor de build", () => {
    const runtime = { wsUrl: "wss://runtime.example", apiUrl: "https://api.runtime.example" };
    expect(wsBaseUrl(env, runtime)).toBe("wss://runtime.example");
    expect(apiBaseUrl(env, runtime)).toBe("https://api.runtime.example");
  });

  it("string vazia conta como ausente (o entrypoint sempre escreve a chave)", () => {
    expect(wsBaseUrl(env, { wsUrl: "" })).toBe("wss://build.example");
    expect(apiBaseUrl(env, { apiUrl: "" })).toBe("https://build.example");
  });

  it("sem runtime nem build, cai no backend de dev", () => {
    expect(wsBaseUrl({}, {})).toBe("ws://localhost:8420");
    expect(apiBaseUrl({}, {})).toBe("http://localhost:8420");
  });

  it("api deriva do ws de runtime quando so o ws vem", () => {
    expect(apiBaseUrl({}, { wsUrl: "wss://sala.example" })).toBe("https://sala.example");
  });
});

describe("recusa no handshake", () => {
  it("limpa o estado de sala — nunca chegamos a entrar", () => {
    // Entrou numa sala e depois foi recusado ao reconectar (sala expirou):
    // manter o codigo faria a UI mostrar "em sala" desconectado, sem saida.
    const entrou = roomReducer(
      { ...initialRoomState, code: "a1B2-c3D", status: "connected" },
      { type: "rejected", message: "sala não encontrada" },
    );
    expect(entrou.code).toBeNull();
    expect(entrou.status).toBe("idle");
    expect(entrou.error).toBe("sala não encontrada");
  });

  it("erro de sessao NAO derruba a sala", () => {
    // serverError e outra coisa: acontece com a sala ja estabelecida
    // (ex: espectador tentando rolar) e nao pode tirar ninguem de lugar.
    const depois = roomReducer(
      { ...initialRoomState, code: "a1B2-c3D", status: "connected" },
      { type: "serverError", message: "spectator_cannot_roll" },
    );
    expect(depois.code).toBe("a1B2-c3D");
    expect(depois.status).toBe("connected");
  });
});
