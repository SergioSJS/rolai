# Handoff — sessões de 2026-08-05/06 (Claude Code → próximo agente)

Continuação direta do trabalho do Kimi Code. Leia `AGENTS.md` e
`docs/architecture.md` antes; este arquivo cobre só **o que mudou nesta
sessão** e **o que vem a seguir**.

## Estado do projeto

Etapas 01–04 concluídas e **verificadas em aparelho real**. Etapa 05 feita
parcialmente (composes validados por `docker compose config` com colima; o
stack nunca subiu de ponta a ponta).

| Pacote | Testes | Outros |
|---|---|---|
| `packages/rules-engine` | 79 | `tsc --noEmit` limpo |
| `apps/web` | 131 | build PWA limpo + `build:headless` (bundle pro Android) |
| `services/backend` | 49 | `ruff` + `mypy` limpos |
| `apps/android` | JVM verdes | **APK debug compila, instala e roda** |

### Ambiente Android (custou tempo pra descobrir — anote)

SDK via brew em `/opt/homebrew/share/android-commandlinetools` (platform 35,
build-tools 34/35, licenças aceitas). O `java` do PATH é o **openjdk@11** e o
`sdkmanager`/Gradle recusam; `/opt/homebrew/opt/openjdk` é **JDK 26** e o
Gradle também recusa. Tem que ser o **21**:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
cd apps/android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Testar contra o dev local pelo cabo (nada exposto na rede):
`adb reverse tcp:8420 tcp:8420 && adb reverse tcp:5273 tcp:5273`. O buildType
debug já aponta a TWA pra `http://localhost:5273` e o WS pra
`ws://localhost:8420`; cleartext liberado **só** pra loopback
(`res/xml/network_security_config.xml`).

Rodar local sem docker: `cd services/backend && uv run python scripts/dev_local.py`
(recarrega sozinho ao salvar em `app/` — a factory fica em `app/dev.py`,
porque reload exige import string que o subprocesso do reloader consiga
importar)
(fakeredis + sqlite em memória, porta **8420**) e `npm run dev -w @rolai/web`
(porta **5273**).

## O que mudou nesta sessão

### rules-engine

- **Dado Fudge/Fate (`4dF`)**: três faces valendo −1/0/+1. No AST vira
  `sides: 3` + flag `fudge`; o roller mapeia o intervalo. Keep/drop funciona,
  `!r` é erro de parse (alvo numérico não faz sentido nessas faces). A fila
  `deterministic` usa os próprios valores (−1..1).
- **Profiles novos**: `fate` (4dF + habilidade vs dificuldade), `d20` (com
  vantagem/desvantagem, crítico e falha crítica) e `d100` (BRP/Cthulhu,
  rolagem por baixo com tiers derivados da perícia).
- **`select` com `options`** no schema de profile: aceita string ou
  `{value,label}`; o `value` é interpolado cru na notação
  (`"1d20{input.mode}"` → `1d20adv`) e **só valores declarados são aceitos**.
- **`{input.x}` também nas `condition`** das `outcome_rules` — é o que
  permite CD/dificuldade/perícia serem dado do jogador. Na validação de
  schema o placeholder vira `0` só pra checar sintaxe.

### backend

- **Protocolo WS ganhou a aparência do dado por jogador**: `style` (JSON,
  validado por `DiceStyle`) vai na query do handshake, é guardado no roster e
  volta em cada broadcast de rolagem. Novo evento `{"type":"roster"}` avisa a
  sala quando alguém entra ou sai (antes o roster só vinha no snapshot).
- **`exclude_none` na serialização do `RollResult`**: campo opcional agora
  vai ausente, não `null`. Estava vazando `"= null — null"` pra UI.
