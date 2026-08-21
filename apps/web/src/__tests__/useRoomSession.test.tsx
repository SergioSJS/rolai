// Sala do App como hook (room/useRoomSession.ts).
//
// O reducer, o cliente WS e o dedupe de echo já tinham teste isolado — o que
// não tinha era a COSTURA entre os três, que foi justo o que saiu do App.tsx.
// Aqui a sala é exercitada como o App a usa: entra, recebe rolagem dos
// outros, ignora o eco da própria, cai fora do ar, troca de cor, sai.
//
// O fake de WebSocket é o mesmo modelo de room.test.ts: a URL é o que
// interessa em vários casos, porque nome e aparência viajam no handshake.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { RollResult } from "@rolai/rules-engine";
import type { DrawResult } from "@rolai/deck-engine";
import { useRoomSession } from "../room/useRoomSession";
import { DEFAULT_DICE_STYLES } from "../settings";
import type { DiceStyles } from "../settings";

function makeResult(overrides: Partial<RollResult> = {}): RollResult {
  return {
    notation: "2d6",
    groups: { roll: { rolls: [3, 4], total: 7 } },
    timestamp: "2026-08-20T12:00:00.000Z",
    ...overrides,
  };
}

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly OPEN = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = FakeWebSocket.OPEN;
  sent: string[] = [];
  closed = false;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  entregar(payload: unknown): void {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(payload) }));
  }

  derrubar(code: number): void {
    this.onclose?.(new CloseEvent("close", { code }));
  }
}

const ultimoSocket = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!;

/** Sobe o hook com espiões no lugar das animações do palco. */
function montar(diceStyles: DiceStyles = DEFAULT_DICE_STYLES) {
  const animate = vi.fn();
  const animateCards = vi.fn();
  const view = renderHook(() =>
    useRoomSession({
      animate,
      animateCards,
      diceStyle: diceStyles["1"],
      diceStyles,
    }),
  );
  return { animate, animateCards, ...view };
}

/** Entra numa sala e conclui o handshake (snapshot = "conectado"). */
function entrar(view: ReturnType<typeof montar>, code = "sala-de-teste-01", nome = "ana") {
  act(() => view.result.current.join(code, nome));
  act(() => ultimoSocket().entregar({ type: "snapshot", roster: [{ name: nome }], history: [] }));
}

