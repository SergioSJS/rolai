// Painel "Servidor": os agregados do GET /stats do backend em tiles
// (specs/11-status-do-servidor.md). So leitura — nao ha nada pra configurar
// aqui, e nada identificavel pra mostrar.

import { useEffect, useState } from "react";
import { formatUptime, limitLabel } from "../serverStats";
import type { ServerStats } from "../serverStats";
import { useServerStats } from "../useServerStats";
import { apiBaseUrl } from "../config";

interface ServerStatsPanelProps {
  /** Falso enquanto o modal esta fechado: e o que desliga o polling. */
  open: boolean;
}

/** Relogio grosso pro carimbo "atualizado há Xs" — a graça do painel e
 * parecer vivo, mas 5s de granularidade basta e evita re-render por segundo. */
function useAgora(ativo: boolean): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ativo) return;
    const timer = window.setInterval(() => setAgora(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, [ativo]);
  return agora;
}

function formatAge(ms: number): string {
  const segundos = Math.max(0, Math.round(ms / 1000));
  if (segundos < 10) return "agora";
  if (segundos < 60) return `há ${segundos}s`;
  const minutos = Math.round(segundos / 60);
  return `há ${minutos}min`;
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-tile">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function Numeros({ stats }: { stats: ServerStats }) {
  return (
    <>
      <h3>Agora</h3>
      <div className="stat-grid">
        <Tile label="salas ativas" value={stats.rooms.active} />
        <Tile label="salas com gente" value={stats.connections.roomsWithSomeone} />
        <Tile label="jogadores" value={stats.connections.playersNow} />
        <Tile label="espectadores" value={stats.connections.spectatorsNow} />
      </div>

      <h3>Desde que o servidor ligou</h3>
      <div className="stat-grid">
        <Tile label="rolagens retransmitidas" value={stats.rollsRelayedSinceBoot} />
        <Tile label="salas criadas" value={stats.rooms.createdSinceBoot} />
        <Tile label="jogadores que entraram" value={stats.connections.playersSinceBoot} />
        <Tile label="espectadores que entraram" value={stats.connections.spectatorsSinceBoot} />
        <Tile label="profiles criados" value={stats.profiles.createdSinceBoot} />
        <Tile label="profiles expurgados" value={stats.profiles.purgedSinceBoot} />
      </div>
      <p className="settings-hint">
        No ar há <strong>{formatUptime(stats.uptimeSeconds)}</strong>. Estes
        números são contados em memória e <strong>voltam a zero</strong> a cada
        reinício do servidor — servem pra ver a atividade recente, não como
        contabilidade.
      </p>

      <h3>Limites atingidos</h3>
      {stats.limitsHitSinceBoot.length === 0 ? (
        <p className="settings-hint">Nenhum limite atingido desde o último reinício.</p>
      ) : (
        <ul className="stat-limits">
          {stats.limitsHitSinceBoot.map((limite) => (
            <li key={limite.kind}>
              <span>{limitLabel(limite.kind)}</span>
              <strong>{limite.count}</strong>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Antes do primeiro dado chegar. "Carregando…" so quando ha MESMO uma
 * busca em voo — aba em segundo plano suspende o polling, e dizer que
 * carrega sem carregar e a armadilha de sempre deste projeto. */
function PrimeiraCarga({ stats }: { stats: ReturnType<typeof useServerStats> }) {
  if (stats.protected || !stats.online || stats.error !== null) return null;
  if (stats.loading) return <p className="settings-hint">Carregando…</p>;
  if (stats.paused) {
    return (
      <p className="settings-hint">
        Pausado enquanto esta aba está em segundo plano — volte pra ela e os
        números aparecem.
      </p>
    );
  }
  return null;
}

export function ServerStatsPanel({ open }: ServerStatsPanelProps) {
  const stats = useServerStats(open);
  const agora = useAgora(open && stats.fetchedAt !== null);

  return (
    <div className="settings-panel server-stats">
      <p className="settings-hint">
        Agregados públicos de <code>{apiBaseUrl().replace(/\/$/, "")}/stats</code>.
        Sem código de sala, apelido ou IP — só contagem.
      </p>

      {stats.protected && (
        <p className="stat-warning">
          Este servidor protege o status com token, então o painel não pode
          consultá-lo pelo navegador.
        </p>
      )}
      {!stats.online && (
        <p className="stat-warning">Sem rede — o painel volta a atualizar sozinho quando voltar.</p>
      )}
      {stats.error !== null && (
        <p className="stat-warning">
          Falha ao consultar o servidor: {stats.error}
          {stats.data !== null && " — os números abaixo são da última leitura."}
        </p>
      )}

      {stats.data === null ? (
        <PrimeiraCarga stats={stats} />
      ) : (
        <Numeros stats={stats.data} />
      )}

      <div className="stat-footer">
        <button
          type="button"
          className="button-ghost"
          onClick={stats.refresh}
          disabled={stats.loading || !stats.online || stats.protected}
        >
          {stats.loading ? "Atualizando…" : "Atualizar"}
        </button>
        {stats.fetchedAt !== null && (
          <span className="settings-hint">
            atualizado {formatAge(agora - stats.fetchedAt)}, sozinho a cada 20s
          </span>
        )}
      </div>
    </div>
  );
}
