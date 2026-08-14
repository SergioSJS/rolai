// Montagem de rolagens a partir da UI. Toda a logica de regras fica no
// rules-engine; aqui so ha conversao dos valores crus do formulario
// (strings de inputs HTML) pros tipos que o engine espera.

import { roll, rollOverlay, rollWithProfile } from "@rolai/rules-engine";
import type {
  ProfileInputs,
  RollResult,
  SystemProfile,
} from "@rolai/rules-engine";

// Converte os valores do formulario (sempre strings) pro ProfileInputs do
// engine. Inputs "number" viram Number; "select" ficam string. Valor
// vazio/invalido em input numerico e erro amigavel — o engine tambem
// validaria, mas com mensagem menos ligada ao formulario.
export function coerceInputs(
  profile: SystemProfile,
  raw: Record<string, string>,
): ProfileInputs {
  const inputs: ProfileInputs = {};
  for (const input of profile.inputs) {
    const value = raw[input.id] ?? "";
    if (input.type === "number") {
      if (value.trim() === "") {
        // Opcional deixado em branco: nem entra no objeto — o engine trata
        // como "nao informado" e pula os outcome_rules que o referenciam
        // (roll_under sem "target", wod5 sem "difficulty", etc).
        if (input.required === false) continue;
        throw new Error(`"${input.label}" precisa ser um numero`);
      }
      const n = Number(value);
      if (!Number.isFinite(n)) {
        throw new Error(`"${input.label}" precisa ser um numero`);
      }
      inputs[input.id] = n;
    } else {
      inputs[input.id] = value;
    }
  }
  return inputs;
}

// Rola via profile (camada 2) ou notacao livre (camada 1). O RNG default
// do engine ja e crypto.
export async function rollFromProfile(
  profile: SystemProfile,
  rawInputs: Record<string, string>,
): Promise<RollResult> {
  return rollWithProfile(profile, coerceInputs(profile, rawInputs));
}

export function rollFromNotation(notation: string): RollResult {
  return roll(notation);
}

// roll_under e afins (roll_type "overlay"): sem dado proprio — a rolagem
// vem do composer de notacao livre, e o profile so avalia outcome_rules
// sobre o resultado (rules-engine/profile.ts).
export async function rollFromOverlay(
  profile: SystemProfile,
  notation: string,
  rawInputs: Record<string, string>,
): Promise<RollResult> {
  return rollOverlay(profile, notation, coerceInputs(profile, rawInputs));
}
