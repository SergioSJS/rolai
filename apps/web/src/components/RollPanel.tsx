// Painel de rolagem: inputs do profile escolhido (em Preferências) ou
// compositor de notacao livre. A montagem da rolagem e 100% via
// rules-engine (src/roll.ts) — a UI nao parseia nem calcula nada.

import { useState } from "react";
import type { FormEvent } from "react";
import type { RollResult, SystemProfile } from "@rolai/rules-engine";
import { rollFromNotation, rollFromProfile } from "../roll";
import { ComposerBar } from "./ComposerBar";
import { StepperInput } from "./StepperInput";

interface RollPanelProps {
  // undefined = notacao livre
  profile?: SystemProfile | undefined;
  onRoll: (result: RollResult) => void;
  disabled?: boolean;
}

// Select ja entra com a primeira opcao escolhida; number comeca vazio.
function defaultInputs(profile?: SystemProfile): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const input of profile?.inputs ?? []) {
    if (input.options?.[0]) defaults[input.id] = input.options[0].value;
  }
  return defaults;
}

export function RollPanel({ profile, onRoll, disabled }: RollPanelProps) {
  const [rawInputs, setRawInputs] = useState<Record<string, string>>(() =>
    defaultInputs(profile),
  );
  const [notation, setNotation] = useState("2d6");
  const [error, setError] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setRolling(true);
    try {
      const result = profile
        ? await rollFromProfile(profile, rawInputs)
        : rollFromNotation(notation);
      onRoll(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRolling(false);
    }
  }

  return (
    <form className="panel roll-panel" onSubmit={handleSubmit}>
      <h2>{profile ? profile.label : "Rolagem livre"}</h2>

      {profile ? (
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
                <label htmlFor={`profile-input-${input.id}`}>{input.label}</label>
                <StepperInput
                  id={`profile-input-${input.id}`}
                  value={rawInputs[input.id] ?? ""}
                  onChange={(v) =>
                    setRawInputs((prev) => ({ ...prev, [input.id]: v }))
                  }
                />
              </div>
            ),
          )}
        </div>
      ) : (
        <ComposerBar notation={notation} onChange={setNotation} />
      )}

      <button
        type="submit"
        className="roll-button"
        // Pool vazio (notacao "") nao e rolagem: desativa em vez de deixar o
        // usuario clicar e receber erro do parser.
        disabled={disabled || rolling || (!profile && notation.trim() === "")}
      >
        Rolar
      </button>
      {error !== null && <p className="error">{error}</p>}
    </form>
  );
}
