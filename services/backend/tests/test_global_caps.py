# Bloco 2 (docs/security.md — "Abuso e recursos"): teto GLOBAL de salas
# ativas, expurgo/TTL de profiles custom e log estruturado de limites.
import asyncio
import logging
from collections.abc import Callable
from datetime import timedelta

import pytest
from fakeredis.aioredis import FakeRedis
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient

from app.db import Base, ProfileRow, make_session_factory, utcnow
from app.profiles import purge_old_profiles
from app.room_store import ACTIVE_ROOMS_KEY


async def _delete_key(redis_client: FakeRedis, key: str) -> None:
    await redis_client.delete(key)


async def _active_room_codes(redis_client: FakeRedis) -> set[str]:
    return {str(code) for code in await redis_client.smembers(ACTIVE_ROOMS_KEY)}


def test_global_room_cap_returns_503(make_client: Callable[..., TestClient]) -> None:
    """O limite por IP segura UM bot; o teto global segura o Redis quando
    varios IPs criam salas abaixo do limite individual. 503 (nao 429): e
    condicao de capacidade do servico, nao culpa deste cliente."""
    with make_client(max_active_rooms=2) as client:
        assert client.post("/rooms").status_code == 201
        assert client.post("/rooms").status_code == 201
        blocked = client.post("/rooms")
        assert blocked.status_code == 503
        assert blocked.headers["Retry-After"] == "3600"


def test_expired_room_frees_cap_slot(
    make_client: Callable[..., TestClient], redis_client: FakeRedis
) -> None:
    """A contagem segue o TTL da sala: sala expirada deixa de contar e a
    vaga abre (o set rooms:active e prunado na proxima criacao)."""
    with make_client(max_active_rooms=1) as client:
        code = client.post("/rooms").json()["code"]
        assert client.post("/rooms").status_code == 503
        # Simula a expiracao: a chave marcador da sala some do Redis.
        asyncio.run(_delete_key(redis_client, f"room:{code}"))
        assert client.post("/rooms").status_code == 201
        assert code not in asyncio.run(_active_room_codes(redis_client))


def test_room_cap_logs_warning(
    make_client: Callable[..., TestClient], caplog: pytest.LogCaptureFixture
) -> None:
    """Sem este log, um ataque esgotando o teto global seria invisivel."""
    with make_client(max_active_rooms=1) as client:
        assert client.post("/rooms").status_code == 201
        with caplog.at_level(logging.WARNING, logger="rolai"):
            assert client.post("/rooms").status_code == 503
    assert any("event=room_cap_reached" in record.getMessage() for record in caplog.records)


def test_rate_limit_logs_warning(
    make_client: Callable[..., TestClient], caplog: pytest.LogCaptureFixture
) -> None:
    with make_client(room_create_limit_per_hour=1) as client:
        assert client.post("/rooms").status_code == 201
        with caplog.at_level(logging.WARNING, logger="rolai"):
            assert client.post("/rooms").status_code == 429
    assert any(
        "event=rate_limited limit=room_create" in record.getMessage()
        for record in caplog.records
    )


def test_purge_removes_only_profiles_older_than_ttl(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Expurgo roda com clock controlado (a funcao direto, sem esperar o
    intervalo da task): profile velho sai, recente fica."""

    async def scenario() -> int:
        engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)
        session_factory = make_session_factory(engine)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with session_factory() as session:
            session.add_all(
                [
                    ProfileRow(
                        id="a" * 32,
                        system="old",
                        data={},
                        created_at=utcnow() - timedelta(days=31),
                    ),
                    ProfileRow(id="b" * 32, system="new", data={}),
                ]
            )
            await session.commit()
        with caplog.at_level(logging.INFO, logger="rolai"):
            removed = await purge_old_profiles(session_factory, ttl_days=30)
        async with session_factory() as session:
            assert await session.get(ProfileRow, "a" * 32) is None
            assert await session.get(ProfileRow, "b" * 32) is not None
        return removed

    assert asyncio.run(scenario()) == 1
    assert any(
        "event=profiles_purged removed=1" in record.getMessage() for record in caplog.records
    )


def test_purge_disabled_with_zero_ttl_keeps_everything() -> None:
    async def scenario() -> int:
        engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)
        session_factory = make_session_factory(engine)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with session_factory() as session:
            session.add(
                ProfileRow(
                    id="a" * 32, system="old", data={}, created_at=utcnow() - timedelta(days=3650)
                )
            )
            await session.commit()
        return await purge_old_profiles(session_factory, ttl_days=0)

    assert asyncio.run(scenario()) == 0
