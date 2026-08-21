import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "../App";

// Smoke do app shell inteiro (jsdom): menu, fluxo de rolagem sempre
// visivel, modais de Sala/Preferências/Sobre. O renderer 3D falha sem
// WebGL no jsdom e o App deve cair pro texto puro sem quebrar.

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App shell", () => {
  it("renderiza menu bar, palco e painel de rolagem", () => {
    render(<App />);
    expect(screen.getByText("Rolaí")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rolar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sala" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Preferências" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sobre" })).toBeTruthy();
    // Compositor visivel no modo notacao livre (default)
    expect(screen.getByRole("button", { name: "Adicionar um d20" })).toBeTruthy();
  });

  it("abre o modal do servidor pelo menu e consulta o /stats", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        uptime_seconds: 60,
        rooms: { active: 2, created_since_boot: 1 },
        connections: {
          players_now: 0,
          spectators_now: 0,
          rooms_with_someone: 0,
          players_since_boot: 1,
          spectators_since_boot: 0,
        },
        rolls_relayed_since_boot: 7,
        profiles: { created_since_boot: 0, purged_since_boot: 0 },
        limits_hit_since_boot: {},
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Servidor" }));
    expect(await screen.findByText("rolagens retransmitidas")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();

    // Fechar o modal desmonta o painel — e com ele o polling.
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("rolagens retransmitidas")).toBeNull();
  });

  it("abre o modal de preferências com qualidade, tema e dados", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Preferências" }));
    await screen.findByLabelText("Qualidade");
    expect(screen.getByLabelText("Tema")).toBeTruthy();
    // Aparencia dos dados (preset + cores + textura/material)
    expect(screen.getByLabelText("Estilo")).toBeTruthy();
    expect(screen.getByLabelText("Corpo")).toBeTruthy();
    expect(screen.getByLabelText("Textura")).toBeTruthy();
    expect(screen.getByLabelText("Material")).toBeTruthy();
    // fecha no botao ✕
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByLabelText("Qualidade")).toBeNull();
  });

  it("botões de histórico: ocultar some da tela, mostrar tudo traz de volta", () => {
    render(<App />);
    // Fora de sala: "Limpar histórico"; em sala vira "Limpar a sala".
    expect(screen.getByRole("button", { name: /Limpar histórico/ })).toBeTruthy();
    const ocultar = screen.getByRole("button", { name: /Ocultar/ });
    // Histórico vazio: nada a ocultar, e "Mostrar tudo" nem aparece.
    expect(ocultar.hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: /Mostrar tudo/ })).toBeNull();

    fireEvent.change(screen.getByLabelText("Notação"), { target: { value: "1d20" } });
    fireEvent.click(screen.getByRole("button", { name: "Rolar" }));

    fireEvent.click(screen.getByRole("button", { name: /Ocultar/ }));
    expect(screen.getByRole("button", { name: /Mostrar tudo/ })).toBeTruthy();
    expect(screen.getByText(/Parte do histórico está oculta/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Mostrar tudo/ }));
    expect(screen.queryByText(/Parte do histórico está oculta/)).toBeNull();
  });

  it("limpar fora de sala pede confirmação antes de apagar", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Notação"), { target: { value: "1d20" } });
    fireEvent.click(screen.getByRole("button", { name: "Rolar" }));

    // Primeiro clique NÃO apaga: apagar sem volta atrás de um clique só é
    // fácil demais de fazer sem querer.
    fireEvent.click(screen.getByRole("button", { name: /Limpar histórico/ }));
    expect(screen.getByRole("button", { name: /Confirmar\?/ })).toBeTruthy();
    expect(screen.queryByText("Nenhuma rolagem ainda.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Confirmar\?/ }));
    expect(screen.getByText("Nenhuma rolagem ainda.")).toBeTruthy();
  });

  it("abre o modal de sala (fora de sala: criar/entrar)", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Sala" }));
    await screen.findByRole("button", { name: "Criar sala" });
    expect(screen.getByRole("button", { name: "Entrar" })).toBeTruthy();
  });

  it("rola sem sala pelo compositor e mostra o resultado", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar um d20" }));
    // Compositor acumula tipos: default 2d6 + clique em d20 = pool misto.
    fireEvent.click(screen.getByRole("button", { name: "Rolar" }));
    const matches = await screen.findAllByText("2d6+1d20", {}, { timeout: 2000 });
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("clique em cima do painel (onde o dado costuma parar) tira os dados", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Rolar" }));
    await screen.findByText("clique ou Esc pra tirar os dados");
    // Regressao: o canvas tem pointer-events: none, entao clicar num dado
    // parado sobre o painel entrega o clique pro painel — tem que dispensar.
    fireEvent.click(screen.getByText(/Histórico/));
    expect(screen.queryByText("clique ou Esc pra tirar os dados")).toBeNull();
  });

  it("clique num controle nao dispensa (segue funcionando com um clique so)", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Rolar" }));
    await screen.findByText("clique ou Esc pra tirar os dados");
    fireEvent.click(screen.getByPlaceholderText("ex: 3d6+2"));
    expect(screen.queryByText("clique ou Esc pra tirar os dados")).not.toBeNull();
  });

  it("clique no fundo tambem tira", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Rolar" }));
    await screen.findByText("clique ou Esc pra tirar os dados");
    fireEvent.click(document.body);
    expect(screen.queryByText("clique ou Esc pra tirar os dados")).toBeNull();
  });

  it("abrir o menu tira os dados da tela", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Rolar" }));
    await screen.findByText("clique ou Esc pra tirar os dados");
    fireEvent.click(screen.getByRole("button", { name: "Preferências" }));
    expect(screen.queryByText("clique ou Esc pra tirar os dados")).toBeNull();
  });

  it("sistema e escolhido em Preferências e o painel do profile aparece ao lado do compositor", async () => {
    render(<App />);
    // modo livre: compositor visivel
    expect(screen.getByLabelText("Adicionar um d20")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Preferências" }));
    fireEvent.change(await screen.findByLabelText("Regras da mesa"), {
      target: { value: "d20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    // painel do profile aparece JUNTO do compositor — nao troca, soma.
    expect(screen.getByLabelText("CD")).toBeTruthy();
    expect(screen.getByLabelText("Adicionar um d20")).toBeTruthy();
  });

  it("Esc tambem tira os dados", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Rolar" }));
    await screen.findByText("clique ou Esc pra tirar os dados");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("clique ou Esc pra tirar os dados")).toBeNull();
  });
});
