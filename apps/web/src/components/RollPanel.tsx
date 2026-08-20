// Painel de rolagem: composer de notacao livre (botoes de dado normais)
// SEMPRE visivel, e o profile escolhido em Preferencias — quando tem um —
// entra do lado. A montagem da rolagem e 100% via rules-engine
// (src/roll.ts) — a UI nao parseia nem calcula nada.
//
// Tres formatos, por profile?.rollType:
// - sem profile: so o composer (como sempre foi).
// - "overlay" (roll_under): profile nao tem dado proprio — os inputs dele
//   (ex.: "valor testado") entram JUNTO do composer num unico form/botao,
//   e a regra e avaliada sobre o que o composer montar (rollFromOverlay).
// - qualquer outro profile (receita fixa: pbta, wod5, ironsworn...): DOIS
//   forms independentes, cada um com seu botao — o profile rola seu
//   proprio dado (rollFromProfile), e o composer continua disponivel do
//   lado pra um d6 solto sem trocar de sistema.

import { useState } from "react";
import type { FormEvent } from "react";
import type { RollResult, SystemProfile } from "@rolai/rules-engine";
import { rollFromNotation, rollFromOverlay, rollFromProfile } from "../roll";
import { isYzeSystem, planYzePush } from "../yzePush";
import { isTrophy, planTrophyPush } from "../trophyPush";
import { ComposerBar } from "./ComposerBar";
import { TimesIcon } from "./Glyphs";
import { StepperInput } from "./StepperInput";

export const INFAERNUM_ACTIONS = [
  { system: "infaernum", label: "Ação" },
  { system: "infaernum_sim_ou_nao", label: "Sim ou Não" },
  { system: "infaernum_ideias", label: "Ideias" },
];

export function isInfaernum(system?: string): boolean {
  return system !== undefined && system.startsWith("infaernum");
}

interface RollPanelProps {
  // undefined = notacao livre
  profile?: SystemProfile | undefined;
  onRoll: (result: RollResult) => void;
  onSystemChange?: ((system: string) => void) | undefined;
  disabled?: boolean;
}

// Select ja entra com a primeira opcao escolhida; number usa o "default"
// do profile quando houver (ex.: modificador comeca em "0"), senao vazio.
function defaultInputs(profile?: SystemProfile): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const input of profile?.inputs ?? []) {
    if (input.options?.[0]) defaults[input.id] = input.options[0].value;
    else if (input.default !== undefined) defaults[input.id] = input.default;
  }
  return defaults;
}

// Campo cujo id comeca com "push_" e escrituracao do Forçar (os "1s
// travados" do Forbidden Lands): quem preenche e o botao, e ver os dois na
// frente o tempo todo entulhava um formulario que ja tem tres pools. Fica
// numa secao recolhida — aberta sozinha quando ja tem valor, senao o
// jogador nao veria o que o Forçar acumulou.
function isPushField(id: string): boolean {
  return id.startsWith("push_");
}

// Inputs que VIRAM DADO (aparecem no `dice` de algum field) — e o que
// separa "Base/Perícia/Equipamento" de "Dificuldade/Sucesso garantido".
// Vem do proprio profile, nao de convencao de nome nem de "tem default":
// as duas tentativas anteriores quebraram assim que um pool ganhou um
// valor inicial.
function diceInputIds(profile: SystemProfile): Set<string> {
  const ids = new Set<string>();
  for (const field of profile.fields) {
    for (const m of field.dice.matchAll(/\{input\.([A-Za-z_][A-Za-z0-9_]*)\}/g)) {
      ids.add(m[1]!);
    }
  }
  return ids;
}

