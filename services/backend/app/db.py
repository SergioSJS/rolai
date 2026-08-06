# Persistencia de profiles custom no Postgres via SQLAlchemy async.
# (SQLite async nos testes — ver tests/conftest.py.)
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    """UTC naive: DateTime sem timezone e o tipo portavel entre sqlite e
    Postgres (ambos devolvem datetime naive por default), entao tudo —
    gravacao e comparacao de expurgo — usa este relogio."""
    return datetime.now(UTC).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class ProfileRow(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    system: Mapped[str] = mapped_column(String(64), index=True)
    # Profile completo ja validado (schemas.CustomProfile) serializado em JSON.
    data: Mapped[dict[str, object]] = mapped_column(JSON)
    # Profile custom e EFEMERO: o expurgo periodico (app/main.py) remove
    # linhas mais velhas que settings.profile_ttl_days (docs/security.md).
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


def make_engine(dsn: str) -> AsyncEngine:
    return create_async_engine(dsn)


def make_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


async def init_db(engine: AsyncEngine) -> None:
    """Cria as tabelas se nao existirem (MVP — sem migrations por ora)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
