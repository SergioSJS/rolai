// Renderer 3D via @3d-dice/dice-box-threejs (three.js + fisica).
//
// Escolha de lib: a dice-box-threejs suporta forcar o valor final do dado
// mantendo a fisica da queda visualmente aleatoria (notacao "2d6@3,4" —
// o valor vindo do RollResult e imposto ao fim da animacao). E exatamente
// o que o fluxo de sala exige (docs/architecture.md — "Renderizacao 3D com
// resultado determinístico"): cada cliente anima a propria queda e todo
// mundo ve o mesmo numero final.
//
// "3D completo" e "3D leve" usam o mesmo motor; o leve desliga sombra e
// reduz a intensidade de luz (ver createRenderer).

import type { RollResult } from "@rolai/rules-engine";
import type { DiceColorset } from "@3d-dice/dice-box-threejs";
import { DEFAULT_DICE_STYLES } from "../settings";
import type { DiceStyle, DiceStyles } from "../settings";
import type { RenderedDie, RollRenderer } from "./types";
import { diceFromResult } from "./types";

declare global {
  interface Window {
    // Injetado pelo host nativo (addJavascriptInterface, ver
    // DiceStageWindow.kt). Ausente no navegador e no OBS.
    RolaiBridge?: { onDiceImpact?: (strength: number) => void };
  }
}

export interface DiceBoxOptions {
  shadows: boolean;
  lightIntensity: number;
  // Aparencia dos dados (Preferencias -> Dados). Cores em hex.
  style: DiceStyle;
  styles?: DiceStyles;
  // Tamanho do dado (1 = padrao do motor). Preferencias -> Tamanho.
  scale: number;
  // Som de impacto da lib. Desligado no overlay do Android: audio de WebView
  // pede FOCO DE AUDIO ao sistema, e o Android abaixa a musica/podcast de
  // quem estiver ouvindo enquanto o dado rola. La o som toca nativo, sem
  // pedir foco (DiceSounds.kt). Desligar tambem poupa carregar 45 mp3.
  sounds: boolean;
}

// Material de dado do three.js — so o que precisamos tocar.
interface DiceMaterial {
  transparent: boolean;
  depthTest: boolean;
  needsUpdate: boolean;
}

type DiceFactoryLike = {
  createMaterials: (...args: unknown[]) => DiceMaterial[];
  createTextMaterial?: (...args: unknown[]) => unknown;
  applyColorSet: (colorset: unknown) => void;
  setMaterialInfo: (arg?: unknown) => void;
  create: (type: string, colorData?: unknown) => unknown;
};

type DiceColorsLike = {
  makeColorSet: (colorset: DiceColorset) => Promise<unknown>;
};

// Quanto engrossar o contorno do numero (ver makeOutlineVisible).
const OUTLINE_WIDTH_BOOST = 3.5;

// Teto pro initialize() COM som. A lib carrega os 75 mp3 EM SERIE, cada um
// esperando `canplaythrough` — em cache frio isso passa longe de 2.5s, que
// era o valor antigo e derrubava o audio quase sempre. Generoso o bastante
// pro caso lento e curto o bastante pra ninguem olhar pra mesa vazia: se
// estourar, o palco sobe sem audio e tenta de novo depois (ver init).
const SOUND_INIT_TIMEOUT_MS = 9000;

/**
 * Aba em segundo plano.
 *
 * O Chrome ADIA carregamento de midia em aba oculta: o `load()` do <audio>
 * nem sai do `readyState: 0`, entao o `canplaythrough` que a lib espera
 * nunca chega. Medido: arquivo servido em 200/audio/mpeg e mesmo assim
 * nenhum evento em 4.4s. Como a Browser Source do OBS nunca e aba visivel,
 * o palco de stream subia MUDO sempre.
 */
function documentoOculto(): boolean {
  return typeof document !== "undefined" && document.hidden;
}

// Teto pra troca de tema entre rolagens (carrega a imagem da textura de
// quem rolou). Curto: e o intervalo entre pedir a rolagem e ver o dado.
const THEME_SWAP_TIMEOUT_MS = 1200;

// --- Barreira do pe do palco (spec 06) ------------------------------------
//
// A escala mundo->tela da lib e fixa: a meia-altura visivel vale
// `containerHeight` unidades e `clientHeight/2` px, entao 1 unidade = 0.5 px
// (a camera do arremesso usa sempre `cameraHeight.far`). Disso sai tudo:

export const WORLD_TO_PX = 0.5;

// As paredes ficam em 0.93 do meio pra borda, logo a 3.5% da beirada do
// palco — o brilho nasce ali, nao no fim do palco.
export const BARRIER_INSET_PCT = 3.5;

