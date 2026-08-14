import { describe, expect, it } from "vitest";
import { rollWithProfile } from "../../src/index.js";

// profiles/infaernum_ideias.yaml: roll_type "multi" — dois 2d6 independentes
// (verbo, substantivo), cada celula lida pelos dois dados individualmente
// (linha = 1o dado, coluna = 2o dado), nao pela soma.

describe("profile: infaernum_ideias", () => {
  it("canto 1,1 de cada tabela: ignorar + ambiente", async () => {
    const result = await rollWithProfile("infaernum_ideias", {}, {
      deterministic: [1, 1, 1, 1],
    });
    expect(result.profile).toBe("infaernum_ideias");
    expect(result.notation).toBe("{2d6} + {2d6}");
    expect(result.groups["verb"]!.rolls).toEqual([1, 1]);
    expect(result.groups["noun"]!.rolls).toEqual([1, 1]);
    expect(result.outcome).toBe("ignorar");
    expect(result.outcome_flags).toEqual(["ignorar", "ambiente"]);
  });

  it("canto 6,6 de cada tabela: aceitar + sucesso", async () => {
    const result = await rollWithProfile("infaernum_ideias", {}, {
      deterministic: [6, 6, 6, 6],
    });
    expect(result.outcome_flags).toEqual(["aceitar", "sucesso"]);
  });

  it("linha/coluna importam mais que a soma (3,5 != 5,3)", async () => {
    const a = await rollWithProfile("infaernum_ideias", {}, {
      deterministic: [3, 5, 1, 1],
    });
    const b = await rollWithProfile("infaernum_ideias", {}, {
      deterministic: [5, 3, 1, 1],
    });
    expect(a.outcome_flags).toContain("oprimir");
    expect(b.outcome_flags).toContain("tomar");
  });

  it("celula central: guiar (verbo 3,4) + fe (substantivo 4,4)", async () => {
    const result = await rollWithProfile("infaernum_ideias", {}, {
      deterministic: [3, 4, 4, 4],
    });
    expect(result.outcome_flags).toEqual(["guiar", "fe"]);
  });

  it("nao precisa de nenhum input", async () => {
    const result = await rollWithProfile("infaernum_ideias", {}, {
      deterministic: [2, 2, 2, 2],
    });
    expect(result.outcome_flags).toEqual(["fazer", "problema"]);
  });
});
