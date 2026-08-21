import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RoomPanel } from "../components/RoomPanel";
import type { RoomState } from "../room/reducer";
import { resetRoomTtlCache } from "../roomTtl";

const SEM_SALA: RoomState = {
  code: null,
  status: "idle",
  roster: [],
  history: [],
  error: null,
};

const EM_SALA: RoomState = { ...SEM_SALA, code: "ABCD1234", status: "connected" };

const NADA = () => {};

function painel(room: RoomState) {
  return (
    <RoomPanel
      room={room}
      playerName="Ana"
      onCreate={NADA}
      onJoin={NADA}
      onLeave={NADA}
      onRename={NADA}
    />
  );
}

function statsComTtl(ttl: number) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ rooms: { active: 0, created_since_boot: 0, ttl_seconds: ttl } }),
  };
}

beforeEach(() => {
  resetRoomTtlCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RoomPanel — aviso de expiração", () => {
  it("diz o prazo antes de entrar, com o número do servidor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(statsComTtl(6 * 3600)));
    render(painel(SEM_SALA));

    await waitFor(() =>
      expect(screen.getByText(/6 horas sem ninguém rolar nada/)).toBeTruthy(),
    );
    // O prazo conta silêncio, não idade da sala — a frase tem que dizer isso.
    expect(screen.getByText(/cada rolagem renova o prazo/i)).toBeTruthy();
  });

  it("dentro da sala, avisa junto do export que o histórico some", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(statsComTtl(6 * 3600)));
    render(painel(EM_SALA));

    await waitFor(() =>
      expect(screen.getByText(/some junto com a sala, depois de/)).toBeTruthy(),
    );
    expect(screen.getByText(/6 horas sem ninguém rolar nada/)).toBeTruthy();
  });

  it("servidor mudo: avisa sem prometer número", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(painel(SEM_SALA));

    await waitFor(() =>
      expect(screen.getByText(/algumas horas sem ninguém rolar nada/)).toBeTruthy(),
    );
  });
});
