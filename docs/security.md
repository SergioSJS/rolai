# Segurança

Checklist a validar em qualquer PR que toque backend, WS, ou o overlay
Android. Não é exaustivo pra todo software — é o recorte específico que
importa pra este projeto.

> **Colocando a Cloudflare na frente (nuvem laranja)?** Leia
> `docs/security-cloudflare.md` ANTES. O limite por IP daqui assume que só o
> Traefik escreve `X-Forwarded-For`; com a CF no caminho o header passa a ser
> forjável e os limites de abuso viram decoração.

## Salas / WebSocket

- **Código de sala**: o gerado pelo backend sai de um CSPRNG
  (`secrets.token_urlsafe`), nunca sequencial/incremental — não deve ser
  adivinhável nem enumerável.
- **Código escolhido pelo usuário (trade-off aceito, 2026-08-06)**: entrar
  numa URL de sala inexistente **cria** a sala com aquele código, desde que
  ele passe no piso de entropia (`is_valid_custom_code` em `room_ws.py`:
  ≥16 caracteres, ≥8 distintos). Motivação: mesa fixa para OBS (a Browser
  Source aponta pro mesmo endereço para sempre, sobrevivendo ao TTL) e link
  compartilhado expirado (todos caem na **mesma** sala, em vez de cada um
  numa sala diferente).
  Custo assumido: como não há login, **o código é a credencial**. Um código
  fraco seria sala pública adivinhável — daí o piso, que derruba `teste`,
  `aaaa...`, `12341234...`. Não é prova de imprevisibilidade; é o piso que
  torna enumeração inviável junto do rate limit por IP.
  A criação por WS usa **o mesmo teto por IP** do `POST /rooms`
  (`room_create_limit_per_hour`) e o mesmo teto global — senão abrir WS
  viraria um caminho paralelo pra encher o Redis.
  Quem escolhe o código assume que quem tiver o link entra: para mesa
  privada, use o código gerado pelo backend.
- **Rate limit por conexão**: limite de mensagens/segundo por socket
  (ex. token bucket simples), pra evitar flood de rolagens travando a sala
  pra todo mundo.
- **Validação de payload**: todo evento recebido do WS passa por um modelo
  Pydantic antes de qualquer processamento — nunca aceitar `dict` cru direto
  do `json.loads`.
- **Tamanho máximo de mensagem**: limitar payload (ex. 4KB) — uma rolagem
  legítima nunca chega perto disso; qualquer coisa maior é rejeitada antes
  de parsear.
- **TTL de sala**: toda sala expira por inatividade (Redis `EXPIRE`
  renovado a cada evento) — nunca uma sala "eterna" acumulando estado.
- **Origin do WebSocket**: CORS **não vale** para WS (o navegador não aplica
  same-origin ali). Se o header `Origin` vier, tem que estar em
  `CORS_ORIGINS`, senão a conexão é fechada com 4403. Sem esse header
  (cliente nativo, ex. o app Android) a conexão passa — navegador sempre
  manda `Origin`, então isso ainda barra site de terceiro usando o navegador
  de quem visita como bot.
- **Formato do código de sala**: só `[A-Za-z0-9_-]{4,32}` vira chave no
  Redis; qualquer outra coisa é 404 (WS) ou 404 (export).
- **Apelido**: cortado em `MAX_NAME_LENGTH` (24) no servidor. O front já
  limita, um bot não — e o apelido é retransmitido pra sala inteira.

## Abuso e recursos (DoS)

O trust model aqui é: sala anônima, sem conta, código compartilhável. Não dá
pra distinguir "jogador" de "bot" por identidade, então tudo é limitado por
IP e por recurso. Todos os tetos estão em `services/backend/app/config.py`
(env override, `0` desliga) e são aplicados em `app/limits.py` — janela fixa
no Redis, que sobrevive a reconexão e a restart, ao contrário do token bucket
por socket.

| Vetor | Controle |
|---|---|
| Bot criando salas em loop (enche o Redis) | `ROOM_CREATE_LIMIT_PER_HOUR` (30/IP) + `maxmemory 256mb` com `allkeys-lru` no Redis |
| Bot gravando profiles (enche o disco do Postgres) | `PROFILE_CREATE_LIMIT_PER_HOUR` (10/IP) + `max_length` em todo campo do schema |
| Flood de requisições HTTP | `HTTP_RATE_LIMIT_PER_MINUTE` (120/IP; `/health` isento) + `rateLimit` do Traefik na borda |
| Corpo gigante | `MAX_BODY_BYTES` (64KB) checado antes da rota + `buffering` do Traefik |
| Frame WS gigante | `--ws-max-size 16384` no uvicorn (o limite de 4KB da app roda depois do frame já montado em memória) |
| Reconectar pra zerar o rate limit por socket | `WS_CONNECT_LIMIT_PER_MINUTE` (30/IP) |
| Amplificação N-para-N (broadcast) numa sala lotada | `MAX_MEMBERS_PER_ROOM` (20) |
| Conexões espectadoras (modo stream/OBS) numa sala | `MAX_SPECTATORS_PER_ROOM` (5) — teto separado, espectador não conta como membro e nunca rola |
| Exaustão de socket/memória | `--limit-concurrency 2048` no uvicorn + `mem_limit` em todos os containers |
| N bots com N IPs criando salas abaixo do limite por IP | `MAX_ACTIVE_ROOMS` (1000, global): `POST /rooms` devolve **503** quando o teto é atingido. Contagem no set Redis `rooms:active`, prunado a cada criação (sala cujo marcador expirou sai do set e deixa de contar) |
| Profiles custom acumulando pra sempre no Postgres | Profile custom é **efêmero**: `PROFILE_TTL_DAYS` (30) + expurgo periódico (`PROFILE_PURGE_INTERVAL_SECONDS`, diário; roda também no boot) |
| Ataque em andamento invisível | Log estruturado no logger `rolai` (ver abaixo) |

