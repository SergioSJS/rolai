// Catalogo de APRESENTACAO compartilhado com o app Android: rotulos de
// outcome, tom de cada outcome, rotulos de pool e as familias de profile.
//
// Nada disto e regra — quem decide o outcome sao as `outcome_rules` dos
// YAMLs (packages/rules-engine/profiles). Sao as palavras que a mesa le, e
// por isso viviam duplicadas: format.ts / profileFamilies.ts de um lado,
// OutcomeLabels.kt / OutcomeTone.kt / ProfileFamilies.kt do outro. Toda
// rolagem nova pedia a mesma edicao nos dois lugares, e esquecer o lado
// Kotlin nao quebrava nada — so fazia o overlay mostrar "desgraca_x1" no
// lugar de "1 desgraça", sem erro em canto nenhum.
//
// Agora este arquivo e a unica fonte: `npm run build:headless -w @rolai/web`
// executa o bundle em Node e gera OutcomeCatalog.kt a partir daqui
// (apps/web/scripts/install-headless.mjs).

// De outcomeTables.ts, NAO de format.ts: format arrasta cardFormat ->
// React, e este modulo entra no bundle headless do Android (que roda numa
// WebView sem `process`). Ver o cabecalho de outcomeTables.ts.
import { GROUP_LABELS, OUTCOME_LABELS, OUTCOME_TONES } from "./outcomeTables";
import type { OutcomeTone } from "./outcomeTables";
import { PROFILE_FAMILIES } from "./profileFamilies";

export interface CatalogFamilyMember {
  system: string;
  subLabel: string;
}

export interface CatalogFamily {
  key: string;
  label: string;
  shortLabel: string;
  members: CatalogFamilyMember[];
}

export interface Catalog {
  outcomeLabels: Record<string, string>;
  outcomeTones: Record<string, OutcomeTone>;
  groupLabels: Record<string, string>;
  families: CatalogFamily[];
}

export function catalog(): Catalog {
  return {
    outcomeLabels: { ...OUTCOME_LABELS },
    // Outcome sem tom declarado nao entra: os dois lados ja tratam
    // ausencia como neutro, e listar "neutral" so engordaria o arquivo.
    outcomeTones: Object.fromEntries(
      Object.entries(OUTCOME_TONES).filter(([, tone]) => tone !== "neutral"),
    ),
    groupLabels: { ...GROUP_LABELS },
    families: PROFILE_FAMILIES.map((family) => ({
      key: family.key,
      label: family.label,
      shortLabel: family.shortLabel ?? family.label,
      members: family.members.map((m) => ({ system: m.system, subLabel: m.subLabel })),
    })),
  };
}