// Bordas na orientacao da TELA. Nao usar os nomes da lib aqui: `leftWall`
// dela e a borda direita da tela (ver DiceBoxInstance.box_body).
export type BarrierEdge = "top" | "bottom" | "left" | "right";

const EDGES: readonly BarrierEdge[] = ["top", "bottom", "left", "right"];

// Piso de velocidade pra acender. Dado parado encostado na parede continua
// gerando contato; sem piso a barreira piscaria sozinha. (A lib usa 250 pro
// som pelo mesmo motivo.)
const IMPACT_MIN_SPEED = 200;

// Dois dados batendo no mesmo instante viram um brilho so.
const IMPACT_THROTTLE_MS = 60;

const IMPACT_FLASH_MS = 380;

// Teto de brilhos simultaneos: 20d6 caindo juntos nao vira estrobo.
const MAX_CONCURRENT_HITS = 4;

// --- Impacto reportado ao host nativo (som do overlay Android) -------------
//
// O palco vai MUDO no APK (`&sound=0`): audio de WebView pede foco de audio e
// abaixa a musica de quem estiver ouvindo. So que tocar um clique seco no
// Kotlin, no comeco da rolagem, soa pobre perto do original — o barulho de
// dado rolando vem de UMA COLISAO POR VEZ. Como a fisica esta aqui, e daqui
// que os impactos sao reportados; quem toca e o nativo, sem pedir foco.

// Colisao mais lenta que isto nao vira som: dado assentando encosta o tempo
// todo. (A propria lib usa 250 pro som dela.)
const SOUND_MIN_SPEED = 250;

// Velocidade que ja conta como impacto forte (volume cheio).
const SOUND_MAX_SPEED = 2200;

// Duas colisoes no mesmo instante viram um som so.
const SOUND_THROTTLE_MS = 28;

// Teto por rolagem: 20 dados nao viram metralhadora.
const SOUND_MAX_PER_ROLL = 14;

// Corpo da fisica (cannon) — so o que a deteccao de impacto le.
export interface PhysicsBody {
  mass: number;
  position: { x: number; y: number; z: number };
  velocity: { length(): number };
}

// `body` e o OUTRO corpo da colisao (mass 0 = parede ou mesa); `target` e o
// dado que recebeu o evento.
export interface CollideEvent {
  body?: PhysicsBody;
  target?: PhysicsBody;
}

type DiceBoxInstance = {
  DiceFactory?: DiceFactoryLike;
  DiceColors?: DiceColorsLike;
  colorData?: unknown;
  spawnDice: (vector: unknown, rethrow?: boolean) => void;
  initialize(): Promise<unknown>;
  roll(notation: string): Promise<unknown>;
  clearDice(): void;
  updateConfig(config: { theme_customColorset: DiceColorset }): Promise<unknown>;
  // Recalcula mundo, camera e paredes a partir do container. Sincrono — a
  // lib so faria isso sozinha num `window.resize`.
  setDimensions(dimensions: { x: number; y: number }): void;
  // Paredes e mesa. Os corpos sao RECRIADOS a cada setDimensions, entao a
  // comparacao por identidade tem que ler daqui na hora do evento.
  //
  // ATENCAO aos nomes: `leftWall` fica em +X (a DIREITA da tela) e
  // `rightWall` em -X (a esquerda). Sao invertidos na lib — conferido no
  // bundle. Confiar no nome faz o brilho acender do lado errado.
  box_body?: {
    topWall?: PhysicsBody;
    bottomWall?: PhysicsBody;
    leftWall?: PhysicsBody;
    rightWall?: PhysicsBody;
  };
  // "simulate" e a passada headless que decide o resultado antes de animar.
  animstate?: string;
  eventCollide(event: CollideEvent): void;
};

// Colorset da lib a partir das preferencias. material "auto" = nao
// sobrescrever: vale o acabamento natural da textura (gelo -> vidro etc).
export function toColorset(style: DiceStyle, id?: string): DiceColorset {
  const name =
    id ??
    `custom_${style.body}_${style.number}_${style.outline}_${style.texture}_${style.material}`.replace(
      /#/g,
      "",
    );
  const colorset: DiceColorset = {
    name,
    background: style.body,
    foreground: style.number,
    outline: style.outline,
    texture: style.texture,
  };
  if (style.material !== "auto") colorset.material = style.material;
  return colorset;
}

