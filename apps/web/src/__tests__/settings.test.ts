import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  clampDiceScale,
  clearRoomCode,
  DEFAULT_DECK_CONFIG,
  DEFAULT_DICE_STYLE,
  DEFAULT_QUALITY_TIER,
  DICE_MATERIALS,
  DICE_PRESETS,
  DICE_TEXTURES,
  isQualityTier,
  loadDeckConfig,
  loadDiceScale,
  loadDiceStyle,
  loadQualityTier,
  loadRoomCode,
  loadTheme,
  saveDeckConfig,
  saveDiceScale,
  saveDiceStyle,
  saveQualityTier,
  saveRoomCode,
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
  it("default e mesa (feltro) — a metafora do app", () => {
    expect(loadTheme(makeStorage())).toBe("table");
  });

  it("persiste e recupera cada tema", () => {
    const storage = makeStorage();
    for (const theme of ["dark", "light", "table"] as const) {
      saveTheme(storage, theme);
      expect(loadTheme(storage)).toBe(theme);
    }
  });

  it("ignora valor invalido", () => {
    expect(loadTheme(makeStorage({ "rolai.theme": "neon" }))).toBe("table");
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

  // Som e mais critico que textura: textura que falta vira 404 silencioso,
  // mas com `sounds: true` a lib faz `throw` no initialize() se um mp3
  // faltar — derruba o renderer inteiro, nao so o audio. A lib pede
  // `sounds/dicehit/dicehit_<material><n>.mp3` e `sounds/surfaces/...`.
  it("os sons da lib estao em public/sounds", () => {
    expect(existsSync("public/sounds/dicehit"), "public/sounds/dicehit sumiu").toBe(true);
    expect(existsSync("public/sounds/surfaces"), "public/sounds/surfaces sumiu").toBe(true);
    for (const material of ["plastic", "metal", "wood", "coin"]) {
      expect(
        existsSync(`public/sounds/dicehit/dicehit_${material}1.mp3`),
        `sem som pro material "${material}"`,
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

describe("ultima sala (reentrar sozinho ao reabrir o app)", () => {
  it("vazio quando nunca esteve em sala", () => {
    expect(loadRoomCode(makeStorage())).toBe("");
  });

  it("persiste e recupera o codigo", () => {
    const storage = makeStorage();
    saveRoomCode(storage, "mesa-fixa-do-sergio-2026");
    expect(loadRoomCode(storage)).toBe("mesa-fixa-do-sergio-2026");
  });

  it("sair da sala apaga o codigo guardado", () => {
    const storage = makeStorage();
    saveRoomCode(storage, "mesa-fixa-do-sergio-2026");
    clearRoomCode(storage);
    expect(loadRoomCode(storage)).toBe("");
  });
});

describe("config do baralho (specs/08-baralho.md)", () => {
  it("default sem curinga, permanent, sem auto-reembaralhar", () => {
    expect(loadDeckConfig(makeStorage())).toEqual(DEFAULT_DECK_CONFIG);
  });

  it("persiste e recupera", () => {
    const storage = makeStorage();
    saveDeckConfig(storage, {
      includeJokers: true,
      removalMode: "returns",
      autoReshuffleOnEmpty: true,
    });
    expect(loadDeckConfig(storage)).toEqual({
      includeJokers: true,
      removalMode: "returns",
      autoReshuffleOnEmpty: true,
    });
  });

  it("campo corrompido cai no default so daquele campo", () => {
    const storage = makeStorage({
      "rolai.deck-config": JSON.stringify({
        includeJokers: "sim",
        removalMode: "invalido",
        autoReshuffleOnEmpty: true,
      }),
    });
    expect(loadDeckConfig(storage)).toEqual({
      includeJokers: false,
      removalMode: "permanent",
      autoReshuffleOnEmpty: true,
    });
  });

  it("JSON quebrado cai no default inteiro", () => {
    const storage = makeStorage({ "rolai.deck-config": "{quebrado" });
    expect(loadDeckConfig(storage)).toEqual(DEFAULT_DECK_CONFIG);
  });
});
