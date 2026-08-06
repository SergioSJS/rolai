# AGENTS.md — rolai

Instruções de projeto pra qualquer agente de codificação (Kimi Code, Claude Code
via `CLAUDE.md` -> `@AGENTS.md`, ou outro). Leia isto inteiro antes de tocar em
qualquer código. Depois leia o spec da tarefa específica em `specs/`.

## O que é este projeto

Dice roller multiplayer para mesas de RPG: rolagem 3D (dice-box), salas
efêmeras compartilhadas via WebSocket, histórico exportável, e um app Android
com botão flutuante (overlay) que dispara rolagens sem sair de outro app
(ex: leitor de PDF). Arquitetura completa em `docs/architecture.md` — leia
antes de propor qualquer mudança estrutural.

## Stack e monorepo

```
packages/rules-engine/   TypeScript — parser de notação + profiles de sistema
                         (Ironsworn, PbtA, FitD, etc). Usado pelo frontend web
                         E pela WebView headless do app Android. Fonte única
                         de verdade das regras — nunca duplicar em Kotlin/Python.
apps/web/                React + Vite + TypeScript. PWA. Usa dice-box /
                         dice-box-threejs pro render 3D.
apps/android/            Kotlin. TWA envelopando apps/web + Foreground Service
                         (overlay, cliente WS, WebView headless).
services/backend/        Python + FastAPI. Relay burro de sala (WS) + REST
                         (criar sala, salvar profile custom, export).
infra/                   docker-compose para Hostinger (Traefik) e para
                         ZimaOS/CasaOS.
```

Regra de ouro: o backend **nunca** recalcula ou valida o resultado de uma
rolagem — ele só retransmite o que o cliente que rolou já calculou. Ele é
responsável por resolver o RNG quando o cálculo precisa ser confiável (ver
`docs/security.md` sobre o trade-off aceito aqui).

## Convenções de código

- TypeScript: `strict: true`, sem `any` não justificado. Testes com `vitest`.
- Python: `ruff` + `mypy` no CI. Testes com `pytest` + `httpx` (FastAPI
  `TestClient` para WS também).
- Kotlin: seguir convenções padrão do Android Studio / ktlint. Não duplicar
  lógica de regras — a WebView headless é a única fonte de cálculo.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
- Sem segredo em texto plano em nenhum arquivo versionado. Usar `.env`
  (nunca commitado — só `.env.example`).

## Como rodar / testar

```bash
# rules-engine
cd packages/rules-engine && npm install && npm test

# backend
cd services/backend && uv sync && uv run pytest

# web
cd apps/web && npm install && npm run dev

# infra local (backend + redis + postgres)
docker compose -f infra/docker-compose.yml up
```

Todo PR deve rodar limpo: `npm test` (rules-engine e web), `pytest`
(backend), `ruff check` e `mypy` (backend), lint do Android (se módulo
android for tocado).

## Segurança — não pular

Ver `docs/security.md` para a lista completa. Os pontos que mais importam
pra revisão de PR:

- Código de sala não pode ser previsível/sequencial (usar gerador
  criptograficamente aleatório, não incremental).
- Rate limit por conexão WS (evitar flood de rolagens).
- Validação de payload sempre via modelo Pydantic — nunca aceitar dict cru.
- Nenhuma permissão Android além do estritamente necessário
  (`SYSTEM_ALERT_WINDOW` só quando o usuário ativa o overlay explicitamente).
- CORS restrito ao(s) domínio(s) do frontend, nunca `*` em produção.
- O IP do cliente vem do primeiro `X-Forwarded-For` e isso só vale porque o
  Traefik é o único proxy na frente. Se entrar CDN/proxy no caminho
  (Cloudflare em nuvem laranja), o header vira forjável e os limites param
  de valer — ver `docs/security-cloudflare.md` antes de mexer.

## Ordem de implementação sugerida

Ver `specs/00-overview.md` para o roadmap completo. Resumo: rules-engine
primeiro (testável isoladamente, sem rede nem UI) -> backend relay -> web
(integra os dois, testável 100% no browser) -> só depois o app Android.
Não pule pro Android antes da fatia web estar funcionando fim-a-fim — é
onde a maior parte do risco técnico do projeto mora, e validar lá é mais
barato que validar no nativo.

## O que NÃO fazer

- Não implemente autenticação de usuário/conta — o escopo é sala anônima
  com código compartilhável, nada além disso por ora.
- Não duplique o motor de regras em outra linguagem "pra ser mais rápido".
- Não adicione WebRTC/P2P — decisão já tomada em `docs/architecture.md`,
  não revisitar sem justificativa nova.
- Não trave em polimento visual antes do fluxo de dados fim-a-fim funcionar.
