// Agrupamento de profiles — so apresentacao. O engine/profiles.ts
// continuam com um SystemProfile por arquivo YAML, sem fusao nenhuma;
// isto so decide como a UI mostra varios profiles que sao "modos" da
// mesma familia. Infaernum tem 3 rolagens bem diferentes (oraculo
// sim/nao, ideias verbo+substantivo, acao 3d6) — no seletor de sistema
// (Preferências) aparecem como UMA entrada, e o RollPanel mostra os 3
// modos como botoes dentro da propria caixa de rolagem (nao precisa abrir
// Preferências pra trocar).

export interface ProfileFamilyMember {
  system: string;
  subLabel: string;
}

export interface ProfileFamily {
  key: string;
  label: string;
  members: ProfileFamilyMember[];
}

export const PROFILE_FAMILIES: ProfileFamily[] = [
  {
    key: "infaernum",
    label: "Infaernum",
    members: [
      { system: "infaernum", subLabel: "Ação (3d6)" },
      { system: "infaernum_sim_ou_nao", subLabel: "Sim ou Não" },
      { system: "infaernum_ideias", subLabel: "Ideias" },
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
