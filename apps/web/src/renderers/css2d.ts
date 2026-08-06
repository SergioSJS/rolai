// Renderer 2D animado: dados como caixas CSS que "embaralham" faces e
// assentam no valor final decidido. Sem WebGL, sem fisica — fallback leve
// da escada de qualidade (docs/architecture.md).

import type { RollResult } from "@rolai/rules-engine";
import type { DiceStyle } from "../settings";
import type { RenderedDie, RollRenderer } from "./types";
import { diceFromResult, faceLabel } from "./types";

const SHUFFLE_INTERVAL_MS = 70;
const BASE_SETTLE_MS = 500;
const PER_DIE_EXTRA_MS = 250;

export class Css2DRenderer implements RollRenderer {
  private container: HTMLElement | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];

  init(container: HTMLElement): Promise<void> {
    this.container = container;
    return Promise.resolve();
  }

  roll(result: RollResult, style?: DiceStyle | null): Promise<void> {
    const container = this.container;
    if (!container) return Promise.resolve();
    this.clearTimers();
    container.replaceChildren();

    let dice: RenderedDie[];
    try {
      dice = diceFromResult(result);
    } catch {
      dice = [];
    }
    if (dice.length === 0) return Promise.resolve();

    const settleAt = dice.map(
      (_, i) => BASE_SETTLE_MS + i * PER_DIE_EXTRA_MS,
    );

    return new Promise((resolve) => {
      dice.forEach((die, i) => {
        const el = document.createElement("div");
        el.className = "die2d";
        el.textContent = "?";
        // Cor de quem rolou (a mesma do tier 3D), quando informada.
        if (style) {
          el.style.background = style.body;
          el.style.color = style.number;
        }
        container.appendChild(el);

        const shuffle = setInterval(() => {
          const face = 1 + Math.floor(Math.random() * die.sides);
          el.textContent = die.fudge
            ? faceLabel({ ...die, value: face - 2 })
            : String(face);
        }, SHUFFLE_INTERVAL_MS);

        this.timers.push(
          setTimeout(() => {
            clearInterval(shuffle);
            el.textContent = faceLabel(die);
            el.classList.add("settled");
          }, settleAt[i]!),
        );
      });
      this.timers.push(
        setTimeout(resolve, settleAt[settleAt.length - 1]! + 50),
      );
    });
  }

  clear(): void {
    this.clearTimers();
    this.container?.replaceChildren();
  }

  dispose(): void {
    this.clearTimers();
    this.container?.replaceChildren();
    this.container = null;
  }

  private clearTimers(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
  }
}
