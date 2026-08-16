// Preferencias do usuario persistidas em localStorage: tier de qualidade de
// render (docs/architecture.md — "Escada de qualidade de render") e tema
// visual. O fundo pro OBS (alpha/chroma) NAO e preferencia: e parametro da
// URL de stream (?stream=1&chroma=... — ver src/stream.ts).
//
// A logica de load/save recebe um StorageLike pra ser testavel sem DOM.

import type { DeckConfig } from "@rolai/deck-engine";

export type QualityTier = "3d-full" | "3d-light" | "2d" | "text";

export const QUALITY_TIERS: readonly QualityTier[] = [
  "3d-full",
  "3d-light",
  "2d",
  "text",
] as const;

export const QUALITY_TIER_LABELS: Record<QualityTier, string> = {
  "3d-full": "3D completo",
  "3d-light": "3D leve",
  "2d": "2D animado",
  text: "Texto puro",
};

// Tema visual do app.
export type ThemeName = "dark" | "light" | "table";

export const THEME_LABELS: Record<ThemeName, string> = {
  dark: "Escuro",
  light: "Claro",
  table: "Mesa",
};

export const THEMES: readonly ThemeName[] = ["dark", "light", "table"] as const;

// ---------- Aparencia dos dados ----------

// Materiais e texturas da dice-box-threejs.
//
// Textura = a imagem estampada no corpo do dado. Os arquivos vivem em
// public/textures/*.webp (copiados do pacote da lib) e sao pedidos em runtime
// como "textures/<nome>.webp" — expor um nome sem arquivo correspondente da
// dado sem estampa nenhuma, entao esta lista so tem textura que existe.
//
// Material = o acabamento (brilho/reflexo) aplicado por cima. Cada textura ja
// traz um material natural (gelo -> vidro, papel -> madeira, ...); "auto"
// respeita esse, e os demais sobrescrevem.
export const DICE_MATERIALS = [
  "auto",
  "plastic",
  "metal",
  "wood",
  "glass",
  "none",
] as const;
export type DiceMaterial = (typeof DICE_MATERIALS)[number];

export const DICE_MATERIAL_LABELS: Record<DiceMaterial, string> = {
  auto: "Automático (da textura)",
  plastic: "Plástico",
  metal: "Metal",
  wood: "Madeira",
  glass: "Vidro",
  none: "Fosco",
};

export const DICE_TEXTURES = [
  "none",
  "marble",
  "speckles",
  "glitter",
  "stars",
  "astral",
  "cloudy",
  "fire",
  "water",
  "ice",
  "paper",
  "wood",
  "metal",
  "stainedglass",
  "skulls",
  "dragon",
  "leopard",
  "tiger",
  "lizard",
  "bird",
] as const;
export type DiceTexture = (typeof DICE_TEXTURES)[number];

export const DICE_TEXTURE_LABELS: Record<DiceTexture, string> = {
  none: "Lisa",
  marble: "Mármore",
  speckles: "Pintas",
  glitter: "Glitter",
  stars: "Estrelas",
  astral: "Céu astral",
  cloudy: "Nuvens",
  fire: "Fogo",
  water: "Água",
  ice: "Gelo",
  paper: "Papel",
  wood: "Madeira",
  metal: "Aço",
  stainedglass: "Vitral",
  skulls: "Caveiras",
  dragon: "Dragão",
  leopard: "Leopardo",
  tiger: "Tigre",
  lizard: "Lagarto",
  bird: "Pena",
};

// Arquivo .webp de cada textura (public/textures) — usado pela PREVIA em
// Preferencias, que mostra a mesma imagem estampada no dado 3D. O nome nem
// sempre e o da textura ("bird" vem de feather.webp).
export const DICE_TEXTURE_FILES: Record<DiceTexture, string | null> = {
  none: null,
  marble: "marble.webp",
  speckles: "speckles.webp",
  glitter: "glitter.webp",
  stars: "stars.webp",
  astral: "astral.webp",
  cloudy: "cloudy.webp",
  fire: "fire.webp",
  water: "water.webp",
  ice: "ice.webp",
  paper: "paper.webp",
  wood: "wood.webp",
  metal: "metal.webp",
  stainedglass: "stainedglass.webp",
  skulls: "skulls.webp",
  dragon: "dragon.webp",
  leopard: "leopard.webp",
  tiger: "tiger.webp",
  lizard: "lizard.webp",
  bird: "feather.webp",
};

export interface DiceStyle {
  // Cor do corpo do dado, do numero e do contorno do numero (hex).
  body: string;
  number: string;
  outline: string;
  texture: DiceTexture;
  material: DiceMaterial;
}