- **Camada de limites de abuso** (`app/limits.py`, janela fixa no Redis por
  IP): teto de criação de sala (30/h), de profiles (10/h), HTTP geral
  (120/min, `/health` isento), conexões WS (30/min), gente por sala (20),
  corpo de requisição (64KB), apelido (24 chars), formato do código de sala.
  Checagem de `Origin` no WS (CORS não vale pra WebSocket). `--ws-max-size` e
  `--limit-concurrency` no uvicorn. Redis com `maxmemory`+`allkeys-lru`,
  `mem_limit` em todos os containers, senha do Postgres obrigatória,
  `rateLimit`/`buffering`/HSTS no Traefik. Tudo documentado em
  `docs/security.md` (seção "Abuso e recursos").

### web

- **Compositor**: remoção de dado visível (botão `−` por tipo, `×` no chip do
  pool, "Limpar"); pool vazio é estado válido (ROLAR desativa); pool misto;
  botão de `dF`; ícones com o formato real de cada dado.
- **Aparência do dado**: presets + cores (corpo/número/contorno) + 20
  texturas + material (com opção "automático"), persistido. **As texturas não
  funcionavam**: os `.webp` da lib nunca eram servidos — agora estão em
  `apps/web/public/textures/` e há teste que quebra se alguém expuser textura
  sem arquivo.
- **Cada jogador vê o dado do outro na cor do outro**; nome do jogador é
  exibido com as cores do dado dele (histórico e roster).
- **Sala**: link `?room=CÓDIGO` entra direto; apelido editável dentro da sala
  (reconecta); apelido persistido.
- **Palco**: dados por cima de toda a UI; clique em qualquer lugar (menos
  controles) ou Esc dispensa; abrir o menu também dispensa.
- **Preferências** virou o lugar do sistema de regras ("Regras da mesa"),
  aparência do dado, render e stream. Modal com altura limitada ao viewport e
  rolagem só no corpo.
- Tiers 3D agora diferem **só na sombra** — o "leve" baixava a luz e deixava
  o mesmo dado visivelmente mais escuro.

## Próximos passos

### 1. Modo stream/OBS — FEITO (2026-08-05)

Implementado conforme o desenho abaixo, com uma diferença decidida pelo
usuário: o **resultado da rolagem também aparece** na stream (overlay na
base central, fade-out automático após 8s). Protocolo final:

- **URL própria**: `?room=CÓDIGO&stream=1`. O `main.tsx` escolhe entre
  `App` e `StreamApp` pelo `parseStreamParams` (`apps/web/src/stream.ts`).
  A StreamApp desenha SÓ o palco full-viewport — sem menu, sem painel, sem
  histórico — com fundo transparente real (alpha). `&chroma=rrggbb` (ou
  `&fundo=`) pinta cor sólida pra quem não pode usar alpha.
- **Espectador**: a URL de stream conecta com `spectator=1` no handshake
  WS. Espectador não entra no roster (entrada/saída não geram evento
  `roster`), não conta no `max_members_per_room` (teto próprio:
  `MAX_SPECTATORS_PER_ROOM`, default 5, em `app/config.py`), recebe
  snapshot com histórico **vazio** (só anima rolagens novas) e qualquer
  `{"type":"roll"}` vindo dele volta `{"type":"error","message":
  "spectator_cannot_roll"}` sem broadcast. Broadcast de rolagem vai pra
  jogadores E espectadores. `RoomClient` também tem guarda local
  (`send()` é no-op pra espectador).
- **"Copiar link pro OBS"** no modal de Sala copia a URL de stream da sala.
- A preferência **"Fundo (OBS)" saiu** do app (o app normal sempre segue o
  tema; alpha/chroma são parâmetros da URL de stream). `BackgroundSettings`
  e o CSS `obs-transparent` foram removidos.
- Sala inexistente/inválida na URL de stream: mensagem mínima em texto
  pequeno (`.stream-status`), sem crashar a Browser Source.

Domínio de produção definido: **rolai.app** (frontend estático, Cloudflare)
+ **api.rolai.app** (backend no VPS Hostinger atrás do Traefik). Ver
`.env.example` e `docs/deployment.md`.

### 2. Segurança — bloco 2 — FEITO (2026-08-05)

Implementado e documentado em `docs/security.md` (seção "Abuso e recursos"):

