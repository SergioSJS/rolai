# Deploy

Dois alvos suportados desde o início — mesma imagem Docker do backend, só
muda o compose file e como o roteamento HTTP é resolvido.

## Hostinger VPS (atrás do Traefik já existente)

`infra/docker-compose.hostinger.yml` assume que já existe uma rede externa
do Traefik (mesmo padrão usado por outros serviços já rodando no VPS, ex.
Savestate/Whishper). Não sobe Traefik de novo — só anexa labels.

```bash
docker compose --env-file .env -f infra/docker-compose.yml \
                              -f infra/docker-compose.hostinger.yml \
                              up -d
```

O `--env-file .env` é necessário ao rodar da raiz do repo: o compose procura
`.env` por padrão no diretório do projeto (a pasta do primeiro `-f`, ou seja
`infra/`). Alternativa: copiar o `.env` para `infra/.env` e omitir a flag.

Variáveis esperadas em `.env` (ver `.env.example`):

- `TRAEFIK_NETWORK` — nome da rede externa do Traefik já em uso
- `ROLAI_BACKEND_HOST` — subdomínio do relay (produção: `api.rolai.app`)
- `LETSENCRYPT_RESOLVER` — nome do resolver ACME já configurado no Traefik

Frontend (`apps/web`) é um build estático, servido de qualquer lugar. Em
produção ele vive em **rolai.app** (Cloudflare Pages ou similar, DNS na
Cloudflare), com a variável de build `VITE_WS_URL=wss://api.rolai.app`
apontando pro backend — que roda no VPS Hostinger atrás do Traefik em
**api.rolai.app**. Não esquecer de liberar a origem do frontend no backend
(`CORS_ORIGINS=["https://rolai.app"]`), senão o WebSocket é recusado na
checagem de `Origin` (ver `docs/security.md`).

## ZimaOS / CasaOS

`infra/docker-compose.casaos.yml` segue o formato de compose que o CasaOS
importa diretamente (App Store customizado ou "Instalar via compose").
Diferenças do compose de Hostinger:

- Sem labels de Traefik — CasaOS gerencia porta exposta diretamente.
- Volumes usando os paths padrão de dados do CasaOS (`/DATA/AppData/...`)
  em vez de volumes nomeados Docker genéricos.
- `infra/casaos/` traz o manifest (`app.json` equivalente) pro catálogo
  MeioOrc-Apps, seguindo o mesmo padrão já usado pra LightRAG/CronMaster.

```bash
# via CasaOS UI: Import via docker-compose, colar infra/docker-compose.casaos.yml
# ou via CLI, se preferir:
docker compose --env-file .env -f infra/docker-compose.yml \
                              -f infra/docker-compose.casaos.yml \
                              up -d
```

`POSTGRES_PASSWORD` é obrigatória (sem default, de propósito — ver
`docs/security.md`). No import via UI do CasaOS, defina a variável no
próprio compose colado (ou no `.env` do app na UI); via CLI, ela vem do
`.env` passado em `--env-file`.

## Redis e Postgres

Ambos os alvos usam os mesmos serviços do `infra/docker-compose.yml` base
(sem overrides específicos) — só o roteamento HTTP externo muda entre os
dois ambientes. Isso é intencional: manter a topologia de dados idêntica
entre Hostinger e homelab facilita mover uma sala de um ambiente pro outro
se precisar no futuro.

## Escala

Em nenhum dos dois alvos há necessidade de múltiplas réplicas do backend
pro volume de uso esperado (mesa de RPG, poucas salas simultâneas). Se
algum dia isso mudar, o pub/sub do Redis já é a peça que permitiria
múltiplas instâncias do backend compartilhando broadcast — não precisa de
mudança de arquitetura, só de compose.

## Deploy na Hostinger (imagens do GHCR)

O CI publica as imagens a cada push no `main` e a cada tag
(`.github/workflows/images.yml`), então **nada compila no servidor**:

```bash
# no VPS, na pasta do projeto (só o infra/ e o .env precisam estar lá)
docker compose -f infra/docker-compose.yml -f infra/docker-compose.hostinger.yml pull
docker compose -f infra/docker-compose.yml -f infra/docker-compose.hostinger.yml up -d
```

`.env` precisa de: `POSTGRES_PASSWORD` (obrigatória, sem default),
`ROLAI_WEB_HOST`, `ROLAI_BACKEND_HOST`, `TRAEFIK_NETWORK`,
`LETSENCRYPT_RESOLVER`, `CORS_ORIGINS` (a origem do front, para CORS **e**
para a checagem de Origin do WebSocket) e `TRUST_PROXY_HEADERS=true` (o
override de Hostinger já define). `ROLAI_TAG` fixa a versão das imagens —
`latest` segue o `main`, ou aponte para `v0.1.0`.

Detalhe que morde: a URL do backend é **inlinada no bundle** pelo Vite em
tempo de build. Trocar de domínio exige rebuildar a imagem `web` com o novo
`VITE_WS_URL` (é uma repository variable no GitHub), não basta reiniciar o
container.

Imagens: `ghcr.io/sergiosjs/rolai-backend` e `ghcr.io/sergiosjs/rolai-web`.

