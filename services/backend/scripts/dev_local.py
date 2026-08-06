# Sobe o backend localmente SEM docker: fakeredis (Redis) + sqlite em
# memoria (Postgres), espelhando tests/conftest.py. Serve pra validar o
# fluxo de sala fim-a-fim com o frontend (`npm run dev` em apps/web) quando
# nao ha infra disponivel. Estado e perdido a cada reload — so pra dev.
#
# Uso: uv run python scripts/dev_local.py
#
# RECARREGA sozinho ao salvar arquivo em app/. Antes nao recarregava, e o
# efeito era pior do que parece: o processo seguia servindo codigo ANTIGO em
# silencio, entao uma correcao ja aplicada continuava "nao funcionando" no
# navegador. Custou uma sessao inteira de diagnostico.
#
# A factory vive em app/dev.py: reload exige import string (com objeto o
# uvicorn desliga o reload sem avisar), e o subprocesso do reloader so
# consegue importar o que estiver no sys.path dele — `app` esta, `scripts`
# nao (e PYTHONPATH nao resolve sob `uv run`, que isola o ambiente).
import uvicorn

# 8420: mesma porta exposta no compose CasaOS (docs/deployment.md).
DEV_PORT = 8420


def main() -> None:
    uvicorn.run(
        "app.dev:build_app",
        factory=True,
        host="127.0.0.1",
        port=DEV_PORT,
        reload=True,
        # So o que e nosso: sem isto o watcher varre o .venv inteiro.
        reload_dirs=["app"],
    )


if __name__ == "__main__":
    main()
