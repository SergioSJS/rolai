// Regressao de UX: remover dado precisa ser clicavel e visivel (antes so
// existia Alt+clique, que ninguem descobre).

import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ComposerBar } from "../components/ComposerBar";

function Harness({ initial }: { initial: string }) {
  const [notation, setNotation] = useState(initial);
  return (
    <>
      <ComposerBar notation={notation} onChange={setNotation} />
      <output data-testid="notation-out">{notation}</output>
    </>
  );
}

function notationOut() {
  return screen.getByTestId("notation-out").textContent;
}

describe("ComposerBar", () => {
  it("botao do dado adiciona e o '−' do slot tira um", () => {
    render(<Harness initial="" />);
    fireEvent.click(screen.getByLabelText("Adicionar um d6"));
    fireEvent.click(screen.getByLabelText("Adicionar um d6"));
    expect(notationOut()).toBe("2d6");
    fireEvent.click(screen.getByLabelText("Tirar um d6"));
    expect(notationOut()).toBe("1d6");
  });

  it("'×' do chip tira o tipo inteiro sem mexer nos outros", () => {
    render(<Harness initial="3d6+1d4" />);
    fireEvent.click(screen.getByLabelText("Tirar todos os d6"));
    expect(notationOut()).toBe("1d4");
  });

  it("tirar o ultimo dado esvazia o pool e mostra a dica", () => {
    render(<Harness initial="1d20" />);
    fireEvent.click(screen.getByLabelText("Tirar um d20"));
    expect(notationOut()).toBe("");
    screen.getByText(/Toque nos dados/);
  });

  it("'−' so aparece pros tipos que estao no pool", () => {
    render(<Harness initial="1d6" />);
    expect(screen.queryByLabelText("Tirar um d20")).toBeNull();
    expect(screen.getByLabelText("Tirar um d6")).toBeTruthy();
  });

  it("modificador vira chip com '×' que zera", () => {
    render(<Harness initial="2d6+3" />);
    fireEvent.click(screen.getByLabelText("Zerar modificador"));
    expect(notationOut()).toBe("2d6");
  });

  it("tem botao de dado Fudge e monta 'dF'", () => {
    render(<Harness initial="" />);
    fireEvent.click(screen.getByLabelText("Adicionar um dF"));
    fireEvent.click(screen.getByLabelText("Adicionar um dF"));
    expect(notationOut()).toBe("2dF");
    fireEvent.click(screen.getByLabelText("Adicionar um d6"));
    expect(notationOut()).toBe("2dF+1d6");
  });

  it("clique num dado depois de notacao livre nao soma num estado invisivel", () => {
    render(<Harness initial="4d6kh3" />);
    fireEvent.click(screen.getByLabelText("Adicionar um d20"));
    expect(notationOut()).toBe("1d20");
  });
});