// Organiza os dados na exata mesma ordem em que buildBoxNotation agrupa os tipos
export function orderDiceForBox(dice: RenderedDie[]): RenderedDie[] {
  const byType = new Map<string, RenderedDie[]>();
  const push = (type: string, die: RenderedDie) => {
    let list = byType.get(type);
    if (!list) {
      list = [];
      byType.set(type, list);
    }
    list.push(die);
  };
  for (const die of dice) {
    if (die.fudge) {
      push("df", die);
    } else if (die.sides === 100) {
      push("d100", die);
      push("d10", die);
    } else if (die.sides === 66) {
      push("d6", die);
      push("d6", die);
    } else if (die.sides === 3) {
      push("d6", die);
    } else if ([2, 4, 6, 8, 10, 12, 20].includes(die.sides)) {
      push(`d${die.sides}`, die);
    } else {
      const fallbackSides = die.sides > 12 ? 20 : die.sides > 8 ? 10 : die.sides > 6 ? 8 : 6;
      push(`d${fallbackSides}`, die);
    }
  }
  const ordered: RenderedDie[] = [];
  for (const list of byType.values()) {
    ordered.push(...list);
  }
  return ordered;
}

// Monta a notacao da dice-box a partir dos dados do resultado.
//
// d100: um d100 fisico e um PAR — d10 de dezenas (face "00"–"90") + d10 de
// unidades. A lib tem o mesh "d100" (dezenas, valor normalizado 10..100),
// mas nao combina com um d10 sozinha: animar "1d100@57" jogaria so o dado
// da dezena com um valor que ele nao consegue representar. Entao cada d100
// do resultado vira dois dados na notacao: "1d100" forcado pro digito da
// dezena (0 = face "00") e "1d10" forcado pro digito da unidade (0 = face
// "0"). A soma visual bate com o valor calculado pelo rules-engine:
// 57 -> dezenas "50" + unidades "7"; 100 -> "00" + "0"; 5 -> "00" + "5".
export function buildBoxNotation(dice: RenderedDie[]): string {
  const parts: string[] = [];
  const values: number[] = [];
  // Grupos na ordem de primeira aparicao; os valores acompanham a ordem
  // dos grupos (a dice-box aplica o resultado pelo indice do dado).
  const groups = new Map<string, { count: number; values: number[] }>();
  const push = (type: string, value: number) => {
    let group = groups.get(type);
    if (!group) {
      group = { count: 0, values: [] };
      groups.set(type, group);
    }
    group.count += 1;
    group.values.push(value);
  };
  for (const die of dice) {
    if (die.fudge) {
      // A lib tem o mesh "df" (faces -, 0, +) e o parser dela aceita valor
      // negativo depois do "@" — o valor do RollResult vai direto.
      push("df", die.value);
    } else if (die.sides === 100) {
      push("d100", Math.floor((die.value % 100) / 10));
      push("d10", die.value % 10);
    } else if (die.sides === 66) {
      // Um d66 no RPG e um par de d6 (dezena 1..6 + unidade 1..6)
      const tens = Math.floor(die.value / 10);
      const units = die.value % 10;
      if (tens >= 1 && tens <= 6 && units >= 1 && units <= 6) {
        push("d6", tens);
        push("d6", units);
      } else {
        const t = Math.max(1, Math.min(6, Math.floor((die.value - 1) / 6) + 1));
        const u = Math.max(1, Math.min(6, ((die.value - 1) % 6) + 1));
        push("d6", t);
        push("d6", u);
      }
    } else if (die.sides === 3) {
      // d3 simula em d6 (face 1, 2 ou 3)
      push("d6", Math.max(1, Math.min(3, die.value)));
    } else if ([2, 4, 6, 8, 10, 12, 20].includes(die.sides)) {
      push(`d${die.sides}`, die.value);
    } else {
      // Qualquer outro dado customizado (ex.: d30): joga no mesh padrao mais proximo
      const fallbackSides = die.sides > 12 ? 20 : die.sides > 8 ? 10 : die.sides > 6 ? 8 : 6;
      const normalizedVal = Math.max(1, Math.min(fallbackSides, die.value % fallbackSides || fallbackSides));
      push(`d${fallbackSides}`, normalizedVal);
    }
  }
  for (const [type, group] of groups) {
    parts.push(`${group.count}${type}`);
    values.push(...group.values);
  }
  return `${parts.join("+")}@${values.join(",")}`;
}

export function makeDiceOpaque(box: DiceBoxInstance): void {
  const factory = box.DiceFactory;
  if (!factory || typeof factory.createMaterials !== "function") return;
  const original = factory.createMaterials.bind(factory);
  factory.createMaterials = (...args: unknown[]): DiceMaterial[] => {
    const materials = original(...args);
    for (const material of materials) {
      material.transparent = false;
      material.depthTest = true;
      material.needsUpdate = true;
    }
    return materials;
  };
}

/**
 * Patch permanente em DiceFactory.create para injetar o colorset específico
 * de cada slot sem wrap aninhado ou race condition entre rolagens.
 */
