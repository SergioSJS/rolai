// "Ocultar daqui pra trás": filtro LOCAL do histórico, desfazível, invisível
// pro resto da mesa (specs/09-limpar-historico.md). O outro botão — "Limpar
// a sala" — apaga no Redis pra todo mundo e não passa por aqui.
//
// O corte é o carimbo (`receivedAt`) da última entrada visível no momento do
// clique, e NÃO `new Date()`. Parece a mesma coisa e não é: `receivedAt` vem
// do relógio do SERVIDOR, e comparar contra o relógio desta máquina traz o
// skew de volta pela porta dos fundos — máquina atrasada guardaria um corte
// menor que os carimbos já existentes e não esconderia nada, sem erro nenhum.
// Guardando um valor que veio do próprio servidor, os dois lados da
// comparação saem do mesmo relógio.

import type { HistoryEntry } from "./reducer";

const HIDDEN_BEFORE_PREFIX = "rolai.hidden-before.";

/** Chave usada fora de sala — o histórico local também aceita corte. */
export const LOCAL_HISTORY_SCOPE = "local";

/**
 * Carimbo pelo qual a entrada é ordenada e cortada.
 *
 * Prefere o do servidor. Entrada sem ele é legado (gravada antes do campo
 * existir, ainda viva no Redis dentro do TTL da sala) ou local sem conexão —
 * aí cai no `timestamp` do payload, que é o relógio de quem rolou.
 */
export function entryStamp(entry: HistoryEntry): string {
  if (entry.receivedAt !== undefined) return entry.receivedAt;
  return entry.type === "roll" ? entry.result.timestamp : entry.timestamp;
}

/** Entradas que continuam à vista com o corte aplicado. */
export function visibleEntries(
  entries: HistoryEntry[],
  hiddenBefore: string | null,
): HistoryEntry[] {
  if (hiddenBefore === null) return entries;
  return entries.filter((entry) => entryStamp(entry) > hiddenBefore);
}

/**
 * Corte que esconde tudo que está à vista agora.
 *
 * `null` quando não há nada visível — sem entrada, não há carimbo de
 * servidor pra usar, e inventar um com o relógio local é justamente o bug
 * descrito no topo do arquivo.
 */
export function cutoffForCurrent(entries: HistoryEntry[]): string | null {
  const visible = entries.at(-1);
  return visible === undefined ? null : entryStamp(visible);
}

export function loadHiddenBefore(storage: Storage, scope: string): string | null {
  try {
    return storage.getItem(HIDDEN_BEFORE_PREFIX + scope);
  } catch {
    return null;
  }
}

export function saveHiddenBefore(storage: Storage, scope: string, value: string | null): void {
  try {
    if (value === null) storage.removeItem(HIDDEN_BEFORE_PREFIX + scope);
    else storage.setItem(HIDDEN_BEFORE_PREFIX + scope, value);
  } catch {
    // Storage cheio ou bloqueado: o corte vale só nesta sessão. Perder a
    // persistência não justifica derrubar a tela.
  }
}
