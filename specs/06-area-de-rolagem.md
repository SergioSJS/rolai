# 06 — área de rolagem limitada, com barreira que brilha

## Objetivo

O dado não pode parar embaixo da placa de resultado — hoje para, e o número
fica ilegível. O limite inferior da mesa passa a terminar onde a placa começa,
e a barreira acende um brilho leve no ponto em que o dado bate, pra que o
limite se leia como parede e não como bug.

Vale igual em desktop, celular (retrato e paisagem), overlay do Android e
Browser Source do OBS — é o mesmo `.stage` nos quatro.

## O que a dice-box impõe (verificado no bundle, não suposto)

Referências: `node_modules/@3d-dice/dice-box-threejs/dist/dice-box-threejs.es.js`.

- **O mundo vem do container.** Paredes em `±0.93 * containerHeight` (e
  `containerWidth`), câmera de arremesso em `cameraHeight.far`. Disso sai uma
  escala fixa de **0,5 px por unidade de mundo** — a meia-altura visível é
  `containerHeight` unidades e `clientHeight/2` px. Consequência prática: a
  parede de baixo cai em **96,5% da altura do palco**, não na borda. O brilho
  nasce ali, 3,5% acima do fim do palco.
- **Ela não observa o container** (`:16874`): só relê no `window.resize`, com
  debounce de 1 rAF. Mudar o CSS sozinho não move parede nenhuma — tem que
  chamar `box.setDimensions({x, y})`, que é síncrono.
- **`makeWorldBox()` recria os corpos das paredes** a cada `setDimensions`
  (`removeBody` seguido de `new`). Qualquer listener presa numa parede morre no
  resize; a identidade dos corpos também muda.
- **Colisão já é observável.** Cada dado nasce com
  `body.addEventListener("collide", this.eventCollide.bind(this))`. O `bind`
  resolve `box.eventCollide` **na criação do dado**, e os dados são recriados a
  cada rolagem — então trocar `box.eventCollide` uma vez, no `init`, pega todas
  as rolagens seguintes.
- **`eventCollide({ body, target })`**: `body` é o outro corpo (`mass === 0` para
  parede/mesa), `target` é o dado. Comparar `body === box.box_body.bottomWall`
  identifica a barreira; `target.position.x` dá onde bateu.
- **`box.animstate === "simulate"`** é a passada headless que decide o resultado.
  Ignorar: senão o brilho pisca antes de o dado aparecer.

## Escopo

### 1. Faixa reservada embaixo

- `--stage-bottom` aplicado ao `.stage`. `App` e `StreamApp` compartilham o CSS,
  então vale nos dois de graça.
- Medir a placa de verdade, não estimar: `useLayoutEffect` mede depois do commit
  do painel e só então dispara a rolagem.
- **Ordem obrigatória**: commit do painel → medir → `renderer.resize()` →
  `roll()`. Custa 1 frame (~16 ms). Nunca redimensionar com dado no ar — as
  paredes andam por baixo dos dados em voo e a física empurra o que ficou fora.
- O hook força o próprio commit em vez de pegar carona no `setState` de quem
  chamou. Depender do estado alheio funciona hoje (os dois apps trocam o
  resultado antes de rolar) e quebraria calado no dia em que alguém rolasse sem
  mexer em estado — o teste de ordem pegou exatamente isso.
- **Medir altura (`offsetHeight`), não posição.** A animação de entrada tem
  `translateY(8px)`: medir por `getBoundingClientRect().top` durante o fade dá
  8px a menos (foi o que fez a folga medida sair 24px em vez dos 32px de
  `padding-bottom`). Reserva = altura da placa + `padding-bottom` do
  `.stage-overlay`.
- **Piso**: `min(altura medida, ~45% da altura)`. Celular em paisagem tem ~390px
  de altura; sem piso sobraria mesa nenhuma.
- Alturas medidas em 2026-08-07 (só pra dimensionar o problema — a implementação
  mede em runtime): desktop 1280×833 → 198px simples, 227px multi-grupo; mobile
  390×844 → 172px simples, 214px multi-grupo, 247px pool 10d6. Varia ~75px e o
  **pior caso troca de lugar** entre desktop e mobile, então faixa fixa por
  breakpoint erra em algum caso.