export function enableMultiSlotColors(
  box: DiceBoxInstance,
  getResolver: () => ((type: string) => unknown) | null,
): void {
  const factory = box.DiceFactory as
    | (DiceFactoryLike & { __rolai_native_create?: (type: string, colorData?: unknown) => unknown })
    | undefined;
  if (!factory || typeof factory.create !== "function") return;
  if (!factory.__rolai_native_create) {
    factory.__rolai_native_create = factory.create.bind(factory);
    const native = factory.__rolai_native_create;
    factory.create = function patchedCreate(type: string, colorData?: unknown) {
      const resolver = getResolver();
      if (resolver) {
        const targetColorSet = resolver(type);
        if (targetColorSet && factory.applyColorSet) {
          factory.applyColorSet(targetColorSet);
          factory.setMaterialInfo();
        }
      }
      return native(type, colorData);
    };
  }
}

/**
 * Ajusta as opcoes do contexto WebGL criado pela dice-box.
 *
 * `preserveDrawingBuffer: true` obriga o Chromium a COPIAR o buffer do
 * canvas na composicao em vez de entrega-lo direto ao compositor. No
 * navegador comum nao muda nada visivel; na WebView transparente do
 * overlay Android e o que impede o caminho de composicao que sai com o
 * dado fantasma (see-through) — visto em aparelho.
 *
 * Envolve getContext so durante a criacao da DiceBox e desfaz em seguida —
 * nenhum outro canvas da pagina e afetado.
 */
function withPatchedContext<T>(create: () => T): T {
  const proto = HTMLCanvasElement.prototype;
  const original = proto.getContext;
  proto.getContext = function patched(
    this: HTMLCanvasElement,
    kind: string,
    options?: Record<string, unknown>,
  ) {
    const next =
      kind === "webgl" || kind === "webgl2" || kind === "experimental-webgl"
        ? { ...(options ?? {}), preserveDrawingBuffer: true }
        : options;
    return (original as (k: string, o?: unknown) => unknown).call(this, kind, next);
  } as typeof proto.getContext;
  try {
    return create();
  } finally {
    proto.getContext = original;
  }
}

/**
 * Engrossa o contorno do numero na textura da face.
 *
 * A lib desenha o contorno com `lineWidth = 5` FIXO, enquanto a fonte e a
 * textura escalam com o tamanho do dado. Metade do traco ainda e coberta
 * pelo preenchimento do glifo, entao sobra ~2px numa textura que aparece
 * reduzida na tela: a cor de contorno escolhida praticamente nao muda nada
 * (reportado em uso, e confirmado no fonte da lib).
 *
 * Como `lineWidth` e setado dentro da funcao da lib, o unico ponto de
 * enganche e o proprio `strokeText` — trocado só enquanto a textura da face
 * esta sendo desenhada, e devolvido em seguida.
 */
export function makeOutlineVisible(box: DiceBoxInstance): void {
  const factory = box.DiceFactory;
  const original = factory?.createTextMaterial;
  if (!factory || typeof original !== "function") return;
  const bound = original.bind(factory);
  const proto = CanvasRenderingContext2D.prototype;
  factory.createTextMaterial = (...args: unknown[]): unknown => {
    const originalStroke = proto.strokeText;
    proto.strokeText = function patched(
      this: CanvasRenderingContext2D,
      text: string,
      x: number,
      y: number,
      maxWidth?: number,
    ): void {
      const previous = this.lineWidth;
      this.lineWidth = previous * OUTLINE_WIDTH_BOOST;
      if (maxWidth === undefined) originalStroke.call(this, text, x, y);
      else originalStroke.call(this, text, x, y, maxWidth);
      this.lineWidth = previous;
    };
    try {
      return bound(...args);
    } finally {
      proto.strokeText = originalStroke;
    }
  };
}

/**
 * Corrige o tamanho do dado depois que o palco encurtou.
 *
 * O tamanho aparente do dado e proporcional a `diagonal/altura` do container
 * (a lib usa `scale = √(w²+h²)/13` e a camera escala com a altura). Encurtar
 * o palco derruba a diagonal MENOS que a altura, entao o dado cresceria na
 * tela — ~30% num desktop 1280×833 com faixa de 240px. Este fator devolve o
 * dado ao tamanho que ele tinha com o palco inteiro.
 *
 * Aplicado so na CONSTRUCAO: a `DiceFactory` cacheia a geometria por tipo de
 * dado no primeiro uso (`scaleGeometry()` e vazio nesta versao da lib), entao
 * mexer em `baseScale` depois nao teria efeito — e ainda deixaria tipos
 * diferentes com escalas diferentes. Se a faixa crescer no meio da sessao, o
 * dado fica alguns por cento maior; e imperceptivel e nao vale a cirurgia no
 * cache da lib.
 */
