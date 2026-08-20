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

import { roll, rollOverlay, rollWithProfile } from "@rolai/rules-engine";
import type { RollOptions, RollResult } from "@rolai/rules-engine";
import { createDeck, draw, reshuffleDeck, updateConfig } from "@rolai/deck-engine";
import type { DeckConfig, DeckState } from "@rolai/deck-engine";
import { availableProfiles, getProfile } from "./profiles.js";
import { catalog } from "./catalog.js";
import { applyInputQuirks } from "./profileInputQuirks.js";
import { isYzeSystem, planYzePush } from "./yzePush.js";
import { isTrophy, planTrophyPush } from "./trophyPush.js";

// Bridge injetado pelo Kotlin via addJavascriptInterface("RolaiBridge").
// Em ambiente de teste (node/jsdom) pode nao existir — nesse caso o
// ultimo payload fica exposto em `rolaiLastDelivery` pra inspecao.
export interface RolaiJsBridge {
  onResult(callbackId: string, payloadJson: string): void;
}

export interface RolaiSystemInfo {
  system: string;
  label: string;
  // "overlay" (roll_under): sem dado proprio — a tela nativa mescla os
  // inputs deste profile com o composer normal e chama rollOverlay, nao
  // rollWithProfile. Qualquer outro valor rola como sempre.
  rollType: string;
  inputs: {
    id: string;
    label: string;
    type: "number" | "select";
    // false = pode ficar em branco (roll_under sem "target", wod5 sem
    // "difficulty" — so rola, sem outcome). Ver docs/system-profiles.md.
    required: boolean;
    // Hint de UI: campo ja vem preenchido (ex. modificador comecando em
    // "0"). Ausente (undefined) quando o profile nao declarou — nao muda
    // obrigatoriedade nenhuma.
    default?: string;
    // Opcoes do select (vazio nos numericos). SEM elas a tela nativa nao tem
    // como montar o campo — era por isso que o app pedia o JSON cru
    // (`{"mode":"adv"}`) em vez de um seletor "Normal/Vantagem/Desvantagem".
    options: { value: string; label: string }[];
  }[];
}

export interface RolaiHeadlessApi {
  /** JSON com os sistemas disponiveis (id, rotulo, inputs) — sincrono. */
  systems(): string;
  /**
   * JSON com o catalogo de apresentacao (rotulos de outcome/pool, tom de
   * cada outcome, familias de profile) — sincrono.
   *
   * Nao e usado em runtime pela WebView: existe pro install-headless.mjs
   * gerar OutcomeCatalog.kt a partir da mesma fonte que a web usa, em vez
   * de manter as tabelas copiadas em Kotlin (ver src/catalog.ts).
   */
  catalog(): string;
  /** Rola notacao camada 1. Resultado chega via bridge no callbackId. */
  roll(notation: string, callbackId: string, optionsJson?: string): Promise<void>;
  /** Rola via profile de sistema com inputs do jogador (JSON). */
  rollWithProfile(
    system: string,
    inputsJson: string,
    callbackId: string,
    optionsJson?: string,
  ): Promise<void>;
  /**
   * Profile "overlay" (roll_under): a notacao vem do composer normal, o
   * profile so avalia outcome_rules sobre o resultado. Ver rollOverlay em
   * @rolai/rules-engine.
   */
  rollOverlay(
    system: string,
    notation: string,
    inputsJson: string,
    callbackId: string,
    optionsJson?: string,
  ): Promise<void>;
  /**
   * Puxa `count` carta(s) de um baralho local ao overlay Android
   * (specs/08-baralho.md — cada jogador tem o proprio, o app nativo NAO
   * tem estado nenhum, so guarda o `DeckState` serializado entre chamadas
   * e devolve pra WebView de novo aqui). `deckStateJson` null/vazio cria um
   * baralho novo com `configJson`; presente, reusa a config JA embutida
   * nele (`configJson` e ignorado nesse caso — mudar config de baralho em
   * andamento e outra chamada, nao esta).
   */
  deckDraw(
    deckStateJson: string | null,
    configJson: string,
    count: number,
    callbackId: string,
  ): Promise<void>;
  /** Reembaralha o baralho serializado (recolhe descarte, reordena). */
  deckReshuffle(deckStateJson: string, callbackId: string): Promise<void>;
  /**
   * Aplica mudancas de config (`removalMode`/`autoReshuffleOnEmpty`) a um
   * baralho JA existente, EM CIMA do monte/descarte atuais — so vale pro
   * proximo draw(). `includeJokers` muda a COMPOSICAO do monte (deck-engine
   * nao adiciona/remove carta de um monte em andamento sozinho) — pra isso
   * use `deckNew`, nao esta chamada.
   */
  deckConfig(deckStateJson: string, changesJson: string, callbackId: string): Promise<void>;
  /** Cria um baralho do zero com a config dada — usado quando `includeJokers`
   *  muda (a composicao do monte so pode mudar num baralho novo). */
  deckNew(configJson: string, callbackId: string): Promise<void>;
  /**
   * Forçar (o push do Year Zero): recalcula o pool a partir da rolagem
   * ANTERIOR (quantos dados sobraram, quantos sucessos travaram) e rola
   * de novo. A conta e a mesma da web (`yzePush.ts`) de proposito — o
   * Kotlin nao reimplementa nada (AGENTS.md).
   *
   * A entrega leva, alem do resultado, os `pushInputs` usados: quem chamou
   * precisa deles pra mostrar no formulario e pra "repetir a ultima
   * rolagem" repetir a rolagem forcada, nao a de antes dela.
   */
  rollPush(
    system: string,
    previousResultJson: string,
    inputsJson: string,
    callbackId: string,
    optionsJson?: string,
  ): Promise<void>;
}

