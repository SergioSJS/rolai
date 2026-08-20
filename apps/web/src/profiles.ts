// Profiles de sistema disponiveis na UI. O conteudo YAML vem dos arquivos
// versionados em packages/rules-engine/profiles via `?raw` do Vite — a UI
// nunca parseia YAML por conta propria, quem valida e o rules-engine
// (parseProfile). Ver docs/system-profiles.md.

import { parseProfile } from "@rolai/rules-engine";
import type { SystemProfile } from "@rolai/rules-engine";
import ironswornYaml from "@rolai/rules-engine/profiles/ironsworn.yaml?raw";
import pbtaYaml from "@rolai/rules-engine/profiles/pbta.yaml?raw";
import pbta2d10Yaml from "@rolai/rules-engine/profiles/pbta2d10.yaml?raw";
import fitdYaml from "@rolai/rules-engine/profiles/fitd.yaml?raw";
import fateYaml from "@rolai/rules-engine/profiles/fate.yaml?raw";
import d20Yaml from "@rolai/rules-engine/profiles/d20.yaml?raw";
import d100Yaml from "@rolai/rules-engine/profiles/d100.yaml?raw";
import rollUnderYaml from "@rolai/rules-engine/profiles/roll_under.yaml?raw";
import poolD6Yaml from "@rolai/rules-engine/profiles/pool_d6.yaml?raw";
import wod5Yaml from "@rolai/rules-engine/profiles/wod5.yaml?raw";
import infaernumYaml from "@rolai/rules-engine/profiles/infaernum.yaml?raw";
import infaernumSimOuNaoYaml from "@rolai/rules-engine/profiles/infaernum_sim_ou_nao.yaml?raw";
import infaernumIdeiasYaml from "@rolai/rules-engine/profiles/infaernum_ideias.yaml?raw";
import fractalYaml from "@rolai/rules-engine/profiles/fractal.yaml?raw";
import firelightsYaml from "@rolai/rules-engine/profiles/firelights.yaml?raw";
import yzeYaml from "@rolai/rules-engine/profiles/yze.yaml?raw";
import yzeFblYaml from "@rolai/rules-engine/profiles/yze_fbl.yaml?raw";
import yzeAlienYaml from "@rolai/rules-engine/profiles/yze_alien.yaml?raw";
import yzeWduYaml from "@rolai/rules-engine/profiles/yze_wdu.yaml?raw";
import trophyDarkYaml from "@rolai/rules-engine/profiles/trophy_dark.yaml?raw";
import trophyGoldYaml from "@rolai/rules-engine/profiles/trophy_gold.yaml?raw";

// A ordem aqui e a ordem do seletor de sistema na UI: do mais comum na
// mesa pro mais especifico.
const PROFILE_YAMLS: Record<string, string> = {
  d20: d20Yaml,
  fate: fateYaml,
  pbta: pbtaYaml,
  pbta2d10: pbta2d10Yaml,
  fitd: fitdYaml,
  ironsworn: ironswornYaml,
  firelights: firelightsYaml,
  trophy_dark: trophyDarkYaml,
  trophy_gold: trophyGoldYaml,
  d100: d100Yaml,
  roll_under: rollUnderYaml,
  pool_d6: poolD6Yaml,
  wod5: wod5Yaml,
  yze: yzeYaml,
  yze_fbl: yzeFblYaml,
  yze_alien: yzeAlienYaml,
  yze_wdu: yzeWduYaml,
  infaernum: infaernumYaml,
  infaernum_sim_ou_nao: infaernumSimOuNaoYaml,
  infaernum_ideias: infaernumIdeiasYaml,
  fractal: fractalYaml,
};

let cache: Map<string, SystemProfile> | null = null;

export function availableProfiles(): SystemProfile[] {
  if (cache === null) {
    cache = new Map(
      Object.entries(PROFILE_YAMLS).map(([id, yaml]) => [id, parseProfile(yaml)]),
    );
  }
  return [...cache.values()];
}

export function getProfile(system: string): SystemProfile | undefined {
  return availableProfiles().find((p) => p.system === system);
}
