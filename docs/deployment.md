# Deploy

Dois alvos suportados desde o início — mesma imagem Docker do backend, só
muda o compose file e como o roteamento HTTP é resolvido.

## Hostinger VPS (atrás do Traefik já existente)

`infra/docker-compose.hostinger.yml` não sobe Traefik de novo — só anexa
labels no Traefik que já roda no VPS (mesmo padrão dos outros serviços de
lá: Savestate, Whishper, Hermes).

```bash
docker compose --env-file .env -f infra/docker-compose.yml \
                              -f infra/docker-compose.hostinger.yml \
                              up -d
```

O `--env-file .env` é necessário ao rodar da raiz do repo: o compose procura
`.env` por padrão no diretório do projeto (a pasta do primeiro `-f`, ou seja
`infra/`). Alternativa: copiar o `.env` para `infra/.env` e omitir a flag.

Variáveis esperadas em `.env` (ver `.env.example`):

- `ROLAI_WEB_HOST` — domínio do app (produção: `rolai.app`)
- `ROLAI_BACKEND_HOST` — subdomínio do relay (produção: `api.rolai.app`)
- `LETSENCRYPT_RESOLVER` — nome do resolver ACME já configurado no Traefik
  (no VPS atual: `letsencrypt`)

Não há `TRAEFIK_NETWORK`: o Traefik do VPS roda em **rede host**, e de lá
alcança o IP de bridge de qualquer container do host. Cada app fica na
própria rede default do seu compose — mesmo padrão dos outros serviços já
rodando lá. O provider está com `exposedbydefault=false`, então só entra no
Traefik quem tem `traefik.enable=true` (o override já põe).

Frontend (`apps/web`) sobe no **mesmo compose**, como imagem própria (nginx
servindo o build estático) atrás do mesmo Traefik: **rolai.app** pro app e
**api.rolai.app** pro relay. A URL do backend é resolvida em runtime pelo
container (ver a seção do GHCR abaixo) — não é variável de build, então a
mesma imagem serve qualquer ambiente.

Não esquecer de liberar a origem do frontend no backend
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

### O domínio é `.app` — o que isso muda

`.app` está na **lista de HSTS preload** embutida nos navegadores: eles se
recusam a falar HTTP com o domínio, antes mesmo de qualquer resposta do
servidor. Consequências práticas:

- **TLS válido é pré-requisito, não polimento.** Sem certificado o site
  simplesmente não abre — não existe "acessa por http enquanto configuro".
  O Traefik com Let's Encrypt resolve, mas o DNS precisa estar apontando
  antes, senão o desafio ACME falha.
- O redirect http -> https já vem do próprio Traefik, no nível do
  entrypoint (`entrypoints.web.http.redirections`), então o override não
  precisa declarar router de porta 80.
- O `Strict-Transport-Security` que já mandamos (`rolai-headers`) continua
  valendo pra subdomínios — `api.rolai.app` incluído.

DNS: dois registros A (ou CNAME) apontando pro VPS — `rolai.app` e
`api.rolai.app`.

## Deploy na Hostinger (imagens do GHCR)

O CI publica as imagens a cada push no `main` e a cada tag
(`.github/workflows/images.yml`), então **nada compila no servidor**:

```bash
# no VPS, na pasta do projeto (só o infra/ e o .env precisam estar lá)
docker compose -f infra/docker-compose.yml -f infra/docker-compose.hostinger.yml pull
docker compose -f infra/docker-compose.yml -f infra/docker-compose.hostinger.yml up -d
```

`.env` precisa de: `POSTGRES_PASSWORD` (obrigatória, sem default),
`ROLAI_WEB_HOST`, `ROLAI_BACKEND_HOST`,
`LETSENCRYPT_RESOLVER`, `CORS_ORIGINS` (a origem do front, para CORS **e**
para a checagem de Origin do WebSocket) e `TRUST_PROXY_HEADERS=true` (o
override de Hostinger já define). `ROLAI_TAG` fixa a versão das imagens —
`latest` segue o `main`, ou aponte para `v0.1.0`.

A URL do backend é **runtime**, não build: o entrypoint do container escreve
`/config.js` a partir de `ROLAI_WS_URL` (e `ROLAI_API_URL`, opcional) a cada
start, e o app lê isso antes do bundle. Trocar de domínio é trocar a env e
reiniciar — a imagem publicada é a mesma pra qualquer ambiente.

Cuidado ao mexer nisso: o `config.js` fica **fora do precache** do service
worker (`globIgnores` no `vite.config.ts`). Se entrar no precache, o SW passa
a servir a versão do build e a env do container deixa de valer.

Imagens: `ghcr.io/sergiosjs/rolai-backend` e `ghcr.io/sergiosjs/rolai-web`.

