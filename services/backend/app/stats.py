# Metricas basicas em memoria (endpoint GET /stats — ver docs/security.md).
#
# O relay e single-process por decisao de arquitetura (docs/architecture.md),
# entao contadores em memoria bastam — mas ZERAM a cada restart do processo.
# Aceitavel: sao sinais de atividade recente ("esta sendo atacado AGORA?"),
# nao contabilidade. A trilha detalhada continua sendo o log estruturado
# (app/logs.py); aqui so agregados — NADA por sala, jogador ou IP.
import hmac
import time
from collections.abc import Callable

from fastapi import APIRouter, HTTPException, Request

from app.config import Settings
from app.room_store import ACTIVE_ROOMS_KEY

router = APIRouter()


class StatsCollector:
    """Contadores desde o boot do processo, incrementados nos mesmos pontos
    em que o log estruturado e emitido. Gauges (salas ativas, conexoes
    abertas AGORA) nao ficam aqui: sao lidos sob demanda das fontes de
    verdade (Redis e app.state) pelo endpoint."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._started = clock()
        self.rooms_created = 0
        self.rolls_relayed = 0
        self.profiles_created = 0
        self.profiles_purged = 0
        self.ws_opened_players = 0
        self.ws_opened_spectators = 0
        # Limites e rejeicoes por tipo, com as mesmas labels do log
        # ("room_create", "room_cap", "ws_connect", "invalid_json", ...).
        self.limits_hit: dict[str, int] = {}

    def limit_hit(self, kind: str) -> None:
        self.limits_hit[kind] = self.limits_hit.get(kind, 0) + 1

    def ws_opened(self, spectator: bool) -> None:
        if spectator:
            self.ws_opened_spectators += 1
        else:
            self.ws_opened_players += 1

    def uptime_seconds(self) -> int:
        return int(self._clock() - self._started)


@router.get("/stats")
async def read_stats(request: Request) -> dict[str, object]:
    """Agregados de atividade. NADA identificavel: sem codigo de sala, sem
    apelido, sem IP — so contagem. Com `STATS_TOKEN` definido, exige
    `Authorization: Bearer <token>`; sem token, o endpoint e aberto (os
    numeros nao expoem ninguem, mas revelam o volume da instancia)."""
    settings: Settings = request.app.state.settings
    if settings.stats_token:
        header = request.headers.get("authorization", "")
        expected = f"Bearer {settings.stats_token}"
        # compare_digest evita vazar o tamanho/prefixo do token pelo tempo.
        if not hmac.compare_digest(header, expected):
            raise HTTPException(status_code=401, detail="token invalido")

    stats: StatsCollector = request.app.state.stats
    connections: dict[str, dict[str, object]] = request.app.state.room_connections
    spectators: dict[str, dict[str, object]] = request.app.state.room_spectators
    # Gauges vem da fonte de verdade na hora da leitura, nao de contador
    # proprio (que dessincroniza quando uma conexao cai sem passar pelo
    # finally).
    active_rooms = int(await request.app.state.redis.scard(ACTIVE_ROOMS_KEY))
    # Uma sala aparece nos DOIS mapas (room_ws faz setdefault em ambos ao
    # admitir qualquer conexao), entao somar os tamanhos contava a mesma sala
    # duas vezes. Uniao das chaves com gente dentro, ignorando mapa vazio.
    rooms_with_someone = {code for code, members in connections.items() if members} | {
        code for code, members in spectators.items() if members
    }
    return {
        "uptime_seconds": stats.uptime_seconds(),
        "rooms": {
            "active": active_rooms,
            "created_since_boot": stats.rooms_created,
        },
        "connections": {
            "players_now": sum(len(v) for v in connections.values()),
            "spectators_now": sum(len(v) for v in spectators.values()),
            "rooms_with_someone": len(rooms_with_someone),
            "players_since_boot": stats.ws_opened_players,
            "spectators_since_boot": stats.ws_opened_spectators,
        },
        "rolls_relayed_since_boot": stats.rolls_relayed,
        "profiles": {
            "created_since_boot": stats.profiles_created,
            "purged_since_boot": stats.profiles_purged,
        },
        # Sinal de "estao batendo na porta agora" — as chaves sao as mesmas
        # labels do log estruturado.
        "limits_hit_since_boot": dict(stats.limits_hit),
    }
