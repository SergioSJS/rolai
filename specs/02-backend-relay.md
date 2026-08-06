# 02 — backend relay

## Objetivo

Serviço FastAPI que cria salas, aceita conexões WebSocket, retransmite
eventos de rolagem, mantém histórico curto com TTL, e expõe export.

## Escopo

- `POST /rooms` — cria sala, devolve código (CSPRNG, ver `docs/security.md`).
- `WS /rooms/{code}` — entra na sala; ao conectar recebe snapshot atual
  (roster + histórico corrente do Redis); eventos subsequentes são
  broadcast pra todos conectados.
- Payload de evento validado via modelo Pydantic equivalente ao contrato
  `RollResult` de `docs/roll-notation.md` — rejeitar qualquer payload fora
  do formato, com mensagem de erro clara de volta ao remetente.
- Histórico da sala em Redis, TTL renovado a cada evento (entrada, saída,
  rolagem).
- `GET /rooms/{code}/export?format=json|csv|md` — dump do histórico atual.
- Rate limit por conexão (token bucket simples em memória, por
  `websocket.client` ou id de conexão).
- `POST /profiles` e `GET /profiles/{id}` — CRUD simples de profile
  customizado do usuário, validado contra o schema de
  `docs/system-profiles.md` antes de persistir no Postgres.

## Fora de escopo nesta etapa

- Qualquer validação matemática do resultado da rolagem em si — o backend
  confia no payload (ver trade-off documentado em `docs/security.md`).
- Autenticação — sem conceito de usuário/conta.
- Frontend consumindo isso de verdade (etapa 03) — os testes desta etapa
  usam um cliente WS de teste (`httpx`/`starlette.testclient`), não o
  browser.

## Critérios de aceite

- `pytest` cobre: criação de sala, join com snapshot correto, broadcast
  pra múltiplos clientes conectados, rejeição de payload malformado,
  expiração de sala por TTL (pode mockar o clock/Redis TTL no teste), e
  rate limit disparando após N mensagens na janela configurada.
- `ruff check` e `mypy` limpos.
- Nenhuma rota aceita corpo de request sem modelo Pydantic correspondente.
