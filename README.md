# Rolaí

Dice roller multiplayer pra mesas de RPG: rolagem 3D com física, salas
efêmeras compartilhadas por link, histórico exportável e um app Android com
botão flutuante que rola por cima de qualquer outro app (o leitor de PDF da
ficha, por exemplo).

## Baixar o app Android

O APK sai da [página de Releases](../../releases) — é um build de **debug**
assinado com a chave de debug do Android (o projeto não vai pra Play Store).
Pra instalar, libere "fontes desconhecidas" no aparelho.

Pra abrir em tela cheia sem barra de URL, o app precisa de um navegador com
suporte a Custom Tabs instalado (Chrome, Brave…).

## O que tem aqui

```
packages/rules-engine/   TypeScript — parser da notação + profiles de sistema
                         (d20, Fate/Fudge, PbtA, FitD, Ironsworn, d100).
                         Fonte única das regras: web e Android usam este mesmo
                         código, nunca uma reimplementação.
apps/web/                React + Vite. PWA, palco 3D, salas, modo stream/OBS.
apps/android/            Kotlin. TWA + Foreground Service com overlay flutuante
                         e WebView headless rodando o rules-engine.
services/backend/        Python + FastAPI. Relay de sala (WebSocket) + REST.
infra/                   docker-compose (Hostinger/Traefik e ZimaOS/CasaOS).
```

Arquitetura em [`docs/architecture.md`](docs/architecture.md); o estado atual
e o que continua aberto em [`docs/handoff.md`](docs/handoff.md).

## Rodar local

```bash
npm install

# backend sem docker (fakeredis + sqlite em memória), porta 8420
cd services/backend && uv run python scripts/dev_local.py

# web, porta 5273
npm run dev -w @rolai/web
```

Testar o app Android contra esse ambiente, pelo cabo USB (nada exposto na
rede):

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21   # o Gradle recusa o JDK 26
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
adb reverse tcp:8420 tcp:8420 && adb reverse tcp:5273 tcp:5273
cd apps/android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Testes

```bash
npm test -w @rolai/rules-engine      # 79
npm test -w @rolai/web               # 144
cd services/backend && uv run pytest # 56
cd apps/android && ./gradlew testDebugUnitTest   # 20 (JVM, sem aparelho)
```

Instrumentados do Android (precisam de aparelho/emulador conectado):

```bash
apps/android/scripts/run-instrumented.sh   # 8
```

Não rodam no CI de propósito — emulador em Actions é lento e instável.
Rode antes de gerar release.

## Modo stream (OBS)

`?stream=1&room=CÓDIGO` desenha só os dados, com fundo transparente de
verdade — feito pra Browser Source. `&chroma=rrggbb` troca por chroma key, e
`&style=`, `&scale=`, `&quality=` ajustam a aparência sem depender do
localStorage do navegador (é assim que o overlay Android configura o palco).

## Agradecimentos e Créditos

O Rolaí é construído sobre excelentes recursos e bibliotecas abertas:

- **Efeitos Sonoros de Baralho**: [Kenney.nl](https://kenney.nl) — *Casino Audio* (efeitos de manuseio e embaralhamento de cartas gravados em alta qualidade, sob licença **CC0 1.0 Universal / Domínio Público**).
- **Cartas de Baralho Vetoriais**: [@letele/playing-cards](https://github.com/letele/playing-cards) — Baralho clássico em SVG vetorial de alta definição (licença **MIT / CC-BY**).
- **Renderizador e Física 3D dos Dados**: Frank Ali e comunidade por [`@3d-dice/dice-box-threejs`](https://github.com/3d-dice/dice-box-threejs) (Three.js + Cannon-es, licença **MIT**).
- **Texturas e Temas de Dados**: MajorVictory, SpencerThayer e contribuidores da comunidade tabletop 3D.
- **Tipografia**: Fontes [*Cinzel*](https://fonts.google.com/specimen/Cinzel) (Natanael Gama) e [*Inter*](https://fonts.google.com/specimen/Inter) (Rasmus Andersson) via Google Fonts (SIL Open Font License).

## Licença

MIT — veja [`LICENSE`](LICENSE).
