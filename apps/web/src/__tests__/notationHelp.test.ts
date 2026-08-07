import { describe, expect, it } from "vitest";
import { parseNotation } from "@rolai/rules-engine";
import { HELP_EXAMPLES } from "../components/NotationHelp";

// A ajuda promete sintaxe ao usuario. Se o parser nao aceitar, a tela vira
// mentira — e o erro so apareceria quando alguem tentasse copiar o exemplo.
describe("exemplos da ajuda de notação", () => {
  it("todo exemplo mostrado é aceito pelo parser", () => {
    for (const exemplo of HELP_EXAMPLES) {
      expect(() => parseNotation(exemplo), `"${exemplo}" não parseia`).not.toThrow();
    }
  });

  it("a lista não está vazia (guarda contra refactor que a esvazie)", () => {
    expect(HELP_EXAMPLES.length).toBeGreaterThan(10);
  });
});
