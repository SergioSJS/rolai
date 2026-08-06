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
import { roll, rollWithProfile } from "@rolai/rules-engine";
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
    expect(ids).toEqual(["d100", "d20", "fate", "fitd", "ironsworn", "pbta"]);
    for (const s of systems) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(Array.isArray(s.inputs)).toBe(true);
    }
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
