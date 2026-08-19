import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { DeckConfig } from "@rolai/deck-engine";
import { SettingsPanel } from "../components/SettingsPanel";
import { availableProfiles } from "../profiles";
import { DEFAULT_DICE_STYLE } from "../settings";

// Config do baralho mora aqui agora (specs/08-baralho.md, ajuste
// pos-review) — antes ficava dentro do DeckPanel, poluindo a caixa de
// puxar carta.

const DECK_CONFIG: DeckConfig = {
  includeJokers: false,
  removalMode: "permanent",
  autoReshuffleOnEmpty: false,
};

function setup(deckConfig: DeckConfig = DECK_CONFIG) {
  const onDeckConfigChange = vi.fn();
  render(
    <SettingsPanel
      tier="3d-light"
      theme="table"
      diceStyle={DEFAULT_DICE_STYLE}
      diceScale={1}
      system=""
      profiles={[]}
      deckConfig={deckConfig}
      onTierChange={() => {}}
      onThemeChange={() => {}}
      onDiceStyleChange={() => {}}
      onDiceScaleChange={() => {}}
      onSystemChange={() => {}}
      onDeckConfigChange={onDeckConfigChange}
    />,
  );
  return onDeckConfigChange;
}

// Sistema de uma familia (Year Zero, Infaernum): o modo e escolhido AQUI.
// Chegou a ficar como abas dentro da caixa de rolagem, mas com os 4 modos
// do Year Zero os botoes lado a lado estouravam a largura do painel.
function setupSystem(system: string) {
  const onSystemChange = vi.fn();
  render(
    <SettingsPanel
      tier="3d-light"
      theme="table"
      diceStyle={DEFAULT_DICE_STYLE}
      diceScale={1}
      system={system}
      profiles={availableProfiles()}
      deckConfig={DECK_CONFIG}
      onTierChange={() => {}}
      onThemeChange={() => {}}
      onDiceStyleChange={() => {}}
      onDiceScaleChange={() => {}}
      onSystemChange={onSystemChange}
      onDeckConfigChange={() => {}}
    />,
  );
  return onSystemChange;
}

describe("SettingsPanel — Baralho", () => {
  it("mostra os controles de baralho", () => {
    setup();
    expect(screen.getByLabelText("Curingas")).toBeTruthy();
    expect(screen.getByLabelText("Carta puxada")).toBeTruthy();
    expect(screen.getByLabelText("Monte vazio")).toBeTruthy();
  });

  it("ligar curinga chama onDeckConfigChange", () => {
    const onDeckConfigChange = setup();
    fireEvent.change(screen.getByLabelText("Curingas"), { target: { value: "yes" } });
    expect(onDeckConfigChange).toHaveBeenCalledWith({ includeJokers: true });
  });

  it("modo 'volta na hora' esconde a opcao de monte vazio (nunca esvazia)", () => {
    setup({ ...DECK_CONFIG, removalMode: "returns" });
    expect(screen.queryByLabelText("Monte vazio")).toBeNull();
  });
});

describe("SettingsPanel — Sistema", () => {
  it("familia aparece uma vez no dropdown, sem os members soltos", () => {
    setupSystem("");
    const regras = screen.getByLabelText("Regras da mesa") as HTMLSelectElement;
    const opcoes = [...regras.options].map((o) => o.text);
    expect(opcoes).toContain("Year Zero");
    expect(opcoes).not.toContain("Year Zero — Pool genérico");
    expect(opcoes).not.toContain("Year Zero — Alien (Estresse)");
    // Sem familia escolhida nao ha o que sub-selecionar.
    expect(screen.queryByLabelText("Modo")).toBeNull();
  });

  it("com familia ativa, o seletor de Modo lista os sub-sistemas", () => {
    const onSystemChange = setupSystem("yze");
    const modo = screen.getByLabelText("Modo") as HTMLSelectElement;
    expect([...modo.options].map((o) => o.text)).toEqual([
      "Genérico",
      "Forbidden Lands",
      "Alien",
      "Walking Dead",
    ]);
    expect(modo.value).toBe("yze");
    fireEvent.change(modo, { target: { value: "yze_fbl" } });
    expect(onSystemChange).toHaveBeenCalledWith("yze_fbl");
  });

  it("escolher a familia no dropdown cai no primeiro modo dela", () => {
    const onSystemChange = setupSystem("");
    fireEvent.change(screen.getByLabelText("Regras da mesa"), {
      target: { value: "yze" },
    });
    expect(onSystemChange).toHaveBeenCalledWith("yze");
  });
});
