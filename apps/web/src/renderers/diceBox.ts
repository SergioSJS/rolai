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
import type { DiceStyle } from "../settings";
import type { RenderedDie, RollRenderer } from "./types";
import { diceFromResult } from "./types";

export interface DiceBoxOptions {
  shadows: boolean;
  lightIntensity: number;
  // Aparencia dos dados (Preferencias -> Dados). Cores em hex.
  style: DiceStyle;
  // Tamanho do dado (1 = padrao do motor). Preferencias -> Tamanho.
  scale: number;
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
};

// Quanto engrossar o contorno do numero (ver makeOutlineVisible).
const OUTLINE_WIDTH_BOOST = 3.5;

// Teto pro initialize() COM som. Generoso pro caso lento (rede ruim, cache
// frio) e curto o bastante pra ninguem ficar olhando pra mesa vazia — se
// estourar, o palco sobe sem audio (ver init).
const SOUND_INIT_TIMEOUT_MS = 2500;

// Teto pra troca de tema entre rolagens (carrega a imagem da textura de
// quem rolou). Curto: e o intervalo entre pedir a rolagem e ver o dado.
const THEME_SWAP_TIMEOUT_MS = 1200;

type DiceBoxInstance = {
  DiceFactory?: DiceFactoryLike;
  initialize(): Promise<unknown>;
  roll(notation: string): Promise<unknown>;
  clearDice(): void;
  updateConfig(config: { theme_customColorset: DiceColorset }): Promise<unknown>;
};

// Colorset da lib a partir das preferencias. material "auto" = nao
// sobrescrever: vale o acabamento natural da textura (gelo -> vidro etc).
export function toColorset(style: DiceStyle): DiceColorset {
  const colorset: DiceColorset = {
    background: style.body,
    foreground: style.number,
    outline: style.outline,
    texture: style.texture,
  };
  if (style.material !== "auto") colorset.material = style.material;
  return colorset;
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
    } else {
      push(`d${die.sides}`, die.value);
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

export class DiceBoxRenderer implements RollRenderer {
  private box: DiceBoxInstance | null = null;
  private container: HTMLElement | null = null;
  // Aparencia atualmente carregada no motor (troca por rolagem de outro
  // jogador; evita recarregar o tema quando nao mudou).
  private currentStyle: DiceStyle | null = null;

  constructor(private readonly options: DiceBoxOptions) {}

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    if (!container.id) container.id = "dice-stage";
    // Import dinamico: o bundle 3D (three.js + fisica) so carrega quando
    // um tier 3D e de fato usado, e falhas de WebGL nao quebram o app.
    const { default: DiceBox } = await import("@3d-dice/dice-box-threejs");
    // As imagens de textura sao pedidas como
    // `${assetPath}textures/<nome>.webp` — os arquivos vivem em
    // public/textures (copiados do pacote da lib).
    const build = (sounds: boolean): DiceBoxInstance =>
      withPatchedContext(() => new DiceBox(`#${container.id}`, {
        assetPath: "./",
        shadows: this.options.shadows,
        light_intensity: this.options.lightIntensity,
        sounds,
        baseScale: Math.round(100 * this.options.scale),
        theme_customColorset: toColorset(this.options.style),
      }));

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
    let box = build(true);
    const withSound = await Promise.race([
      box.initialize().then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), SOUND_INIT_TIMEOUT_MS)),
    ]).catch(() => false);
    if (!withSound) {
      console.warn("[rolai] audio nao carregou a tempo, seguindo sem som");
      container.replaceChildren();
      box = build(false);
      await box.initialize();
    }
    // A lib cria TODO material de dado com `transparent: true` e
    // `depthTest: false`. Num canvas com alpha (que e o nosso caso: modo
    // stream, overlay do Android e Browser Source do OBS) isso faz o fundo
    // atravessar o dado — ele aparece translucido. Forcamos opaco na
    // fabrica, entao vale pra todo dado criado daqui pra frente.
    makeDiceOpaque(box);
    makeOutlineVisible(box);
    this.box = box;
    this.currentStyle = this.options.style;
  }

  async roll(result: RollResult, style?: DiceStyle | null): Promise<void> {
    if (!this.box) return;
    const dice = diceFromResult(result);
    if (dice.length === 0) return;
    // Rolagem de outro jogador vem com a aparencia dele: troca o colorset
    // antes de criar os dados, pra mesa toda ver o dado de quem rolou.
    const wanted = style ?? this.options.style;
    if (JSON.stringify(wanted) !== JSON.stringify(this.currentStyle)) {
      // Trocar a cor NAO pode custar a animacao — e aqui `try/catch` nao
      // basta, precisa de relogio.
      //
      // updateConfig chama loadTheme -> makeColorSet, que CARREGA A IMAGEM
      // da textura. Se esse carregamento nao resolve, a promise fica
      // pendente pra sempre: nao ha excecao pra pegar, o `await` simplesmente
      // nunca volta e a rolagem nunca e desenhada. Como so rolagem de OUTRO
      // jogador troca o colorset, o sintoma e exatamente "so aparece o meu
      // dado" — e so depois de customizar a aparencia, que e o que faz o
      // estilo dos outros passar a divergir do meu.
      const trocou = await Promise.race([
        this.box.updateConfig({ theme_customColorset: toColorset(wanted) }).then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), THEME_SWAP_TIMEOUT_MS)),
      ]).catch(() => false);
      if (trocou) {
        this.currentStyle = wanted;
      } else {
        console.warn("[rolai] troca de estilo nao completou; rolando com a cor atual");
      }
    }
    await this.box.roll(buildBoxNotation(dice));
  }

  clear(): void {
    this.box?.clearDice();
  }

  dispose(): void {
    // A lib nao expoe destroy; remover o canvas basta pra esta etapa.
    this.box = null;
    this.container?.replaceChildren();
    this.container = null;
  }
}