- **Teto global de salas ativas** (`MAX_ACTIVE_ROOMS`, default 1000): set
  Redis `rooms:active` prunado a cada criação (sala expirada deixa de
  contar); `POST /rooms` devolve **503** no teto.
- **Expurgo de profiles custom**: coluna `created_at` em `profiles`,
  `purge_old_profiles` (`app/profiles.py`) rodada por task asyncio no
  lifespan (boot + a cada `PROFILE_PURGE_INTERVAL_SECONDS`, default
  diário); TTL `PROFILE_TTL_DAYS` (default 30). Atenção ao deploy num
  Postgres já existente: sem migrations, a coluna nova exige dropar a
  tabela ou `ALTER TABLE` (nota em `docs/security.md`).
- **Log estruturado** no logger `rolai` (`app/logs.py`), key=value, stdlib:
  INFO pra sala criada/profile criado/WS aberta-fechada/expurgo, WARNING
  pra todo limite atingido e payload rejeitado.

Backend naquele momento com 44 testes. **Hoje (2026-08-07): 56**, `ruff` +
`mypy` limpos. Contagem atual das outras frentes: web 144, Android 20 JVM +
8 instrumentados.

### 3. Etapa 04 — overlay Android — FEITO e VALIDADO EM APARELHO (2026-08-07)

Escrita sem SDK em 2026-08-05 (nada compilava na época); desde então
compilada, assinada, publicada e exercitada num aparelho físico:

- APK de **release assinado** nas Releases (chave própria, secrets no CI);
- TWA verificada pelo Android — `pm get-app-links` devolve
  `rolai.app: verified`, abre sem barra de URL;
- **8 testes instrumentados** passando (`scripts/run-instrumented.sh`);
- conexão de sala sobrevive a 160s ociosa com a tela apagada.

- **TWA**: `TwaActivity` (androidbrowserhelper 2.6.0) → `https://rolai.app`,
  intent-filter `autoVerify`. `apps/web/public/.well-known/assetlinks.json`
  criado com placeholder de fingerprint SHA-256 (o build do vite copia
  `.well-known/` pro dist — verificado). Geração do fingerprint real
  documentada no `apps/android/README.md`.
- **Launcher nativo** (`SettingsActivity`), não a TWA — é onde mora o
  toggle do overlay e o pedido de `SYSTEM_ALERT_WINDOW`
  (`ACTION_MANAGE_OVERLAY_PERMISSION`, só na ação explícita) +
  `POST_NOTIFICATIONS` (API 33+). Campos: sala, apelido, rolagem rápida,
  seletor de sistema (lê `assets/headless/systems.json`), inputs JSON,
  servidor WS.
- **`OverlayService`**: foreground service tipo **`specialUse`** — decisão
  com fonte oficial no manifest: nenhum tipo cobre overlay interativo
  persistente; `dataSync` tem teto de 6h/24h na API 35+
  (developer.android.com/develop/background-work/services/fg-service-timeout)
  e `connectedDevice` é pra dispositivo externo. Exige
  `FOREGROUND_SERVICE_SPECIAL_USE` + `<property>`
  `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` no manifest (ambos presentes).
  Notificação persistente (canal LOW, ação "Encerrar").
- **OverlayView**: bolha 🎲 arrastável com snap na borda + painel
  (status da sala, ROLAR, resultado, últimas atividades). Sem campo de
  texto → `FLAG_NOT_FOCUSABLE`, nunca rouba teclado do app em primeiro
  plano. Tier texto puro, nunca 3D (docs/architecture.md).
- **RoomClient** (OkHttp WS): handshake
  `/rooms/{code}?name=...&style={json}` — o `style` é a aparência de dado
  DESTE aparelho, e sem ele a mesa animava a nossa rolagem com a cor dela.
  `spectator` fica de fora de propósito (o overlay é jogador). Envia `{"type":"roll","result":...}`
  já calculado, parseia snapshot/roster/roll/error, reconexão com backoff
  exponencial 1s→30s (`ReconnectBackoff`), **não** reconecta em close
  4404 (sala inexistente).
