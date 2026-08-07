// Entry do bundle headless usado pela WebView sem UI do app Android
// (specs/04-android-overlay.md). Expoe `rolai` no escopo global com a API
// minima que o Kotlin chama via evaluateJavascript, e devolve resultados
// pelo bridge injetado (`RolaiBridge.onResult`, ver HeadlessRoller.kt).
//
// NENHuma logica de regras aqui — so o fino envelope async/JSON em cima
// do @rolai/rules-engine (regra de ouro do AGENTS.md).
//
// O bundle e gerado em vite lib-mode (vite.headless.config.ts) e instalado
// em apps/android/app/src/main/assets/headless/ por scripts/install-headless.mjs.

import { roll, rollWithProfile } from "@rolai/rules-engine";
import type { RollOptions, RollResult } from "@rolai/rules-engine";
import { availableProfiles, getProfile } from "./profiles.js";

// Bridge injetado pelo Kotlin via addJavascriptInterface("RolaiBridge").
// Em ambiente de teste (node/jsdom) pode nao existir — nesse caso o
// ultimo payload fica exposto em `rolaiLastDelivery` pra inspecao.
export interface RolaiJsBridge {
  onResult(callbackId: string, payloadJson: string): void;
}

export interface RolaiSystemInfo {
  system: string;
  label: string;
  inputs: {
    id: string;
    label: string;
    type: "number" | "select";
    // Opcoes do select (vazio nos numericos). SEM elas a tela nativa nao tem
    // como montar o campo — era por isso que o app pedia o JSON cru
    // (`{"mode":"adv"}`) em vez de um seletor "Normal/Vantagem/Desvantagem".
    options: { value: string; label: string }[];
  }[];
}

export interface RolaiHeadlessApi {
  /** JSON com os sistemas disponiveis (id, rotulo, inputs) — sincrono. */
  systems(): string;
  /** Rola notacao camada 1. Resultado chega via bridge no callbackId. */
  roll(notation: string, callbackId: string, optionsJson?: string): Promise<void>;
  /** Rola via profile de sistema com inputs do jogador (JSON). */
  rollWithProfile(
    system: string,
    inputsJson: string,
    callbackId: string,
    optionsJson?: string,
  ): Promise<void>;
}

type Delivery =
  | { ok: true; result: RollResult }
  | { ok: false; error: string };

declare global {
  // `var` global: acessivel como `rolai.roll(...)` no JS da WebView.
  // eslint-disable-next-line no-var
  var rolai: RolaiHeadlessApi;
  // eslint-disable-next-line no-var
  var RolaiBridge: RolaiJsBridge | undefined;
  // eslint-disable-next-line no-var
  var rolaiLastDelivery: { callbackId: string; payloadJson: string } | undefined;
}

function deliver(callbackId: string, payload: Delivery): void {
  const payloadJson = JSON.stringify(payload);
  const bridge = globalThis.RolaiBridge;
  if (bridge) {
    bridge.onResult(callbackId, payloadJson);
  } else {
    globalThis.rolaiLastDelivery = { callbackId, payloadJson };
  }
}

function toError(e: unknown): Delivery {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

function parseOptions(optionsJson?: string): RollOptions {
  return optionsJson ? (JSON.parse(optionsJson) as RollOptions) : {};
}

const api: RolaiHeadlessApi = {
  systems(): string {
    const infos: RolaiSystemInfo[] = availableProfiles().map((p) => ({
      system: p.system,
      label: p.label,
      inputs: p.inputs.map((i) => ({
        id: i.id,
        label: i.label,
        type: i.type,
        options: (i.options ?? []).map((o) => ({ value: o.value, label: o.label })),
      })),
    }));
    return JSON.stringify(infos);
  },

  async roll(notation, callbackId, optionsJson) {
    try {
      deliver(callbackId, { ok: true, result: roll(notation, parseOptions(optionsJson)) });
    } catch (e) {
      deliver(callbackId, toError(e));
    }
  },

  async rollWithProfile(system, inputsJson, callbackId, optionsJson) {
    try {
      const profile = getProfile(system);
      if (!profile) throw new Error(`sistema desconhecido: "${system}"`);
      const inputs = inputsJson
        ? (JSON.parse(inputsJson) as Record<string, number | string>)
        : {};
      const result = await rollWithProfile(profile, inputs, parseOptions(optionsJson));
      deliver(callbackId, { ok: true, result });
    } catch (e) {
      deliver(callbackId, toError(e));
    }
  },
};

globalThis.rolai = api;