export const DEFAULT_DICE_STYLE: DiceStyle = {
  body: "#1d9e75",
  number: "#f4f7f5",
  outline: "#0c3527",
  texture: "none",
  material: "plastic",
};

// Presets prontos — a maioria das mesas nao quer escolher 3 cores na mao.
export interface DicePreset {
  id: string;
  label: string;
  style: DiceStyle;
}

export const DICE_PRESETS: readonly DicePreset[] = [
  { id: "esmeralda", label: "Esmeralda", style: DEFAULT_DICE_STYLE },
  {
    id: "osso",
    label: "Osso",
    style: {
      body: "#e8e0cd",
      number: "#3a3226",
      outline: "#3a3226",
      texture: "marble",
      material: "auto",
    },
  },
  {
    id: "obsidiana",
    label: "Obsidiana",
    style: {
      body: "#14171c",
      number: "#e5c07b",
      outline: "#e5c07b",
      texture: "speckles",
      material: "metal",
    },
  },
  {
    id: "sangue",
    label: "Sangue",
    style: {
      body: "#8c1f2b",
      number: "#f7e8e2",
      outline: "#2b0a0e",
      texture: "marble",
      material: "plastic",
    },
  },
  {
    id: "abissal",
    label: "Abissal",
    style: {
      body: "#22307a",
      number: "#9fd8ff",
      outline: "#0a1030",
      texture: "astral",
      material: "auto",
    },
  },
  {
    id: "gelo",
    label: "Gelo",
    style: {
      body: "#bfe6f2",
      number: "#123a4a",
      outline: "#0b2733",
      texture: "ice",
      material: "glass",
    },
  },
  {
    id: "escamas",
    label: "Escamas",
    style: {
      body: "#2f6b3a",
      number: "#eaf7d9",
      outline: "#10240f",
      texture: "dragon",
      material: "auto",
    },
  },
  {
    id: "madeira",
    label: "Taverna",
    style: {
      body: "#7a4a22",
      number: "#f0dcb8",
      outline: "#2a1608",
      texture: "wood",
      material: "wood",
    },
  },
] as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const QUALITY_KEY = "rolai.quality-tier";
const THEME_KEY = "rolai.theme";
const DICE_STYLE_KEY = "rolai.dice-style";
const DICE_SCALE_KEY = "rolai.dice-scale";

export const DEFAULT_QUALITY_TIER: QualityTier = "3d-light";
// Feltro por padrao: a mesa e a metafora do app, e o fundo texturizado
// deixa o dado 3D com cara de rolagem em mesa de verdade. Quem prefere o
// escuro liso troca em Preferencias.
export const DEFAULT_THEME: ThemeName = "table";

export function isQualityTier(value: unknown): value is QualityTier {
  return (
    typeof value === "string" &&
    (QUALITY_TIERS as readonly string[]).includes(value)
  );
}

export function loadQualityTier(storage: StorageLike): QualityTier {
  const raw = storage.getItem(QUALITY_KEY);
  return isQualityTier(raw) ? raw : DEFAULT_QUALITY_TIER;
}

export function saveQualityTier(storage: StorageLike, tier: QualityTier): void {
  storage.setItem(QUALITY_KEY, tier);
}

