# App FastAPI (spec 02-backend-relay.md): relay burro de sala via WS +
# REST (criar sala, export, profiles custom). Ver docstring de app/rooms.py
# para o protocolo WS.
import asyncio
import contextlib
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app import profiles, rooms, stats
from app.config import Settings
from app.db import init_db, make_engine, make_session_factory
from app.limits import client_ip, within_limit
from app.logs import configure_logging, log
from app.profiles import purge_old_profiles
from app.redis import create_redis
from app.rooms import RoomStore
from app.stats import StatsCollector

RequestHandler = Callable[[Request], Awaitable[Response]]


def create_app(
    settings: Settings | None = None,
    redis_client: Redis | None = None,
    session_factory: async_sessionmaker[AsyncSession] | None = None,
    engine: AsyncEngine | None = None,
) -> FastAPI:
    """Factory da app. `redis_client`/`session_factory` injetaveis pra testes
    (fakeredis + sqlite async) sem monkeypatch."""
    settings = settings or Settings()
    redis_client = redis_client or create_redis(settings.redis_url)
    if session_factory is None:
        engine = make_engine(settings.postgres_dsn)
        session_factory = make_session_factory(engine)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        configure_logging()
        if engine is not None:
            await init_db(engine)
        purge_task = _start_profile_purge(settings, session_factory, app.state.stats)
        try:
            yield
        finally:
            if purge_task is not None:
                purge_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await purge_task

    app = FastAPI(title="rolai backend", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,  # nunca "*" em producao
        allow_methods=["GET", "POST"],
    )

    @app.middleware("http")
    async def guard(request: Request, call_next: RequestHandler) -> Response:
        """Duas barreiras antes de qualquer rota: tamanho de corpo e limite
        por IP (docs/security.md). /health fica de fora pra monitoramento
        nao ser bloqueado."""
        declared = request.headers.get("content-length")
        if declared is not None:
            try:
                if int(declared) > settings.max_body_bytes:
                    log.warning(
                        "event=payload_rejected reason=body_too_large ip=%s",
                        client_ip(request, settings.trust_proxy_headers),
                    )
                    return JSONResponse({"detail": "payload_too_large"}, status_code=413)
            except ValueError:
                return JSONResponse({"detail": "invalid_content_length"}, status_code=400)

        if request.url.path != "/health":
            ip = client_ip(request, settings.trust_proxy_headers)
            allowed = await within_limit(
                redis_client,
                f"rl:http:{ip}",
                settings.http_rate_limit_per_minute,
                60,
            )
            if not allowed:
                log.warning("event=rate_limited limit=http ip=%s", ip)
                return JSONResponse(
                    {"detail": "rate_limit_exceeded"},
                    status_code=429,
                    headers={"Retry-After": "60"},
                )
        response: Response = await call_next(request)
        return response

    app.state.settings = settings
    app.state.redis = redis_client
    app.state.room_store = RoomStore(redis_client, settings)
    app.state.session_factory = session_factory
    # Conexoes WS ativas por sala (em memoria — relay single-process).
    # Espectadores (modo stream/OBS) ficam em mapa separado: nao entram no
    # roster nem contam no teto de membros.
    app.state.room_connections = {}
    app.state.room_spectators = {}
    # Contadores de atividade desde o boot (GET /stats).
    app.state.stats = StatsCollector()

    app.include_router(rooms.router)
    app.include_router(profiles.router)
    app.include_router(stats.router)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


def _start_profile_purge(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
    collector: StatsCollector,
) -> asyncio.Task[None] | None:
    """Expurgo periodico de profiles custom (efemeros — docs/security.md).
    Roda uma vez no boot e depois a cada intervalo. Desligado com
    profile_ttl_days 0 ou profile_purge_interval_seconds 0."""
    if settings.profile_ttl_days <= 0 or settings.profile_purge_interval_seconds <= 0:
        return None

    async def _loop() -> None:
        while True:
            try:
                await purge_old_profiles(
                    session_factory, settings.profile_ttl_days, stats=collector
                )
            except Exception:  # noqa: BLE001 — task de fundo NAO pode morrer: qualquer
                # erro de banco e logado e o proximo ciclo tenta de novo.
                log.exception("event=profile_purge_failed")
            await asyncio.sleep(settings.profile_purge_interval_seconds)

    return asyncio.create_task(_loop())


app = create_app()