interface DeckDrawPayload {
  deck: DeckState;
  cards: DeckState["drawPile"];
  remaining: number;
}

interface DeckStatePayload {
  deck: DeckState;
}

type Delivery =
  | { ok: true; result: RollResult; pushInputs?: Record<string, string> }
  | { ok: true; result: DeckDrawPayload }
  | { ok: true; result: DeckStatePayload }
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

// `kind: "deck"` e o que deixa o Kotlin (HeadlessRoller.handlePayload) rotear
// pro par de callbacks de baralho em vez do de rolagem, sem duas WebViews —
// entrega de rolagem (sem `kind`) segue no formato de sempre, retrocompativel.
function deliver(callbackId: string, payload: Delivery, kind?: "deck"): void {
  const payloadJson = JSON.stringify(kind ? { ...payload, kind } : payload);
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
      rollType: p.rollType,
      inputs: p.inputs.map((i) => ({
        id: i.id,
        label: i.label,
        type: i.type,
        required: i.required,
        ...(i.default !== undefined ? { default: i.default } : {}),
        options: (i.options ?? []).map((o) => ({ value: o.value, label: o.label })),
      })),
    }));
    return JSON.stringify(infos);
  },

  catalog(): string {
    return JSON.stringify(catalog());
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
      const result = await rollWithProfile(
        profile,
        applyInputQuirks(profile, inputs),
        parseOptions(optionsJson),
      );
      deliver(callbackId, { ok: true, result });
    } catch (e) {
      deliver(callbackId, toError(e));
    }
  },

  async rollOverlay(system, notation, inputsJson, callbackId, optionsJson) {
    try {
      const profile = getProfile(system);
      if (!profile) throw new Error(`sistema desconhecido: "${system}"`);
      const inputs = inputsJson
        ? (JSON.parse(inputsJson) as Record<string, number | string>)
        : {};
      const result = await rollOverlay(profile, notation, inputs, parseOptions(optionsJson));
      deliver(callbackId, { ok: true, result });
    } catch (e) {
      deliver(callbackId, toError(e));
    }
  },

  async deckDraw(deckStateJson, configJson, count, callbackId) {
    try {
      const state: DeckState = deckStateJson
        ? (JSON.parse(deckStateJson) as DeckState)
        : createDeck(JSON.parse(configJson) as Partial<DeckConfig>);
      const result = draw(state, count);
      deliver(
        callbackId,
        { ok: true, result: { deck: state, cards: result.cards, remaining: result.remaining } },
        "deck",
      );
    } catch (e) {
      deliver(callbackId, toError(e), "deck");
    }
  },

  async deckReshuffle(deckStateJson, callbackId) {
    try {
      const state = JSON.parse(deckStateJson) as DeckState;
      reshuffleDeck(state);
      deliver(callbackId, { ok: true, result: { deck: state } }, "deck");
    } catch (e) {
      deliver(callbackId, toError(e), "deck");
    }
  },

  async deckConfig(deckStateJson, changesJson, callbackId) {
    try {
      const state = JSON.parse(deckStateJson) as DeckState;
      updateConfig(state, JSON.parse(changesJson) as Partial<DeckConfig>);
      deliver(callbackId, { ok: true, result: { deck: state } }, "deck");
    } catch (e) {
      deliver(callbackId, toError(e), "deck");
    }
  },

  async rollPush(system, previousResultJson, inputsJson, callbackId, optionsJson) {
    try {
      const profile = getProfile(system);
      if (!profile) throw new Error(`sistema desconhecido: "${system}"`);
      const previous = JSON.parse(previousResultJson) as RollResult;
      const current = inputsJson
        ? (JSON.parse(inputsJson) as Record<string, string | number>)
        : {};
      const raw: Record<string, string> = {};
      for (const [k, v] of Object.entries(current)) raw[k] = String(v);

      let pushInputs: Record<string, string> | null = null;
      if (isYzeSystem(system)) {
        const plan = planYzePush(system, previous, raw);
        if (plan === null) throw new Error("essa rolagem nao da pra forcar");
        pushInputs = plan.inputs;
      } else if (isTrophy(system)) {
        const plan = planTrophyPush(previous, raw);
        if (plan === null) throw new Error("essa rolagem nao da pra forcar");
        pushInputs = {
          claros: String(plan["claros"]),
          escuros: String(plan["escuros"]),
          ruina: String(plan["ruina"]),
        };
      } else {
        throw new Error("sistema nao suporta forcar rolagem");
      }

      const inputs: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(pushInputs)) {
        if (v === "") continue;
        const n = Number(v);
        inputs[k] = Number.isFinite(n) ? n : v;
      }
      const result = await rollWithProfile(
        profile,
        applyInputQuirks(profile, inputs),
        parseOptions(optionsJson),
      );
      deliver(callbackId, { ok: true, result, pushInputs });
    } catch (e) {
      deliver(callbackId, toError(e));
    }
  },

  async deckNew(configJson, callbackId) {
    try {
      const state = createDeck(JSON.parse(configJson) as Partial<DeckConfig>);
      deliver(callbackId, { ok: true, result: { deck: state } }, "deck");
    } catch (e) {
      deliver(callbackId, toError(e), "deck");
    }
  },
};

globalThis.rolai = api;
