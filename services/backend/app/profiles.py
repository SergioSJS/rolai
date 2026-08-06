# CRUD de profiles custom (spec 02-backend-relay.md).
# Valida contra schemas.CustomProfile (espelho de docs/system-profiles.md)
# ANTES de persistir — nunca aceita dict/YAML arbitrario. O backend nao
# avalia `condition` (isso e do rules-engine TS); so valida a estrutura.
# Profile custom e EFEMERO: purge_old_profiles remove os antigos (ver
# docs/security.md, "Abuso e recursos").
import uuid
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import delete
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.db import ProfileRow, utcnow
from app.limits import client_ip, within_limit
from app.logs import log
from app.schemas import CustomProfile, StoredProfile

if TYPE_CHECKING:
    from app.stats import StatsCollector

router = APIRouter()


def _session_factory(request: Request) -> async_sessionmaker[AsyncSession]:
    factory: async_sessionmaker[AsyncSession] = request.app.state.session_factory
    return factory


@router.post("/profiles", status_code=201)
async def create_profile(profile: CustomProfile, request: Request) -> StoredProfile:
    # Profile custom vai pro Postgres e fica la ate o expurgo (efemero — ver
    # purge_old_profiles): teto por IP pra um bot nao encher o disco entre um
    # expurgo e outro — ver docs/security.md.
    settings: Settings = request.app.state.settings
    ip = client_ip(request, settings.trust_proxy_headers)
    if not await within_limit(
        request.app.state.redis,
        f"rl:profiles:{ip}",
        settings.profile_create_limit_per_hour,
        3600,
    ):
        log.warning("event=rate_limited limit=profile_create ip=%s", ip)
        request.app.state.stats.limit_hit("profile_create")
        raise HTTPException(
            status_code=429,
            detail="limite de criacao de profiles excedido",
            headers={"Retry-After": "3600"},
        )
    row = ProfileRow(
        id=uuid.uuid4().hex,
        system=profile.system,
        data=profile.model_dump(mode="json"),
    )
    async with _session_factory(request)() as session:
        session.add(row)
        await session.commit()
    log.info("event=profile_created id=%s system=%s ip=%s", row.id, row.system, ip)
    request.app.state.stats.profiles_created += 1
    return StoredProfile(id=row.id, profile=profile)


async def purge_old_profiles(
    session_factory: async_sessionmaker[AsyncSession],
    ttl_days: int,
    now: datetime | None = None,
    stats: "StatsCollector | None" = None,
) -> int:
    """Remove profiles custom com mais de `ttl_days` dias. Retorna quantos
    sairam. `now` injetavel pra teste rodar com clock controlado em vez de
    esperar o intervalo da task."""
    if ttl_days <= 0:
        return 0
    cutoff = (now or utcnow()) - timedelta(days=ttl_days)
    async with session_factory() as session:
        result = await session.execute(delete(ProfileRow).where(ProfileRow.created_at < cutoff))
        await session.commit()
    # DELETE via ORM sempre devolve CursorResult — so ele expoe rowcount.
    assert isinstance(result, CursorResult)
    removed = result.rowcount
    log.info("event=profiles_purged removed=%d ttl_days=%d", removed, ttl_days)
    if stats is not None:
        stats.profiles_purged += removed
    return removed


@router.get("/profiles/{profile_id}")
async def get_profile(profile_id: str, request: Request) -> StoredProfile:
    async with _session_factory(request)() as session:
        row = await session.get(ProfileRow, profile_id)
    if row is None:
        raise HTTPException(status_code=404, detail="profile nao encontrado")
    return StoredProfile(id=row.id, profile=CustomProfile.model_validate(row.data))
