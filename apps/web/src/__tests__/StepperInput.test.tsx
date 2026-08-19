import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StepperInput } from "../components/StepperInput";

// O "X" de limpar saiu daqui (agora mora na linha do rotulo, em
// RollPanel.tsx) — o comportamento dele e testado em RollPanel.test.tsx.
describe("StepperInput", () => {
  it("so tem diminuir/aumentar", () => {
    render(<StepperInput value="0" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "diminuir" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "aumentar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "limpar" })).toBeNull();
  });

  it("os botoes andam de um em um a partir do valor atual", () => {
    const onChange = vi.fn();
    render(<StepperInput value="3" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "aumentar" }));
    expect(onChange).toHaveBeenLastCalledWith("4");
    fireEvent.click(screen.getByRole("button", { name: "diminuir" }));
    expect(onChange).toHaveBeenLastCalledWith("2");
  });

  it("campo vazio conta como zero pro passo, e min/max seguram o valor", () => {
    const onChange = vi.fn();
    const { rerender } = render(<StepperInput value="" onChange={onChange} min={0} />);
    fireEvent.click(screen.getByRole("button", { name: "diminuir" }));
    expect(onChange).toHaveBeenLastCalledWith("0");
    rerender(<StepperInput value="5" onChange={onChange} max={5} />);
    fireEvent.click(screen.getByRole("button", { name: "aumentar" }));
    expect(onChange).toHaveBeenLastCalledWith("5");
  });
});
