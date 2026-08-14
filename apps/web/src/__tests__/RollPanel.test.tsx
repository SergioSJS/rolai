import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { parseProfile } from "@rolai/rules-engine";
import { RollPanel } from "../components/RollPanel";
import type { ProfileFamily } from "../profileFamilies";

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

const ROLL_UNDER = parseProfile(`
system: roll_under
label: "Genérico — Roll Under"
roll_type: overlay
inputs:
  - id: target
    label: "Valor testado"
    type: number
    required: false
fields: []
outcome_rules:
  - condition: "roll.total <= {input.target}"
    result: success
  - condition: "roll.total > {input.target}"
    result: fail
`);

const FAMILY: ProfileFamily = {
  key: "familia-teste",
  label: "Família de teste",
  members: [
    { system: "pbta", subLabel: "Modo A" },
    { system: "pbta2d10", subLabel: "Modo B" },
  ],
};

// O sistema agora e escolhido em Preferências (App) e chega pronto por prop.
function setup(
  profile?: typeof PBTA,
  extra?: { family?: ProfileFamily; onSelectFamilyMember?: (system: string) => void },
) {
  const onRoll = vi.fn();
  render(
    <RollPanel
      profile={profile}
      family={extra?.family}
      onSelectFamilyMember={extra?.onSelectFamilyMember}
      onRoll={onRoll}
    />,
  );
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
    fireEvent.click(screen.getByRole("button", { name: "Rolar sistema" }));
    await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(1));
    const result = onRoll.mock.calls[0]![0];
    expect(result.profile).toBe("pbta");
    expect(result.notation).toBe("2d6+2");
    expect(result.groups["roll"]?.total).toBeGreaterThanOrEqual(4);
  });

  it("mostra erro amigavel quando o input numerico esta vazio", async () => {
    const onRoll = setup(PBTA);
    fireEvent.click(screen.getByRole("button", { name: "Rolar sistema" }));
    await screen.findByText(/precisa ser um numero/);
    expect(onRoll).not.toHaveBeenCalled();
  });

  it("com profile de receita fixa, o compositor livre continua disponivel do lado", async () => {
    const onRoll = setup(PBTA);
    // Os dois formularios coexistem: o do profile e o "Rolagem livre".
    expect(screen.getByRole("button", { name: "Rolar sistema" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar um d20" }));
    fireEvent.click(screen.getByRole("button", { name: "Rolar dados" }));
    await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(1));
    const result = onRoll.mock.calls[0]![0];
    expect(result.profile).toBeUndefined();
    expect(result.notation).toBe("2d6+1d20");
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

  it("familia: mostra os modos como botoes na caixa, nao um <h2> fixo", async () => {
    setup(PBTA, { family: FAMILY });
    expect(screen.queryByText("PbtA — Rolagem 2d6")).toBeNull();
    const tabA = screen.getByRole("tab", { name: "Modo A" });
    const tabB = screen.getByRole("tab", { name: "Modo B" });
    expect(tabA.getAttribute("aria-selected")).toBe("true");
    expect(tabB.getAttribute("aria-selected")).toBe("false");
  });

  it("familia: clicar num modo chama onSelectFamilyMember com o system certo", async () => {
    const onSelectFamilyMember = vi.fn();
    setup(PBTA, { family: FAMILY, onSelectFamilyMember });
    fireEvent.click(screen.getByRole("tab", { name: "Modo B" }));
    expect(onSelectFamilyMember).toHaveBeenCalledWith("pbta2d10");
  });

  it("roll_type overlay: um so formulario, mescla input do profile com o compositor", async () => {
    const onRoll = setup(ROLL_UNDER);
    // Nao existe secao separada do profile — so um form com o composer.
    expect(screen.queryByRole("button", { name: "Rolar sistema" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Valor testado (opcional)"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar um d20" }));
    fireEvent.click(screen.getByRole("button", { name: "Rolar" }));
    await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(1));
    const result = onRoll.mock.calls[0]![0];
    expect(result.profile).toBe("roll_under");
    expect(result.notation).toBe("2d6+1d20");
    expect(result.outcome === "success" || result.outcome === "fail").toBe(true);
  });

  it("roll_type overlay: campo opcional tem botao pra limpar o valor", async () => {
    setup(ROLL_UNDER);
    const targetField = screen.getByLabelText(
      "Valor testado (opcional)",
    ) as HTMLInputElement;
    fireEvent.change(targetField, { target: { value: "10" } });
    expect(targetField.value).toBe("10");
    fireEvent.click(screen.getByRole("button", { name: "limpar" }));
    expect(targetField.value).toBe("");
  });
});
