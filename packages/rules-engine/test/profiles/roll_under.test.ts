import { describe, expect, it } from "vitest";
import { rollOverlay, rollWithProfile } from "../../src/index.js";

// profiles/roll_under.yaml: roll_type "overlay" — sem dado proprio, aplica
// "<= target" em cima de QUALQUER notacao que o composer livre montar
// (1d20, 3d6, ...). success (total <= target), fail (total > target), e
// o caso sem "target" (opcional) — so rola, sem outcome.

describe("profile: roll_under", () => {
  it("success: total <= target", async () => {
    const result = await rollOverlay("roll_under", "1d20", { mode: "", target: 10 }, {
      deterministic: [10],
    });
    expect(result.profile).toBe("roll_under");
    expect(result.notation).toBe("1d20");
    expect(result.groups["roll"]).toEqual({ rolls: [10], total: 10 });
    expect(result.outcome).toBe("success");
    expect(result.outcome_flags).toEqual(["success"]);
    expect(result.tested).toEqual([{ label: "Valor testado", value: 10 }]);
  });

  it("fail: total > target", async () => {
    const result = await rollOverlay("roll_under", "1d20", { mode: "", target: 10 }, {
      deterministic: [11],
    });
    expect(result.outcome).toBe("fail");
    expect(result.outcome_flags).toEqual(["fail"]);
  });

  it("borda exata: total == target e success", async () => {
    const result = await rollOverlay("roll_under", "1d6", { mode: "", target: 3 }, {
      deterministic: [3],
    });
    expect(result.outcome).toBe("success");
  });

  it("sem target: so rola, sem outcome, sem tested", async () => {
    const result = await rollOverlay("roll_under", "1d20", { mode: "" }, {
      deterministic: [15],
    });
    expect(result.notation).toBe("1d20");
    expect(result.groups["roll"]).toEqual({ rolls: [15], total: 15 });
    expect(result.outcome).toBeUndefined();
    expect(result.outcome_flags).toBeUndefined();
    expect(result.tested).toBeUndefined();
  });

  it("qualquer pool que o composer montar funciona (3d6, pool misto)", async () => {
    const result = await rollOverlay("roll_under", "3d6", { mode: "", target: 10 }, {
      deterministic: [3, 3, 4],
    });
    expect(result.notation).toBe("3d6");
    expect(result.groups["roll"]!.total).toBe(10);
    expect(result.outcome).toBe("success");
  });

  // Numero MENOR e melhor em roll_under (o oposto de d20/pbta) — "Vantagem"
  // tem que manter o dado BAIXO, entao o token literal do parser sai
  // invertido: mode "adv" vira sufixo "dis" (fica com o menor) na notacao.
  it("vantagem mantem o dado BAIXO (numero menor e melhor aqui)", async () => {
    const result = await rollOverlay("roll_under", "1d20", { mode: "adv", target: 10 }, {
      deterministic: [4, 18],
    });
    expect(result.notation).toBe("1d20dis");
    expect(result.groups["roll"]!.rolls).toEqual([4]);
    expect(result.groups["roll"]!.total).toBe(4);
    expect(result.outcome).toBe("success");
  });

  it("desvantagem mantem o dado ALTO", async () => {
    const result = await rollOverlay("roll_under", "1d20", { mode: "dis", target: 10 }, {
      deterministic: [4, 18],
    });
    expect(result.notation).toBe("1d20adv");
    expect(result.groups["roll"]!.rolls).toEqual([18]);
    expect(result.outcome).toBe("fail");
  });

  it("pool composto ignora o modo (ambiguo qual termo vira vantagem)", async () => {
    const result = await rollOverlay(
      "roll_under",
      "2d6+1d4",
      { mode: "adv", target: 10 },
      { deterministic: [3, 3, 2] },
    );
    expect(result.notation).toBe("2d6+1d4");
    expect(result.groups["roll"]!.total).toBe(8);
  });

  it("rollWithProfile rejeita roll_type overlay", async () => {
    await expect(rollWithProfile("roll_under", { target: 10 })).rejects.toThrow(
      /roll_type "overlay"/,
    );
  });
});