export function scaleCompensation(
  width: number,
  stageHeight: number,
  viewportHeight: number,
): number {
  if (width <= 0 || stageHeight <= 0 || viewportHeight <= stageHeight) return 1;
  const cheio = Math.hypot(width, viewportHeight) / viewportHeight;
  const curto = Math.hypot(width, stageHeight) / stageHeight;
  // Teto em 1 (nunca AUMENTAR o dado) e piso pra um layout torto nao sumir
  // com ele.
  return Math.min(1, Math.max(0.5, cheio / curto));
}

export interface Impact {
  edge: BarrierEdge;
  // Posicao em px AO LONGO da borda: x nas horizontais, y nas verticais.
  pos: number;
}

/**
 * Onde o brilho deve nascer, ou `null` quando a colisao nao deve acender.
 *
 * As recusas, todas por um motivo concreto:
 *
 * - `simulate`: e a passada headless que decide o resultado ANTES de animar.
 *   Acender ali faria a barreira piscar sem dado nenhum na tela.
 * - colisao com outro dado, com a mesa, ou com um mundo que ja foi recriado:
 *   so parede acende.
 * - lento demais: dado parado encostado na parede continua gerando contato.
 * - cedo demais NAQUELA borda: varios dados batendo juntos viram um brilho
 *   so, mas bordas diferentes acendem em paralelo.
 */
export function impactAt(
  event: CollideEvent,
  ctx: {
    animstate?: string;
    // Chaves na orientacao da TELA — quem monta este mapa e que resolve a
    // inversao de nomes da lib.
    walls: Partial<Record<BarrierEdge, PhysicsBody | undefined>>;
    containerWidth: number;
    containerHeight: number;
    sinceLast: (edge: BarrierEdge) => number;
  },
): Impact | null {
  if (ctx.animstate === "simulate") return null;
  const die = event.target;
  const hit = event.body;
  if (!die || !hit) return null;
  const edge = EDGES.find((candidate) => ctx.walls[candidate] === hit);
  if (edge === undefined) return null;
  if (die.velocity.length() < IMPACT_MIN_SPEED) return null;
  if (ctx.sinceLast(edge) < IMPACT_THROTTLE_MS) return null;
  // Y do mundo cresce pra CIMA; y da tela cresce pra baixo.
  const pos =
    edge === "top" || edge === "bottom"
      ? ctx.containerWidth / 2 + die.position.x * WORLD_TO_PX
      : ctx.containerHeight / 2 - die.position.y * WORLD_TO_PX;
  return { edge, pos };
}

/**
 * Forca (0..1) de uma colisao, pra virar volume no host nativo. `null` quando
 * a colisao nao deve soar: lenta demais (dado so encostando), cedo demais
 * depois da anterior, ou passada headless `simulate` — nesta a fisica inteira
 * roda ANTES de aparecer dado na tela, e sairia um chocalho do nada.
 */
export function impactStrength(
  event: CollideEvent,
  ctx: { animstate?: string; sinceLast: number; playedThisRoll: number },
): number | null {
  if (ctx.animstate === "simulate") return null;
  const die = event.target;
  if (!die) return null;
  if (ctx.playedThisRoll >= SOUND_MAX_PER_ROLL) return null;
  const speed = die.velocity.length();
  if (speed < SOUND_MIN_SPEED) return null;
  if (ctx.sinceLast < SOUND_THROTTLE_MS) return null;
  const faixa = SOUND_MAX_SPEED - SOUND_MIN_SPEED;
  return Math.min(1, Math.max(0, (speed - SOUND_MIN_SPEED) / faixa));
}

export class DiceBoxRenderer implements RollRenderer {
  private box: DiceBoxInstance | null = null;
  private container: HTMLElement | null = null;
  private slotColorResolver: ((type: string) => unknown) | null = null;
  // Uma faixa de brilho por borda; cada impacto vira um filho efemero.
  private barriers: Partial<Record<BarrierEdge, HTMLElement>> = {};
  private lastImpact: Partial<Record<BarrierEdge, number>> = {};
  // Som: contagem e relogio proprios (todas as colisoes, nao so as paredes).
  private lastSound = 0;
  private soundsThisRoll = 0;
  // dispose() chamado enquanto init() ainda esta em algum await (StrictMode
  // do dev monta -> desmonta -> monta de novo antes do primeiro init()
  // terminar): sem isto, o init() velho retoma DEPOIS do dispose(), pisa no
  // container que o renderer NOVO ja esta usando e monta um segundo canvas
  // WebGL por cima do certo — o dado do renderer novo continua rolando por
  // baixo, so que ninguem ve. So acontece em dev (o efeito que chama init()
  // roda uma unica vez por carregamento real de pagina), mas o guard e
  // barato e evita a fonte mais provavel de "conectou mas o dado nao aparece".
  private disposed = false;

