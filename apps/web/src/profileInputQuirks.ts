// Alguns profiles precisam de um valor que nao e um input de verdade —
// combina dois inputs visiveis num numero que so o motor usa. O profile
// schema (docs/system-profiles.md) nao tem "input derivado": field.dice so
// faz substituicao literal de {input.id}, sem aritmetica. Entao quem
// calcula esse valor e a UI, num lugar SO (nao duplicado em roll.ts e
// headless.ts, senao um dos dois fica pra tras — mesma familia de erro do
// AGENTS.md).
//
// fractal: o jogador informa "fatos_aplicaveis" (0+) e "vantagem"
// (sim/nao), mas o field usa "{input.dice_total}d6" — pool de Fatos
// (capada em 3) + 1 se teve Vantagem E tinha pelo menos 1 Fato aplicavel
// (Vantagem sem Fato nao conta, mesmo se o valor chegar aqui como "sim").

import type { ProfileInputs, SystemProfile } from "@rolai/rules-engine";

export function applyInputQuirks(
  profile: SystemProfile,
  inputs: ProfileInputs,
): ProfileInputs {
  if (profile.system !== "fractal") return inputs;
  const fatos = Math.max(0, Math.min(3, Number(inputs["fatos_aplicaveis"] ?? 0)));
  const vantagem = fatos >= 1 && inputs["vantagem"] === "sim" ? 1 : 0;
  return { ...inputs, dice_total: fatos + vantagem };
}
