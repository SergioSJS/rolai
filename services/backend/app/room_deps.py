# Acessores do estado montado no lifespan (app/main.py). Ficavam em
# rooms.py, mas os quatro modulos de sala precisam deles — deixar num
# arquivo so evita import circular e diz de onde vem cada coisa.
from typing import TYPE_CHECKING

from fastapi import Request, WebSocket
from redis.asyncio import Redis

from app.config import Settings
from app.room_store import RoomStore

if TYPE_CHECKING:
    from app.stats import StatsCollector


def _settings_of(request_or_ws: Request | WebSocket) -> Settings:
    settings: Settings = request_or_ws.app.state.settings
    return settings


def _store_of(request_or_ws: Request | WebSocket) -> RoomStore:
    store: RoomStore = request_or_ws.app.state.room_store
    return store


def _redis_of(request_or_ws: Request | WebSocket) -> Redis:
    redis: Redis = request_or_ws.app.state.redis
    return redis


def _stats_of(request_or_ws: Request | WebSocket) -> "StatsCollector":
    """Contadores de /stats. Import so em type-check pra manter este modulo
    livre de app.stats — ele e importado por todo mundo aqui."""
    collector: StatsCollector = request_or_ws.app.state.stats
    return collector
