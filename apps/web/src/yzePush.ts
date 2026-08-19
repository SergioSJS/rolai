// Forçar (o "push" da linha Year Zero): monta os inputs da PROXIMA rolagem
// a partir da que acabou de sair.
//
// O motor e stateless de proposito (docs/architecture.md) — ele nao sabe
// que a rolagem anterior existiu. Entao "empurrar" nao e um modo do
// profile: e recalcular quantos dados sobraram pra rerrolar e quantos
// sucessos ficaram travados, e devolver isso como valores de formulario. O
// jogador ve nos campos o que foi usado e pode ajustar pra rolar de novo —
// e por isso que esta funcao devolve inputs, nao uma rolagem: quem rola e o
// RollPanel (e, no futuro, o overlay do Android), com a mesma conta.
//
// Cada sabor trava coisas diferentes na mesa:
//   yze       (Coriolis, Tales, Vaesen) — 6 trava. Todo o resto rerrola.
//   yze_fbl   (Forbidden Lands, Mutant) — 6 E 1 travam; so o meio rerrola.
//   yze_alien / yze_wdu                 — 6 trava, 1 nao (o 1 no Estresse
//                                         ja disparou panico/descontrole na
//                                         hora); alem disso o push
//                                         ACRESCENTA um dado de Estresse.
//
// Mora aqui, num lugar so, pelo mesmo motivo do profileInputQuirks.ts: a
// bridge headless do Android vai chamar ESTA funcao quando o overlay
// ganhar o botao Forçar — reescrever a conta em Kotlin seria a duplicata
// que o AGENTS.md manda evitar.

import type { RollResult } from "@rolai/rules-engine";

export const YZE_SYSTEMS = ["yze", "yze_fbl", "yze_alien", "yze_wdu"] as const;

export type YzeSystem = (typeof YZE_SYSTEMS)[number];

export function isYzeSystem(system: string | undefined): system is YzeSystem {
  return system !== undefined && (YZE_SYSTEMS as readonly string[]).includes(system);
}

export interface YzePushPlan {
  /** Valores crus do formulario pra proxima rolagem (mesmo formato do RollPanel). */
  inputs: Record<string, string>;
  /** Quantos dados voltam pra mesa — a soma dos pools depois do push. */
  dadosRerrolados: number;
  /** Sucessos que ficaram travados (os 6 que nao rerrolam). */
  sucessosTravados: number;
}

function count(rolls: number[], value: number): number {
  return rolls.filter((v) => v === value).length;
}

// Dados que CONTAM (group.rolls ja exclui o descartado do keep/drop — o
// "1d6dl1" do zero_dice_fallback existe pra representar pool vazio, e o
// dado dele nao esta na mesa).
function rollsOf(result: RollResult, group: string): number[] {
  return result.groups[group]?.rolls ?? [];
}

// Sucessos que a rolagem que estamos empurrando JA carregava de antes: o
// modificador do grupo que leva "{input.sucessos_anteriores}" (com
// success_rule, o modificador soma na contagem — ver docs/system-profiles.md).
function carryOf(result: RollResult, group: string): number {
  return result.groups[group]?.modifier ?? 0;
}

function num(raw: string | undefined): number {
  const n = Number(raw ?? "");
  return Number.isFinite(n) ? n : 0;
}

/**
 * Inputs da rolagem empurrada, ou `null` se nao da pra empurrar este
 * resultado (outro sistema, ou grupos que nao batem com o profile).
 *
 * `current` sao os valores que estao no formulario agora — sao eles que
 * carregam os 1s ja travados em pushes anteriores no Forbidden Lands.
 */
export function planYzePush(
  system: string,
  result: RollResult,
  current: Record<string, string>,
): YzePushPlan | null {
  if (!isYzeSystem(system) || result.profile !== system) return null;

  if (system === "yze") {
    const pool = rollsOf(result, "pool");
    const sixes = count(pool, 6);
    const rerroll = pool.length - sixes;
    return {
      inputs: {
        ...current,
        pool_size: String(rerroll),
        sucessos_anteriores: String(sixes + carryOf(result, "pool")),
      },
      dadosRerrolados: rerroll,
      sucessosTravados: sixes + carryOf(result, "pool"),
    };
  }

  if (system === "yze_fbl") {
    const base = rollsOf(result, "base");
    const pericia = rollsOf(result, "pericia");
    const equipamento = rollsOf(result, "equipamento");
    // 6 trava em todos; 1 trava em Base e Equipamento (geram dano).
    // Em Perícia, 1 nao e bane e volta pra mao (rerrola junto com 2-5).
    const rerrollBase = base.length - count(base, 6) - count(base, 1);
    const rerrollPericia = pericia.length - count(pericia, 6);
    const rerrollEquip =
      equipamento.length - count(equipamento, 6) - count(equipamento, 1);
    const travados =
      count(base, 6) + count(pericia, 6) + count(equipamento, 6) + carryOf(result, "base");
    return {
      inputs: {
        ...current,
        base: String(rerrollBase),
        pericia: String(rerrollPericia),
        equipamento: String(rerrollEquip),
        sucessos_anteriores: String(travados),
        // Preencher estes dois e o que liga o dano na rolagem empurrada:
        // em branco (rolagem normal) as outcome_rules de bane sao puladas.
        push_banes_base: String(count(base, 1) + num(current["push_banes_base"])),
        push_banes_equip: String(
          count(equipamento, 1) + num(current["push_banes_equip"]),
        ),
      },
      dadosRerrolados: rerrollBase + rerrollPericia + rerrollEquip,
      sucessosTravados: travados,
    };
  }

  // yze_alien / yze_wdu: o 1 nao trava (ja cobrou o preco dele na hora), e
  // empurrar custa um dado de Estresse a mais.
  const base = rollsOf(result, "base");
  const estresse = rollsOf(result, "estresse");
  const rerrollBase = base.length - count(base, 6);
  const rerrollEstresse = estresse.length - count(estresse, 6) + 1;
  const travados = count(base, 6) + count(estresse, 6) + carryOf(result, "base");
  return {
    inputs: {
      ...current,
      base: String(rerrollBase),
      estresse: String(rerrollEstresse),
      sucessos_anteriores: String(travados),
    },
    dadosRerrolados: rerrollBase + rerrollEstresse,
    sucessosTravados: travados,
  };
}
