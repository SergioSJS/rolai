// Fabrica de renderers por tier de qualidade (persistido em localStorage —
// ver src/settings.ts). Os dois tiers 3D dividem o mesmo motor; o "leve" so
// desliga a sombra.

import type { DiceStyle, QualityTier } from "../settings";
import { clampDiceScale, DEFAULT_DICE_SCALE, DEFAULT_DICE_STYLE } from "../settings";
import type { DiceBoxOptions } from "./diceBox";
import type { RollRenderer } from "./types";
import { DiceBoxRenderer } from "./diceBox";
import { Css2DRenderer } from "./css2d";
import { TextRenderer } from "./text";

// Mesma luz nos dois tiers 3D. Intensidade de luz nao custa GPU — o que
// pesa e o shadow map — e baixar pra 0.5 no "leve" so deixava o dado
// escuro/sujo, com a mesma cor rendendo diferente entre os jogadores.
export const LIGHT_INTENSITY = 0.9;

// Config do motor 3D por tier (exportada pra ser testavel sem WebGL).
export function diceBoxOptions(
  tier: "3d-full" | "3d-light",
  style: DiceStyle,
  scale: number = DEFAULT_DICE_SCALE,
): DiceBoxOptions {
  return {
    shadows: tier === "3d-full",
    lightIntensity: LIGHT_INTENSITY,
    style,
    scale: clampDiceScale(scale),
  };
}

export function createRenderer(
  tier: QualityTier,
  style: DiceStyle = DEFAULT_DICE_STYLE,
  scale: number = DEFAULT_DICE_SCALE,
): RollRenderer {
  switch (tier) {
    case "3d-full":
    case "3d-light":
      return new DiceBoxRenderer(diceBoxOptions(tier, style, scale));
    case "2d":
      return new Css2DRenderer();
    case "text":
      return new TextRenderer();
  }
}
