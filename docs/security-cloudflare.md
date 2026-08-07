# Cloudflare na frente do Rolaí — o que muda na segurança

Doc de handoff para quem for ligar a **nuvem laranja** (proxy da Cloudflare)
no `rolai.app`. Complementa `docs/security.md`, que descreve o modelo atual —
leia aquele primeiro. Aqui só o que a Cloudflare quebra, o que ela ganha, e o
que precisa mudar no código antes.

Estado de hoje: **laranja ativa nos dois domínios** (migração concluída em
2026-08-06 — a "Ordem de execução" registra o passo a passo seguido).
`client_ip()` prefere `CF-Connecting-IP`, o WebSocket tem heartbeat, o
rate limit de borda usa `requestHeaderName=CF-Connecting-IP` e os dois
routers têm `ipAllowList` com os ranges da CF.

## Topologia atual

```
navegador ──TLS──> Cloudflare (borda) ──TLS Full(strict)──> Traefik (rede host, VPS Hostinger) ──> rolai-web   (nginx)
                                                              ▲                                └──> rolai-backend (FastAPI)
                                                              └── só os ranges da CF passam (ipAllowList nos routers do rolai)
```

- `rolai.app` — app estático (PWA)
- `api.rolai.app` — REST + WebSocket da sala
- Traefik: `providers.docker` com `exposedbydefault=false`, resolver ACME
  `letsencrypt` por **HTTP-01** no entrypoint `web`, e redirect global
  `web -> websecure`.
- O compose de Hostinger não declara rede: o Traefik roda em **rede host** e
  alcança o IP de bridge dos containers (`infra/docker-compose.hostinger.yml`).

## O que a laranja dá

- Esconde o IP de origem (hoje `dig rolai.app` entrega o IP do VPS).
- Absorve DDoS volumétrico (L3/L4) — grátis e ilimitado no plano free.
- CDN do estático: o precache da PWA passa de 3 MB.
- Botões de emergência: "Under Attack", bot fight, WAF, rate limit de borda.

## O que ela quebra — e o conserto

### 1. O limite por IP vira contornável (o mais grave)

O código original de `services/backend/app/limits.py:client_ip()` pegava o
**primeiro** item de `X-Forwarded-For`:

```python
forwarded = source.headers.get("x-forwarded-for")
first = forwarded.split(",")[0].strip()
```

Isso era **correto** com só o Traefik na frente: quem escreve o header é o
proxy, e o primeiro item é o cliente real.

Com a Cloudflare no caminho deixa de ser: a CF **anexa** o IP real ao
`X-Forwarded-For` que o cliente mandou. Quem enviar
`X-Forwarded-For: 1.2.3.4` na mão faz o backend contar o limite no IP falso —
e escapa de `room_create_limit_per_hour`, `ws_connect_limit_per_minute` e
`http_rate_limit_per_minute` de uma vez.

**Conserto (IMPLEMENTADO):** `client_ip()` lê `CF-Connecting-IP` antes do
`X-Forwarded-For`, mantendo `trust_proxy_headers` como está — a Cloudflare
**sobrescreve** esse header sempre, ignorando o que o cliente mandar. A
preferência é segura mesmo antes da laranja: sem CF no caminho o header não
vem e o código cai no caminho antigo; e um atacante que alcança o VPS
direto forja um header ou outro com o mesmo esforço (ou seja, nada piora
na transição). Coberto por teste
(`tests/test_limits.py::test_cf_connecting_ip_takes_precedence_over_x_forwarded_for`).

**Não basta.** `CF-Connecting-IP` também é forjável por quem alcançar o VPS
direto, pulando a CF. Duas defesas:

- **Traefik `ipAllowList`** nos ranges da CF nos dois routers do rolai
  (`rolai-cfonly` no `infra/docker-compose.hostinger.yml`). Foi a escolha
  deste deploy: o VPS hospeda outros sites fora da Cloudflare, e firewall
  global em 80/443 derrubaria eles.
- **Firewall no VPS** (80/443 só dos ranges de
  `https://www.cloudflare.com/ips/`) — mais forte (camada de rede), mas só
  cabe se **tudo** no VPS estiver atrás da CF.
- Complemento opcional: `forwardedHeaders.trustedIPs` com os ranges da CF na
  config estática do Traefik, pro `X-Forwarded-For` voltar a ser íntegro
  (logs e usos futuros).

Sem pelo menos uma das duas primeiras, trocar `X-Forwarded-For` por
`CF-Connecting-IP` só troca um header forjável por outro.

### 2. Rate limit de borda do Traefik

`infra/docker-compose.hostinger.yml` usa:

```
traefik.http.middlewares.rolai-ratelimit.rateLimit.sourceCriterion.ipStrategy.depth=1
```