- **Cálculo via WebView headless** (`HeadlessRoller`): novo entry
  `apps/web/src/headless.ts` expõe `rolai.{systems,roll,rollWithProfile}`
  (aceita `optionsJson` com fila `deterministic` — usado só por testes).
  Build vite lib-mode (`vite.headless.config.ts`) → IIFE único;
  `npm run build:headless -w @rolai/web` builda e instala em
  `apps/android/app/src/main/assets/headless/` (bundle + `systems.json`
  gerados do próprio bundle — fonte única). WebView restrita:
  `blockNetworkLoads`, `shouldOverrideUrlLoading` sempre true, bridge
  `RolaiBridge.onResult` só recebe texto. `node:fs/promises` do
  `loadProfile` vira stub no bundle, mas é caminho morto — o headless
  sempre passa o objeto `SystemProfile`, nunca um id.
- **Gradle**: `compileSdk/targetSdk 35`, `minSdk 26`, JDK 17, repos em
  `settings.gradle.kts` (o skeleton não tinha — nada resolvia), wrapper
  properties Gradle 8.7 (sem `gradlew`/jar versionados — gerar no 1º
  open). Deps: androidbrowserhelper 2.6.0, appcompat 1.7.0 (LauncherActivity
  exige tema AppCompat — `Theme.RolaiTwa`), core 1.13.1, okhttp 4.12.0.
- **Verificado na época (sem SDK)**: `npm run build:headless` verde;
  `apps/web/src/headless.test.ts` (5 testes) carrega o bundle real e
  prova paridade com o rules-engine na mesma fila determinística; web
  inteiro verde (**123 testes**, 118+5) e `npm run build` (tsc + vite)
  limpo.
- **NÃO executado (depende de SDK)**: `testDebugUnitTest` (3 classes JVM
  puras: backoff, validações, URL do WS) e `connectedDebugAndroidTest`
  (`OverlayServiceTest`, `RoomClientReconnectTest` com MockWebServer,
  `HeadlessRollerParityTest` com valores assados do bundle). Pré-requisitos
  `appops`/`pm grant` no README.
- **Pontos de atenção pra 1ª compilação real**: (1) imports/anotações
  Kotlin não passaram por compilador; (2) `Switch`/`EditText` da
  plataforma sem appcompat na SettingsActivity é intencional — se der
  erro de tema, trocar tema da activity; (3) o `systems.json`/bundle em
  `assets/` é versionado — rebuildar ao mudar rules-engine/profiles;
  (4) `ic_dice.xml` é drawable simples como ícone do app — trocar por
  adaptive icon antes de publicar; (5) teste manual do spec (PDF +
  overlay + 2º dispositivo) ainda pendente.

### 4. Etapa 05 — deploy/CI — FEITO (2026-08-05, parcial: sem daemon docker)

Validado tudo que dava sem daemon (colima desligado na máquina):

- **Compose**: os 3 cenários parseiam limpos (`docker compose --env-file .env
  -f infra/docker-compose.yml [overrides] config`). Atenção: da raiz do repo é
  preciso `--env-file .env` — o compose só lê `.env` do diretório do projeto
  (`infra/`) por padrão. Documentado em `docs/deployment.md`.
- **`infra/docker-compose.yml`**: agora repassa pro container os limites de
  abuso opcionais do `.env.example` (MAX_ACTIVE_ROOMS, PROFILE_TTL_DAYS etc,
  com defaults espelhando `app/config.py`) — antes, setar no `.env` não tinha
  efeito nenhum no container.
- **`services/backend/Dockerfile`**: estava **quebrado** — `pip install .`
  rodava antes do `COPY app`, e o setuptools falha com `package directory
  'app' does not exist` (pyproject declara `packages=["app"]`). Ordem
  invertida; wheel constrói (`pip wheel --no-deps .` verde).
- **CI**: job `web` ganhou `npm run build` (tsc -b && vite build) — era a
  única cobertura que faltava. Dev extras do backend (`fakeredis`,
  `aiosqlite`) confirmados no pyproject; `pip install ".[dev]"` basta.