  /**
   * Subiu SEM audio mesmo tendo sido pedido com som.
   *
   * Aba oculta nao carrega midia: o Chrome adia o `load()` do <audio>, o
   * `canplaythrough` nunca chega e a corrida abaixo sempre perde. Uma
   * Browser Source do OBS NUNCA e aba visivel, entao o palco subia mudo
   * pra sempre — e nao havia segunda chance, porque o fallback so rodava
   * na montagem. Este campo e a segunda chance.
   */
  private soundPendente = false;
  private aoVoltarVisivel: (() => void) | null = null;
  /** Enquanto true, remontar tiraria dado da tela no meio da animacao. */
  private rolando = false;

  constructor(private readonly options: DiceBoxOptions) {}

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    if (!container.id) container.id = "dice-stage";
    // Import dinamico: o bundle 3D (three.js + fisica) so carrega quando
    // um tier 3D e de fato usado, e falhas de WebGL nao quebram o app.
    const { default: DiceBox } = await import("@3d-dice/dice-box-threejs");
    if (this.disposed) return;
    // As imagens de textura sao pedidas como
    // `${assetPath}textures/<nome>.webp` — os arquivos vivem em
    // public/textures (copiados do pacote da lib).
    // O palco ja sobe com a faixa reservada embaixo (stage/floor.ts), entao
    // o container aqui e mais baixo que a janela — daí a compensacao.
    const compensacao = scaleCompensation(
      container.clientWidth,
      container.clientHeight,
      window.innerHeight,
    );
    // O .d.ts da lib nao declara `setDimensions` nem `eventCollide`, que
    // existem em runtime (conferido no bundle) e sao o que sustenta a faixa
    // do pe do palco e o brilho da barreira. Os dois usos tem guarda de
    // runtime, entao uma versao futura que os remova vira no-op, nao crash.
    const build = (sounds: boolean): DiceBoxInstance =>
      withPatchedContext(() => new DiceBox(`#${container.id}`, {
        assetPath: "./",
        shadows: this.options.shadows,
        light_intensity: this.options.lightIntensity,
        sounds,
        baseScale: Math.round(100 * this.options.scale * compensacao),
        theme_customColorset: toColorset(this.options.style),
      }) as unknown as DiceBoxInstance);

