import { describe, expect, it } from "vitest";
import {
  BURST_LIMIT,
  checkCooldown,
  initialCooldown,
  type CooldownState,
} from "../rollCooldown";

// Roda N rolagens seguidas no mesmo instante e devolve o ultimo veredito.
function rajada(vezes: number, players: number, inicio = 1000) {
  let estado: CooldownState = initialCooldown;
  let ultimo = checkCooldown(estado, inicio, players);
  estado = ultimo.state;
  for (let i = 1; i < vezes; i += 1) {
    ultimo = checkCooldown(estado, inicio + i * 10, players);
    estado = ultimo.state;
  }
  return ultimo;
}

describe("freio de spam de rolagem", () => {
  it("nao freia quem esta sozinho — o unico incomodado seria ele", () => {
    const solo = rajada(BURST_LIMIT + 20, 1);
    expect(solo.allowed).toBe(true);
  });

  it("nao freia offline (sem sala, players = 0)", () => {
    expect(rajada(BURST_LIMIT + 20, 0).allowed).toBe(true);
  });

  it("freia a partir da sexta rolagem em rajada, com mesa cheia", () => {
    const rapido = rajada(BURST_LIMIT + 1, 3);
    expect(rapido.allowed).toBe(false);
    expect(rapido.waitSeconds).toBe(3);
  });

  it("rolagem espacada nunca freia", () => {
    let estado: CooldownState = initialCooldown;
    for (let i = 0; i < 30; i += 1) {
      const v = checkCooldown(estado, i * 5000, 3);
      expect(v.allowed).toBe(true);
      estado = v.state;
    }
  });

  it("sai do bloqueio depois da espera e nao reentra na hora", () => {
    const bloqueado = rajada(BURST_LIMIT + 1, 3);
    expect(bloqueado.allowed).toBe(false);

    // Ainda dentro da espera: continua barrado, com contagem regressiva.
    const meio = checkCooldown(bloqueado.state, 2000, 3);
    expect(meio.allowed).toBe(false);

    // Passada a espera, a janela foi zerada — a proxima passa.
    const depois = checkCooldown(bloqueado.state, 1000 + 60 * 1000, 3);
    expect(depois.allowed).toBe(true);
  });
});
