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
(backend), `ruff check` e `mypy` (backend), `./gradlew testDebugUnitTest`
(Android, se o módulo for tocado).

Os testes instrumentados do Android NÃO rodam no CI (emulador em Actions é
lento e instável) — rode `apps/android/scripts/run-instrumented.sh` num
aparelho antes de gerar release. Eles cobrem justamente o que teste JVM não
alcança: ciclo de vida do Service e a janela do overlay.

## Segurança — não pular

Ver `docs/security.md` para a lista completa. Os pontos que mais importam
pra revisão de PR:

- Código de sala GERADO pelo backend usa CSPRNG, nunca sequencial.
- Código ESCOLHIDO pelo usuário é permitido — decisão consciente de
  2026-08-06, registrada em `docs/security.md`. Serve pra mesa fixa (a
  Browser Source do OBS aponta pro mesmo endereço pra sempre) e pra link
  compartilhado que expirou. Vem com piso de entropia
  (`is_valid_custom_code`: >=16 caracteres, >=8 distintos), replicado em
  `apps/web/src/room/code.ts` e `RolaiSettings.customCodeIssue` só pra dizer
  o motivo antes de gastar conexão. **Não "conserte" isso achando que é
  falha**: o piso e o rate limit por IP são a defesa, e quem escolhe o
  código aceita que quem tiver o link entra.
- Rate limit por conexão WS (evitar flood de rolagens).
- Validação de payload sempre via modelo Pydantic — nunca aceitar dict cru.
- Nenhuma permissão Android além do estritamente necessário
  (`SYSTEM_ALERT_WINDOW` só quando o usuário ativa o overlay explicitamente).
- CORS restrito ao(s) domínio(s) do frontend, nunca `*` em produção.
- **A Cloudflare está em nuvem laranja** (desde 2026-08-06), então o IP do
  cliente vem de `CF-Connecting-IP`, e não do primeiro `X-Forwarded-For` —
  atrás da CF esse header é forjável pelo cliente. O bypass direto ao VPS é
  fechado por `ipAllowList` nos routers do rolai. Mexer em limite por IP sem
  ler `docs/security-cloudflare.md` fura os três limites de abuso de uma vez.

## Ordem de implementação sugerida

**As quatro etapas estão concluídas e em produção** (rolai.app +
api.rolai.app, APK assinado nas Releases). A ordem abaixo fica como registro
do porquê, e vale pra qualquer fatia nova:

rules-engine primeiro (testável isoladamente, sem rede nem UI) -> backend
relay -> web (integra os dois, testável 100% no browser) -> só depois o
Android. Não pule pro Android antes da fatia web estar funcionando
fim-a-fim — é onde a maior parte do risco técnico mora, e validar lá é mais
barato que validar no nativo. Ver `specs/00-overview.md`.

## O que NÃO fazer

- Não implemente autenticação de usuário/conta — o escopo é sala anônima
  com código compartilhável, nada além disso por ora.
- Não duplique o motor de regras em outra linguagem "pra ser mais rápido".
- Não adicione WebRTC/P2P — decisão já tomada em `docs/architecture.md`,
  não revisitar sem justificativa nova.
- Não trave em polimento visual antes do fluxo de dados fim-a-fim funcionar.
- Não faça o palco de dados do Android voltar a entrar na sala como
  espectador. Era uma segunda conexão WS por aparelho e a animação inteira
  dependia dela: quando não subia, o dado simplesmente não aparecia, sem
  erro em lugar nenhum. Hoje o Service empurra por
  `window.rolaiStream.play()` — ver `docs/architecture.md`. No OBS o
  espectador continua certo (é outra máquina, não há quem empurre).

## Palco de dados offline (Android)

O app roda 100% sem rede, menos sala. O palco 3D vem de `assets/stage/`
(build do `apps/web`), servido por `WebViewAssetLoader` em
`https://appassets.androidplatform.net/...` — tem que ser https, porque
WebGL e localStorage exigem origem segura e `file://` é opaca.

Ao mexer nisso:

- `npm run build:stage -w @rolai/web` regenera os assets. Rode quando o web
  mudar, senão o APK fica com um palco velho.
- `vite.config.ts` usa `base: "./"`. Caminho absoluto quebra dentro do APK
  (o palco vive numa subpasta) e o dado some sem erro visível.
- A URL aponta pro **arquivo** `index.html`, não pra pasta: o
  `AssetsPathHandler` não faz índice de diretório — terminar em `/` dá 404.
- Service worker fica fora do APK (não há o que ele resolva ali), e o
  `install-stage.mjs` remove a tag do `registerSW.js` do HTML.
- Servidor custom nas preferências volta a usar a rede — é o caminho pra
  testar outro deploy.

## Mexeu no rules-engine? Regenere o bundle do Android

O app calcula rolagem numa WebView com o bundle EMBARCADO em
`apps/android/app/src/main/assets/headless/`. É artefato de build, e fica
defasado em silêncio: a web mostra o comportamento novo e o APK segue com
o motor antigo, sem erro nenhum.

```bash
npm run build:headless -w @rolai/web   # motor de regras (rolagem)
npm run build:stage    -w @rolai/web   # palco 3D offline
```

Aconteceu com o `dropped` do keep/drop: corrigido no engine, verde nos
testes web, e `1d20dis` continuava errado no celular.
`KeepDropHeadlessTest` (instrumentado) falha quando o bundle está velho.

## Armadilha recorrente deste projeto

A maior parte dos bugs difíceis daqui teve a mesma forma: **código decidindo
por "existe" em vez de "funcionou"**.

- `roomClient != null` significa "tem código de sala salvo", não "conectado"
  — a rolagem sumia sem erro quando a sala estava fora do ar;
- palco anexado ao WindowManager ≠ palco animando;
- flag estática de service ligada ≠ instância montada (crash ao religar).

Some-se a isso que `try/catch` **não pega promise pendente**: `initialize()`
e `updateConfig()` da dice-box travam em vez de rejeitar quando um asset não
carrega, e o efeito é "não acontece nada, sem log". Onde houver `await` numa
lib de terceiro que carrega recurso, prefira corrida com relógio.

Quando algo "simplesmente não acontece" e não há erro, suspeite dessas duas
famílias antes de procurar em outro lugar.
