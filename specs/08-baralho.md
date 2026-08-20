# 08 — baralho de cartas

## Objetivo

Baralho de cartas como segundo modo de sorteio, ao lado do dado, seguindo a
mesma escada de qualidade (3D completo / 3D leve / 2D / texto puro) e o
mesmo modelo de confiança (cliente calcula, backend só retransmite). Etapa
1: baralho padrão de 52 cartas + curingas opcionais, local por jogador.
Etapa 2 (fora de escopo aqui): puxada de cartas cruzada com rolagem de dado
(Firelights/Ironsworn) e baralho compartilhado por sala.

## Estado atual (2026-08-15)

`deck-engine` + UI web (texto puro, 2D e **3D real** — malha three.js
própria, não mais o mesmo flip do 2D) + eventos de sala
(deck_draw/deck_shuffle/deck_config, backend + web) + botão flutuante
Android (puxar carta) implementados e testados end-to-end — inclusive
manual com duas abas na mesma sala (log de quem puxou/reembaralhou/mudou
config chega pra todo mundo, mesmo quem está na aba Dados) e manual num
aparelho físico (Poco X3 Pro) pro overlay. Etapa 1 completa.

## Decisão de arquitetura: local por jogador, não por sala

Cada jogador tem seu próprio baralho — sem estado compartilhado entre
membros da sala. Baralho compartilhado exigiria o backend virar dono do
estado (pra evitar dois jogadores puxando a mesma carta ao mesmo tempo),
quebrando a regra de ouro atual (backend nunca calcula/valida, só
retransmite — ver `docs/architecture.md`). Não há caso de uso que
justifique essa exceção agora.

Fica de porta aberta pro futuro: o schema dos eventos WS
(`deck_draw`/`deck_shuffle`/`deck_config`) é desenhado igual ao que seria
necessário num modelo compartilhado — só troca quem calcula (cliente vs.
backend), não o formato. `deck-engine` expõe shuffle/draw/reshuffle como
funções puras isoladas do estado de rede, prontas pra rodar num contexto
server-side no dia em que isso for decidido. Não implementar essa porta
agora — só não fechar.

## Escopo

### `packages/deck-engine` (novo pacote TS)

- Fonte única de lógica de baralho — mesmo papel do `rules-engine` pra
  dado: usado por `apps/web` direto e pela WebView headless do Android,
  nunca duplicado em Kotlin.
- Modelo de baralho: 52 cartas + 2 curingas opcionais.
- Config:
  - `includeJokers: boolean` (default `false`)
  - `removalMode: "permanent" | "returns"` — carta puxada some até
    reembaralhar, ou volta ao monte na hora (modo leitura)
  - `autoReshuffleOnEmpty: boolean` — monte vazio reembaralha sozinho
    (puxando descarte de volta) ou trava esperando ação manual
- `draw(n)`: se `n` > cartas restantes e `autoReshuffleOnEmpty` desligado,
  recusa e sinaliza "faltam N" — não faz draw parcial silencioso.
- RNG: `crypto.getRandomValues`, nunca `Math.random()` — mesmo padrão do
  `rules-engine`.
- Suporte a resultado determinístico por carta (igual ao dado), pra
  permitir animação 2D/3D convergindo pro valor já decidido — necessário
  pro replay de um resultado recebido via WS.

### `apps/web`

- `components/DeckPanel.tsx`: só os controles (quantidade +/-, puxar,
  reembaralhar, contador de restantes). Config (curingas, `removalMode`,
  `autoReshuffleOnEmpty`) mora em **Preferências** (`SettingsPanel.tsx`,
  seção "Baralho") — mesmo tratamento do sistema de regras, não fica
  cravada dentro da caixa de puxar carta. `App.tsx` é dono do estado
  (`deckConfig`) e do `localStorage`; `DeckPanel` recebe `config` como
  prop controlada e só aplica no `DeckState` local quando ela muda.
