// Config de rede do app, em ordem de precedencia:
//
//   1. RUNTIME  — window.__ROLAI_CONFIG__, escrito em /config.js pelo
//      entrypoint do container (infra/web-entrypoint.sh) a partir das envs
//      ROLAI_WS_URL / ROLAI_API_URL. E o que permite a MESMA imagem servir
//      qualquer dominio: trocou a env, reiniciou o container, pronto.
//   2. BUILD    — VITE_WS_URL / VITE_API_URL, inlinadas pelo Vite (util no
//      `npm run dev` e em build local; ver .env.example).
//   3. DEFAULT  — backend de dev na 8420.
//
// O base HTTP deriva do WS trocando o scheme, a menos que a URL de API
// venha explicita.

export interface RuntimeConfig {
  wsUrl?: string;
  apiUrl?: string;
}

declare global {
  interface Window {
    __ROLAI_CONFIG__?: RuntimeConfig;
  }
}

const DEFAULT_WS_URL = "ws://localhost:8420";

function runtimeConfig(): RuntimeConfig {
  return (typeof window === "undefined" ? undefined : window.__ROLAI_CONFIG__) ?? {};
}

export function wsBaseUrl(
  env: Record<string, string | undefined> = import.meta.env,
  runtime: RuntimeConfig = runtimeConfig(),
): string {
  // Strings vazias contam como ausentes: o entrypoint sempre escreve as
  // chaves, mesmo quando a env nao foi definida.
  return runtime.wsUrl || env.VITE_WS_URL || DEFAULT_WS_URL;
}

export function apiBaseUrl(
  env: Record<string, string | undefined> = import.meta.env,
  runtime: RuntimeConfig = runtimeConfig(),
): string {
  if (runtime.apiUrl) return runtime.apiUrl;
  if (env.VITE_API_URL) return env.VITE_API_URL;
  const ws = wsBaseUrl(env, runtime);
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

// Ultima versao do APK, sem hardcodar numero: o GitHub redireciona
// /releases/latest pra tag mais nova. Se um dia o repo mudar de dono/nome,
// e o unico lugar a tocar.
export const APK_LATEST_URL = "https://github.com/SergioSJS/rolai/releases/latest";
