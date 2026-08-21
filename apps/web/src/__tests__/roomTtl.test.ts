import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatTtl,
  loadRoomTtl,
  rememberRoomTtl,
  resetRoomTtlCache,
  ttlPhrase,
} from "../roomTtl";

function statsResponse(ttl: unknown) {
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

describe("formatTtl", () => {
  it("escreve por extenso, sem abreviar", () => {
    expect(formatTtl(6 * 3600)).toBe("6 horas");
    expect(formatTtl(3600)).toBe("1 hora");
    expect(formatTtl(5400)).toBe("90 minutos");
    expect(formatTtl(60)).toBe("1 minuto");
  });
});

describe("ttlPhrase", () => {
  it("sem numero quando o servidor nao contou — o aviso vale mesmo assim", () => {
    expect(ttlPhrase(null)).toBe("algumas horas sem ninguém rolar nada");
    // Backend velho, sem o campo: o parse devolve 0, e prometer "0 hora"
    // seria pior que nao dar numero.
    expect(ttlPhrase(0)).toBe("algumas horas sem ninguém rolar nada");
    expect(ttlPhrase(6 * 3600)).toBe("6 horas sem ninguém rolar nada");
  });
});

describe("loadRoomTtl", () => {
  it("busca no /stats e guarda", async () => {
    const fetchMock = vi.fn().mockResolvedValue(statsResponse(1800));
    vi.stubGlobal("fetch", fetchMock);

    expect(await loadRoomTtl()).toBe(1800);
    expect(await loadRoomTtl()).toBe(1800);
    expect(fetchMock).toHaveBeenCalledTimes(1); // o segundo veio do cache
  });

  it("nao dispara duas buscas quando Sala e Ajuda perguntam juntas", async () => {
    const fetchMock = vi.fn().mockResolvedValue(statsResponse(1800));
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([loadRoomTtl(), loadRoomTtl()]);
    expect([a, b]).toEqual([1800, 1800]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("usa o que veio do POST /rooms sem tocar no /stats", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    rememberRoomTtl(21600);
    expect(await loadRoomTtl()).toBe(21600);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("servidor fora do ar nao vira erro — a tela cai no texto sem numero", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await loadRoomTtl()).toBeNull();
  });

  it("401 (servidor com STATS_TOKEN) tambem cai no texto sem numero", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    expect(await loadRoomTtl()).toBeNull();
  });
});
