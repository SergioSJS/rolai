// Quanto tempo uma sala parada sobrevive no servidor, pra UI poder dizer
// isso sem hardcodar numero (specs/12-aviso-de-expiracao-de-sala.md).
//
// O TTL RENOVA a cada atividade da sala (room_store._refresh_ttl no
// backend): e tempo de SILENCIO, nao tempo desde a criacao. O texto da tela
// tem que dizer isso, senao quem joga a tarde inteira acha que vai perder o
// historico no meio da sessao.
//
// Duas fontes, porque quem CRIA sala e quem ENTRA numa recebem coisas
// diferentes: o POST /rooms devolve `ttl_seconds` de brinde, e quem so entra
// nunca ve esse corpo — pra esse, o valor vem do GET /stats.

import { useEffect, useState } from "react";
import { fetchServerStats } from "./serverStats";

let cache: number | null = null;
// Uma busca em voo e compartilhada por todos os componentes que perguntarem
// ao mesmo tempo (Sala e Ajuda abrem uma depois da outra).
let emVoo: Promise<number | null> | null = null;

/** Guarda o TTL que veio de graca no POST /rooms. */
export function rememberRoomTtl(seconds: unknown): void {
  if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
    cache = Math.floor(seconds);
  }
}

/** Só pros testes: o cache e de modulo e sobreviveria de um caso pro outro. */
export function resetRoomTtlCache(): void {
  cache = null;
  emVoo = null;
}

export async function loadRoomTtl(): Promise<number | null> {
  if (cache !== null) return cache;
  if (emVoo !== null) return emVoo;
  emVoo = fetchServerStats()
    .then((stats) => {
      rememberRoomTtl(stats.rooms.ttlSeconds);
      return cache;
    })
    // Servidor fora do ar, protegido por token ou velho demais pra ter o
    // campo: a tela cai no texto sem numero. Avisar que a sala expira
    // importa mais que dizer em quantas horas.
    .catch(() => null)
    .finally(() => {
      emVoo = null;
    });
  return emVoo;
}

/** `null` = ainda nao sei (ou o servidor nao contou). */
export function useRoomTtl(): number | null {
  const [ttl, setTtl] = useState<number | null>(cache);
  useEffect(() => {
    if (cache !== null) return;
    let vivo = true;
    void loadRoomTtl().then((valor) => {
      if (vivo) setTtl(valor);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return ttl;
}

/** "6 horas", "1 hora", "90 minutos" — texto corrido, nao "6h". */
export function formatTtl(seconds: number): string {
  if (seconds % 3600 === 0) {
    const horas = seconds / 3600;
    return horas === 1 ? "1 hora" : `${horas} horas`;
  }
  const minutos = Math.max(1, Math.round(seconds / 60));
  return minutos === 1 ? "1 minuto" : `${minutos} minutos`;
}

/** A frase inteira, com ou sem numero. Um lugar so: o aviso aparece em mais
 * de uma tela e nao pode divergir entre elas. */
export function ttlPhrase(ttl: number | null): string {
  return ttl === null || ttl <= 0
    ? "algumas horas sem ninguém rolar nada"
    : `${formatTtl(ttl)} sem ninguém rolar nada`;
}