`depth=1` conta a partir da direita do `X-Forwarded-For`. Com uma camada a
mais na frente, a profundidade muda e o limite passa a agrupar gente errada
(no pior caso, todo mundo no mesmo balde). Trocar por:

```
traefik.http.middlewares.rolai-ratelimit.rateLimit.sourceCriterion.requestHeaderName=CF-Connecting-IP
```

A label nova já está no `infra/docker-compose.hostinger.yml`, comentada,
com as instruções de troca (bloco "MODO LARANJA"). **Não descomentar antes
da laranja no api**: em cinza nenhuma requisição traz o header e o rate
limit de borda agruparia todo mundo num balde só.

### 3. WebSocket ocioso morre (~100s) — RESOLVIDO

A Cloudflare fecha conexão WebSocket parada. O risco era duplo: mesa ociosa
reconectando a cada ~2 min (chato) e cada reconexão comendo cota de
`ws_connect_limit_per_minute` — o limite de abuso punindo uso normal.

**Heartbeat implementado** (app-level, não frame de protocolo — o Starlette
não expõe ping/pong de baixo nível):

- Backend (`rooms.py`): a cada `ws_heartbeat_seconds` (default 30, 0 desliga)
  sem mensagem do cliente, envia `{"type":"ping"}`. O envio fica na mesma
  task do receive (via `asyncio.wait_for`), sem writer concorrente no socket.
- Cliente web (`apps/web/src/room/client.ts`) e Android
  (`apps/android/.../RoomClient.kt`) respondem `{"type":"pong"}`; o backend
  consome o pong em silêncio (não é rolagem, não gera erro).
- Cliente antigo que ignore o ping não quebra: o ping sozinho já reseta o
  timer ocioso da CF.

**Verificado em produção (2026-08-06)**, com um espectador ocioso ligado em
`wss://api.rolai.app` atravessando a Cloudflare laranja:

```
[  0s] snapshot
[ 19s] ping de PROTOCOLO (opcode 0x9)  -> pong automatico
[ 30s] ping de APLICACAO {"type":"ping"} -> {"type":"pong"}
[ 60s] ping de APLICACAO
[ 90s] ping de APLICACAO
[120s] ping de APLICACAO
conexao VIVA aos 139s
```

**Duas camadas de keepalive, não uma** — e isso importa para quem escrever
cliente que não seja navegador:

1. **Protocolo** (RFC 6455, opcode 0x9/0xA), a cada ~20s, vindo da
   infraestrutura. Navegador e OkHttp respondem **sozinhos**. Um cliente cru
   que ignore esse frame é derrubado em ~40s, mesmo com o heartbeat de
   aplicação funcionando — foi exatamente o que aconteceu na primeira
   tentativa deste teste.
2. **Aplicação** (`{"type":"ping"}`), a cada `ws_heartbeat_seconds`, que é o
   que este projeto controla.

Ou seja: se um cliente novo cair sozinho depois de ~40s ociosos, suspeite do
pong de protocolo antes de mexer no heartbeat de aplicação.

Com isso o `api.rolai.app` **pode** ir pra laranja — a recomendação anterior
de mantê-lo em cinza não se aplica mais.

### 4. Cache de borda

- `config.js` — **crítico**. Escrito pelo entrypoint a cada start com a URL do
  backend (`infra/web-entrypoint.sh`). Já sai com
  `Cache-Control: no-cache, no-store, must-revalidate` no `infra/nginx.conf`;
  a CF respeita. **Não mexer nisso**: se cachear, trocar de domínio no `.env`
  deixa de fazer efeito sem sintoma claro.
- `/assets/` tem hash no nome — `immutable` de um ano, pode cachear à vontade.
- `/.well-known/assetlinks.json` — `max-age=300` e fora do fallback de SPA
  (dá 404 honesto se sumir, em vez de 200 com HTML). Se a CF cachear demais,
  a validação da TWA fica presa numa versão velha após troca de chave.
- `sw.js` — `no-store`. Se cachear, o app fica preso numa versão antiga.

### 5. TLS

Modo SSL/TLS **Full (strict)**, nunca "Flexible" (fala HTTP com a origem).

Ovo-e-galinha do ACME: o certificado da origem **já existe** (Let's Encrypt
via Traefik), então ligar a laranja agora não quebra nada. A atenção é pra
reemissão do zero (cert expirado ou VPS novo): com laranja + "Always Use
HTTPS", o desafio HTTP-01 é redirecionado pra um HTTPS onde o Traefik ainda
não tem cert válido e a emissão pode falhar. **Ordem segura:** cinza →
certificado emitido → só então laranja.

`.app` está na lista de **HSTS preload**: o navegador nunca tenta HTTP. TLS
válido é pré-requisito, não polimento.

## O que NÃO muda