function ProfileInputFields({
  profile,
  rawInputs,
  setRawInputs,
}: {
  profile: SystemProfile;
  rawInputs: Record<string, string>;
  setRawInputs: (update: (prev: Record<string, string>) => Record<string, string>) => void;
}) {
  const main = profile.inputs.filter((i) => !isPushField(i.id));
  // Duas fileiras, nao uma fileira que quebra sozinha: os DADOS (os tres
  // pools do Forbidden Lands) numa linha, os AJUSTES (dificuldade, sucesso
  // garantido) na seguinte. Deixado no automatico, o flex-wrap encaixava 4
  // campos na primeira linha e largava o quinto sozinho esticado embaixo.
  const poolIds = diceInputIds(profile);
  const dados = main.filter((i) => poolIds.has(i.id));
  const ajustes = main.filter((i) => !poolIds.has(i.id));
  const push = profile.inputs.filter((i) => isPushField(i.id));
  const pushFilled = push.some((i) => (rawInputs[i.id] ?? "") !== "");
  return (
    <>
      {dados.length > 0 && (
        <ProfileInputRow
          inputs={dados}
          rawInputs={rawInputs}
          setRawInputs={setRawInputs}
        />
      )}
      {ajustes.length > 0 && (
        <ProfileInputRow
          inputs={ajustes}
          rawInputs={rawInputs}
          setRawInputs={setRawInputs}
        />
      )}
      {push.length > 0 && (
        <details className="push-fields" open={pushFilled}>
          <summary>Escrituração do Forçar</summary>
          <ProfileInputRow
            inputs={push}
            rawInputs={rawInputs}
            setRawInputs={setRawInputs}
          />
        </details>
      )}
    </>
  );
}

// Campo numerico do formulario de sistema. O "X" fica ao lado do stepper,
// nao no rotulo: solto no fim de um rotulo que quebra em duas linhas ele
// aparecia colado no campo VIZINHO. Cabe porque so campo com default ou
// opcional tem X, e esses ficam na segunda fileira (dois por linha) —
// nunca na fileira dos pools.
//
// Pra onde o X leva depende do campo: opcional volta a ficar VAZIO (e o que
// faz o motor pular as outcome_rules que o citam); obrigatorio com default
// volta pro default — o "Sucesso garantido" precisa zerar sem esvaziar, ou
// a rolagem nem sai (input obrigatorio ausente).
function ProfileNumberField({
  input,
  value,
  onChange,
}: {
  input: SystemProfile["inputs"][number];
  value: string;
  onChange: (value: string) => void;
}) {
  const clearTo = input.required === false ? "" : input.default;
  return (
    <div className="field">
      <label htmlFor={`profile-input-${input.id}`}>
        {input.label}
        {input.required === false ? " (opcional)" : ""}
      </label>
      <span className="field-control">
        <StepperInput
          id={`profile-input-${input.id}`}
          value={value}
          onChange={onChange}
        />
        {clearTo !== undefined && (
          <button
            type="button"
            className="field-clear"
            aria-label="limpar"
            disabled={value === clearTo}
            onClick={() => onChange(clearTo)}
          >
            <TimesIcon />
          </button>
        )}
      </span>
    </div>
  );
}

