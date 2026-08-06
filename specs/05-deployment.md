# 05 — deployment e CI

## Objetivo

Compose files funcionando pros dois alvos (Hostinger + ZimaOS/CasaOS) e
pipeline de CI cobrindo lint, teste e scan de dependência das etapas
anteriores.

## Escopo

- Validar `infra/docker-compose.yml` (base) + overrides de Hostinger e
  CasaOS de fato sobem backend + Redis + Postgres funcionando nos dois
  ambientes (ver `docs/deployment.md`).
- CI (`.github/workflows/ci.yml`): já existe um esqueleto rodando lint +
  teste de cada pacote — validar que cobre `rules-engine`, `backend`, e
  `web`, e adicionar o scan de dependência (`pip-audit`, `npm audit`)
  falhando em severidade alta.
- Manifest CasaOS em `infra/casaos/` completo o suficiente pra importar
  no MeioOrc-Apps catalog.

## Critérios de aceite

- `docker compose -f infra/docker-compose.yml -f infra/docker-compose.hostinger.yml up` sobe limpo localmente (mesmo sem Traefik real — validar que não quebra por falta das labels).
- `docker compose -f infra/docker-compose.yml -f infra/docker-compose.casaos.yml up` sobe limpo localmente.
- CI verde cobrindo todos os pacotes tocados até aqui.