- **CasaOS**: `infra/casaos/icon.png` criado (cópia do
  `apps/web/public/icon-512.png`); `app.json` já estava completo no padrão
  do catálogo.
- **`npm audit --audit-level=high`** na raiz **falha**: 1 critical
  (`vitest`, via `@vitest/mocker` — leitura/execução de arquivo arbitrário
  com a UI do vitest ouvindo), 1 high (`vite` — path traversal em `.map` de
  deps otimizadas, dev server). Tudo em cadeia de dev tooling (vite/vitest/
  vite-plugin-pwa); nada vai pra imagem de produção do backend nem pro build
  estático do frontend. Fix exige bump major (vite 8) — **não feito**;
  decidir separadamente. Enquanto isso o job `web` do CI ficará vermelho no
  step de audit.
- **Pendente (validação manual com daemon)**: `docker compose ... up` nos 3
  cenários e `docker build` do backend.

### 5. Overlay Android — acabamento (2026-08-06)

**Dado fantasma: causa raiz achada e resolvida.** O Android 12+ clampa em
**0.8 o alpha de qualquer janela de overlay com `FLAG_NOT_TOUCHABLE`**
(anti-tapjacking, `maximumObscuringOpacityForTouch`). O desconto é aplicado
na janela pelo compositor do sistema — por isso material opaco, filtro CSS,
`preserveDrawingBuffer`, `premultipliedAlpha` e `LAYER_TYPE_HARDWARE` não
mudavam nada: todos mexiam dentro da página. Provado por `dumpsys window`
(`alpha=0.8` que nunca setamos) e pelo teste de subir o teto do sistema.

Solução (`DiceStageWindow`): a janela do palco **alterna** —
`NOT_TOUCHABLE` parada (toque atravessa, palco invisível) e **tocável**
enquanto há dado na tela (sem clamp → dado sólido); qualquer toque dispensa
os dados e devolve o atravessamento na hora. O palco é adicionado **depois**
do painel, então o dado voa por cima de tudo, painel incluso.

Também nesta rodada: palco funciona **sem sala e offline** (ponte
`window.rolaiStream.play/clear` + `HeadlessRoller`); preset/tamanho/qualidade
do dado viajam na URL do modo stream (`&style=&scale=&quality=`), porque a
WebView do overlay tem `localStorage` próprio; painel do overlay redesenhado
(chips de dado que viram o termo, ROLAR mostrando a notação, ações);
`SettingsActivity` com tema escuro, seções, slider de tamanho e seletor de
qualidade.

### 6. Acabamento visual (2026-08-06)

**Web (Preferências)**: prévia dos dados com as cores e a **textura real**
(o mesmo `.webp` estampado no dado 3D — `DICE_TEXTURE_FILES` mapeia
textura → arquivo, o nome nem sempre bate: `bird` vem de `feather.webp`);
slider de **tamanho** (0.7–1.6× no `baseScale` do motor); e prévia ao vivo —
com o modal aberto, qualquer mudança rola um d20 de verdade no palco atrás
da janela (debounce de 500ms por causa da rajada do color picker).

**Android**: ícone adaptativo próprio (d20 vetorial igual ao logo da web,
fundo verde com gradiente radial — `mipmap-anydpi-v26`), a bolha do overlay
passou a usar o mesmo d20 (emoji renderizava diferente por fabricante), e a
tela de configurações ganhou tema escuro com seções, **paleta de cores para
corpo/número/contorno**, seletores de **textura** e **material**, slider de
tamanho, seletor de qualidade e prévia do dado.

A paleta tem ordem proposital: 6 neutros (branco → preto) e depois 12
matizes dando a volta no círculo cromático com S/L constantes — a primeira
versão era um apanhado das cores dos presets, sem lógica nenhuma.

Como a aparência chega no palco: a WebView do overlay tem `localStorage`
próprio, então **tudo viaja na URL do modo stream** —
`?stream=1&style=&scale=&quality=&body=&number=&outline=&texture=&material=`.
No `apps/web` a precedência é: parâmetros explícitos > preset por id >
o que estiver salvo no navegador (`stream.ts`).