export function isTheme(value: unknown): value is ThemeName {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function loadTheme(storage: StorageLike): ThemeName {
  const raw = storage.getItem(THEME_KEY);
  return isTheme(raw) ? raw : DEFAULT_THEME;
}

export function saveTheme(storage: StorageLike, theme: ThemeName): void {
  storage.setItem(THEME_KEY, theme);
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Estilo do dado: valida campo a campo e cai no default no que estiver
// corrompido — o valor vai direto pro renderer 3D.
export function loadDiceStyle(storage: StorageLike): DiceStyle {
  const raw = storage.getItem(DICE_STYLE_KEY);
  if (raw === null) return DEFAULT_DICE_STYLE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_DICE_STYLE;
    const { body, number, outline, texture, material } = parsed as Record<
      string,
      unknown
    >;
    const color = (v: unknown, fallback: string): string =>
      typeof v === "string" && HEX_COLOR.test(v) ? v : fallback;
    return {
      body: color(body, DEFAULT_DICE_STYLE.body),
      number: color(number, DEFAULT_DICE_STYLE.number),
      outline: color(outline, DEFAULT_DICE_STYLE.outline),
      texture: (DICE_TEXTURES as readonly unknown[]).includes(texture)
        ? (texture as DiceTexture)
        : DEFAULT_DICE_STYLE.texture,
      material: (DICE_MATERIALS as readonly unknown[]).includes(material)
        ? (material as DiceMaterial)
        : DEFAULT_DICE_STYLE.material,
    };
  } catch {
    return DEFAULT_DICE_STYLE;
  }
}

export function saveDiceStyle(storage: StorageLike, style: DiceStyle): void {
  storage.setItem(DICE_STYLE_KEY, JSON.stringify(style));
}

// Tamanho do dado: multiplicador do baseScale do motor 3D.
export const MIN_DICE_SCALE = 0.7;
export const MAX_DICE_SCALE = 1.6;
export const DEFAULT_DICE_SCALE = 1;

export function clampDiceScale(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_DICE_SCALE;
  return Math.min(MAX_DICE_SCALE, Math.max(MIN_DICE_SCALE, n));
}

export function loadDiceScale(storage: StorageLike): number {
  const raw = storage.getItem(DICE_SCALE_KEY);
  return raw === null ? DEFAULT_DICE_SCALE : clampDiceScale(raw);
}

export function saveDiceScale(storage: StorageLike, scale: number): void {
  storage.setItem(DICE_SCALE_KEY, String(clampDiceScale(scale)));
}

// Sistema escolhido ("" = notacao livre). Vive em Preferencias, nao no
// painel de rolagem: e uma escolha de mesa, mudada uma vez por sessao.
const SYSTEM_KEY = "rolai.system";

export function loadSystem(storage: StorageLike): string {
  return storage.getItem(SYSTEM_KEY) ?? "";
}

export function saveSystem(storage: StorageLike, system: string): void {
  storage.setItem(SYSTEM_KEY, system);
}

// Apelido do jogador. Persistido pra entrar por link direto sem precisar
// digitar nada — e editavel na tela de Sala.
const PLAYER_NAME_KEY = "rolai.player-name";
export const MAX_PLAYER_NAME = 24;

export function loadPlayerName(storage: StorageLike): string {
  const raw = storage.getItem(PLAYER_NAME_KEY);
  return raw === null ? "" : raw.slice(0, MAX_PLAYER_NAME);
}

export function savePlayerName(storage: StorageLike, name: string): void {
  storage.setItem(PLAYER_NAME_KEY, name.trim().slice(0, MAX_PLAYER_NAME));
}

// Ultima sala em que a pessoa esteve. So pra reentrar sozinho ao reabrir o
// app sem link (?room= na URL ja cobre o caso de link direto) — sair da sala
// de proposito apaga isto (App.tsx), senao reabrir o app sempre puxaria de
// volta uma sala que a pessoa deixou por querer.
const ROOM_CODE_KEY = "rolai.room-code";

export function loadRoomCode(storage: StorageLike): string {
  return storage.getItem(ROOM_CODE_KEY) ?? "";
}

export function saveRoomCode(storage: StorageLike, code: string): void {
  storage.setItem(ROOM_CODE_KEY, code);
}

export function clearRoomCode(storage: StorageLike): void {
  storage.setItem(ROOM_CODE_KEY, "");
}

// ---------- Baralho (specs/08-baralho.md) ----------

export const DEFAULT_DECK_CONFIG: DeckConfig = {
  includeJokers: false,
  removalMode: "permanent",
  autoReshuffleOnEmpty: false,
};

const DECK_CONFIG_KEY = "rolai.deck-config";

function isRemovalMode(value: unknown): value is DeckConfig["removalMode"] {
  return value === "permanent" || value === "returns";
}

export function loadDeckConfig(storage: StorageLike): DeckConfig {
  const raw = storage.getItem(DECK_CONFIG_KEY);
  if (raw === null) return DEFAULT_DECK_CONFIG;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_DECK_CONFIG;
    const { includeJokers, removalMode, autoReshuffleOnEmpty } = parsed as Record<
      string,
      unknown
    >;
    return {
      includeJokers:
        typeof includeJokers === "boolean"
          ? includeJokers
          : DEFAULT_DECK_CONFIG.includeJokers,
      removalMode: isRemovalMode(removalMode) ? removalMode : DEFAULT_DECK_CONFIG.removalMode,
      autoReshuffleOnEmpty:
        typeof autoReshuffleOnEmpty === "boolean"
          ? autoReshuffleOnEmpty
          : DEFAULT_DECK_CONFIG.autoReshuffleOnEmpty,
    };
  } catch {
    return DEFAULT_DECK_CONFIG;
  }
}

export function saveDeckConfig(storage: StorageLike, config: DeckConfig): void {
  storage.setItem(DECK_CONFIG_KEY, JSON.stringify(config));
}
