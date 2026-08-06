import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "../App";

// Smoke do app shell inteiro (jsdom): menu, fluxo de rolagem sempre
// visivel, modais de Sala/Preferências/Sobre. O renderer 3D falha sem
// WebGL no jsdom e o App deve cair pro texto puro sem quebrar.

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

  it("sistema e escolhido em Preferências e troca o painel de rolagem", async () => {
    render(<App />);
    // modo livre: compositor visivel
    expect(screen.getByLabelText("Adicionar um d20")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Preferências" }));
    fireEvent.change(await screen.findByLabelText("Regras da mesa"), {
      target: { value: "d20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    // painel agora mostra os inputs do profile, sem compositor
    expect(screen.getByLabelText("CD")).toBeTruthy();
    expect(screen.queryByLabelText("Adicionar um d20")).toBeNull();
  });

  it("Esc tambem tira os dados", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Rolar" }));
    await screen.findByText("clique ou Esc pra tirar os dados");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("clique ou Esc pra tirar os dados")).toBeNull();
  });
});
