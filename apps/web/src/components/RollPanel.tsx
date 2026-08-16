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
import type { ProfileFamily } from "../profileFamilies";
import { ComposerBar } from "./ComposerBar";
import { StepperInput } from "./StepperInput";

interface RollPanelProps {
  // undefined = notacao livre
  profile?: SystemProfile | undefined;
  // Presente quando `profile` e um dos modos de uma familia (Infaernum:
  // oraculo/ideias/acao) — mostra os modos como botoes AQUI, na propria
  // caixa de rolagem, em vez de exigir abrir Preferências pra trocar.
  family?: ProfileFamily | undefined;
  onSelectFamilyMember?: (system: string) => void;
  onRoll: (result: RollResult) => void;
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

function ProfileInputFields({
  profile,
  rawInputs,
  setRawInputs,
}: {
  profile: SystemProfile;
  rawInputs: Record<string, string>;
  setRawInputs: (update: (prev: Record<string, string>) => Record<string, string>) => void;
}) {
  return (
    <div className="profile-inputs">
      {profile.inputs.map((input) =>
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
          <div key={input.id} className="field">
            <label htmlFor={`profile-input-${input.id}`}>
              {input.label}
              {input.required === false ? " (opcional)" : ""}
            </label>
            <StepperInput
              id={`profile-input-${input.id}`}
              value={rawInputs[input.id] ?? ""}
              onChange={(v) =>
                setRawInputs((prev) => ({ ...prev, [input.id]: v }))
              }
              onClear={
                input.required === false
                  ? () => setRawInputs((prev) => ({ ...prev, [input.id]: "" }))
                  : undefined
              }
            />
          </div>
        ),
      )}
    </div>
  );
}

export function RollPanel({
  profile,
  family,
  onSelectFamilyMember,
  onRoll,
  disabled,
}: RollPanelProps) {
  const isOverlay = profile?.rollType === "overlay";
  const [rawInputs, setRawInputs] = useState<Record<string, string>>(() =>
    defaultInputs(profile),
  );
  const [notation, setNotation] = useState("2d6");

  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRolling, setProfileRolling] = useState(false);
  const [freeError, setFreeError] = useState<string | null>(null);
  const [freeRolling, setFreeRolling] = useState(false);

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setProfileError(null);
    setProfileRolling(true);
    try {
      onRoll(await rollFromProfile(profile, rawInputs));
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : String(err));
    } finally {
      setProfileRolling(false);
    }
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

  return (
    <div className="roll-panel-stack">
      {twoForms && (
        <form className="panel roll-panel" onSubmit={handleProfileSubmit}>
          {family ? (
            <div className="family-tabs" role="tablist" aria-label={family.label}>
              {family.members.map((member) => (
                <button
                  key={member.system}
                  type="button"
                  role="tab"
                  aria-selected={member.system === profile.system}
                  className={
                    member.system === profile.system
                      ? "family-tab is-active"
                      : "family-tab"
                  }
                  onClick={() => onSelectFamilyMember?.(member.system)}
                >
                  {member.subLabel}
                </button>
              ))}
            </div>
          ) : (
            <h2>{profile.label}</h2>
          )}
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