`TRUST_PROXY_HEADERS` decide se `X-Forwarded-For` vale como IP do cliente:
**só ligue com proxy na frente** (o override de Hostinger liga). Sem proxy, o
header é forjável e o limite por IP vira decorativo.

O teto global de salas devolve **503 e não 429** de propósito: é uma
condição de capacidade do serviço, não algo que o cliente da requisição
tenha causado — o `Retry-After` indica que vagas abrem conforme salas
expiram.

**Log estruturado**: logger único `rolai`, stdlib `logging`, mensagens em
formato `key=value` (`event=room_created code=AbCdEfGh ip=1.2.3.4`) —
greppável sem dependência nova. INFO para eventos normais (`room_created`,
`profile_created`, `ws_open`, `ws_closed`, `profiles_purged`), WARNING para
limites e rejeições (`rate_limited limit=...`, `room_cap_reached`,
`payload_rejected reason=...`, `ws_rejected reason=origin_forbidden`).
Payload de rolagem **nunca** é logado — só metadados.

Nota de migração: o expurgo depende da coluna `created_at` em `profiles`, e
o MVP não tem migrations (`init_db` só faz `create_all`). Num Postgres que
já tinha a tabela antiga: dropar a tabela `profiles` (dados são efêmeros
mesmo) ou `ALTER TABLE profiles ADD COLUMN created_at TIMESTAMP NOT NULL
DEFAULT now()`.

### Observabilidade

- **Log estruturado** (`app/logs.py`): `event=...` em key=value, INFO pra
  evento normal e WARNING pra limite atingido/payload rejeitado. Nunca loga
  payload de rolagem.
- **`GET /stats`**: agregados desde o boot (salas criadas, rolagens
  retransmitidas, conexões de jogador e de espectador, profiles criados e
  expurgados, limites atingidos por tipo) mais os gauges do momento (salas
  ativas, conexões abertas). **Nada identificável** — sem código de sala,
  apelido ou IP; há teste que trava isso. Contadores são em memória e zeram
  no restart: servem pra responder "está sendo atacado agora?", não pra
  contabilidade. Com `STATS_TOKEN` definido, o endpoint exige
  `Authorization: Bearer <token>`; sem token, fica aberto. O painel
  **Servidor** da web (`specs/11-status-do-servidor.md`) lê esse mesmo
  endpoint do navegador, sem token nenhum — se o operador ligar
  `STATS_TOKEN`, o painel mostra "protegido" e para de consultar. Nunca
  embutir o token no bundle pra "resolver" isso: ele iria pro cliente.

**Ainda em aberto** (aceito por ora, revisar se o projeto crescer): nada
do bloco 2 — os três itens acima estão implementados.

## Trust model do resultado de rolagem

O backend **não valida** que o resultado enviado por um cliente é
matematicamente possível pra aquela notação — ele confia e retransmite.
Isso é uma decisão consciente (ver `docs/architecture.md`), aceitável pro
caso de uso de mesa entre amigos. **Se um dia o projeto ganhar salas
públicas abertas para desconhecidos**, isso precisa ser revisitado: nesse
cenário, resolver o RNG no servidor (usando o mesmo `rules-engine`, portado
ou rodado via subprocess Node) deixa de ser opcional.

## Backend geral

- CORS restrito à(s) origem(ns) do frontend em produção — nunca `*`.
- Segredos (se houver — hoje o projeto não tem contas de usuário, então a
  superfície é pequena) só via variável de ambiente, nunca hardcoded.
  `.env.example` documenta todas as chaves esperadas, sem valores reais.
- Dependências: `pip-audit` (backend) e `npm audit` (web/rules-engine) no
  CI, falhando o build em vulnerabilidade de severidade alta.
- Postgres: profiles customizados salvos por usuário devem ser validados
  contra o schema de `docs/system-profiles.md` antes de persistir — nunca
  aceitar YAML arbitrário sem validação (evita profile malicioso injetando
  `condition` com efeitos colaterais; o avaliador de `condition` deve ser
  uma expressão restrita, nunca `eval` de Python/JS puro).

## App Android

- `SYSTEM_ALERT_WINDOW` só é solicitado quando o usuário ativa o recurso
  de overlay explicitamente na tela de configurações do próprio app — nunca
  no primeiro boot, nunca implícito.
- Foreground Service declara o tipo correto de serviço (`dataSync` ou
  equivalente mais específico disponível) e mostra notificação persistente
  enquanto ativo — sem serviço "escondido" do usuário.
  Verificar o tipo de foreground service atualmente exigido no
  `AndroidManifest.xml` para a API level alvo do projeto: as regras da
  Google mudam por versão do Android e o requisito exato deve ser conferido
  na documentação oficial no momento da implementação, não assumido daqui.
- A WebView headless usada para cálculo não deve ter navegação externa
  habilitada (`WebViewClient` restrito à origem do app) — ela existe só pra
  rodar o `rules-engine`, não pra navegar.
- TWA: verificar Digital Asset Links (`assetlinks.json`) configurado
  corretamente no domínio do frontend, senão a TWA cai pra barra de URL
  visível (quebra a experiência, não é um risco de segurança em si, mas é
  sinal de configuração incorreta que vale checar).

## O que fica fora de escopo (por ora)

- Autenticação de usuário/conta — não existe no MVP.
- Moderação de conteúdo — salas são privadas por código compartilhado, sem
  descoberta pública.
