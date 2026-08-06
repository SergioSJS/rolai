// Config de rede do app. `VITE_WS_URL` e a fonte de verdade (ver
// .env.example da raiz); o base HTTP deriva dele trocando o scheme,
// a menos que `VITE_API_URL` esteja definido explicitamente.

const DEFAULT_WS_URL = "ws://localhost:8420";

export function wsBaseUrl(env: Record<string, string | undefined> = import.meta.env): string {
  return env.VITE_WS_URL ?? DEFAULT_WS_URL;
}

export function apiBaseUrl(env: Record<string, string | undefined> = import.meta.env): string {
  if (env.VITE_API_URL) return env.VITE_API_URL;
  const ws = wsBaseUrl(env);
  if (ws.startsWith("wss://")) return "https://" + ws.slice("wss://".length);
  if (ws.startsWith("ws://")) return "http://" + ws.slice("ws://".length);
  return ws;
}

// `style` (JSON) declara a aparencia dos dados do jogador pra sala inteira:
// o backend guarda no roster e devolve junto de cada rolagem, pra todo mundo
// animar o dado de quem rolou com a cor de quem rolou. `spectator` marca a
// conexao do modo stream/OBS: so recebe broadcast, nunca rola (ver
// services/backend/app/rooms.py).
export function roomWsUrl(
  code: string,
  name: string,
  style?: unknown,
  spectator = false,
): string {
  const base = wsBaseUrl().replace(/\/$/, "");
  const params = new URLSearchParams({ name });
  if (style !== undefined) params.set("style", JSON.stringify(style));
  if (spectator) params.set("spectator", "1");
  return `${base}/rooms/${encodeURIComponent(code)}?${params.toString()}`;
}

export function exportUrl(code: string, format: "json" | "csv" | "md"): string {
  const base = apiBaseUrl().replace(/\/$/, "");
  return `${base}/rooms/${encodeURIComponent(code)}/export?format=${format}`;
}
