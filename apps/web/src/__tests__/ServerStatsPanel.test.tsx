import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServerStatsPanel } from "../components/ServerStatsPanel";
import { STATS_POLL_MS } from "../useServerStats";

const CORPO = {
  uptime_seconds: 7200,
  rooms: { active: 5, created_since_boot: 3 },
  connections: {
    players_now: 2,
    spectators_now: 1,
    rooms_with_someone: 1,
    players_since_boot: 9,
    spectators_since_boot: 4,
  },
  rolls_relayed_since_boot: 42,
  profiles: { created_since_boot: 1, purged_since_boot: 0 },
  limits_hit_since_boot: {},
};

function okResponse(body: unknown = CORPO) {
  return { ok: true, status: 200, json: async () => body };
}

function setOnLine(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
}

beforeEach(() => {
  setOnLine(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ServerStatsPanel", () => {
  it("mostra os agregados do servidor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse()));
    render(<ServerStatsPanel open />);

    expect(await screen.findByText("42")).toBeTruthy();
    // 5 salas ativas e o rotulo correspondente
    expect(screen.getByText("salas ativas")).toBeTruthy();
    expect(screen.getByText(/No ar há/)).toBeTruthy();
    expect(screen.getByText(/Nenhum limite atingido/)).toBeTruthy();
  });

  it("lista os limites atingidos, inclusive chave que esta build nao conhece", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okResponse({ ...CORPO, limits_hit_since_boot: { room_create: 7, limite_novo: 1 } }),
      ),
    );
    render(<ServerStatsPanel open />);

    expect(await screen.findByText("criação de sala")).toBeTruthy();
    expect(screen.getByText("limite_novo")).toBeTruthy();
  });

  it("erro de rede mantem o ultimo dado na tela, com aviso", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse())
      .mockRejectedValue(new Error("servidor fora do ar"));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(<ServerStatsPanel open />);
    await waitFor(() => expect(screen.getByText("42")).toBeTruthy());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATS_POLL_MS + 100);
    });

    expect(screen.getByText(/servidor fora do ar/)).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy(); // o numero de antes continua ali
  });

  it("401 avisa que o status e protegido e para de bater no endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(<ServerStatsPanel open />);
    await waitFor(() => expect(screen.getByText(/protege o status com token/)).toBeTruthy());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATS_POLL_MS * 3);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aba em segundo plano ao abrir avisa que esta pausado, sem fingir que carrega", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<ServerStatsPanel open />);
    expect(await screen.findByText(/Pausado enquanto esta aba/)).toBeTruthy();
    expect(screen.queryByText("Carregando…")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offline nao consulta o servidor", async () => {
    setOnLine(false);
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<ServerStatsPanel open />);
    expect(await screen.findByText(/Sem rede/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aba escondida suspende o auto-refresh — /stats divide o teto por IP", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(<ServerStatsPanel open />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATS_POLL_MS * 3);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