describe("useRoomSession", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    // O restyle e debounced: sem relogio falso o teste teria que dormir.
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("ocultar corta pelo carimbo do servidor e mostrar tudo desfaz", () => {
    const view = montar();
    entrar(view);
    act(() =>
      ultimoSocket().entregar({
        type: "roll",
        player: "bia",
        result: makeResult(),
        received_at: "2026-08-20T12:00:00.100000+00:00",
      }),
    );

    act(() => view.result.current.hideHistory());
    // O corte é o carimbo do SERVIDOR, não `new Date()` desta máquina —
    // comparar contra o relógio local traria o skew de volta (room/hidden.ts).
    expect(view.result.current.hiddenBefore).toBe("2026-08-20T12:00:00.100000+00:00");
    // Ocultar é só filtro de exibição: o histórico da sala segue inteiro.
    expect(view.result.current.room.history).toHaveLength(1);

    act(() => view.result.current.showAllHistory());
    expect(view.result.current.hiddenBefore).toBeNull();
  });

  it("corte é por sala e sobrevive ao F5", () => {
    const view = montar();
    entrar(view, "sala-de-teste-01");
    act(() =>
      ultimoSocket().entregar({
        type: "roll",
        player: "bia",
        result: makeResult(),
        received_at: "2026-08-20T12:00:00.100000+00:00",
      }),
    );
    act(() => view.result.current.hideHistory());

    // Outra sala não herda o corte da anterior.
    entrar(view, "sala-de-teste-02");
    expect(view.result.current.hiddenBefore).toBeNull();

    // Voltar pra primeira reencontra o corte: sem persistir, um F5 desfaria
    // o que a pessoa mandou esconder sem ela pedir.
    entrar(view, "sala-de-teste-01");
    expect(view.result.current.hiddenBefore).toBe("2026-08-20T12:00:00.100000+00:00");
  });

  it("ocultar sem nada à vista não guarda corte", () => {
    const view = montar();
    entrar(view);
    act(() => view.result.current.hideHistory());
    expect(view.result.current.hiddenBefore).toBeNull();
  });

  it("limpar em sala manda history_clear e o servidor zera o histórico", () => {
    const view = montar();
    entrar(view);
    act(() =>
      ultimoSocket().entregar({
        type: "roll",
        player: "bia",
        result: makeResult(),
        received_at: "2026-08-20T12:00:00.100000+00:00",
      }),
    );

    act(() => view.result.current.clearHistory());
    // O cliente NÃO apaga por conta própria: quem manda é o backend, senão a
    // aba mostraria vazio enquanto a mesa continua com tudo.
    expect(ultimoSocket().sent).toContain(JSON.stringify({ type: "history_clear" }));
    expect(view.result.current.room.history).toHaveLength(1);

    act(() =>
      ultimoSocket().entregar({
        type: "history_cleared",
        player: "ana",
        received_at: "2026-08-20T12:00:01.000000+00:00",
      }),
    );
    expect(view.result.current.room.history).toHaveLength(0);
  });

  it("em sala fora do ar, limpar não cai no ramo local", () => {
    // "Tem cliente" não é "está conectado" (AGENTS.md): sem a guarda, o
    // clique limparia um localHistory vazio e pareceria ter funcionado,
    // enquanto a mesa segue com o histórico inteiro.
    const view = montar();
    entrar(view);
    act(() =>
      ultimoSocket().entregar({
        type: "roll",
        player: "bia",
        result: makeResult(),
        received_at: "2026-08-20T12:00:00.100000+00:00",
      }),
    );
    act(() => ultimoSocket().derrubar(1006));
    expect(view.result.current.canClearHistory).toBe(false);

    const enviadosAntes = ultimoSocket().sent.length;
    act(() => view.result.current.clearHistory());
    expect(ultimoSocket().sent).toHaveLength(enviadosAntes);
    expect(view.result.current.room.history).toHaveLength(1);
  });

  it("fora de sala limpar apaga o histórico local de verdade", () => {
    const view = montar();
    act(() => {
      view.result.current.sendRoll(makeResult());
    });
    expect(view.result.current.localHistory).toHaveLength(1);
    // Carimbo local: fora de sala não há servidor, e sem ele o corte e o
    // hint de hora não teriam o que ler.
    expect(view.result.current.localHistory[0]!.receivedAt).toBeTruthy();

    act(() => view.result.current.clearHistory());
    expect(view.result.current.localHistory).toHaveLength(0);
  });

  it("entrar guarda a sala e reflete o codigo na URL", () => {
    const view = montar();
    entrar(view);

    expect(view.result.current.room.status).toBe("connected");
    expect(view.result.current.room.code).toBe("sala-de-teste-01");
    expect(view.result.current.playerName).toBe("ana");
    expect(window.localStorage.getItem("rolai.room-code")).toBe("sala-de-teste-01");
    // Quem copiar a barra de endereços tem que cair na sala certa.
    expect(new URLSearchParams(window.location.search).get("room")).toBe("sala-de-teste-01");
  });

  it("rolagem de outro jogador anima com a aparencia de quem rolou", () => {
    const view = montar();
    entrar(view);
    const deOutro = makeResult({ timestamp: "2026-08-20T12:00:05.000Z" });
    const estiloDela = { ...DEFAULT_DICE_STYLES["1"], body: "#aa1122" };

    act(() => ultimoSocket().entregar({ type: "roll", player: "bia", result: deOutro, style: estiloDela }));

    expect(view.animate).toHaveBeenCalledTimes(1);
    expect(view.animate.mock.calls[0]![0]).toEqual(deOutro);
    expect(view.animate.mock.calls[0]![1]).toEqual(estiloDela);
    expect(view.animate.mock.calls[0]![2]).toBe("bia");
  });

  it("o eco da propria rolagem nao anima de novo", () => {
    const view = montar();
    entrar(view);
    const minha = makeResult({ timestamp: "2026-08-20T12:00:07.000Z" });

    // O App anima no disparo; o hook só rastreia pro dedupe.
    act(() => {
      expect(view.result.current.sendRoll(minha)).toBe(true);
    });
    act(() => ultimoSocket().entregar({ type: "roll", player: "ana", result: minha }));

    expect(view.animate).not.toHaveBeenCalled();
    // Mas ENTRA no histórico da sala, que é a ordem canônica.
    expect(view.result.current.room.history).toHaveLength(1);
  });

  it("rolagem conectada vai pro socket e nao duplica no historico local", () => {
    const view = montar();
    entrar(view);

    act(() => {
      view.result.current.sendRoll(makeResult());
    });

    const enviados = ultimoSocket().sent.map((s) => JSON.parse(s) as { type: string });
    expect(enviados.filter((e) => e.type === "roll")).toHaveLength(1);
    expect(view.result.current.localHistory).toHaveLength(0);
  });

  it("fora de sala a rolagem devolve false e fica no historico local", () => {
    const view = montar();

    let foi = true;
    act(() => {
      foi = view.result.current.sendRoll(makeResult());
    });

    expect(foi).toBe(false);
    expect(view.result.current.localHistory).toHaveLength(1);
    expect(view.result.current.localHistory[0]!.player).toBe("você");
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it("dentro da sala mas SEM conexao agora tambem devolve false", () => {
    // A armadilha da casa: existir cliente não é estar conectado. Sem isto a
    // rolagem animava e sumia no vazio, sem ninguém mais ver.
    const view = montar();
    entrar(view);
    act(() => ultimoSocket().derrubar(1006));
    expect(view.result.current.room.status).not.toBe("connected");

    let foi = true;
    act(() => {
      foi = view.result.current.sendRoll(makeResult());
    });

    expect(foi).toBe(false);
    expect(view.result.current.room.code).toBe("sala-de-teste-01");
    expect(view.result.current.localHistory).toHaveLength(1);
  });

  it("puxada de carta fora de sala fica no historico local", () => {
    const view = montar();
    const puxada: DrawResult = {
      cards: [{ id: "as", rank: "A", suit: "spades" }],
      remaining: 51,
    } as DrawResult;

    act(() => view.result.current.sendDeckDraw(puxada, "2026-08-20T12:01:00.000Z"));

    expect(view.result.current.localHistory).toHaveLength(1);
    expect(view.result.current.localHistory[0]!.type).toBe("deck_draw");
  });

  it("carta puxada por outro jogador anima", () => {
    const view = montar();
    entrar(view);
    const cartas = [{ id: "kh", rank: "K", suit: "hearts" }];

    act(() =>
      ultimoSocket().entregar({
        type: "deck_draw",
        player: "bia",
        cards: cartas,
        remaining: 50,
        timestamp: "2026-08-20T12:02:00.000Z",
      }),
    );

    expect(view.animateCards).toHaveBeenCalledTimes(1);
    expect(view.animateCards.mock.calls[0]![1]).toBe("bia");
  });

  it("sala recusada limpa o codigo salvo e a URL", () => {
    const view = montar();
    act(() => view.result.current.join("sala-que-nao-existe-1", "ana"));
    expect(window.localStorage.getItem("rolai.room-code")).toBe("sala-que-nao-existe-1");

    act(() => ultimoSocket().derrubar(4404));

    // Não adianta guardar pra reentrar sozinho no próximo carregamento.
    expect(window.localStorage.getItem("rolai.room-code")).toBe("");
    expect(new URLSearchParams(window.location.search).get("room")).toBeNull();
  });

  it("sair fecha o socket, limpa historico local e tira o codigo da URL", () => {
    const view = montar();
    entrar(view);
    act(() => view.result.current.leave());

    expect(ultimoSocket().closed).toBe(true);
    expect(view.result.current.localHistory).toHaveLength(0);
    expect(window.localStorage.getItem("rolai.room-code")).toBe("");
    expect(new URLSearchParams(window.location.search).get("room")).toBeNull();
  });

  it("trocar de apelido reconecta com o nome novo", () => {
    const view = montar();
    entrar(view);
    const antes = FakeWebSocket.instances.length;

    act(() => view.result.current.rename("bia"));

    expect(FakeWebSocket.instances.length).toBe(antes + 1);
    expect(new URL(ultimoSocket().url).searchParams.get("name")).toBe("bia");
    expect(view.result.current.playerName).toBe("bia");
  });

  // REGRESSAO: trocar a cor dentro da sala reconectava mandando só o estilo
  // do slot 1 no handshake, sem o mapa dos três. A mesa continuava vendo os
  // dados 2 e 3 na cor antiga até o próximo join — enquanto o join, logo ao
  // lado, sempre mandou os dois.
  it("trocar de cor reconecta mandando os TRES slots, nao so o primeiro", () => {
    const view = montar();
    entrar(view);

    const novas: DiceStyles = {
      "1": { ...DEFAULT_DICE_STYLES["1"], body: "#111111" },
      "2": { ...DEFAULT_DICE_STYLES["2"], body: "#222222" },
      "3": { ...DEFAULT_DICE_STYLES["3"], body: "#333333" },
    };
    act(() => view.result.current.restyle(novas));
    act(() => void vi.advanceTimersByTime(400));

    const params = new URL(ultimoSocket().url).searchParams;
    expect(JSON.parse(params.get("style")!)).toEqual(novas["1"]);
    expect(JSON.parse(params.get("styles")!)).toEqual(novas);
    // E não perde a sala no caminho.
    expect(view.result.current.room.code).toBe("sala-de-teste-01");
  });

  it("trocar de cor fora de sala nao abre conexao nenhuma", () => {
    const view = montar();
    act(() => view.result.current.restyle(DEFAULT_DICE_STYLES));
    act(() => void vi.advanceTimersByTime(400));
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  // REGRESSAO: arrastar o seletor de cor dispara onChange a cada movimento.
  // Sem debounce viravam dezenas de reconexoes em segundos, o backend batia
  // no ws_connect_limit_per_minute (30), respondia 4429, e o cliente tratava
  // como recusa definitiva — saia da sala e limpava o codigo salvo. Quem
  // mexeu na cor perdia a mesa.
  it("arrastar a cor gera UMA reconexao, nao uma por movimento", () => {
    const view = montar();
    entrar(view);
    const conexoesAntes = FakeWebSocket.instances.length;

    // 30 mudancas seguidas, como um arrasto de seletor.
    act(() => {
      for (let i = 0; i < 30; i++) {
        view.result.current.restyle({
          ...DEFAULT_DICE_STYLES,
          "3": { ...DEFAULT_DICE_STYLES["3"], body: `#0000${i.toString(16).padStart(2, "0")}` },
        });
      }
    });
    // Antes do debounce vencer, nada de novo foi aberto.
    expect(FakeWebSocket.instances.length).toBe(conexoesAntes);

    act(() => void vi.advanceTimersByTime(400));

    expect(FakeWebSocket.instances.length).toBe(conexoesAntes + 1);
    // E a conexao que sobrou leva a ULTIMA cor, nao a primeira do arrasto.
    const styles = JSON.parse(new URL(ultimoSocket().url).searchParams.get("styles")!);
    expect(styles["3"].body).toBe("#00001d");
  });

  it("mesma cor de novo nao reconecta", () => {
    const view = montar();
    entrar(view);
    const antes = FakeWebSocket.instances.length;

    act(() => view.result.current.restyle(DEFAULT_DICE_STYLES));
    act(() => void vi.advanceTimersByTime(400));

    expect(FakeWebSocket.instances.length).toBe(antes);
  });

  it("sair cancela a reconexao de cor que estava agendada", () => {
    const view = montar();
    entrar(view);
    act(() =>
      view.result.current.restyle({
        ...DEFAULT_DICE_STYLES,
        "2": { ...DEFAULT_DICE_STYLES["2"], body: "#123456" },
      }),
    );
    const antes = FakeWebSocket.instances.length;

    act(() => view.result.current.leave());
    act(() => void vi.advanceTimersByTime(400));

    // Nada de reconectar numa sala que a pessoa acabou de deixar.
    expect(FakeWebSocket.instances.length).toBe(antes);
  });

  it("link de convite (?room=) entra sozinho ao montar", () => {
    window.history.replaceState(null, "", "/?room=sala-do-convite-01");
    const view = montar();

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(new URL(ultimoSocket().url).pathname).toContain("sala-do-convite-01");
    expect(view.result.current.room.code).toBe("sala-do-convite-01");
  });
});
