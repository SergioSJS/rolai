// Profiles de sistema disponiveis na UI. O conteudo YAML vem dos arquivos
// versionados em packages/rules-engine/profiles via `?raw` do Vite — a UI
// nunca parseia YAML por conta propria, quem valida e o rules-engine
// (parseProfile). Ver docs/system-profiles.md.
//
// A lista e varrida do diretorio (import.meta.glob), nao escrita a mao:
// eram 21 linhas de import mais um mapa de 21 entradas, e um profile novo
// so aparecia se as DUAS fossem editadas. Agora basta o YAML existir.

import { parseProfile } from "@rolai/rules-engine";
import type { SystemProfile } from "@rolai/rules-engine";

const YAML_MODULES = import.meta.glob("../../../packages/rules-engine/profiles/*.yaml", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

// Ordem do seletor de sistema na UI: do mais comum na mesa pro mais
// especifico. Era a ordem das chaves do mapa antigo — agora explicita,
// porque a varredura devolve o diretorio em ordem alfabetica.
//
// Profile que nao estiver aqui entra no fim, em ordem alfabetica: um YAML
// novo aparece na UI sozinho, so nao escolhe onde.
const ORDER = [
  "d20",
  "fate",
  "pbta",
  "pbta2d10",
  "fitd",
  "ironsworn",
  "firelights",
  "trophy_dark",
  "trophy_gold",
  "d100",
  "roll_under",
  "pool_d6",
  "wod5",
  "yze",
  "yze_fbl",
  "yze_alien",
  "yze_wdu",
  "infaernum",
  "infaernum_sim_ou_nao",
  "infaernum_ideias",
  "fractal",
];

function idFromPath(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.yaml$/, "");
}

function rank(id: string): number {
  const i = ORDER.indexOf(id);
  return i === -1 ? ORDER.length : i;
}

let cache: SystemProfile[] | null = null;

export function availableProfiles(): SystemProfile[] {
  if (cache === null) {
    cache = Object.entries(YAML_MODULES)
      .map(([path, yaml]) => [idFromPath(path), yaml] as const)
      .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
      .map(([, yaml]) => parseProfile(yaml));
  }
  return cache;
}

export function getProfile(system: string): SystemProfile | undefined {
  return availableProfiles().find((p) => p.system === system);
}
