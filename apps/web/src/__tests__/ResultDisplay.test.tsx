import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { roll } from "@rolai/rules-engine";
import type { RollResult } from "@rolai/rules-engine";
import { ResultDisplay } from "../components/ResultDisplay";

describe("ResultDisplay", () => {
  it("com outcome (FitD), o outcome e o headline — nao a soma do pool", () => {
    // Repro do bug reportado: [6,6,2,3] no FitD exibia "17" gigante,
    // numero que nao significa nada pro sistema.
    const result: RollResult = {
      notation: "4d6",
      groups: { pool: { rolls: [6, 6, 2, 3], total: 17 } },
      profile: "fitd",
      outcome: "critical",
      outcome_flags: ["critical"],
      timestamp: "2026-08-05T12:00:00.000Z",
    };
    const { container } = render(<ResultDisplay result={result} />);
    const headline = container.querySelector(".result-headline");
    expect(headline?.textContent).toBe("crítico");
    expect(headline?.textContent).not.toBe("17");
    // A composicao continua visivel nos chips.
    expect(container.textContent).toContain("6");
    expect(container.textContent).toContain("d6");
  });

  it("sem outcome (notacao livre), o total e o headline", () => {
    const result = roll("2d6", { deterministic: [3, 4] });
    const { container } = render(<ResultDisplay result={result} />);
    expect(container.querySelector(".result-headline")?.textContent).toBe("7");
  });

  it("flags independentes do outcome aparecem como badge (ex: match)", () => {
    const result: RollResult = {
      notation: "{1d6+3} vs {2d10}",
      groups: {
        action: { rolls: [4], modifier: 3, total: 7 },
        challenge: { rolls: [5, 5] },
      },
      profile: "ironsworn",
      outcome: "strong_hit",
      outcome_flags: ["strong_hit", "match"],
      timestamp: "2026-08-05T12:00:00.000Z",
    };
    const { container } = render(<ResultDisplay result={result} />);
    expect(container.querySelector(".result-headline")?.textContent).toBe(
      "sucesso forte",
    );
    expect(container.querySelector(".result-flag")?.textContent).toBe("match!");
  });

  it("sem resultado nao desenha nada", () => {
    // O overlay do resultado e fixo acima de toda a UI: placeholder aqui
    // vira texto flutuando por cima do historico e dos controles.
    const { container } = render(<ResultDisplay result={null} />);
    expect(container.textContent).toBe("");
  });
});

// Ate aqui TODO outcome saia verde: uma falha crítica no d20 tinha a mesma
// cara de um acerto crítico, e quem le de longe (ou na stream) so via que
// "deu alguma coisa".
describe("tom do resultado", () => {
  const comOutcome = (outcome: string, flags?: string[]): RollResult => ({
    notation: "1d20",
    groups: { roll: { rolls: [1], total: 1 } },
    profile: "d20",
    outcome,
    ...(flags ? { outcome_flags: flags } : {}),
    timestamp: "2026-08-05T12:00:00.000Z",
  });

  it("falha vai de vermelho", () => {
    const { container } = render(<ResultDisplay result={comOutcome("critical_failure")} />);
    expect(container.querySelector(".result-headline")?.className).toContain("tone-failure");
  });

  it("sucesso segue no tom de acerto", () => {
    const { container } = render(<ResultDisplay result={comOutcome("critical_success")} />);
    expect(container.querySelector(".result-headline")?.className).toContain("tone-success");
  });

  it("sucesso parcial nao e nem um nem outro", () => {
    const { container } = render(<ResultDisplay result={comOutcome("weak_hit")} />);
    expect(container.querySelector(".result-headline")?.className).toContain("tone-partial");
  });

  // Profile custom: pintar de verde uma falha desconhecida e pior que nao
  // pintar. Neutro fica na cor de acento, como era antes.
  it("outcome desconhecido fica neutro em vez de chutar", () => {
    const { container } = render(<ResultDisplay result={comOutcome("algo_novo")} />);
    expect(container.querySelector(".result-headline")?.className).toContain("tone-neutral");
  });

  // "match" no Ironsworn e evento (dados de desafio iguais) e pode vir junto
  // de acerto OU de falha — nao pode carregar tom de sucesso.
  it("flag de match e neutra, e a falha ao lado continua vermelha", () => {
    const { container } = render(<ResultDisplay result={comOutcome("miss", ["miss", "match"])} />);
    expect(container.querySelector(".result-headline")?.className).toContain("tone-failure");
    expect(container.querySelector(".result-flag")?.className).toContain("tone-neutral");
  });
});
