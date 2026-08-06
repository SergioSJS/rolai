# Sobe o backend localmente SEM docker: fakeredis (Redis) + sqlite em
# memoria (Postgres), espelhando tests/conftest.py. Serve pra validar o
# fluxo de sala fim-a-fim com o frontend (`npm run dev` em apps/web) quando
# nao ha infra disponivel. Estado e perdido ao reiniciar — so pra dev.
#
# Uso: uv run python scripts/dev_local.py
import fakeredis.aioredis
import uvicorn
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.db import make_session_factory
from app.main import create_app


def main() -> None:
    engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)
    app = create_app(
        settings=Settings(),
        redis_client=fakeredis.aioredis.FakeRedis(decode_responses=True),
        session_factory=make_session_factory(engine),
        engine=engine,
    )
    # 8420: mesma porta exposta no compose CasaOS (docs/deployment.md).
    uvicorn.run(app, host="127.0.0.1", port=8420)


if __name__ == "__main__":
    main()
