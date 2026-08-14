// Teste do bundle headless gerado pra WebView do Android
// (specs/04-android-overlay.md): carrega dist-headless/rolai-headless.js
// de verdade (builda se nao existir) e valida que window.rolai calcula o
// MESMO resultado que o @rolai/rules-engine importado direto, com a mesma
// fila deterministica. E a prova local de que a WebView headless nao
// diverge do motor — o instrumented test HeadlessRollerParityTest repete
// a checagem no Android com os valores assados aqui.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { roll, rollOverlay, rollWithProfile } from "@rolai/rules-engine";
import type { RollResult } from "@rolai/rules-engine";
import { getProfile } from "./profiles.js";

const BUNDLE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist-headless",
  "rolai-headless.js",
);

type Delivery =
  | { ok: true; result: RollResult }
  | { ok: false; error: string };

interface BridgeCapture {
  calls: { callbackId: string; payload: Delivery }[];
}

function installBridge(): BridgeCapture {
  const capture: BridgeCapture = { calls: [] };
  globalThis.RolaiBridge = {
    onResult(callbackId: string, payloadJson: string) {
      capture.calls.push({ callbackId, payload: JSON.parse(payloadJson) as Delivery });
    },
  };
  return capture;
}

async function waitDelivery(capture: BridgeCapture, callbackId: string): Promise<Delivery> {
  for (let i = 0; i < 100; i++) {
    const found = capture.calls.find((c) => c.callbackId === callbackId);
    if (found) return found.payload;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`delivery "${callbackId}" nao chegou`);
}

beforeAll(() => {
  if (!fs.existsSync(BUNDLE)) {
    execSync("npm run build:headless", { stdio: "inherit" });
  }
  // Executa o IIFE no escopo global (como a tag <script> da WebView faria).
  const code = fs.readFileSync(BUNDLE, "utf8");
  new Function(code)();
  expect(typeof globalThis.rolai).toBe("object");
});

describe("bundle headless (WebView Android)", () => {
  it("expoe systems() com os profiles versionados", () => {
    const systems = JSON.parse(globalThis.rolai.systems()) as {
      system: string;
      label: string;
      inputs: unknown[];
    }[];
    const ids = systems.map((s) => s.system).sort();
    expect(ids).toEqual([
      "d100",
      "d20",
      "fate",
      "fitd",
      "fractal",
      "infaernum",
      "infaernum_ideias",
      "infaernum_sim_ou_nao",
      "ironsworn",
      "pbta",
      "pbta2d10",
      "pool_d6",
      "roll_under",
      "wod5",
    ]);
    for (const s of systems) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(Array.isArray(s.inputs)).toBe(true);
    }
  });

  // A tela nativa monta o formulario a partir DESTE json (systems.json, ver
  // scripts/install-headless.mjs). Sem as opcoes do select o app nao tinha
  // como oferecer "Vantagem" e pedia o JSON cru do input.
  it("systems() leva as opcoes dos selects, nao so o id", () => {
    const systems = JSON.parse(globalThis.rolai.systems()) as {
      system: string;
      inputs: { id: string; type: string; options: { value: string; label: string }[] }[];
    }[];
    const d20 = systems.find((s) => s.system === "d20");
    const modo = d20?.inputs.find((i) => i.id === "mode");
    expect(modo?.type).toBe("select");
    expect(modo?.options.map((o) => o.label)).toEqual(["Normal", "Vantagem", "Desvantagem"]);
    // Campo numerico nao tem opcao — o array existe vazio, pra tela nao
    // precisar checar ausencia.
    expect(d20?.inputs.find((i) => i.id === "dc")?.options).toEqual([]);
  });

  it("roll() bate com o rules-engine na mesma fila deterministica", async () => {
    const capture = installBridge();
    await globalThis.rolai.roll(
      "2d6",
      "cb-roll",
      JSON.stringify({ deterministic: [3, 4], timestamp: "2026-01-01T00:00:00.000Z" }),
    );
    const delivery = await waitDelivery(capture, "cb-roll");

    const expected = roll("2d6", {
      deterministic: [3, 4],
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(delivery).toEqual({ ok: true, result: expected });
    if (delivery.ok) {
      expect(delivery.result.groups["roll"]?.rolls).toEqual([3, 4]);
      // "2d6" sem modificador/keep-drop: `total` e ausente por contrato
      // (docs/roll-notation.md) — a UI soma os rolls quando precisa.
      expect(delivery.result.groups["roll"]?.total).toBeUndefined();
    }
  });

  it("rollWithProfile() bate com o rules-engine (pbta, strong_hit)", async () => {
    const capture = installBridge();
    await globalThis.rolai.rollWithProfile(
      "pbta",
      JSON.stringify({ mod: 1 }),
      "cb-profile",
      JSON.stringify({ deterministic: [6, 6], timestamp: "2026-01-01T00:00:00.000Z" }),
    );
    const delivery = await waitDelivery(capture, "cb-profile");

    const profile = getProfile("pbta");
    expect(profile).toBeDefined();
    const expected = await rollWithProfile(profile!, { mod: 1 }, {
      deterministic: [6, 6],
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(delivery).toEqual({ ok: true, result: expected });
    if (delivery.ok) {
      expect(delivery.result.outcome).toBe("strong_hit");
      expect(delivery.result.profile).toBe("pbta");
    }
  });

  // roll_under: sem dado proprio — a tela nativa precisa saber que este
  // system e "overlay" pra mesclar o form com o composer normal.
  it("systems() marca rollType overlay no roll_under", () => {
    const systems = JSON.parse(globalThis.rolai.systems()) as {
      system: string;
      rollType: string;
      inputs: { id: string; default?: string }[];
    }[];
    const rollUnder = systems.find((s) => s.system === "roll_under");
    expect(rollUnder?.rollType).toBe("overlay");
    const pbta = systems.find((s) => s.system === "pbta");
    expect(pbta?.rollType).toBe("simple");
    expect(pbta?.inputs.find((i) => i.id === "mod")?.default).toBe("0");
  });

  it("rollOverlay() bate com o rules-engine (roll_under)", async () => {
    const capture = installBridge();
    await globalThis.rolai.rollOverlay(
      "roll_under",
      "1d20",
      JSON.stringify({ target: 10 }),
      "cb-overlay",
      JSON.stringify({ deterministic: [10], timestamp: "2026-01-01T00:00:00.000Z" }),
    );
    const delivery = await waitDelivery(capture, "cb-overlay");

    const profile = getProfile("roll_under");
    expect(profile).toBeDefined();
    const expected = await rollOverlay(profile!, "1d20", { target: 10 }, {
      deterministic: [10],
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(delivery).toEqual({ ok: true, result: expected });
    if (delivery.ok) {
      expect(delivery.result.outcome).toBe("success");
      expect(delivery.result.profile).toBe("roll_under");
    }
  });

  it("devolve erro estruturado pra notacao invalida", async () => {
    const capture = installBridge();
    await globalThis.rolai.roll("isso nao e notacao", "cb-erro");
    const delivery = await waitDelivery(capture, "cb-erro");
    expect(delivery.ok).toBe(false);
    if (!delivery.ok) expect(delivery.error.length).toBeGreaterThan(0);
  });

  it("devolve erro pra sistema desconhecido", async () => {
    const capture = installBridge();
    await globalThis.rolai.rollWithProfile("gurps", "{}", "cb-erro2");
    const delivery = await waitDelivery(capture, "cb-erro2");
    expect(delivery.ok).toBe(false);
  });
});
