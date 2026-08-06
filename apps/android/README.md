# apps/android

TWA envelopando `apps/web` (`https://rolai.app`) + Foreground Service com
overlay flutuante que rola dados e acompanha a sala sem sair do app em
primeiro plano (ex: leitor de PDF). Escopo e critérios de aceite em
`specs/04-android-overlay.md`.

> **Estado: code-only, ainda não compilado.** Este módulo foi escrito num
> ambiente **sem Android SDK/gradle/emulador**. Nada aqui passou por um
> build real — a primeira compilação provavelmente expõe ajustes menores.
> O que JÁ foi validado de verdade: o bundle headless do rules-engine
> (build + testes em `apps/web`, ver abaixo).

## Arquitetura

```
SettingsActivity (launcher nativo)
   │  toggle "Ativar botão flutuante" → pede SYSTEM_ALERT_WINDOW (só aqui)
   │  botão "Abrir o rolai.app" → TwaActivity (TWA, androidbrowserhelper)
   ▼
OverlayService (foreground service, tipo specialUse)
   ├── OverlayView        bolha/painel flutuante via WindowManager (texto puro, nunca 3D)
   ├── RoomClient         WebSocket da sala (OkHttp), reconexão com backoff
   └── HeadlessRoller     WebView headless rodando o rules-engine
                          (assets/headless/ — NUNCA duplicar regra em Kotlin)
```

Decisões relevantes (com a fonte oficial no `AndroidManifest.xml`):

- **Launcher nativo, não a TWA**: a tela de configurações é onde mora o
  pedido explícito de `SYSTEM_ALERT_WINDOW` (docs/security.md); a TWA só
  renderiza conteúdo web e não exporia esse fluxo.
- **`foregroundServiceType="specialUse"`**: nenhum outro tipo cobre UI de
  overlay interativa persistente; `dataSync` tem teto cumulativo de 6h/24h
  a partir da API 35 ([fg-service-timeout](https://developer.android.com/develop/background-work/services/fg-service-timeout))
  e `connectedDevice` é pra dispositivo externo. Fonte:
  [service-types](https://developer.android.com/develop/background-work/services/fgs/service-types).
- **Sem campo de texto no overlay**: a janela fica `FLAG_NOT_FOCUSABLE` e
  nunca disputa teclado com o app em primeiro plano. A rolagem rápida
  (notação ou sistema + inputs) se configura na SettingsActivity.

## Pré-requisitos

- Android Studio (ou SDK cmdline-tools) com **API 35** e **JDK 17**.
- O repo não versiona `gradlew`/wrapper JAR — ao abrir no Android Studio
  ele gera; ou rode `gradle wrapper` (a config está em
  `gradle/wrapper/gradle-wrapper.properties`, Gradle 8.7 pro AGP 8.6).

## Build

```bash
# 1) Bundle headless do rules-engine -> assets do app (OBRIGATÓRIO antes
#    de qualquer build Android; sem isso a WebView não carrega nada).
#    Gera app/src/main/assets/headless/{rolai-headless.js, systems.json}.
npm run build:headless -w @rolai/web

# 2) Build do app
cd apps/android
./gradlew assembleDebug        # ou abrir no Android Studio
```

O bundle gerado fica versionado em `app/src/main/assets/headless/`, então
quem só compila o Android não precisa refazer o passo 1 — refaça quando o
rules-engine ou os profiles mudarem.

## TWA e assetlinks.json

A TWA só abre sem barra de URL se o Digital Asset Links estiver certo:

1. Gere o fingerprint SHA-256 do keystore de release:

   ```bash
   keytool -list -v -keystore <seu-keystore>.jks -alias <alias>
   # copie a linha "SHA256: AA:BB:..."
   ```

2. Substitua o placeholder em `apps/web/public/.well-known/assetlinks.json`
   (vai pro deploy de rolai.app em `/.well-known/assetlinks.json`).
   Inclua também o fingerprint do **keystore de debug** enquanto testa
   (`~/.android/debug.keystore`, senha `android`), senão o build de debug
   cai na barra de URL.
3. Verifique: instalar o app, abrir um link `https://rolai.app` — deve
   abrir direto na TWA. Diagnóstico:
   `adb shell dumpsys package d | grep -A3 rolai` (domínios verificados).

## Overlay e permissões

- `SYSTEM_ALERT_WINDOW`: pedida **somente** no toggle da tela de
  configurações (fluxo: toggle → tela do sistema → volta → service sobe).
- `POST_NOTIFICATIONS` (API 33+): pedida em runtime ao ativar o overlay.
- Foreground service tipo `specialUse` + notificação persistente com ação
  "Encerrar".

## Testes

```bash
# JVM locais (lógica pura: backoff, validação de código/apelido, URL do WS)
./gradlew testDebugUnitTest

# Instrumented — NUNCA executados neste ambiente (sem SDK/emulador).
./gradlew connectedDebugAndroidTest
```

Pré-requisitos dos instrumented tests no dispositivo/emulador:

```bash
adb shell appops set app.meioorc.rolai SYSTEM_ALERT_WINDOW allow
# API 33+: conceder POST_NOTIFICATIONS via UI ou:
adb shell pm grant app.meioorc.rolai android.permission.POST_NOTIFICATIONS
```

- `OverlayServiceTest` — service inicia e desenha a view; ACTION_STOP remove.
- `RoomClientReconnectTest` — reconexão WS (MockWebServer derruba a 1ª
  conexão) e não-reconexão em close 4404 (sala inexistente).
- `HeadlessRollerParityTest` — resultado da WebView headless bate com o
  rules-engine nos mesmos inputs (fila `deterministic`; valores assados a
  partir do bundle, espelhados em `apps/web/src/headless.test.ts`).

## Desenvolvendo contra backend local

O campo "Servidor (avançado)" aceita outra base WS. No emulador, o backend
local da máquina é `ws://10.0.2.2:8420` (ver `services/backend/scripts/dev_local.py`).
OkHttp não aplica o bloqueio de cleartext da plataforma, então `ws://`
funciona sem mexer na networkSecurityConfig.

## Estrutura

```
app/src/main/java/app/meioorc/rolai/
  SettingsActivity.kt   launcher nativo, toggle do overlay, prefs
  TwaActivity.kt        TWA -> https://rolai.app
  OverlayService.kt     foreground service (specialUse) orquestrando tudo
  OverlayView.kt        bolha arrastável + painel (WindowManager)
  RoomClient.kt         WS da sala (OkHttp) + backoff de reconexão
  ReconnectBackoff.kt   backoff exponencial (puro, teste JVM)
  HeadlessRoller.kt     WebView headless <-> bridge RolaiBridge
  RolaiSettings.kt      SharedPreferences + validações puras
app/src/main/assets/headless/
  index.html            página mínima carregada pela WebView
  rolai-headless.js     GERADO (npm run build:headless) — não editar
  systems.json          GERADO — fonte do seletor de sistema
```
