import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { parseProfile } from "@rolai/rules-engine";
import { RollPanel } from "../components/RollPanel";

const PBTA = parseProfile(`
system: pbta
label: "PbtA — Rolagem 2d6"
roll_type: simple
inputs:
  - id: mod
    label: "Modificador"
    type: number
fields:
  - id: roll
    dice: "2d6"
    modifier: "{input.mod}"
outcome_rules:
  - condition: "roll.total >= 7"
    result: hit
  - condition: "roll.total < 7"
    result: miss
`);

// O sistema agora e escolhido em Preferências (App) e chega pronto por prop.
function setup(profile?: typeof PBTA) {
  const onRoll = vi.fn();
  render(<RollPanel profile={profile} onRoll={onRoll} />);
  return onRoll;
}

describe("RollPanel", () => {
  it("modo livre por padrao: rola a notacao digitada", async () => {
    const onRoll = setup();
    fireEvent.change(screen.getByPlaceholderText("ex: 3d6+2"), {
      target: { value: "1d20+5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rolar" }));
    await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(1));
    const result = onRoll.mock.calls[0]![0];
    expect(result.notation).toBe("1d20+5");
    expect(result.groups["roll"]?.rolls).toHaveLength(1);
  });

  it("com profile, monta a rolagem a partir dos inputs", async () => {
    const onRoll = setup(PBTA);
    fireEvent.change(screen.getByLabelText("Modificador"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rolar" }));
    await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(1));
    const result = onRoll.mock.calls[0]![0];
    expect(result.profile).toBe("pbta");
    expect(result.notation).toBe("2d6+2");
    expect(result.groups["roll"]?.total).toBeGreaterThanOrEqual(4);
  });

  it("mostra erro amigavel quando o input numerico esta vazio", async () => {
    const onRoll = setup(PBTA);
    fireEvent.click(screen.getByRole("button", { name: "Rolar" }));
    await screen.findByText(/precisa ser um numero/);
    expect(onRoll).not.toHaveBeenCalled();
  });

  it("mostra erro do parser pra notacao invalida", async () => {
    const onRoll = setup();
    fireEvent.change(screen.getByPlaceholderText("ex: 3d6+2"), {
      target: { value: "banana" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rolar" }));
    await screen.findByText(/invalid/i);
    expect(onRoll).not.toHaveBeenCalled();
  });
});