    // Som e opcional; dado 3D nao e.
    //
    // A lib carrega os 75 mp3 DENTRO do initialize(), e o `loadAudio` dela
    // so resolve no `canplaythrough`. Quando isso nao chega, a promise fica
    // pendente pra sempre: o initialize() nao rejeita, TRAVA. Verificado em
    // producao e local — com `sounds: true` a rolagem saia so em numero,
    // sem dado nenhum, porque o renderer nunca terminava de subir.
    //
    // Por isso a corrida com relogio em vez de try/catch: `catch` nao pega
    // promise pendente. Estourou o tempo, remonta sem audio.
    // Aba oculta nem tenta: o audio nao vai carregar e o unico efeito seria
    // segurar o palco por SOUND_INIT_TIMEOUT_MS antes de desistir. Sobe
    // mudo agora e liga o som quando a aba aparecer.
    const podeAudio = this.options.sounds && !documentoOculto();
    let box = build(podeAudio);
    if (podeAudio) {
      const withSound = await Promise.race([
        box.initialize().then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), SOUND_INIT_TIMEOUT_MS)),
      ]).catch(() => false);
      if (!withSound) {
        console.warn("[rolai] audio nao carregou a tempo, seguindo sem som");
        container.replaceChildren();
        box = build(false);
        await box.initialize();
        this.soundPendente = true;
      }
    } else {
      // Sem som nao ha promise de audio pra travar — e o palco sobe antes,
      // por nao carregar os 75 mp3.
      await box.initialize();
      this.soundPendente = this.options.sounds;
      if (this.soundPendente) {
        // Precisa aparecer: sem este aviso, "abri a aba e nao tem som" nao
        // tinha nenhum rastro no console — o caso silencioso era literalmente
        // silencioso nos dois sentidos.
        console.warn(
          "[rolai] aba em segundo plano: palco sem audio ate ela ficar visivel",
        );
      }
    }
    if (this.disposed) return;
    // A lib cria TODO material de dado com `transparent: true` e
    // `depthTest: false`. Num canvas com alpha (que e o nosso caso: modo
    // stream, overlay do Android e Browser Source do OBS) isso faz o fundo
    // atravessar o dado — ele aparece translucido. Forcamos opaco na
    // fabrica, entao vale pra todo dado criado daqui pra frente.
    makeDiceOpaque(box);
    makeOutlineVisible(box);
    enableMultiSlotColors(box, () => this.slotColorResolver);
    this.box = box;
    this.mountBarrier(container);
    this.watchImpacts(box);
    this.armarRecuperacaoDeSom(container);
  }

  /**
   * Tenta o audio de novo quando a aba ficar visivel.
   *
   * Sem isto, quem carregou a pagina em segundo plano (OBS, aba aberta e
   * deixada de lado) ficava mudo pro resto da sessao: o palco monta uma vez
   * e nunca mais reavalia. Remonta so quando nao ha dado na tela — trocar o
   * canvas no meio da animacao faria o dado sumir.
   */
  private armarRecuperacaoDeSom(container: HTMLElement): void {
    if (this.aoVoltarVisivel !== null || typeof document === "undefined") return;
    const tentar = () => {
      if (this.disposed || !this.soundPendente || documentoOculto() || this.rolando) return;
      this.soundPendente = false;
      void this.init(container).catch(() => {
        // Falhou remontar: segue com o palco mudo que ja esta na tela.
      });
    };
    this.aoVoltarVisivel = tentar;
    document.addEventListener("visibilitychange", tentar);
  }

  /** Uma faixa por borda. Vazias enquanto ninguem bate. */
  private mountBarrier(container: HTMLElement): void {
    this.barriers = {};
    for (const edge of EDGES) {
      const barrier = document.createElement("div");
      barrier.className = `stage-barrier is-${edge}`;
      barrier.setAttribute("aria-hidden", "true");
      // A posicao vem da parede (0.93 do meio pra borda), nao de chute.
      const inset = `${BARRIER_INSET_PCT}%`;
      const far = `${100 - BARRIER_INSET_PCT}%`;
      if (edge === "top") barrier.style.top = inset;
      else if (edge === "bottom") barrier.style.top = far;
      else if (edge === "left") barrier.style.left = inset;
      else barrier.style.left = far;
      container.appendChild(barrier);
      this.barriers[edge] = barrier;
    }
  }

  /**
   * Engancha na deteccao de colisao da propria lib.
   *
   * Cada dado nasce com `body.addEventListener("collide", this.eventCollide
   * .bind(this))`, e o `bind` resolve `eventCollide` NA CRIACAO do dado. Como
   * os dados sao recriados a cada rolagem, trocar o metodo uma vez aqui vale
   * pra todas as rolagens seguintes.
   */
  private watchImpacts(box: DiceBoxInstance): void {
    if (typeof box.eventCollide !== "function") return;
    const original = box.eventCollide.bind(box);
    box.eventCollide = (event: CollideEvent): void => {
      original(event);
      // O erro nosso nao pode subir: isto roda dentro do passo da fisica.
      try {
        this.onImpact(event);
        this.reportImpact(event);
      } catch (err: unknown) {
        console.warn("[rolai] impacto falhou:", err);
      }
    };
  }

  private onImpact(event: CollideEvent): void {
    const box = this.box;
    const container = this.container;
    if (!box || !container) return;
    const now = Date.now();
    // Ler as paredes AGORA: `setDimensions` recria os corpos, e uma
    // referencia guardada apontaria pro mundo anterior. Aqui tambem e onde a
    // inversao de nomes da lib e desfeita — `leftWall` fica na DIREITA.
    const body = box.box_body;
    const impact = impactAt(event, {
      animstate: box.animstate,
      walls: {
        top: body?.topWall,
        bottom: body?.bottomWall,
        left: body?.rightWall,
        right: body?.leftWall,
      },
      containerWidth: container.clientWidth,
      containerHeight: container.clientHeight,
      sinceLast: (edge) => now - (this.lastImpact[edge] ?? 0),
    });
    if (impact === null) return;
    this.lastImpact[impact.edge] = now;
    this.flash(impact);
  }

  /**
   * Reporta a colisao ao host nativo, se houver (o overlay Android injeta
   * `RolaiBridge` — ver HeadlessRoller.kt/DiceStageWindow.kt). Sem host, nada
   * acontece: no navegador e no OBS quem toca e a propria lib.
   */
  private reportImpact(event: CollideEvent): void {
    const bridge = window.RolaiBridge;
    if (!bridge || typeof bridge.onDiceImpact !== "function") return;
    const now = Date.now();
    const forca = impactStrength(event, {
      animstate: this.box?.animstate,
      sinceLast: now - this.lastSound,
      playedThisRoll: this.soundsThisRoll,
    });
    if (forca === null) return;
    this.lastSound = now;
    this.soundsThisRoll += 1;
    bridge.onDiceImpact(forca);
  }

  private flash({ edge, pos }: Impact): void {
    const barrier = this.barriers[edge];
    if (!barrier || barrier.childElementCount >= MAX_CONCURRENT_HITS) return;
    const vertical = edge === "left" || edge === "right";
    const hit = document.createElement("span");
    hit.className = "stage-barrier-hit";
    // Nas verticais o clarao e o mesmo traco, deitado 90 graus.
    const gira = vertical ? " rotate(90deg)" : "";
    if (vertical) hit.style.top = `${Math.round(pos)}px`;
    else hit.style.left = `${Math.round(pos)}px`;
    barrier.appendChild(hit);
    // WAAPI quando existe (jsdom nao tem `animate`); a classe CSS cuida do
    // desenho nos dois casos.
    if (typeof hit.animate === "function") {
      const anim = hit.animate(
        [
          { opacity: 0, transform: `translate(-50%, -50%)${gira} scaleX(0.5)` },
          { opacity: 1, transform: `translate(-50%, -50%)${gira} scaleX(1)`, offset: 0.2 },
          { opacity: 0, transform: `translate(-50%, -50%)${gira} scaleX(1.3)` },
        ],
        { duration: IMPACT_FLASH_MS, easing: "ease-out" },
      );
      void anim.finished.catch(() => undefined).then(() => hit.remove());
    } else {
      setTimeout(() => hit.remove(), IMPACT_FLASH_MS);
    }
  }

  async roll(
    result: RollResult,
    style?: DiceStyle | null,
    styles?: DiceStyles | null,
  ): Promise<void> {
    if (!this.box) return;
    const dice = diceFromResult(result);
    if (dice.length === 0) return;
    this.rolando = true;

    // Resolve os estilos ativos pros slots 1, 2 e 3:
    const activeStyles: DiceStyles =
      styles ??
      (style
        ? {
            "1": style,
            "2": this.options.styles?.["2"] ?? DEFAULT_DICE_STYLES["2"],
            "3": this.options.styles?.["3"] ?? DEFAULT_DICE_STYLES["3"],
          }
        : (this.options.styles ?? {
            "1": this.options.style,
            "2": DEFAULT_DICE_STYLES["2"],
            "3": DEFAULT_DICE_STYLES["3"],
          }));

    // Pre-carrega colorsets dos slots usados nesta rolagem:
    const neededSlots = new Set<number>(dice.map((d) => d.slot ?? 1));
    const slotColorSets: Record<number, unknown> = {};

    if (this.box.DiceColors) {
      for (const slot of neededSlots) {
        const slotKey = String(slot) as "1" | "2" | "3";
        const s =
          activeStyles[slotKey] ??
          DEFAULT_DICE_STYLES[slotKey] ??
          activeStyles["1"] ??
          this.options.style;
        const cs = toColorset(
          s,
          `slot_${slot}_${s.body}_${s.number}_${s.outline}_${s.texture}_${s.material}`,
        );
        try {
          const loaded = await Promise.race([
            this.box.DiceColors.makeColorSet(cs),
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), THEME_SWAP_TIMEOUT_MS),
            ),
          ]);
          if (loaded) {
            slotColorSets[slot] = loaded;
          }
        } catch {
          // segue com fallback
        }
      }
    }

    const orderedDice = orderDiceForBox(dice);
    let spawnIndex = 0;
    this.slotColorResolver = () => {
      const targetDie = orderedDice[spawnIndex++];
      const slotNum = targetDie?.slot ?? 1;
      return slotColorSets[slotNum] ?? slotColorSets[1];
    };

    try {
      // Teto de sons e por ROLAGEM: zera aqui.
      this.soundsThisRoll = 0;
      await this.box.roll(buildBoxNotation(dice));
    } finally {
      this.slotColorResolver = null;
      this.rolando = false;
      // A rolagem pode ter sido justamente o que segurou a remontagem com
      // audio — reavalia agora que a mesa esta parada.
      this.aoVoltarVisivel?.();
    }
  }

  clear(): void {
    this.slotColorResolver = null;
    this.box?.clearDice();
  }

  /**
   * Refaz mundo, camera e paredes com o tamanho atual do container.
   *
   * A lib so faria isso sozinha num `window.resize` — quando a faixa do pe do
   * palco cresce, quem avisa e o `stage/floor.ts`. Chamado SEMPRE entre
   * rolagens, nunca com dado no ar.
   */
  resize(): void {
    const box = this.box;
    const container = this.container;
    if (!box || !container || typeof box.setDimensions !== "function") return;
    box.setDimensions({ x: container.clientWidth, y: container.clientHeight });
  }

  dispose(): void {
    // A lib nao expoe destroy; remover o canvas basta pra esta etapa.
    this.disposed = true;
    if (this.aoVoltarVisivel !== null && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.aoVoltarVisivel);
      this.aoVoltarVisivel = null;
    }
    this.box = null;
    this.barriers = {};
    this.container?.replaceChildren();
    this.container = null;
  }
}
