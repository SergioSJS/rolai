import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DeckPanel } from "../components/DeckPanel";
import type { DeckConfig } from "@rolai/deck-engine";

// DeckPanel e so os CONTROLES (quantidade/botoes) — config agora e
// controlada de fora (Preferencias, SettingsPanel.test.tsx) e o resultado
// (cartas puxadas) sobe pro palco compartilhado via onDraw, testado em
// App.test.tsx. Ver specs/08-baralho.md.

const DEFAULT_CONFIG: DeckConfig = {
  includeJokers: false,
  removalMode: "permanent",
  autoReshuffleOnEmpty: false,
};

describe("DeckPanel", () => {
  it("comeca com 52 cartas, sem curinga", () => {
    render(<DeckPanel config={DEFAULT_CONFIG} />);
    expect(screen.getByText("52 cartas restantes")).toBeTruthy();
  });

  it("puxar decrementa o monte e chama onDraw com o resultado e um timestamp", () => {
    const onDraw = vi.fn();
    render(<DeckPanel config={DEFAULT_CONFIG} onDraw={onDraw} />);
    fireEvent.click(screen.getByRole("button", { name: "Puxar" }));
    expect(screen.getByText("51 cartas restantes · 1 no descarte")).toBeTruthy();
    expect(onDraw).toHaveBeenCalledOnce();
    const [result, timestamp] = onDraw.mock.calls[0]!;
    expect(result.cards).toHaveLength(1);
    expect(result.remaining).toBe(51);
    expect(typeof timestamp).toBe("string");
  });

  it("reembaralhar recolhe o descarte e chama onReshuffle", () => {
    const onReshuffle = vi.fn();
    render(<DeckPanel config={DEFAULT_CONFIG} onReshuffle={onReshuffle} />);
    fireEvent.click(screen.getByRole("button", { name: "Puxar" }));
    fireEvent.click(screen.getByRole("button", { name: "Reembaralhar" }));
    expect(screen.getByText("52 cartas restantes")).toBeTruthy();
    expect(onReshuffle).toHaveBeenCalledOnce();
  });

  it("mudar includeJokers na config (de fora) reconstroi o monte com 54 cartas", () => {
    const { rerender } = render(<DeckPanel config={DEFAULT_CONFIG} />);
    expect(screen.getByText("52 cartas restantes")).toBeTruthy();
    rerender(<DeckPanel config={{ ...DEFAULT_CONFIG, includeJokers: true }} />);
    expect(screen.getByText("54 cartas restantes")).toBeTruthy();
  });

  it("removalMode 'returns' (de fora) libera puxar mais que o restante", () => {
    render(<DeckPanel config={{ ...DEFAULT_CONFIG, removalMode: "returns" }} />);
    fireEvent.change(screen.getByLabelText("Cartas a puxar"), { target: { value: "52" } });
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Puxar" }))).not.toThrow();
    expect(screen.getByText("52 cartas restantes")).toBeTruthy();
  });

  it("pedir mais carta que o restante recusa sem autoReshuffleOnEmpty (sem chamar onDraw)", () => {
    const onDraw = vi.fn();
    render(<DeckPanel config={DEFAULT_CONFIG} onDraw={onDraw} />);
    fireEvent.change(screen.getByLabelText("Cartas a puxar"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Puxar" }));
    expect(screen.getByText(/faltam \d+ carta/)).toBeTruthy();
    expect(onDraw).not.toHaveBeenCalled();
  });
});
