import { describe, expect, it } from "vitest";
import { roll } from "@rolai/rules-engine";
import { buildBoxNotation } from "../renderers/diceBox";
import {
  cardsFromResult,
  diceFromResult,
  exceedsAnimationCap,
  faceLabel,
  MAX_ANIMATED_DICE,
  physicalDiceCount,
} from "../renderers/types";

describe("buildBoxNotation", () => {
  it("agrupa dados iguais e forca os valores na ordem", () => {
    expect(
      buildBoxNotation([
        { sides: 6, value: 3 },
        { sides: 6, value: 5 },
        { sides: 20, value: 17 },
      ]),
    ).toBe("2d6+1d20@3,5,17");
  });

  it("d100 vira par dezenas+unidades: 57 -> d100 no 5 e d10 no 7", () => {
    expect(buildBoxNotation([{ sides: 100, value: 57 }])).toBe("1d100+1d10@5,7");
  });

  it("d100 = 100 mostra '00' + '0'", () => {
    expect(buildBoxNotation([{ sides: 100, value: 100 }])).toBe("1d100+1d10@0,0");
  });

  it("d100 = 5 mostra '00' + '5'", () => {
    expect(buildBoxNotation([{ sides: 100, value: 5 }])).toBe("1d100+1d10@0,5");
  });

  it("d100 = 60 mostra '60' + '0'", () => {
    expect(buildBoxNotation([{ sides: 100, value: 60 }])).toBe("1d100+1d10@6,0");
  });

  it("varios d100 mantem pares na ordem (todos os tens, depois unidades)", () => {
    expect(
      buildBoxNotation([
        { sides: 100, value: 57 },
        { sides: 100, value: 82 },
      ]),
    ).toBe("2d100+2d10@5,8,7,2");
  });

  it("d100 misturado com outros dados mantem pares adjacentes", () => {
    // O par dezenas/unidades fica junto; os valores seguem a ordem da notacao.
    expect(
      buildBoxNotation([
        { sides: 100, value: 100 },
        { sides: 6, value: 3 },
      ]),
    ).toBe("1d100+1d10+1d6@0,0,3");
  });

  it("d2 usa o mesh de moeda 'd2' da lib", () => {
    expect(buildBoxNotation([{ sides: 2, value: 1 }])).toBe("1d2@1");
    expect(buildBoxNotation([{ sides: 2, value: 2 }])).toBe("1d2@2");
  });
});

describe("dado Fudge (4dF)", () => {
  it("usa o mesh 'df' da lib com o valor cru (-1/0/+1)", () => {
    expect(
      buildBoxNotation([
        { sides: 3, value: 1, fudge: true },
        { sides: 3, value: -1, fudge: true },
        { sides: 3, value: 0, fudge: true },
      ]),
    ).toBe("3df@1,-1,0");
  });

  it("mistura com dado comum sem virar d3", () => {
    expect(
      buildBoxNotation([
        { sides: 3, value: -1, fudge: true },
        { sides: 6, value: 4 },
      ]),
    ).toBe("1df+1d6@-1,4");
  });

  it("diceFromResult marca a flag a partir da notacao", () => {
    const dice = diceFromResult(roll("4dF", { deterministic: [1, 0, -1, 1] }));
    expect(dice).toEqual([
      { sides: 3, value: 1, fudge: true },
      { sides: 3, value: 0, fudge: true },
      { sides: 3, value: -1, fudge: true },
      { sides: 3, value: 1, fudge: true },
    ]);
  });

  it("face exibida e sinal, nao numero", () => {
    expect(faceLabel({ sides: 3, value: 1, fudge: true })).toBe("+");
    expect(faceLabel({ sides: 3, value: 0, fudge: true })).toBe("0");
    expect(faceLabel({ sides: 3, value: -1, fudge: true })).toBe("−");
    expect(faceLabel({ sides: 6, value: 4 })).toBe("4");
  });
});

describe("cap de dados animados", () => {
  it("100d20 estoura o teto (o bug que travava o app)", () => {
    expect(exceedsAnimationCap(roll("100d20"))).toBe(true);
  });

  it("no teto exato anima; um alem, nao", () => {
    expect(exceedsAnimationCap(roll(`${MAX_ANIMATED_DICE}d6`))).toBe(false);
    expect(exceedsAnimationCap(roll(`${MAX_ANIMATED_DICE + 1}d6`))).toBe(true);
  });

  it("d100 conta dobrado (dois corpos fisicos por dado)", () => {
    const dice = diceFromResult(roll("2d100"));
    expect(dice).toHaveLength(2);
    expect(physicalDiceCount(dice)).toBe(4);
    // 10d100 = 20 corpos (ok); 11d100 = 22 (estoura).
    expect(exceedsAnimationCap(roll("10d100"))).toBe(false);
    expect(exceedsAnimationCap(roll("11d100"))).toBe(true);
  });

  it("rolagem comum de profile fica abaixo do teto", () => {
    expect(exceedsAnimationCap(roll("{1d6+3} vs {2d10}"))).toBe(false);
  });
});

// Regressao: o tier "3D leve" baixava a luz pra 0.5 e o mesmo dado saia
// visivelmente mais escuro que no "3D completo" (a diferenca entre os tiers
// tem que ser custo de GPU, nao aparencia).
describe("cartas de baralho (termos 'c')", () => {
  it("diceFromResult extrai apenas dados fisicos e ignora cartas", () => {
    const res = roll("{2d6} vs {2c}", { deterministic: [4, 5, 2, 8] });
    const dice = diceFromResult(res);
    expect(dice).toEqual([
      { sides: 6, value: 4 },
      { sides: 6, value: 5 },
    ]);
  });

  it("cardsFromResult extrai as cartas com rank correspondente", () => {
    const res = roll("{2d6} vs {2c}", { deterministic: [4, 5, 1, 10] });
    const cards = cardsFromResult(res);
    expect(cards).toHaveLength(2);
    expect(cards[0]?.rank).toBe("A");
    expect(cards[1]?.rank).toBe("10");
  });
});