### 2. Tamanho aparente do dado

O tamanho na tela é proporcional a `diagonal/altura` do container. Encurtar
aumenta o dado: **+30% no desktop** (faixa de 240px em 1280×833), **+8% no
mobile** (250px em 390×844).

Compensar no `baseScale` mantém o dado do tamanho de hoje — sem compensar, 10d6
lota uma mesa que ficou 30% menor.

A compensação vale **só na construção**: a `DiceFactory` cacheia a geometria por
tipo de dado no primeiro uso e o `scaleGeometry()` desta versão da lib é vazio,
então mexer em `baseScale` depois não teria efeito (e deixaria tipos diferentes
com escalas diferentes). Se a faixa crescer no meio da sessão, o dado fica alguns
por cento maior — imperceptível, e não vale cirurgia no cache da lib.

### 3. Brilho da barreira

- **DOM, não WebGL.** Barra absoluta dentro do `.stage`, em `top: 96.5%`, com um
  brilho radial posicionado no X do impacto. Não mexe em estado de WebGL, não
  custa shader, e funciona igual na WebView do overlay.
- Impacto → `screenX = clientWidth/2 + target.position.x * 0.5` (a escala de 0,5
  acima). Acende e apaga em ~350ms.
- Filtros, todos necessários:
  - `box.animstate !== "simulate"`;
  - `body === box.box_body.bottomWall`;
  - velocidade do dado acima de um piso (a lib usa 250 pro som) — senão dado
    encostado tremendo acende sem parar;
  - throttle (~60ms) e teto de acendimentos por rolagem.
- **Ler a parede na hora do evento**, nunca guardar a referência: como os corpos
  são recriados a cada `setDimensions`, uma referência guardada apontaria pra
  parede de um mundo que não existe mais. Lendo `box_body.bottomWall` dentro do
  handler, o resize deixa de exigir religar qualquer coisa.
- Transparência: parado, nada desenhado. Em OBS com fundo alpha não pode aparecer
  barra nenhuma sem rolagem.
- Tiers não-3D (texto, css2d) não têm física: ficam sem brilho, mas a faixa
  reservada continua valendo.

### 4. Brilho nas quatro bordas

Mesmo mecanismo, uma faixa por borda. Dois detalhes que só aparecem ao fazer:

- **Os nomes das paredes na lib são invertidos**: `leftWall` fica em `+X` (a
  DIREITA da tela) e `rightWall` em `−X`. Conferido no bundle. Confiar no nome
  acende o brilho do lado oposto ao do impacto. O mapa borda→corpo é montado no
  renderer, já corrigido; a função pura só conhece bordas de TELA.
- **Y do mundo cresce pra cima, y da tela pra baixo**: nas verticais a posição é
  `containerHeight/2 − pos.y * 0.5`, não a soma.

O anti-repique passa a ser por borda: dois dados na mesma parede viram um brilho
só, mas paredes diferentes acendem em paralelo.

## Fora de escopo

- Som de impacto.
- Trocar de lib ou de renderer.

## Critérios de aceite

1. Com resultado na tela, nenhum dado repousa sobre a placa — desktop, celular
   retrato e paisagem, e no overlay do APK.
2. Rolagens de tamanhos diferentes em sequência (2d6 → 10d6 no celular)
   reajustam a faixa, e o reajuste nunca acontece com dado no ar.
3. Girar o aparelho reajusta a mesa sem deixar dado preso fora das paredes.
4. O brilho acende só em impacto real, no X do dado, e nunca durante `simulate`.
5. Palco parado não desenha barra alguma.
6. `npm test -w @rolai/web` verde e `build:stage` regenerado antes de gerar APK.

## Verificação

Chrome remoto não serve pra conferir: a camada WebGL não entra no screenshot e o
rAF não roda — o canvas sai vazio até no `readPixels`. Conferir em navegador de
verdade e no aparelho (ver `apps/android/README.md` pra instalar).