- Checagem de `Origin` no WS (`rooms.py`, close **4403**) — a CF repassa o
  header. `CORS_ORIGINS` continua valendo pro CORS **e** pro WS.
- Trust model da rolagem: o backend não recalcula (`docs/architecture.md`).
- Códigos de sala aleatórios, validação Pydantic, tetos de sala e de memória.

## Ordem de execução

**Estado em 2026-08-06: migração concluída.** Laranja ativa nos dois
domínios, `requestHeaderName=CF-Connecting-IP` no rate limit de borda e
`ipAllowList` (`rolai-cfonly`) nos dois routers. O firewall ficou de fora
de propósito: o VPS hospeda outros sites fora da Cloudflare. A lista
abaixo fica como referência caso seja preciso refazer do zero:

1. **Deploy do código novo** (heartbeat + `CF-Connecting-IP`): push no
   `main`, o CI publica as imagens, e no VPS
   `docker compose -f infra/docker-compose.yml -f infra/docker-compose.hostinger.yml pull && up -d`
   (ver `docs/deployment.md`). Tudo continua cinza e funcionando — as
   mudanças são inertes sem CF no caminho.
2. **Cloudflare dashboard**: SSL/TLS em modo **Full (strict)** — nunca
   Flexible (fala HTTP com a origem). "Always Use HTTPS" é dispensável: o
   redirect do Traefik já cobre, e `.app` é HSTS preload. Não ativar —
   com ele, a renovação HTTP-01 do Let's Encrypt pode falhar (item 5).
3. **Ligar a laranja nos dois registros** (`rolai.app` e `api.rolai.app`).
   O heartbeat segura o WS; o `CF-Connecting-IP` já passa a chegar e o
   backend já prefere ele.
4. **Trocar a label do rate limit** no `infra/docker-compose.hostinger.yml`:
   comentar `ipStrategy.depth=1`, ativar
   `requestHeaderName=CF-Connecting-IP`, e subir de novo.
5. **Fechar o bypass direto ao VPS** — só agora, com a laranja já ligada
   (antes disso isto derruba o site):
   - VPS só com rolai (ou tudo atrás da CF): firewall com os ranges de
     `https://www.cloudflare.com/ips/`, cuidando pra não trancar o SSH.
   - VPS compartilhado (o caso atual): `ipAllowList` com os ranges da CF
     nos dois routers (middleware `rolai-cfonly` no compose). Protege só o
     rolai e não encosta nos outros sites.
   - Os ranges mudam raramente, mas mudam — revisitar a lista de tempos em
     tempos, em qualquer das duas opções.
6. **Verificar** (seção abaixo) — principalmente o teste dos 40 POSTs.

## Como verificar

O status HTTP mente: o fallback de SPA devolve **200 com `index.html`** para
arquivo inexistente. Conferir sempre o `content-type`:

```bash
curl -sI https://rolai.app/config.js | grep -i cache-control     # no-store
curl -sI https://rolai.app/favicon.svg | grep -i content-type    # image/svg+xml
curl -sI https://rolai.app/.well-known/assetlinks.json | grep -i content-type
```

Limite por IP não pode ser burlável por header (com laranja ligada, os dois
devem contar no MESMO balde):

```bash
for i in $(seq 1 40); do
  curl -s -o /dev/null -w "%{http_code} " -X POST https://api.rolai.app/rooms \
    -H "Content-Type: application/json" -H "Origin: https://rolai.app" \
    -H "X-Forwarded-For: 1.2.3.$i" -d '{}'
done
```

Deve aparecer **429** depois de `room_create_limit_per_hour`. Se os 40 saírem
200, o header está sendo aceito como identidade — o furo desta doc.

WebSocket sobrevive ocioso (com o api em laranja): abrir a sala, deixar 3
minutos sem rolar, e conferir que o roster não piscou. Com o heartbeat nem
reconexão deveria haver — no devtools dá pra ver os `{"type":"ping"}`
chegando a cada `ws_heartbeat_seconds` (30s por default).

## Referências no código

| Assunto | Onde |
| --- | --- |
| IP do cliente | `services/backend/app/limits.py` |
| Heartbeat do WS | `services/backend/app/rooms.py` (`ws_heartbeat_seconds` em `config.py`), `apps/web/src/room/client.ts`, `apps/android/.../RoomClient.kt` |
| Origin do WS, códigos 4403/4429 | `services/backend/app/rooms.py` |
| Limites configuráveis | `services/backend/app/config.py`, `.env.example` |
| Labels do Traefik | `infra/docker-compose.hostinger.yml` |
| Cache e SPA fallback | `infra/nginx.conf` |
| Config de runtime do front | `infra/web-entrypoint.sh`, `apps/web/src/config.ts` |
| Modelo geral | `docs/security.md` |
