# Factory do backend de DESENVOLVIMENTO: fakeredis (Redis) + sqlite em
# memoria (Postgres), espelhando tests/conftest.py. Entrypoint em
# scripts/dev_local.py.
#
# Por que mora dentro de `app/` e nao em `scripts/`: o reload do uvicorn
# exige import string, e o subprocesso do reloader precisa conseguir
# importar esse caminho. `scripts` nao esta no sys.path do subprocesso (e
# PYTHONPATH nao resolve sob `uv run`, que isola o ambiente), enquanto
# `app` e importavel por construcao.
#
# Nao e importado por app.main nem por nada que va pra producao — a imagem
# nem tem fakeredis instalado, e este modulo so e carregado quando o
# uvicorn recebe "app.dev:build_app" explicitamente.
import fakeredis.aioredis
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.db import make_session_factory
from app.main import create_app


def build_app() -> FastAPI:
    """Chamada pelo uvicorn a cada reload — dai o estado zerar sozinho."""
    engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)
    return create_app(
        settings=Settings(),
        redis_client=fakeredis.aioredis.FakeRedis(decode_responses=True),
        session_factory=make_session_factory(engine),
        engine=engine,
    )
