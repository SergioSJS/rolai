// Profiles de sistema disponiveis na UI. O conteudo YAML vem dos arquivos
// versionados em packages/rules-engine/profiles via `?raw` do Vite — a UI
// nunca parseia YAML por conta propria, quem valida e o rules-engine
// (parseProfile). Ver docs/system-profiles.md.

import { parseProfile } from "@rolai/rules-engine";
import type { SystemProfile } from "@rolai/rules-engine";
import ironswornYaml from "@rolai/rules-engine/profiles/ironsworn.yaml?raw";
import pbtaYaml from "@rolai/rules-engine/profiles/pbta.yaml?raw";
import fitdYaml from "@rolai/rules-engine/profiles/fitd.yaml?raw";
import fateYaml from "@rolai/rules-engine/profiles/fate.yaml?raw";
import d20Yaml from "@rolai/rules-engine/profiles/d20.yaml?raw";
import d100Yaml from "@rolai/rules-engine/profiles/d100.yaml?raw";

// A ordem aqui e a ordem do seletor de sistema na UI: do mais comum na
// mesa pro mais especifico.
const PROFILE_YAMLS: Record<string, string> = {
  d20: d20Yaml,
  fate: fateYaml,
  pbta: pbtaYaml,
  fitd: fitdYaml,
  ironsworn: ironswornYaml,
  d100: d100Yaml,
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
