// Agrupamento de profiles — so apresentacao. O engine/profiles.ts
// continuam com um SystemProfile por arquivo YAML, sem fusao nenhuma;
// isto so decide como a UI mostra varios profiles que sao "modos" da
// mesma familia. Infaernum tem 3 rolagens bem diferentes (oraculo
// sim/nao, ideias verbo+substantivo, acao 3d6) — no seletor de sistema
// (Preferências) aparecem como UMA entrada, com um segundo select "Modo"
// logo abaixo pros membros.
//
// Os modos ja foram botoes lado a lado dentro da caixa de rolagem; com os
// 4 do Year Zero a fileira estourava a largura do painel e empurrava a
// rolagem pra fora da vista, entao voltaram pro SettingsPanel.

export interface ProfileFamilyMember {
  system: string;
  subLabel: string;
}

export interface ProfileFamily {
  key: string;
  label: string;
  members: ProfileFamilyMember[];
  /**
   * Nome enxuto pra onde o label inteiro nao cabe — hoje so o overlay do
   * Android usa ("ROLAR YZ"), onde "Year Zero" com quatro modos ja empurrava
   * a aba pra fora do painel de 300dp. Ausente = usa o proprio `label`.
   */
  shortLabel?: string;
}

export const PROFILE_FAMILIES: ProfileFamily[] = [
  {
    key: "infaernum",
    label: "Infaernum",
    members: [
      { system: "infaernum", subLabel: "Ação" },
      { system: "infaernum_sim_ou_nao", subLabel: "Sim ou Não" },
      { system: "infaernum_ideias", subLabel: "Ideias" },
    ],
  },
  // Year Zero: mesma mecanica de base (pool de d6, 6 = sucesso) com pools
  // e banes diferentes por linha. Sao 4 profiles porque o que muda e a
  // ESTRUTURA da rolagem (1, 3 ou 2 pools) e o nome do desastre — nao da
  // pra unificar sem perder o termo que a mesa usa.
  {
    key: "yze",
    label: "Year Zero",
    shortLabel: "YZ",
    members: [
      { system: "yze", subLabel: "Genérico" },
      { system: "yze_fbl", subLabel: "Forbidden Lands" },
      { system: "yze_alien", subLabel: "Alien" },
      { system: "yze_wdu", subLabel: "Walking Dead" },
    ],
  },
  {
    key: "trophy",
    label: "Trophy",
    members: [
      { system: "trophy_dark", subLabel: "Dark" },
      { system: "trophy_gold", subLabel: "Gold" },
    ],
  },
];

// Familia que contem este system id, se houver.
export function familyFor(system: string): ProfileFamily | undefined {
  return PROFILE_FAMILIES.find((f) => f.members.some((m) => m.system === system));
}

// Ids de todo member de toda familia — pra filtrar o dropdown principal
// (esses profiles nao aparecem soltos, so dentro da familia).
export function familyMemberSystems(): Set<string> {
  const ids = new Set<string>();
  for (const family of PROFILE_FAMILIES) {
    for (const member of family.members) ids.add(member.system);
  }
  return ids;
}
