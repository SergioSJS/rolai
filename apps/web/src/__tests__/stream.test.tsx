import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RollResult } from "@rolai/rules-engine";
import { parseStreamParams } from "../stream";
import { roomWsUrl } from "../config";
import { RoomClient } from "../room/client";
import { ResultDisplay } from "../components/ResultDisplay";

const RESULT: RollResult = {
  notation: "2d6",
  groups: { roll: { rolls: [3, 4], total: 7 } },
  timestamp: "2026-08-05T12:00:00.000Z",
};

describe("parseStreamParams", () => {
  it("URL comum (sem stream=1) nao e modo stream", () => {
    expect(parseStreamParams("")).toBeNull();
    expect(parseStreamParams("?room=abc123")).toBeNull();
    expect(parseStreamParams("?room=abc123&stream=0")).toBeNull();
  });

  it("stream=1 com sala: fundo alpha (sem chroma)", () => {
    expect(parseStreamParams("?room=abc123&stream=1")).toEqual({
      room: "abc123",
      chroma: null,
      styleId: "",
      scrim: 0,
      scale: 0,
      quality: "",
      style: null,
    });
  });

  it("chroma aceita cor com ou sem # e normaliza", () => {
    expect(parseStreamParams("?room=x&stream=1&chroma=00ff00")?.chroma).toBe("#00ff00");
    expect(parseStreamParams("?room=x&stream=1&chroma=%23FF00FF")?.chroma).toBe("#ff00ff");
  });

  it("fundo funciona como alias de chroma", () => {
    expect(parseStreamParams("?room=x&stream=1&fundo=00ff00")?.chroma).toBe("#00ff00");
  });

  it("chroma invalido cai pro alpha (nunca pinta cor arbitraria)", () => {
    expect(parseStreamParams("?room=x&stream=1&chroma=verde")?.chroma).toBeNull();
    expect(parseStreamParams("?room=x&stream=1&chroma=fff")?.chroma).toBeNull();
    expect(
      parseStreamParams("?room=x&stream=1&chroma=javascript:alert(1)")?.chroma,
    ).toBeNull();
  });

  it("stream=1 sem room devolve room vazio (a StreamApp mostra mensagem)", () => {
    expect(parseStreamParams("?stream=1")).toEqual({
      room: "",
      chroma: null,
      styleId: "",
      scrim: 0,
      scale: 0,
      quality: "",
      style: null,
    });
  });
});

describe("cliente espectador", () => {
  it("roomWsUrl marca spectator=1 no handshake", () => {
    const url = new URL(roomWsUrl("abc123", "stream", undefined, true));
    expect(url.searchParams.get("spectator")).toBe("1");
    // Espectador nao declara nome nem estilo proprio pra sala.
    const normal = new URL(roomWsUrl("abc123", "Ana"));
    expect(normal.searchParams.has("spectator")).toBe(false);
  });

  it("espectador nunca envia roll, mesmo com socket aberto", () => {
    const client = new RoomClient("abc123", "stream", () => {}, undefined, true);
    const send = vi.fn();
    // Injeta um socket "aberto" de mentira: se a guarda de espectador
    // falhar, o send e chamado e o teste pega.
    (client as unknown as { ws: unknown }).ws = {
      readyState: WebSocket.OPEN,
      send,
    };
    client.send(RESULT);
    expect(send).not.toHaveBeenCalled();
  });

  it("jogador normal envia roll com socket aberto", () => {
    const client = new RoomClient("abc123", "Ana", () => {});
    const send = vi.fn();
    (client as unknown as { ws: unknown }).ws = {
      readyState: WebSocket.OPEN,
      send,
    };
    client.send(RESULT);
    expect(send).toHaveBeenCalledOnce();
  });
});

describe("resultado no modo stream", () => {
  it("sem hint de dispensar (na stream ninguem clica)", () => {
    render(<ResultDisplay result={RESULT} showDismissHint={false} />);
    expect(screen.queryByText(/clique ou Esc/)).toBeNull();
    // Headline e chips continuam: o resultado aparece na stream.
    expect(screen.getByText("7")).toBeTruthy();
  });
});

// Overlay do Android: preset de dado e veu vem pela URL (a WebView do
// palco tem localStorage proprio, nunca ve a escolha feita no navegador).
describe("parametros do overlay Android", () => {
  it("le style e scrim", () => {
    const options = parseStreamParams("?stream=1&style=obsidiana&scrim=0.55");
    expect(options?.styleId).toBe("obsidiana");
    expect(options?.scrim).toBe(0.55);
  });

  it("scrim invalido ou fora de 0..1 e normalizado", () => {
    expect(parseStreamParams("?stream=1&scrim=abc")?.scrim).toBe(0);
    expect(parseStreamParams("?stream=1&scrim=7")?.scrim).toBe(1);
  });
});

describe("tamanho e qualidade pela URL (overlay Android)", () => {
  it("le scale e quality", () => {
    const options = parseStreamParams("?stream=1&scale=1.3&quality=3d-full");
    expect(options?.scale).toBe(1.3);
    expect(options?.quality).toBe("3d-full");
  });

  it("scale fora da faixa e clampado; ausente vira 0 (usa o salvo)", () => {
    expect(parseStreamParams("?stream=1&scale=9")?.scale).toBe(1.6);
    expect(parseStreamParams("?stream=1")?.scale).toBe(0);
  });
});

// Overlay Android manda a aparencia custom pela URL (WebView tem
// localStorage proprio e nunca ve o que foi escolhido no app).
describe("aparencia explicita na URL", () => {
  it("le cores, textura e material", () => {
    const o = parseStreamParams(
      "?stream=1&body=8c1f2b&number=f7e8e2&outline=2b0a0e&texture=marble&material=metal",
    );
    expect(o?.style).toEqual({
      body: "#8c1f2b",
      number: "#f7e8e2",
      outline: "#2b0a0e",
      texture: "marble",
      material: "metal",
    });
  });

  it("ignora valor invalido e devolve null quando nao veio nada", () => {
    expect(parseStreamParams("?stream=1&body=javascript&texture=lava")?.style).toBeNull();
    expect(parseStreamParams("?stream=1")?.style).toBeNull();
  });
});
