// Modo stream/OBS: uma URL propria (`?room=CODIGO&stream=1`) que desenha
// SÓ o palco de dados — sem menu, sem painel, sem historico — pra ser
// usada como Browser Source do OBS. Fundo transparente de verdade (alpha)
// por padrao; `&chroma=rrggbb` (ou `&fundo=`) pinta uma cor solida pra
// quem nao pode usar alpha (ver docs/architecture.md — "Chroma key").
//
// O parsing e puro (recebe a query string) pra ser testavel sem DOM.

import { clampDiceScale, DICE_MATERIALS, DICE_TEXTURES } from "./settings";
import type { DiceStyle } from "./settings";

const HEX = /^#?[0-9a-fA-F]{6}$/;

function hexParam(params: URLSearchParams, key: string): string | null {
  const raw = params.get(key);
  return raw !== null && HEX.test(raw) ? `#${raw.replace(/^#/, "").toLowerCase()}` : null;
}

// Monta o override de aparencia so com o que veio valido na URL.
function parseStyleOverride(params: URLSearchParams): Partial<DiceStyle> | null {
  const style: Partial<DiceStyle> = {};
  const body = hexParam(params, "body");
  const number = hexParam(params, "number");
  const outline = hexParam(params, "outline");
  if (body !== null) style.body = body;
  if (number !== null) style.number = number;
  if (outline !== null) style.outline = outline;
  const texture = params.get("texture");
  if (texture !== null && (DICE_TEXTURES as readonly string[]).includes(texture)) {
    style.texture = texture as DiceStyle["texture"];
  }
  const material = params.get("material");
  if (material !== null && (DICE_MATERIALS as readonly string[]).includes(material)) {
    style.material = material as DiceStyle["material"];
  }
  return Object.keys(style).length > 0 ? style : null;
}

export interface StreamOptions {
  // Id de preset de dado (DICE_PRESETS em settings.ts) escolhido por quem
  // embute a pagina — e assim que o overlay do Android manda a cor do dado,
  // ja que a WebView dele tem localStorage proprio e vazio. "" = usa o
  // estilo salvo no proprio navegador.
  styleId: string;
  // Tamanho do dado (multiplicador; 0.7..1.6) e tier de qualidade — o
  // overlay Android passa os dois pela URL porque a WebView do palco tem
  // localStorage proprio e nunca ve o que foi escolhido no app.
  scale: number;
  quality: string;
  // Aparencia explicita (cores hex, textura e material). Vence o preset: e
  // como o overlay Android manda cor custom, ja que a WebView dele tem
  // localStorage proprio.
  style: Partial<DiceStyle> | null;
  // Veu (0..1) desenhado ATRAS do dado enquanto ele esta na tela. Existe
  // pro overlay do Android: numa janela transparente quem compoe e o
  // sistema, e o WebView entrega o dado fantasma (ghosting conhecido do
  // WebView com fundo transparente). Com o veu, quem compoe o dado e o
  // proprio Chromium — o sistema so recebe o veu. 0 = sem veu (OBS).
  scrim: number;
  // Som do dado. `sound=0` desliga — e o que o overlay do Android usa: la o
  // som toca NATIVO, porque audio de WebView pede foco de audio ao sistema e
  // isso abaixa a musica/podcast de quem estiver ouvindo. Ver DiceSounds.kt.
  sound: boolean;
  // Codigo da sala (pode vir vazio — a StreamApp mostra mensagem minima).
  room: string;
  // Cor de chroma key em #rrggbb, ou null pra fundo transparente (alpha).
  chroma: string | null;
}

const CHROMA_COLOR = /^#?[0-9a-fA-F]{6}$/;

// null = URL comum do app (sem `stream=1`).
export function parseStreamParams(search: string): StreamOptions | null {
  const params = new URLSearchParams(search);
  if (params.get("stream") !== "1") return null;
  const room = params.get("room") ?? "";
  const raw = params.get("chroma") ?? params.get("fundo");
  const chroma =
    raw !== null && CHROMA_COLOR.test(raw) ? `#${raw.replace(/^#/, "").toLowerCase()}` : null;
  const scrimRaw = Number(params.get("scrim") ?? "");
  const scrim = Number.isFinite(scrimRaw) ? Math.min(1, Math.max(0, scrimRaw)) : 0;
  const scaleRaw = params.get("scale");
  return {
    room,
    chroma,
    styleId: params.get("style") ?? "",
    scrim,
    scale: scaleRaw === null ? 0 : clampDiceScale(scaleRaw),
    quality: params.get("quality") ?? "",
    // Ligado por padrao: quem abre a pagina (OBS, navegador) quer o som.
    sound: params.get("sound") !== "0",
    style: parseStyleOverride(params),
  };
}
