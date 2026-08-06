# Cloudflare na frente do Rolaí — o que muda na segurança

Doc de handoff para quem for ligar a **nuvem laranja** (proxy da Cloudflare)
no `rolai.app`. Complementa `docs/security.md`, que descreve o modelo atual —
leia aquele primeiro. Aqui só o que a Cloudflare quebra, o que ela ganha, e o
que precisa mudar no código antes.

Estado de hoje: **os dois domínios estão em nuvem cinza (DNS only)**, e o
código assume isso. Ligar laranja sem as mudanças abaixo **abre um furo real
no limite de abuso** — não é polimento.

## Topologia atual

```
navegador ──TLS──> Traefik (rede host, VPS Hostinger) ──> rolai-web   (nginx)
                                                     └──> rolai-backend (FastAPI)
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

`services/backend/app/limits.py:client_ip()` pega o **primeiro** item de
`X-Forwarded-For`:

```python
forwarded = source.headers.get("x-forwarded-for")
first = forwarded.split(",")[0].strip()
```

Isso está **correto hoje**, com só o Traefik na frente: quem escreve o header
é o proxy, e o primeiro item é o cliente real.

Com a Cloudflare no caminho deixa de ser: a CF **anexa** o IP real ao
`X-Forwarded-For` que o cliente mandou. Quem enviar
`X-Forwarded-For: 1.2.3.4` na mão faz o backend contar o limite no IP falso —
e escapa de `room_create_limit_per_hour`, `ws_connect_limit_per_minute` e
`http_rate_limit_per_minute` de uma vez.

**Conserto:** ler `CF-Connecting-IP`, que a Cloudflare **sobrescreve** sempre,
ignorando o que o cliente mandar. E só confiar nele quando a requisição
realmente veio da CF.

Esboço (mantendo `trust_proxy_headers` como está):

```python
def client_ip(source: Request | WebSocket, trust_proxy: bool) -> str:
    if trust_proxy:
        # Atras da Cloudflare este header e reescrito pela borda e nao pode
        # ser forjado; X-Forwarded-For pode (a CF anexa ao que o cliente
        # mandou). Preferir sempre o especifico.
        cf = source.headers.get("cf-connecting-ip")
        if cf:
            return cf[:45]
        forwarded = source.headers.get("x-forwarded-for")
        ...
```

**Não basta.** `CF-Connecting-IP` também é forjável por quem alcançar o VPS
direto, pulando a CF. Duas defesas, e o ideal é as duas:

- **Firewall no VPS**: aceitar 80/443 só dos ranges da Cloudflare
  (`https://www.cloudflare.com/ips/`). Fecha o bypass de vez.
- **Traefik**: `ipAllowList` nos ranges da CF no router do backend, ou
  `forwardedHeaders.trustedIPs` com esses ranges.

Sem pelo menos uma delas, trocar `X-Forwarded-For` por `CF-Connecting-IP` só
troca um header forjável por outro.

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

### 3. WebSocket ocioso morre (~100s)

A Cloudflare fecha conexão WebSocket parada. **Não há heartbeat no projeto** —
nem no backend (`services/backend/app/rooms.py`) nem no cliente
(`apps/web/src/room/client.ts`). O cliente reconecta com backoff
(`MAX_RECONNECT_ATTEMPTS = 5`), então não quebra de vez, mas uma mesa parada
fica reconectando a cada ~2 min. Cada reconexão consome cota de
`ws_connect_limit_per_minute` — o limite de abuso passa a punir uso normal.

Duas saídas:

- **`api.rolai.app` fica em cinza** (recomendado, e é o estado atual). A
  laranja entra só no `rolai.app`, que é estático e não tem WS.
- Ou **implementar ping/pong** antes de ligar laranja no `api`. Vale de
  qualquer forma: qualquer proxy tem timeout ocioso.

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

Ovo-e-galinha do ACME: com laranja ligada e "Always Use HTTPS" ativo, o
desafio HTTP-01 é redirecionado antes de chegar no Traefik e o certificado
nunca sai. **Ordem certa:** cinza → certificado emitido → só então laranja.

`.app` está na lista de **HSTS preload**: o navegador nunca tenta HTTP. TLS
válido é pré-requisito, não polimento.

## O que NÃO muda

- Checagem de `Origin` no WS (`rooms.py`, close **4403**) — a CF repassa o
  header. `CORS_ORIGINS` continua valendo pro CORS **e** pro WS.
- Trust model da rolagem: o backend não recalcula (`docs/architecture.md`).
- Códigos de sala aleatórios, validação Pydantic, tetos de sala e de memória.

## Ordem de execução

1. Firewall do VPS restrito aos ranges da Cloudflare (ou `ipAllowList` no
   Traefik). **Primeiro** — sem isso o resto é teatro.
2. `client_ip()` preferindo `CF-Connecting-IP`, com teste.
3. Label do Traefik para `requestHeaderName=CF-Connecting-IP`.
4. Ligar laranja **só em `rolai.app`**, SSL em Full (strict).
5. `api.rolai.app` **permanece cinza** até existir heartbeat no WS.

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

WebSocket sobrevive ocioso (só faz sentido se um dia o `api` for pra laranja):
abrir a sala, deixar 3 minutos sem rolar, e conferir que o roster não piscou.

## Referências no código

| Assunto | Onde |
| --- | --- |
| IP do cliente | `services/backend/app/limits.py` |
| Origin do WS, códigos 4403/4429 | `services/backend/app/rooms.py` |
| Limites configuráveis | `services/backend/app/config.py`, `.env.example` |
| Labels do Traefik | `infra/docker-compose.hostinger.yml` |
| Cache e SPA fallback | `infra/nginx.conf` |
| Config de runtime do front | `infra/web-entrypoint.sh`, `apps/web/src/config.ts` |
| Modelo geral | `docs/security.md` |
