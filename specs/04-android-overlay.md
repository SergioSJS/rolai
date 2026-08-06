# 04 — overlay Android

## Objetivo

App Kotlin que envelopa `apps/web` via TWA e adiciona um Foreground Service
com botão/barrinha flutuante capaz de rolar e ver atividade da sala sem
sair do app em primeiro plano (ex: leitor de PDF).

Não iniciar esta etapa antes de `03-frontend-web.md` estar funcionando
fim-a-fim — o risco técnico maior do projeto mora na etapa 03, validar lá
primeiro é mais barato.

## Escopo

- TWA apontando pro domínio de produção de `apps/web`, com
  `assetlinks.json` configurado (ver checagem em `docs/security.md`).
- Tela de configurações do app: toggle explícito pra ativar o overlay
  (é aqui que a permissão `SYSTEM_ALERT_WINDOW` é solicitada — nunca antes).
- Foreground Service:
  - Desenha a view flutuante via `WindowManager` (botão ou barrinha
    ancorada na borda, recolhível).
  - Mantém uma conexão WebSocket viva com a sala ativa (mesmo protocolo
    do backend da etapa 02).
  - Ao rolar pelo overlay: aciona uma WebView headless (sem UI visível)
    carregando uma página mínima que importa `rules-engine` e devolve o
    resultado via bridge JS -> Kotlin.
  - Mostra o resultado como texto/badge nativo (tier "texto puro" da
    escada de qualidade — nunca tenta renderizar 3D no overlay).
  - Notificação persistente enquanto o serviço está ativo.

## Fora de escopo nesta etapa

- Qualquer renderização 3D dentro do overlay.
- Duplicar lógica de regras em Kotlin — se algo parecer mais fácil de
  fazer nativo, checar `AGENTS.md` (regra de não duplicar) antes.

## Critérios de aceite

- Instrumented test (Android) cobrindo: Service inicia e desenha a view,
  Service reconecta o WS após perda de conexão, resultado calculado pela
  WebView headless bate com o mesmo input rodado em
  `packages/rules-engine` (mesmo teste, ambiente diferente).
- Teste manual documentado no PR: abrir um PDF, rolar pelo overlay, ver
  outro dispositivo na mesma sala receber o resultado.
- Nenhuma permissão além de `SYSTEM_ALERT_WINDOW` (e o mínimo de rede/
  foreground service) declarada no `AndroidManifest.xml`.
