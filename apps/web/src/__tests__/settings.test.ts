import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  clampDiceScale,
  DEFAULT_DICE_STYLE,
  DEFAULT_QUALITY_TIER,
  DICE_MATERIALS,
  DICE_PRESETS,
  DICE_TEXTURES,
  isQualityTier,
  loadDiceScale,
  loadDiceStyle,
  loadQualityTier,
  loadTheme,
  saveDiceScale,
  saveDiceStyle,
  saveQualityTier,
  saveTheme,
} from "../settings";

// Storage fake em memoria — a logica de persistencia nao depende de DOM.
function makeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

describe("quality tier", () => {
  it("default e 3d-light quando nada foi salvo", () => {
    expect(loadQualityTier(makeStorage())).toBe(DEFAULT_QUALITY_TIER);
    expect(DEFAULT_QUALITY_TIER).toBe("3d-light");
  });

  it("persiste e recupera o tier escolhido", () => {
    const storage = makeStorage();
    saveQualityTier(storage, "2d");
    expect(loadQualityTier(storage)).toBe("2d");
    saveQualityTier(storage, "text");
    expect(loadQualityTier(storage)).toBe("text");
  });

  it("ignora valor corrompido no storage e cai pro default", () => {
    const storage = makeStorage({ "rolai.quality-tier": "8d-ultra" });
    expect(loadQualityTier(storage)).toBe(DEFAULT_QUALITY_TIER);
  });

  it("isQualityTier valida os 4 niveis da escada", () => {
    for (const tier of ["3d-full", "3d-light", "2d", "text"]) {
      expect(isQualityTier(tier)).toBe(true);
    }
    expect(isQualityTier("3d")).toBe(false);
    expect(isQualityTier(42)).toBe(false);
  });
});

describe("tema", () => {
  it("default e escuro", () => {
    expect(loadTheme(makeStorage())).toBe("dark");
  });

  it("persiste e recupera cada tema", () => {
    const storage = makeStorage();
    for (const theme of ["dark", "light", "table"] as const) {
      saveTheme(storage, theme);
      expect(loadTheme(storage)).toBe(theme);
    }
  });

  it("ignora valor invalido", () => {
    expect(loadTheme(makeStorage({ "rolai.theme": "neon" }))).toBe("dark");
  });
});

describe("estilo dos dados", () => {
  it("default e o preset esmeralda", () => {
    expect(loadDiceStyle(makeStorage())).toEqual(DEFAULT_DICE_STYLE);
  });

  it("persiste e recupera cada preset", () => {
    const storage = makeStorage();
    for (const preset of DICE_PRESETS) {
      saveDiceStyle(storage, preset.style);
      expect(loadDiceStyle(storage)).toEqual(preset.style);
    }
  });

  it("aceita cor custom em hex", () => {
    const storage = makeStorage();
    const style = { ...DEFAULT_DICE_STYLE, body: "#ff00aa" };
    saveDiceStyle(storage, style);
    expect(loadDiceStyle(storage).body).toBe("#ff00aa");
  });

  it("cai no default campo a campo no que estiver invalido", () => {
    const storage = makeStorage({
      "rolai.dice-style": JSON.stringify({
        body: "javascript:alert(1)",
        number: "#112233",
        outline: "#000000",
        texture: "lava",
        material: "adamantium",
      }),
    });
    const style = loadDiceStyle(storage);
    expect(style.body).toBe(DEFAULT_DICE_STYLE.body);
    expect(style.number).toBe("#112233");
    expect(style.texture).toBe(DEFAULT_DICE_STYLE.texture);
    expect(style.material).toBe(DEFAULT_DICE_STYLE.material);
  });

  it("JSON corrompido nao quebra", () => {
    expect(loadDiceStyle(makeStorage({ "rolai.dice-style": "{{" }))).toEqual(
      DEFAULT_DICE_STYLE,
    );
  });
});

// Regressao: textura exposta na UI sem arquivo servido = dado sem estampa
// nenhuma (a lib pede "textures/<arquivo>.webp" em runtime e engole o 404).
// O nome do arquivo nem sempre e o nome da textura — "bird" vem de feather.
const TEXTURE_FILES: Record<string, string> = {
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

describe("texturas dos dados", () => {
  it("toda textura da lista tem arquivo em public/textures", () => {
    for (const texture of DICE_TEXTURES) {
      if (texture === "none") continue;
      const file = TEXTURE_FILES[texture];
      expect(file, `sem arquivo mapeado pra textura "${texture}"`).toBeDefined();
      expect(
        existsSync(`public/textures/${file}`),
        `public/textures/${file} nao existe`,
      ).toBe(true);
    }
  });

  it("todo preset usa textura e material validos", () => {
    for (const preset of DICE_PRESETS) {
      expect(DICE_TEXTURES).toContain(preset.style.texture);
      expect(DICE_MATERIALS).toContain(preset.style.material);
    }
  });
});

describe("tamanho do dado", () => {
  it("default 1, persiste e clampa na faixa 0.7..1.6", () => {
    const storage = makeStorage();
    expect(loadDiceScale(storage)).toBe(1);
    saveDiceScale(storage, 1.3);
    expect(loadDiceScale(storage)).toBe(1.3);
    saveDiceScale(storage, 99);
    expect(loadDiceScale(storage)).toBe(1.6);
    expect(clampDiceScale("lixo")).toBe(1);
  });
});
