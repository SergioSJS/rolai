// Polling do GET /stats enquanto o painel "Servidor" esta aberto
// (specs/11-status-do-servidor.md).
//
// Tres portas fecham o polling, e todas importam: modal fechado, aba
// escondida e navegador offline. /stats cai no MESMO teto por IP que a
// criacao de sala (http_rate_limit_per_minute, 120/min), entao aba esquecida
// aberta a noite inteira nao pode gastar esse orcamento.

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchServerStats, StatsProtectedError } from "./serverStats";
import type { ServerStats } from "./serverStats";
import { useOnline } from "./useOnline";

export const STATS_POLL_MS = 20_000;

export interface ServerStatsState {
  data: ServerStats | null;
  /** Momento da ultima resposta boa (Date.now()), pro carimbo "atualizado
   * há Xs". Null enquanto nunca deu certo. */
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
  /** Servidor exige STATS_TOKEN. Estado final: o bundle nao tem token pra
   * mandar, entao insistir so gasta 401. */
  protected: boolean;
  online: boolean;
  /** Aba em segundo plano: o polling esta suspenso de proposito. Sem isso a
   * tela mostrava "Carregando…" para sempre, dizendo que buscava algo que
   * nao estava sendo buscado. */
  paused: boolean;
}

const ESTADO_INICIAL: Omit<ServerStatsState, "online" | "paused"> = {
  data: null,
  fetchedAt: null,
  loading: false,
  error: null,
  protected: false,
};

export function useServerStats(enabled: boolean): ServerStatsState & { refresh: () => void } {
  const [state, setState] = useState(ESTADO_INICIAL);
  const online = useOnline();
  // Aba escondida: o navegador ja estrangula timer em aba de fundo, mas nao
  // o suficiente — sem isso a busca continua rodando atras.
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );
  const inFlight = useRef<AbortController | null>(null);
  const montado = useRef(true);

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    inFlight.current?.abort();
    const control = new AbortController();
    inFlight.current = control;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const data = await fetchServerStats(control.signal);
      if (!montado.current || control.signal.aborted) return;
      setState({
        data,
        fetchedAt: Date.now(),
        loading: false,
        error: null,
        protected: false,
      });
    } catch (err) {
      if (!montado.current || control.signal.aborted) return;
      // Erro NAO apaga o ultimo dado: o painel continua mostrando o que
      // sabia, com o carimbo de quando soube, e o aviso ao lado.
      if (err instanceof StatsProtectedError) {
        setState((prev) => ({ ...prev, loading: false, error: null, protected: true }));
        return;
      }
      const motivo = err instanceof Error ? err.message : "falha ao consultar o servidor";
      setState((prev) => ({ ...prev, loading: false, error: motivo }));
    }
  }, []);

  const refresh = useCallback(() => {
    // Manual ignora "aba escondida" (se clicou, esta olhando) mas nao adianta
    // sem rede, e nao adianta contra servidor que exige token.
    if (!online) return;
    void load();
  }, [load, online]);

  useEffect(() => {
    if (!enabled) {
      inFlight.current?.abort();
      return;
    }
    if (!online || !visible || state.protected) return;
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, STATS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, online, visible, state.protected, load]);

  // Fechou o painel: zera pra proxima abertura nao mostrar numero velho como
  // se fosse de agora.
  useEffect(() => {
    if (!enabled) setState(ESTADO_INICIAL);
  }, [enabled]);

  return { ...state, online, paused: !visible, refresh };
}
