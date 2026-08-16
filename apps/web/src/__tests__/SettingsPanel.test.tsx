import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { DeckConfig } from "@rolai/deck-engine";
import { SettingsPanel } from "../components/SettingsPanel";
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