### 7. Roda de cores e harmonia (2026-08-06)

**Roda HSV** no Android: primeiro item de cada paleta é um botão com
gradiente sweep que abre o `ColorPickerDialog` da
`com.github.skydoves:colorpickerview` (Maven Central) — matiz no ângulo,
saturação no raio, barra de brilho embaixo. Duas armadilhas, ambas
documentadas no `ColorWheelDialog`: criar a `ColorPickerView` em código
estoura (`width and height must be > 0`) porque ela gera o bitmap da paleta
antes do layout — por isso usamos o **dialog pronto** da lib; e o builder
herda de AppCompat, então precisa de `ContextThemeWrapper` com tema
AppCompat, já que a `SettingsActivity` é `Activity` pura com tema Material.

**Harmonia automática** (`DiceHarmony`, Kotlin puro, com teste JVM): escolhida
a cor do corpo, o número vira claro ou escuro pelo que tiver **mais contraste
por luminância relativa (WCAG)** — brilho ingênuo erra azul puro (canal 255,
luminância 0.07) e ciano claro —, e o contorno é o próprio corpo escurecido
(ou clareado, se o corpo já for quase preto, senão a borda some). Escolher
número ou contorno à mão desliga o automático.

Na web o equivalente já existe de graça: os três campos são
`<input type="color">`, que abre o seletor nativo do sistema.

### 8. Cor de contorno "não fazia diferença" (2026-08-06)

Reportado nas duas pontas (web e Android). No fonte da lib, o contorno **é**
desenhado — `l != "none" && l != a && (ctx.strokeStyle = l, ctx.lineWidth = 5,
ctx.strokeText(...))`, com `a` = cor do corpo (então contorno igual ao corpo
não desenha nada, de propósito) — mas o `lineWidth` é **fixo em 5** enquanto
fonte e textura escalam com o tamanho do dado. Metade do traço ainda fica
coberta pelo preenchimento do glifo, então sobra ~2px numa textura que
aparece reduzida na tela: a cor escolhida some.

Correção em `makeOutlineVisible` (`renderers/diceBox.ts`): como o `lineWidth`
é setado dentro da função da lib, o único ponto de enganche é o próprio
`strokeText` — trocado apenas enquanto a textura da face está sendo
desenhada (×3.5) e devolvido em seguida.

**Não foi confirmado visualmente em aparelho** nesta rodada (a sessão acabou
antes); vale um olho antes de considerar fechado.

### 9. Limpeza

`dice-roller.zip` continua na raiz do repositório.

## Git, CI e distribuição (2026-08-06)

O projeto passou a ser versionado: <https://github.com/SergioSJS/rolai>
(público, MIT). Antes do push foi feita auditoria — nenhum `.env`, chave ou
senha no que subiu — e o autor dos commits usa o e-mail noreply do GitHub em
vez do pessoal.

- **CI** (`.github/workflows/ci.yml`) roda os quatro pacotes: rules-engine,
  backend, web e **android** (testes JVM + `assembleDebug`, com JDK 21 —
  o 26 o Gradle recusa).
- **Release** (`.github/workflows/release.yml`): tag `v*` (ou disparo manual,
  que atualiza a pré-release `nightly`) compila e anexa o APK. É de **debug**
  de propósito: sem Play Store, não há keystore de release no repo — chave
  privada não entra em git e o CI não precisa de segredo.
- Primeira publicada: **v0.1.0** com `rolai-0.1.0.apk` (3,8 MB).

A URL do backend é resolvida em **runtime**, não no build: o entrypoint do
container escreve `/config.js` a partir de `ROLAI_WS_URL`/`ROLAI_API_URL` e o
app lê `window.__ROLAI_CONFIG__` antes do bundle (precedência em
`apps/web/src/config.ts`: runtime > build > default). A mesma imagem serve
qualquer domínio. **Cuidado**: `config.js` está no `globIgnores` do workbox —
se entrar no precache, o service worker passa a servir a versão do build e a
env do container deixa de valer.

