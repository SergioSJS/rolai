// Calculo do botao "Forçar" do Trophy (Trophy Dark e Trophy Gold).
//
// Regra do Forçar (The Gauntlet / Hedgemaze Press):
// No teste de risco do Trophy, se o jogador nao tirou um 6 (sucesso completo),
// ele pode Forçar a rolagem. Ao Forçar, ele acrescenta +1 Dado Escuro ao
// seu pool e rerrola todos os dados.

import type { ProfileInputs, RollResult } from "@rolai/rules-engine";

export function isTrophy(system: string): boolean {
  return system === "trophy_dark" || system === "trophy_gold";
}

/**
 * Monta os inputs pra proxima rolagem (empurrada), ou null quando nao da pra
 * forcar (ja tirou um 6 / sucesso completo).
 */
export function planTrophyPush(
  lastResult: RollResult,
  currentInputs: ProfileInputs,
): ProfileInputs | null {
  if (!isTrophy(lastResult.profile ?? "")) return null;

  // Se ja tirou 6 (sucesso completo), nao ha motivo para forcar.
  if (lastResult.outcome === "success") return null;

  const claros = Number(currentInputs["claros"] ?? 1);
  const escuros = Number(currentInputs["escuros"] ?? 0);
  const ruina = Number(currentInputs["ruina"] ?? 1);

  return {
    claros,
    escuros: escuros + 1,
    ruina,
  };
}
