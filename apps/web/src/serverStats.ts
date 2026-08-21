// Leitura do GET /stats do backend (services/backend/app/stats.py) pro painel
// "Servidor" — specs/11-status-do-servidor.md.
//
// Parse TOLERANTE de proposito: o painel roda contra qualquer backend que o
// usuario aponte nas preferencias, incluindo um mais velho ou mais novo que
// esta build. Campo que faltar vira 0; campo desconhecido e ignorado. A tela
// nunca quebra por causa da forma do JSON.

import { apiBaseUrl } from "./config";

export interface ServerStats {
  uptimeSeconds: number;
  rooms: { active: number; createdSinceBoot: number };
  connections: {
    playersNow: number;
    spectatorsNow: number;
    roomsWithSomeone: number;
    playersSinceBoot: number;
    spectatorsSinceBoot: number;
  };
  rollsRelayedSinceBoot: number;
  profiles: { createdSinceBoot: number; purgedSinceBoot: number };
  limitsHitSinceBoot: Array<{ kind: string; count: number }>;
}

/** 401 do endpoint com STATS_TOKEN ligado. O frontend NAO tem token pra
 * oferecer (nunca embutir segredo no bundle), entao isso e um estado final,
 * nao um erro pra tentar de novo. */
export class StatsProtectedError extends Error {
  constructor() {
    super("status protegido por token neste servidor");
    this.name = "StatsProtectedError";
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function num(source: unknown, key: string): number {
  if (!isRecord(source)) return 0;
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function branch(source: unknown, key: string): unknown {
  return isRecord(source) ? source[key] : undefined;
}

export function parseServerStats(raw: unknown): ServerStats {
  const rooms = branch(raw, "rooms");
  const connections = branch(raw, "connections");
  const profiles = branch(raw, "profiles");
  const limits = branch(raw, "limits_hit_since_boot");
  return {
    uptimeSeconds: num(raw, "uptime_seconds"),
    rooms: { active: num(rooms, "active"), createdSinceBoot: num(rooms, "created_since_boot") },
    connections: {
      playersNow: num(connections, "players_now"),
      spectatorsNow: num(connections, "spectators_now"),
      roomsWithSomeone: num(connections, "rooms_with_someone"),
      playersSinceBoot: num(connections, "players_since_boot"),
      spectatorsSinceBoot: num(connections, "spectators_since_boot"),
    },
    rollsRelayedSinceBoot: num(raw, "rolls_relayed_since_boot"),
    profiles: {
      createdSinceBoot: num(profiles, "created_since_boot"),
      purgedSinceBoot: num(profiles, "purged_since_boot"),
    },
    // Chaves dinamicas (as mesmas labels do log estruturado do backend):
    // ordena pela maior contagem, que e o que interessa olhar primeiro.
    limitsHitSinceBoot: isRecord(limits)
      ? Object.entries(limits)
          .filter(([, count]) => typeof count === "number" && count > 0)
          .map(([kind, count]) => ({ kind, count: count as number }))
          .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind))
      : [],
  };
}

const REQUEST_TIMEOUT_MS = 8_000;

/** Busca os agregados. O timeout e obrigatorio: `fetch` pendurado num
 * servidor que aceita a conexao e nao responde nunca rejeita sozinho, e o
 * painel ficaria em "carregando…" pra sempre (armadilha recorrente do
 * projeto — ver AGENTS.md). */
export async function fetchServerStats(signal?: AbortSignal): Promise<ServerStats> {
  const control = new AbortController();
  // O abort do relogio precisa virar ERRO, e nao ser confundido com o abort
  // de quem chamou (troca de busca, painel fechado). Sem essa distincao o
  // estouro de tempo fica indistinguivel de "cancelei", e a tela trava em
  // "carregando…" — a mesma armadilha de sempre.
  let estourou = false;
  const timer = setTimeout(() => {
    estourou = true;
    control.abort();
  }, REQUEST_TIMEOUT_MS);
  const onAbort = () => control.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetch(`${apiBaseUrl().replace(/\/$/, "")}/stats`, {
      signal: control.signal,
    });
    if (response.status === 401) throw new StatsProtectedError();
    if (!response.ok) throw new Error(`servidor respondeu HTTP ${response.status}`);
    return parseServerStats(await response.json());
  } catch (err) {
    if (estourou) {
      throw new Error(`o servidor não respondeu em ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    // `fetch` joga TypeError pra rede fora do ar, DNS, CORS recusado — a
    // mensagem nativa ("Failed to fetch") nao diz nada pra quem le a tela.
    if (err instanceof TypeError) {
      throw new Error("não foi possível alcançar o servidor");
    }
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

const UNIDADES: Array<[number, string]> = [
  [86_400, "d"],
  [3_600, "h"],
  [60, "min"],
];

/** "3d 4h", "12min 30s", "menos de 1min" — duas casas bastam pra responder
 * "faz quanto tempo que subiu?". */
export function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) return `${total}s`;
  const partes: string[] = [];
  let resto = total;
  for (const [tamanho, sufixo] of UNIDADES) {
    const quantidade = Math.floor(resto / tamanho);
    resto -= quantidade * tamanho;
    if (quantidade > 0) partes.push(`${quantidade}${sufixo}`);
    if (partes.length === 2) break;
  }
  return partes.join(" ");
}

// Rotulos das labels de limite do backend (app/logs.py e app/limits.py).
// Chave que nao estiver aqui aparece crua: o backend pode ganhar limite novo
// sem que esta build saiba, e sumir com a linha seria pior que mostrar o
// nome tecnico.
const LIMIT_LABELS: Record<string, string> = {
  room_create: "criação de sala",
  room_cap: "teto de salas do servidor",
  member_cap: "teto de jogadores na sala",
  spectator_cap: "teto de espectadores na sala",
  ws_connect: "abertura de conexão",
  origin_forbidden: "origem não autorizada",
  profile_create: "criação de profile",
};

export function limitLabel(kind: string): string {
  return LIMIT_LABELS[kind] ?? kind;
}