Um percalço que vale lembrar: `pip install .` no CI deixa cópia do pacote em
`build/lib` e o mypy acusa módulo `app` duplicado — resolvido com
`exclude = ["^build/"]`. Local não aparece porque usamos `uv`.

## Aberto (nada disso foi feito)

- **Release assinado**: se um dia for pra loja, keystore em base64 num secret
  e `signingConfig` lendo de env; o `assetlinks.json` em
  `apps/web/public/.well-known/` ainda tem fingerprint placeholder, então a
  TWA abre com barra de URL. Precisa de navegador com Custom Tabs instalado
  (Brave serve; a lib descobre o provedor em runtime, não tem allowlist).
- **Overlay**: "repetir última rolagem" e histórico maior no painel.
- **Deploy**: o stack docker nunca subiu de ponta a ponta.
- **Testes instrumentados** do Android (`androidTest`) nunca rodaram — exigem
  emulador/aparelho conectado.

## Offline (adicionado depois — sessão Kimi)

- Precache do SW agora cobre TUDO que a rolagem local precisa
  (`workbox.globPatterns` com `.webp` incluído — as 38 texturas dos dados
  não eram cacheadas no padrão; `navigateFallback: index.html`).
  54 entradas no precache.
- `useOnline` (`apps/web/src/useOnline.ts`) + badge "Sem conexão — rolando
  offline" no canto inferior esquerdo. Rolagem é 100% local; offline = sem
  salas, como decidido em docs/architecture.md.
- Offline só funciona no BUILD (preview/produção) — `npm run dev` não tem
  SW. Validar com `npm run preview -w @rolai/web` + DevTools → Offline.

## Sessão 2026-08-16 (Firelights, Cartas no Motor, Novos Dados 3D e Overlay Mobile)

- **Cartas integradas à notação do motor de regras (`Nc`, ex: `2c`)**:
  - `packages/rules-engine/src/parser.ts` reconhece termos com sufixo `c` (`sides: 13, card: true`).
  - Valores de 1 a 13 representam Ás (1), números (2..10), Valete (11 / J), Dama (12 / Q) e Rei (13 / K).
  - Sistema **Firelights** adicionado (`packages/rules-engine/profiles/firelights.yaml`), com ação `{2d6+mod}` contra desafio de 2 cartas `{2c}`, computando acerto forte, acerto fraco, falha e combinações (*match*).
- **Separação de renderização entre Dados 3D e Cartas**:
  - `diceFromResult` no web e android pula termos de carta (`card: true`), evitando rolar d10s fantasmas na mesa física 3D.
  - `cardsFromResult` extrai as cartas sorteadas com ranks e naipes, animando o arremesso de cartas 3D via `CardStage3D` enquanto os dados 2d6 rolam com física por cima delas.
  - Cache de texturas SVG corrigido por chave única (`${rank}-${suit}`), eliminando repetição de cartas anteriores.
- **Novos botões de dados e organização**:
  - Adicionados botões de `d2`, `d3`, `d66` e `carta` tanto na versão Web quanto no overlay Android.
  - O overlay Android foi completamente reorganizado em 3 abas limpas (`[ SISTEMA ] [ DADOS ] [ BARALHO ]`), com rótulos compactos (`systemShortLabel`) e botões de rolagem com destaque visual unificado.
  - Submenu colapsável dedicado de **Qualidade e Desempenho** desacoplado da aparência dos dados na `SettingsActivity` do Android.
- **Rolagem mista unificada (Dados + Cartas, ex: `2d6+2c`)**:
  - `handleFreeSubmit` e `OverlayService.rollNotation` avaliam notações mistas como uma única rolagem unificada no motor, sem separar em eventos distintos.
  - `DisplayGroup` agora usa `DisplayRoll` para que cada termo retenha seu tipo (`d6`, `carta`, `dF`, etc.), exibindo chips de dados e cartas juntos com o total e somas corretas.