function ProfileInputRow({
  inputs,
  rawInputs,
  setRawInputs,
}: {
  inputs: SystemProfile["inputs"];
  rawInputs: Record<string, string>;
  setRawInputs: (update: (prev: Record<string, string>) => Record<string, string>) => void;
}) {
  return (
    <div className="profile-inputs">
      {inputs.map((input) =>
        input.options ? (
          <div key={input.id} className="field">
            <label htmlFor={`profile-input-${input.id}`}>{input.label}</label>
            <select
              id={`profile-input-${input.id}`}
              value={rawInputs[input.id] ?? input.options[0]?.value ?? ""}
              onChange={(e) =>
                setRawInputs((prev) => ({ ...prev, [input.id]: e.target.value }))
              }
            >
              {input.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <ProfileNumberField
            key={input.id}
            input={input}
            value={rawInputs[input.id] ?? ""}
            onChange={(v) => setRawInputs((prev) => ({ ...prev, [input.id]: v }))}
          />
        ),
      )}
    </div>
  );
}

export function RollPanel({
  profile,
  onRoll,
  onSystemChange,
  disabled,
}: RollPanelProps) {
  const isOverlay = profile?.rollType === "overlay";
  const infaernum = profile ? isInfaernum(profile.system) : false;
  const [rawInputs, setRawInputs] = useState<Record<string, string>>(() =>
    defaultInputs(profile),
  );
  const [notation, setNotation] = useState("2d6");

  // Ultima rolagem DESTE painel com ESTE profile — a base do "Forçar" do
  // Year Zero. E o resultado proprio de proposito: em sala, `lastResult` do
  // App tambem recebe a rolagem dos outros, e empurrar a rolagem alheia nao
  // e uma coisa que exista.
  const [lastOwn, setLastOwn] = useState<RollResult | null>(null);
  const [pushHint, setPushHint] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRolling, setProfileRolling] = useState(false);
  const [freeError, setFreeError] = useState<string | null>(null);
  const [freeRolling, setFreeRolling] = useState(false);

  // Um caminho so pra rolar pelo profile — o botao Rolar e o Forçar usam
  // este, com inputs diferentes. O Forçar passa os valores calculados
  // DIRETO em vez de depender do setRawInputs ja ter chegado no estado
  // (setState nao e sincrono: rolar lendo `rawInputs` logo depois rolaria
  // o pool velho, em silencio — a familia de bug do AGENTS.md).
  async function runProfileRoll(
    inputs: Record<string, string>,
  ): Promise<RollResult | null> {
    if (!profile) return null;
    setProfileError(null);
    setProfileRolling(true);
    try {
      const result = await rollFromProfile(profile, inputs);
      setLastOwn(result);
      onRoll(result);
      return result;
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setProfileRolling(false);
    }
  }

  // Rolar normal comeca uma cadeia NOVA: a escrituracao do Forçar
  // ("push_*": os 1s travados do Forbidden Lands) descreve o que veio das
  // rolagens ANTERIORES desta cadeia, e carregar isso pra uma rolagem
  // fresca fazia aparecer dano do nada, de uma rolagem que nem foi forcada.
  // Quem preenche esses campos e o Forçar, sempre.
  function withoutPushBookkeeping(
    inputs: Record<string, string>,
  ): Record<string, string> {
    const next = { ...inputs };
    for (const input of profile?.inputs ?? []) {
      if (isPushField(input.id)) next[input.id] = "";
    }
    return next;
  }

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    setPushHint(null);
    const inputs = withoutPushBookkeeping(rawInputs);
    setRawInputs(() => inputs);
    await runProfileRoll(inputs);
  }

  async function handleFreeSubmit(event: FormEvent) {
    event.preventDefault();
    setFreeError(null);
    setFreeRolling(true);
    try {
      if (notation.trim() !== "") {
        const result =
          profile && isOverlay
            ? await rollFromOverlay(profile, notation, rawInputs)
            : rollFromNotation(notation);
        onRoll(result);
      }
    } catch (err) {
      setFreeError(err instanceof Error ? err.message : String(err));
    } finally {
      setFreeRolling(false);
    }
  }

  // Pool vazio (notacao "") nao e rolagem: desativa em vez de deixar o
  // usuario clicar e receber erro do parser. Vale pro composer sempre,
  // ja que agora ele fica visivel independente de ter profile.
  const notationEmpty = notation.trim() === "";
  // Dois forms visiveis (profile de receita fixa + composer): o botao de
  // cada um precisa de rotulo distinto pra nao ficar ambiguo (teste,
  // leitor de tela) — texto continua "Rolar" nos dois.
  const twoForms = profile !== undefined && !isOverlay;

  // Forçar (o "push" da linha Year Zero): recalcula quantos dados sobraram
  // e quantos sucessos ficaram travados (a conta vive em yzePush.ts), joga
  // isso nos campos E rola na hora — um toque, como na mesa. Os campos
  // ficam preenchidos com o que foi usado, entao da pra ajustar e rolar de
  // novo pelo Rolar normal.
  //
  // Nada impede forcar de novo o que ja foi forcado: a regra de "so uma
  // vez" varia por jogo da linha, e quem decide isso e a mesa, nao o app.
  const yzePush =
    profile !== undefined && isYzeSystem(profile.system) && lastOwn !== null
      ? planYzePush(profile.system, lastOwn, rawInputs)
      : null;

  const trophyPush =
    profile !== undefined && isTrophy(profile.system) && lastOwn !== null
      ? planTrophyPush(lastOwn, rawInputs)
      : null;

  const canPush = yzePush !== null || trophyPush !== null;

  async function handlePush() {
    if (yzePush !== null) {
      setRawInputs(() => yzePush.inputs);
      const travados = yzePush.sucessosTravados;
      const rerrolados = yzePush.dadosRerrolados;
      const result = await runProfileRoll(yzePush.inputs);
      if (result === null) return;
      setPushHint(
        `Forçou: ${travados} ${travados === 1 ? "sucesso garantido" : "sucessos garantidos"}, ` +
          `${rerrolados} ${rerrolados === 1 ? "dado rerrolado" : "dados rerrolados"}.`,
      );
    } else if (trophyPush !== null) {
      const inputsStr: Record<string, string> = {
        claros: String(trophyPush["claros"]),
        escuros: String(trophyPush["escuros"]),
        ruina: String(trophyPush["ruina"]),
      };
      setRawInputs(() => inputsStr);
      const result = await runProfileRoll(inputsStr);
      if (result === null) return;
      setPushHint(
        `Forçou: +1 dado escuro (${trophyPush["escuros"]} ${
          trophyPush["escuros"] === 1 ? "dado escuro" : "dados escuros"
        }).`,
      );
    }
  }

  return (
    <div className="roll-panel-stack">
      {twoForms && (
        <form className="panel roll-panel" onSubmit={handleProfileSubmit}>
          {infaernum && onSystemChange !== undefined && (
            <div className="family-tabs" role="tablist" aria-label="Ações de Infaernum">
              {INFAERNUM_ACTIONS.map((action) => (
                <button
                  key={action.system}
                  type="button"
                  role="tab"
                  aria-selected={action.system === profile.system}
                  className={action.system === profile.system ? "family-tab is-active" : "family-tab"}
                  onClick={() => onSystemChange(action.system)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
          <h2>{profile.label}</h2>
          <ProfileInputFields
            profile={profile}
            rawInputs={rawInputs}
            setRawInputs={setRawInputs}
          />
          <button
            type="submit"
            className="roll-button"
            aria-label="Rolar sistema"
            disabled={disabled || profileRolling}
          >
            Rolar
          </button>
          {canPush && (
            <button
              type="button"
              className="push-button"
              onClick={() => void handlePush()}
              disabled={disabled || profileRolling}
            >
              Forçar
            </button>
          )}
          {pushHint !== null && (
            <p className="push-hint" role="status">
              {pushHint}
            </p>
          )}
          {profileError !== null && <p className="error">{profileError}</p>}
        </form>
      )}

      <form className="panel roll-panel" onSubmit={handleFreeSubmit}>
        <h2>{isOverlay && profile ? profile.label : "Rolagem livre"}</h2>
        {isOverlay && profile && (
          <ProfileInputFields
            profile={profile}
            rawInputs={rawInputs}
            setRawInputs={setRawInputs}
          />
        )}
        <ComposerBar notation={notation} onChange={setNotation} />
        <button
          type="submit"
          className="roll-button"
          aria-label={twoForms ? "Rolar dados" : undefined}
          disabled={disabled || freeRolling || notationEmpty}
        >
          Rolar
        </button>
        {freeError !== null && <p className="error">{freeError}</p>}
      </form>
    </div>
  );
}
