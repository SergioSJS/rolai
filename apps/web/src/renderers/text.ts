// Renderer de texto puro: numero direto, sem animacao. Tier usado tambem
// como fallback quando a notacao nao parseia ou o WebGL falha.

import type { RollResult } from "@rolai/rules-engine";
import type { RollRenderer } from "./types";
import { summarizeResult } from "../format";

export class TextRenderer implements RollRenderer {
  private container: HTMLElement | null = null;

  init(container: HTMLElement): Promise<void> {
    this.container = container;
    return Promise.resolve();
  }

  roll(result: RollResult): Promise<void> {
    if (!this.container) return Promise.resolve();
    this.container.replaceChildren();
    const el = document.createElement("div");
    el.className = "die-text";
    el.textContent = summarizeResult(result);
    this.container.appendChild(el);
    return Promise.resolve();
  }

  clear(): void {
    this.container?.replaceChildren();
  }

  dispose(): void {
    this.container?.replaceChildren();
    this.container = null;
  }
}