- **Internacionalização (PT-BR)**:
  - Rótulos de grupos traduzidos (`AÇÃO`, `DESAFIO`, `VERBO`, `SUBSTANTIVO`, `REGULARES`, `FOME/IRA`) e outcomes (`combinação!`).
  - Modal de Ajuda da Notação atualizado com exemplos de cartas (`1c`, `2c`, `{2d6+2} vs {2c}`).

## Sessões 2026-08-19/20 (Year Zero, Trophy, Overlay Layout, WOD5 Sucessos)

### v1.1.1 — Year Zero Engine, Trophy, 3 slots de dados, logs ricos (2026-08-19)

- **Família Year Zero Engine completa**: `yze` (genérico), `yze_fbl`
  (Forbidden Lands — 3 pools: base/perícia/equipamento), `yze_alien`
  (Alien — base + estresse), `yze_wdu` (Vaesen — base + estresse).
  Empurrar rolagem (push) com `sucessos_anteriores` como modificador de
  contagem de sucessos (campo `modifier` + `success_rule`).
- **Perfis Trophy**: Trophy Dark e Trophy Gold (claros vs escuros, ruína
  aumenta).
- **Customização de 3 slots de dados**: web e Android passaram a suportar
  corpo/número/contorno independentes para até 3 tipos de dado (ex.:
  Base verde, Perícia azul, Equipamento cinza no Forbidden Lands; Regular
  verde e Fome/Ira vermelho no Vampiro).
- **Logs ricos no overlay Android**: histórico com `SpannableStringBuilder`,
  cores de slot, negritos em nomes de jogadores, destaque colorido de
  outcomes (verde/amarelo/vermelho conforme tom).
- **Seleção de sistema movida**: as abas de modo (Infaernum, Ironsworn…)
  saíram de dentro da caixa de rolagem e foram para a tela de Preferências
  do Android. Decisão registrada no `AGENTS.md`.
- Correções: abas do Infaernum restauradas, tabs uniformes, escala de
  prévia, tipos TypeScript no build, botão de limpar reposicionado.

### v1.2.0 — Overlay hierárquico, cores de dado, WOD5 sucessos (2026-08-20)

- **Layout hierárquico do resultado no overlay Android**:
  `ResultDisplayLines` divide o resultado em headline (grande, colorida
  pelo tom do outcome) + linha de detalhe (menor, pools nomeados
  separados por `•`) + parâmetros testados (muted). Implementado via
  `formatDisplayLines` em `ResultFormat.kt` e o plano de spans em
  `RichTextPlan.kt` (aplicado por `ResultSpans.kt`).
- **Cores de dado 3D corrigidas**: a segunda rolagem após trocar de modo
  (ex.: Vampiro → livre → Vampiro) resetava todos os dados pra uma cor
  só. `diceBox.updateConfig` não reaplicava os estilos de slot.
- **Compositor preserva notação**: `1[` + clicar "d20" completava
  corretamente em vez de limpar o campo.
- **Grand total de multi-grupo**: `1[1d6] + 2[2d6]` agora mostra a soma
  final.
- **WOD5 — contagem de sucessos de Vampiro v5**:
  - `success_rule: ">=6"` adicionado a `regular` e `hunger` em
    `wod5.yaml`. Cada pool agora reporta o total de sucessos.
  - Par de 10s soma +2 bônus (floor(totalTens / 2) * 2), refletido na
    avaliação contra dificuldade e no total exibido.
  - Headline: `4 sucessos — crítico manchado (Dificuldade: 2)`.
  - Chips com status visual na web: borda verde (≥6), dourada (10),
    vermelha (1 na Fome), opacidade reduzida (falha).
  - No overlay Android: números em `[colchetes]` coloridos (verde ≥6,
    dourado 10); outcomes como "fracasso bestial" e "crítico manchado"
    classificados corretamente no destaque.
  - `wod5Successes` em `format.ts` (web) e cálculo equivalente em
    `ResultFormat.kt` (Android) — apresentação, não regra do motor.
  - Exemplo documentado em `docs/system-profiles.md`.
  - 8 testes no `wod5.test.ts` (rules-engine) + 2 testes novos em
    `OverlayServiceFormatTest.kt`.