- Resultado (cartas puxadas) aparece no **palco compartilhado**
  (`App.tsx`), igual ao dado — não dentro do `DeckPanel`. A caixa de
  resultado sempre mostra só o VALOR em texto (chips, como o dado);
  a animação (2D ou 3D) fica numa camada separada, solta por cima de
  tudo, nunca dentro da caixa.
- Escada de qualidade reaproveitada do dado (mesmo setting em
  `localStorage`, lida direto por `App.tsx`/`StreamApp.tsx`):
  - Texto puro: chips `10♥ Q♠` na caixa de resultado.
  - 2D: `components/CardStack.tsx` + `CardFlip.tsx` — flip CSS 3D
    (`rotateY`) sobre SVG da carta, cartas em escada (uma cobre parte da
    anterior, sem tampar o índice). Sobreposição entre cartas é
    **calculada** (mede a largura real da carta renderizada e o espaço
    disponível), não um valor fixo — um passo fixo cabia bem com poucas
    cartas mas só cortava na tela com muitas.
  - **3D completo/leve — implementado de verdade**:
    `components/CardStage3D.tsx` monta uma cena three.js própria
    (`cardScene3D.ts`) num `<canvas>`, independente do `dice-box-threejs`.
    Entra por `LazyCardStage3D` (import dinâmico, desde 2026-08-20): o
    three inteiro estava no chunk de entrada por causa deste import, e quem
    só rolava dado baixava a cena do baralho junto — 126KB gzip a menos no
    primeiro load. Enquanto o chunk não chega, o fallback é o próprio flip
    2D (`CardStack`), o mesmo pro qual o palco já caía sem WebGL; o chunk é
    aquecido quando a aba Baralho abre e, no modo stream, já na montagem
    (no OBS a carta chega sem aviso).
    `BoxGeometry` fina (não plano) com a face da carta de um lado e o
    verso do outro — rotacionar o mesh 180° troca o que a câmera vê, sem
    trocar material. Textura vem de `cardTexture.tsx`: rasteriza o
    componente SVG da carta (`renderToStaticMarkup` + canvas 2D) num
    `THREE.CanvasTexture`, cacheada por carta. **Sem física** (cannot-es):
    ao contrário do dado, a carta só precisa flipar e pousar num lugar
    decidido — um tween manual (posição/rotação/escala com easing) basta,
    sem dependência nova. Fallback pro flip 2D se `WebGLRenderer` falhar
    (mesmo padrão do dado caindo pro texto puro).
    Lições da primeira versão (documentadas no código, não repetir):
    giro de "flourish" (mais de meia-volta) faz a caixa fina passar pela
    zona "de canto" (larga em Z) mais de uma vez — com cartas vizinhas
    empilhadas, isso *atravessa* uma carta na outra visualmente. Fica só
    um giro de 180°, com a rotação terminando bem antes do resto do
    movimento (e cartas escalonadas com folga: só uma fica "de canto" por
    vez). `MeshStandardMaterial` do three.js **ignora o alfa da textura**
    sem `transparent: true` — cantos arredondados da carta viravam preto
    sólido em vez de deixar o palco transparecer.
    Brilho: a primeira versão usava `MeshStandardMaterial` + luz de cena
    (`AmbientLight`/`DirectionalLight`) + `ACESFilmicToneMapping` — reduzia
    o estouro, mas o resultado variava entre GPU/WebView (mobile e desktop
    liam a mesma luz de jeitos visivelmente diferentes) e, mesmo ajustado,
    ainda ficava claro demais contra o tema escuro do app ("queima os
    olhos", segundo teste real). Resolvido trocando de raiz: material
    **unlit** (`MeshBasicMaterial`, sem luz nenhuma na cena, sem tone
    mapping) — a cor que sai é a textura, ponto, sem variável de GPU no
    meio — e a textura em si vem ESCURECIDA na origem: `cardTexture.tsx`
    escala os canais RGB pra 72% via `getImageData`/`putImageData` (pixel a
    pixel, não `globalCompositeOperation: "multiply"` — testado que o blend
    mode não escurecia o bastante em todo motor de canvas). O tier 2D
    (`CardFlip`, `styles.css`) leva o mesmo fator via `filter:
    brightness(0.72)`, pra não ficar mais claro que o 3D.
    Não pesquisado lib de terceiro pra isso (`cardsJS`,
    `deck-of-cards`, `Threejs-interactive-card` — todas hobby-project sem
    manutenção ativa na pesquisa original) — a malha própria reaproveita o
    `three` que já é dependência (via `dice-box-threejs`) e fica pequena
    o bastante pra não valer a dependência externa.
- Assets visuais: **`@letele/playing-cards`** (npm, CC0-1.0, componentes
  React SVG por carta — `Sq`, `Ha`, `C10`, `J1`/`J2` de curinga, `B1`/`B2`
  de verso). Achado via busca no registro do npm: o sandbox de build não
  tem egress de rede pra `kenney.nl`/`github.com` (só `registry.npmjs.org`
  e `raw.githubusercontent.com` responderam), então as opções pesquisadas
  no planejamento original (Cardmeister, `htdebeer/SVG-cards`, direto do
  GitHub) não deram pra baixar — o pacote npm resolveu o mesmo problema
  sem precisar de download manual. Detalhe de empacotamento: o pacote só
  declara `"module"` no `package.json` (sem `"main"`/`"exports"`), o que
  quebra a resolução do Vite — contornado com `resolve.alias` em
  `vite.config.ts` apontando direto pro `dist/index.esm.js`. Mapeamento
  `Card` (deck-engine) -> nome do componente em `cardFormat.ts`
  (`cardComponent`).
- Som: **sintetizado via Web Audio API** (`deckSound.ts`: ruído filtrado
  com decaimento curto — não é asset binário nenhum). O plano original era
  o Kenney Casino Audio (CC0), mas `kenney.nl` também ficou fora do
  alcance de rede do sandbox de build; sintetizar evita a dependência de
  download por completo (e evita a questão de licença/atribuição de
  qualquer pacote de SFX de terceiro).
- Modo stream (OBS): `window.rolaiStream` ganha `playCard(...)` ao lado do
  `play(...)` de dado existente.
- Histórico de sala: eventos `deck_draw`/`deck_shuffle`/`deck_config` no
  mesmo canal de histórico da rolagem, atribuídos ao apelido de quem
  operou — mesma ressalva de trust model do apelido hoje (sem conta,
  atribuição de boa-fé, não prova criptográfica).

### `apps/android`

- **Implementado**: `StreamApp.tsx` (o palco, `assets/stage/`) ganhou
  `window.rolaiStream.playCard(cards)` ao lado do `play(resultado)` que já
  existia — mesmo contrato (aceita objeto ou JSON em string, já que
  `evaluateJavascript` do Kotlin entrega string), mesmo overlay de stage,
  mesma limpeza automática. Também escuta `deck_draw` da sala (não só
  `roll`) — puxada de outro jogador aparece na Browser Source do OBS igual
  a uma rolagem. `npm run build:stage` testado (build de produção real,
  não só `vitest`) e confere: 129 arquivos, o bundle inclui
  `@rolai/deck-engine` + `@letele/playing-cards` sem erro.
- **"Puxar carta" no overlay (implementado e validado em aparelho físico —
  Poco X3 Pro)**: NÃO é mini-bolha própria no fan — depois de tentar isso e
  o usuário pedir de volta, virou uma seção "Baralho" dentro do PAINEL
  (compositor de dado), com stepper de quantidade + botão "Puxar"
  (`OverlayView.kt::buildPanel`), logo abaixo do `ROLAR` do dado. Config
  fixa (sem curinga, remoção permanente, sem reembaralhar sozinho) — o
  overlay ainda não tem tela própria pra essas opções, só a tela cheia do
  app. A mini-bolha "rolar" do fan (repete a última ação) agora vale pra
  QUALQUER coisa — dado ou carta: `OverlayService.lastRollAction` é
  reatribuído em `onDeckCalculated` do mesmo jeito que em
  `rollNotation`/`rollWithInputs`, sem precisar de um segundo tipo de
  "última ação".
  - A suposição original desta seção ("deck-engine não precisa entrar no
    bundle headless") **caiu** assim que o botão flutuante virou pedido de
    verdade: sem UI própria, quem calcula o draw é a MESMA WebView headless
    do dado. `headless.ts` ganhou `rolai.deckDraw`/`rolai.deckReshuffle`,
    reusando o bridge `RolaiBridge.onResult` existente — a entrega carrega
    um campo `kind:"deck"` extra pra `HeadlessRoller.kt` rotear pro par de
    callbacks certo (`onDeckResult`/`onDeckError`) sem precisar de uma
    segunda WebView. `build:headless` cresceu de ~170KB pra ~173KB.
  - `HeadlessRoller` é recriada a cada `OverlayService` — o `DeckState`
    (monte/descarte) não sobrevive sozinho entre chamadas. `OverlayService`
    guarda o `DeckState` serializado (`deckStateJson`) e persiste em
    `SharedPreferences` a cada puxada, igual `lastRollAction`/`KEY_LAST_ROLL`
    já faz pra rolagem — sobrevive a um restart do processo (Doze/memória
    baixa), só reseta se o app for desinstalado ou os dados limpos.
  - `DiceStageWindow.playCard(cardsJson)` (espelha `play()`) e
    `RoomClient.sendDeckDraw`/`Listener.onDeckDraw` (espelha
    `sendRoll`/`onRoll`) fecham o mesmo caminho que a rolagem já tinha:
    puxada fora de sala anima o palco local direto; em sala, só quando o
    eco do servidor chega (evita animar duas vezes, mesmo raciocínio do
    `onRollCalculated`).
  - Testado no aparelho: duas puxadas seguidas (J♥, depois Q♥) — badge
    nativo com o texto certo, naipe vermelho, carta diferente a cada vez
    (confirma que o monte avança, não reseta), palco local renderizando a
    carta, histórico do overlay com as duas linhas ("você: J♥", "você:
    Q♥"), sem erro no logcat.

## Fora de escopo nesta etapa

- Baralho compartilhado por sala / backend autoritativo (ver decisão
  acima).
- Puxada cruzada com dado (Firelights/Ironsworn: 2 cartas vs.
  2d6+atributo, sucesso completo/parcial/falha) — etapa 2, precisa de um
  novo tipo de profile no `rules-engine` combinando dado+carta.
- Baralho de tarô ou qualquer baralho customizado — só o padrão de
  52+curingas.
- Múltiplos baralhos simultâneos por jogador.

## Critérios de aceite

- `npm test` em `packages/deck-engine` cobre: shuffle não duplica/perde
  carta, `draw` respeita `removalMode` e `autoReshuffleOnEmpty`, toggle de
  curinga muda o tamanho do monte, resultado determinístico por carta bate
  com o valor pedido.
- `npm test -w @rolai/web` cobre seleção de tier pra carta (reaproveitando
  o teste de tier do dado) e montagem do payload de
  `deck_draw`/`deck_shuffle`/`deck_config`.
- Teste manual documentado no PR: puxar carta nos quatro tiers de
  qualidade, reembaralhar, esvaziar o monte com `autoReshuffleOnEmpty`
  ligado e desligado. **Feito** — inclusive puxada de 8+ cartas no tier 3D
  (testa o caso que mais expõe bug de sobreposição/timing). Nota: "3D
  completo" e "3D leve" hoje renderizam a MESMA cena (`CardStage3D`) sem
  diferença de qualidade entre si — ao contrário do dado (que varia
  sombra/luz entre os dois), a cena de carta já é leve o bastante (sem
  física, textura pequena) pra não precisar de dois níveis por ora.
- Instrumented test Android (mesmo espírito do `KeepDropHeadlessTest` do
  dado) confirma que o resultado calculado pela WebView headless bate com
  o mesmo input rodado em `packages/deck-engine` — engine desatualizado no
  bundle é bug silencioso, igual ao caso já documentado do dado.
- `build:headless` e `build:stage` regenerados antes de gerar APK de
  release, com a checagem de `AGENTS.md`.
