import { describe, expect, it } from "vitest";
import {
  CUSTOM_CODE_MIN_DISTINCT,
  CUSTOM_CODE_MIN_LENGTH,
  customCodeIssue,
} from "../room/code";

// Espelho de is_valid_custom_code (services/backend/app/rooms.py). Se o
// backend mudar o piso e isto nao mudar junto, o usuario recebe "pode criar"
// e leva 4404 na cara — por isso os numeros ficam travados aqui.
describe("codigo de sala escolhido a mao", () => {
  it("aceita um codigo de mesa fixa", () => {
    expect(customCodeIssue("mesa-do-sergio-2026")).toBeNull();
  });

  it("recusa os casos que o backend recusa", () => {
    expect(customCodeIssue("sergio")).toContain("16");
    expect(customCodeIssue("teste")).toContain("16");
    // Comprimento ok, variedade nao.
    expect(customCodeIssue("aaaaaaaaaaaaaaaaaaaa")).toContain("diferentes");
    expect(customCodeIssue("12341234123412341234")).toContain("diferentes");
  });

  it("recusa caractere fora do alfabeto da URL", () => {
    expect(customCodeIssue("mesa do sergio 2026")).toContain("apenas");
    expect(customCodeIssue("mesa/do/sergio/2026")).toContain("apenas");
  });

  it("campo vazio pede codigo (o botao Criar trata como aleatorio antes)", () => {
    expect(customCodeIssue("   ")).toBe("digite um código");
  });

  it("piso bate com o do backend", () => {
    expect(CUSTOM_CODE_MIN_LENGTH).toBe(16);
    expect(CUSTOM_CODE_MIN_DISTINCT).toBe(8);
  });
});
