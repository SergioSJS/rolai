// Tipos minimos da @3d-dice/dice-box-threejs 0.0.12 — o pacote nao distribui
// declaracoes. So a superficie que o DiceBoxRenderer usa.

declare module "@3d-dice/dice-box-threejs" {
  // Paleta custom do dado: corpo, numero, contorno, textura e material.
  export interface DiceColorset {
    background: string;
    foreground: string;
    outline?: string;
    texture?: string;
    material?: string;
  }

  export interface DiceBoxConfig {
    assetPath?: string;
    theme_customColorset?: DiceColorset;
    shadows?: boolean;
    light_intensity?: number;
    sounds?: boolean;
    theme_colorset?: string;
    theme_texture?: string;
    theme_material?: string;
    scale?: number;
    baseScale?: number;
    gravity_multiplier?: number;
    strength?: number;
    onRollComplete?: (results: unknown) => void;
  }

  export default class DiceBox {
    constructor(selector: string, config?: DiceBoxConfig);
    initialize(): Promise<unknown>;
    roll(notation: string): Promise<unknown>;
    add(notation: string): Promise<unknown>;
    clearDice(): void;
    // Troca tema/colorset com o motor ja de pe (usado pra animar a rolagem
    // de outro jogador com a cor dele).
    updateConfig(config: DiceBoxConfig): Promise<unknown>;
  }
}
