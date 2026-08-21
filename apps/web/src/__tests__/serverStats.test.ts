import { describe, expect, it, vi, afterEach } from "vitest";
import {
  fetchServerStats,
  formatUptime,
  limitLabel,
  parseServerStats,
  StatsProtectedError,
} from "../serverStats";

const RESPOSTA_COMPLETA = {
  uptime_seconds: 54251,
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
  limits_hit_since_boot: { ws_connect: 2, room_create: 7, desconhecido: 1 },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseServerStats", () => {
  it("le a resposta do backend", () => {
    const stats = parseServerStats(RESPOSTA_COMPLETA);
    expect(stats.rooms.active).toBe(5);
    expect(stats.connections.spectatorsSinceBoot).toBe(4);
    expect(stats.rollsRelayedSinceBoot).toBe(42);
  });

  it("ordena os limites pela maior contagem e ignora zero", () => {
    const stats = parseServerStats({
      ...RESPOSTA_COMPLETA,
      limits_hit_since_boot: { ws_connect: 2, room_create: 7, member_cap: 0 },
    });
    expect(stats.limitsHitSinceBoot).toEqual([
      { kind: "room_create", count: 7 },
      { kind: "ws_connect", count: 2 },
    ]);
  });

  it("aguenta backend velho/estranho sem quebrar a tela", () => {
    // Campo faltando, tipo errado e resposta que nem objeto e: tudo vira 0.
    const parcial = parseServerStats({ rooms: { active: "muitas" }, connections: null });
    expect(parcial.rooms.active).toBe(0);
    expect(parcial.connections.playersNow).toBe(0);
    expect(parcial.limitsHitSinceBoot).toEqual([]);
    expect(parseServerStats("nada disso").uptimeSeconds).toBe(0);
  });
});

describe("formatUptime", () => {
  it("mostra no maximo duas unidades", () => {
    expect(formatUptime(45)).toBe("45s");
    expect(formatUptime(3 * 60 + 20)).toBe("3min");
    expect(formatUptime(54251)).toBe("15h 4min");
    expect(formatUptime(3 * 86400 + 4 * 3600 + 12 * 60)).toBe("3d 4h");
    expect(formatUptime(-5)).toBe("0s");
  });
});

describe("limitLabel", () => {
  it("traduz o que conhece e devolve cru o que nao conhece", () => {
    expect(limitLabel("room_create")).toBe("criação de sala");
    expect(limitLabel("limite_novo_do_backend")).toBe("limite_novo_do_backend");
  });
});

describe("fetchServerStats", () => {
  it("chama /stats e devolve o agregado", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => RESPOSTA_COMPLETA,
    });
    vi.stubGlobal("fetch", fetchMock);

    const stats = await fetchServerStats();
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/stats$/);
    expect(stats.connections.playersNow).toBe(2);
  });

  it("401 vira StatsProtectedError — servidor com STATS_TOKEN ligado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(fetchServerStats()).rejects.toBeInstanceOf(StatsProtectedError);
  });

  it("servidor mudo vira erro de timeout, nao 'carregando' pra sempre", async () => {
    vi.useFakeTimers();
    // Aceita a conexao e nunca responde: `fetch` fica pendurado, e promise
    // pendente NAO rejeita sozinha (AGENTS.md).
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const erro = new Error("aborted");
              erro.name = "AbortError";
              reject(erro);
            });
          }),
      ),
    );

    const promessa = fetchServerStats();
    const esperado = expect(promessa).rejects.toThrow(/não respondeu em 8s/);
    await vi.advanceTimersByTimeAsync(9_000);
    await esperado;
    vi.useRealTimers();
  });

  it("rede fora do ar vira mensagem legivel, nao 'Failed to fetch'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(fetchServerStats()).rejects.toThrow("não foi possível alcançar o servidor");
  });

  it("HTTP quebrado vira erro com o codigo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    await expect(fetchServerStats()).rejects.toThrow("HTTP 502");
  });
});
