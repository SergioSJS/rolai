import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { parseProfile } from "@rolai/rules-engine";
import { RollPanel } from "../components/RollPanel";
import { getProfile } from "../profiles";

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

  // O sub-modo de uma familia (Year Zero, Infaernum) e escolhido em
  // Preferências — ver SettingsPanel.test.tsx. Aqui a caixa so mostra o
  // profile que chegou por prop, com o nome dele no cabecalho.
  it("familia: a caixa mostra o profile ativo, sem seletor de modo", () => {
    setup(PBTA);
    expect(screen.getByText("PbtA — Rolagem 2d6")).toBeTruthy();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
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
  // Forçar (o push do Year Zero): recalcula o pool (yzePush.ts) E rola na
  // hora. Usa os profiles de verdade (profiles.ts) de proposito — e a
  // checagem de que os YAMLs continuam registrados na UI, nao so no motor.
  describe("Year Zero — Forçar", () => {
    it("so oferece Forçar depois de uma rolagem propria", async () => {
      const onRoll = setup(getProfile("yze"));
      expect(screen.queryByRole("button", { name: "Forçar" })).toBeNull();
      fireEvent.change(screen.getByLabelText("Dados no pool"), { target: { value: "5" } });
      fireEvent.click(screen.getByRole("button", { name: "Rolar sistema" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(1));
      expect(screen.getByRole("button", { name: "Forçar" })).toBeTruthy();
    });

    it("forcar trava os 6, rerrola o resto e ja rola — num toque so", async () => {
      const onRoll = setup(getProfile("yze"));
      fireEvent.change(screen.getByLabelText("Dados no pool"), { target: { value: "5" } });
      fireEvent.click(screen.getByRole("button", { name: "Rolar sistema" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(1));
      const rolls = onRoll.mock.calls[0]![0].groups["pool"]!.rolls as number[];
      const seis = rolls.filter((v) => v === 6).length;

      fireEvent.click(screen.getByRole("button", { name: "Forçar" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(2));
      const forcada = onRoll.mock.calls[1]![0];
      // Rolou com o pool recalculado, nao com o velho: os 6 viraram
      // modificador (sucessos travados) e sairam do pool.
      // Sem sucesso garantido nenhum a notacao nao ganha "+0" (o motor so
      // emite o modificador de contagem quando ele existe).
      expect(forcada.groups["pool"]!.modifier ?? 0).toBe(seis);
      expect(forcada.notation).toBe(seis === 0 ? "5d6" : `${5 - seis}d6+${seis}`);
      // Os campos ficam com o que foi usado, pra ajustar e rolar de novo.
      const pool = screen.getByLabelText("Dados no pool") as HTMLInputElement;
      const travados = screen.getByLabelText("Sucesso garantido") as HTMLInputElement;
      expect(pool.value).toBe(String(5 - seis));
      expect(travados.value).toBe(String(seis));
    });

    it("o X do Sucesso garantido volta pro zero sem esvaziar o campo", async () => {
      const onRoll = setup(getProfile("yze"));
      fireEvent.change(screen.getByLabelText("Dados no pool"), { target: { value: "5" } });
      fireEvent.click(screen.getByRole("button", { name: "Rolar sistema" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole("button", { name: "Forçar" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(2));

      const garantido = screen.getByLabelText("Sucesso garantido") as HTMLInputElement;
      // O X vive na linha do rotulo do proprio campo — pega pelo campo, nao
      // por posicao na lista (a ordem dos inputs vem do YAML e muda).
      const clear = garantido
        .closest(".field")!
        .querySelector('button[aria-label="limpar"]') as HTMLButtonElement;
      // O X do campo obrigatorio devolve pro default ("0") — esvaziar
      // deixaria a rolagem sem input obrigatorio e ela nem sairia.
      fireEvent.click(clear);
      expect(garantido.value).toBe("0");
      fireEvent.click(screen.getByRole("button", { name: "Rolar sistema" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(3));
      expect(onRoll.mock.calls[2]![0].groups["pool"]!.modifier ?? 0).toBe(0);
    });

    it("forcar de novo acumula em cima da rolagem forcada", async () => {
      const onRoll = setup(getProfile("yze"));
      fireEvent.change(screen.getByLabelText("Dados no pool"), { target: { value: "6" } });
      fireEvent.click(screen.getByRole("button", { name: "Rolar sistema" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole("button", { name: "Forçar" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(2));
      fireEvent.click(screen.getByRole("button", { name: "Forçar" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(3));
      // Dado nenhum se perde: pool + sucessos travados continua 6.
      const terceira = onRoll.mock.calls[2]![0];
      const pool = terceira.groups["pool"]!;
      expect(pool.rolls.length + (pool.modifier ?? 0)).toBe(6);
    });

    it("alien: empurrar acrescenta um dado de Estresse", async () => {
      const onRoll = setup(getProfile("yze_alien"));
      fireEvent.change(screen.getByLabelText("Base"), { target: { value: "3" } });
      fireEvent.change(screen.getByLabelText("Estresse"), {
        target: { value: "1" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Rolar sistema" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(1));
      const estresseRolls = onRoll.mock.calls[0]![0].groups["estresse"]!.rolls as number[];

      fireEvent.click(screen.getByRole("button", { name: "Forçar" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(2));
      const estresse = screen.getByLabelText("Estresse") as HTMLInputElement;
      expect(estresse.value).toBe(
        String(estresseRolls.filter((v) => v !== 6).length + 1),
      );
    });

    // Ponta a ponta no profile de verdade: se o id que o yzePush escreve
    // divergir do que o YAML declara, o input vira chave desconhecida, as
    // outcome_rules de dano ficam puladas e o dano some sem erro nenhum —
    // "existe" tratado como "funciona", a armadilha do AGENTS.md.
    it("forbidden lands: forcar liga o dano dos 1s travados", async () => {
      const onRoll = setup(getProfile("yze_fbl"));
      fireEvent.change(screen.getByLabelText("Base"), { target: { value: "6" } });
      fireEvent.change(screen.getByLabelText("Perícia"), { target: { value: "0" } });
      fireEvent.change(screen.getByLabelText("Equipamento"), { target: { value: "0" } });
      fireEvent.click(screen.getByRole("button", { name: "Rolar sistema" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(1));
      // Rolagem normal nunca marca dano, mesmo com 1 na Base.
      expect(onRoll.mock.calls[0]![0].outcome_flags).not.toContain(
        "yze_dano_atributo_x1",
      );

      const uns = (onRoll.mock.calls[0]![0].groups["base"]!.rolls as number[]).filter(
        (v) => v === 1,
      ).length;
      fireEvent.click(screen.getByRole("button", { name: "Forçar" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(2));
      const forcada = onRoll.mock.calls[1]![0];
      // Prova deterministica do vinculo: "tested" so lista input DECLARADO
      // no profile e citado numa condition. Se o id divergisse, o valor
      // viraria chave desconhecida e nao apareceria aqui.
      expect(
        (forcada.tested as { label: string }[] | undefined)?.map((t) => t.label),
      ).toContain("1s Base");
      const unsDepois =
        uns +
        (forcada.groups["base"]!.rolls as number[]).filter((v) => v === 1).length;
      const esperado =
        unsDepois === 0
          ? null
          : `yze_dano_atributo_x${Math.min(unsDepois, 3)}`;
      if (esperado === null) {
        expect(forcada.outcome_flags ?? []).not.toContain("yze_dano_atributo_x1");
      } else {
        expect(forcada.outcome_flags).toContain(esperado);
      }
    });

    it("Rolar depois de um Forçar comeca cadeia nova: dano velho nao volta", async () => {
      const onRoll = setup(getProfile("yze_fbl"));
      fireEvent.change(screen.getByLabelText("Base"), { target: { value: "6" } });
      fireEvent.change(screen.getByLabelText("Perícia"), { target: { value: "0" } });
      fireEvent.change(screen.getByLabelText("Equipamento"), { target: { value: "0" } });
      fireEvent.click(screen.getByRole("button", { name: "Rolar sistema" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole("button", { name: "Forçar" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(2));
      // Forçada: os "1s travados" existem e o dano e avaliado.
      expect(
        (onRoll.mock.calls[1]![0].tested as { label: string }[] | undefined)?.map(
          (t) => t.label,
        ),
      ).toContain("1s Base");

      fireEvent.click(screen.getByRole("button", { name: "Rolar sistema" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(3));
      const nova = onRoll.mock.calls[2]![0];
      // Rolagem nova nao e empurrada: sem 1s travados, sem dano nenhum.
      expect(
        (nova.tested as { label: string }[] | undefined)?.map((t) => t.label) ?? [],
      ).not.toContain("1s Base");
      expect((nova.outcome_flags ?? []).join(" ")).not.toContain("yze_dano");
    });

    it("sistema fora da linha Year Zero nao ganha o botao", async () => {
      const onRoll = setup(PBTA);
      fireEvent.change(screen.getByLabelText("Modificador"), { target: { value: "1" } });
      fireEvent.click(screen.getByRole("button", { name: "Rolar sistema" }));
      await waitFor(() => expect(onRoll).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole("button", { name: "Forçar" })).toBeNull();
    });
  });
});
