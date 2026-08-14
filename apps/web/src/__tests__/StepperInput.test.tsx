import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StepperInput } from "../components/StepperInput";

describe("StepperInput", () => {
  it("sem onClear, so mostra diminuir/aumentar", () => {
    render(<StepperInput value="0" onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: "limpar" })).toBeNull();
  });

  it("com onClear, o botao limpar chama onClear", () => {
    const onClear = vi.fn();
    render(<StepperInput value="10" onChange={() => {}} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: "limpar" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("botao limpar desativa quando o valor ja esta vazio", () => {
    const onClear = vi.fn();
    render(<StepperInput value="" onChange={() => {}} onClear={onClear} />);
    const button = screen.getByRole("button", { name: "limpar" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
