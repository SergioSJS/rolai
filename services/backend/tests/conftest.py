# Fixtures: app de teste com fakeredis (Redis) e sqlite async (Postgres),
# sem infra real. O client e o TestClient do starlette (roda o lifespan,
# que cria as tabelas no sqlite em memoria).
from collections.abc import Callable, Iterator

import pytest
from fakeredis.aioredis import FakeRedis
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient

from app.config import Settings
from app.db import make_session_factory
from app.main import create_app


@pytest.fixture
def redis_client() -> FakeRedis:
    return FakeRedis(decode_responses=True)


@pytest.fixture
def make_client(redis_client: FakeRedis) -> Callable[..., TestClient]:
    """Factory de TestClient com settings customizaveis por teste."""

    def _make(**settings_overrides: object) -> TestClient:
        settings = Settings(room_ttl_seconds=3600, **settings_overrides)  # type: ignore[arg-type]
        engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)
        app = create_app(
            settings=settings,
            redis_client=redis_client,
            session_factory=make_session_factory(engine),
            engine=engine,
        )
        return TestClient(app)

    return _make


@pytest.fixture
def client(make_client: Callable[..., TestClient]) -> Iterator[TestClient]:
    with make_client() as test_client:
        yield test_client


def make_roll_message(notation: str = "2d6", total: int = 6) -> dict[str, object]:
    return {
        "type": "roll",
        "result": {
            "notation": notation,
            "groups": {"roll": {"rolls": [2, 4], "total": total}},
            "timestamp": "2026-01-01T00:00:00Z",
        },
    }
