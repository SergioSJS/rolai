// Barra do compositor: resumo do pool em chips removiveis, botoes de dado
// (d4..d100 + dF, com icone do formato), stepper de modificador, preview
// editavel da notacao e limpar. A notacao e a fonte de verdade — os botoes
// so a editam via composer.ts (sempre parseavel pelo engine).
//
// Adicionar e remover sao ambos visiveis, sem atalho escondido: o corpo do
// botao adiciona, o "−" no canto tira um dado, e o "×" do chip tira o tipo
// inteiro.

import {
  addDieToNotation,
  adjustModifier,
  clearComposer,
  COMPOSER_DICE,
  dieKind,
  dieKindLabel,
  EMPTY_COMPOSER,
  fromNotation,
  removeDieFromNotation,
  removeTerm,
  termNotation,
  toNotation,
} from "../composer";
import type { ComposerState } from "../composer";
import { StepperInput } from "./StepperInput";
import { DiceIcon } from "./DiceIcon";
import { MinusIcon, TimesIcon } from "./Glyphs";

interface ComposerBarProps {
  notation: string;
  onChange: (notation: string) => void;
}

export function ComposerBar({ notation, onChange }: ComposerBarProps) {
  // null = notacao digitada a mao fora do que os botoes representam
  // (keep/drop, vs, ...). Nesse caso o clique num dado recomeça de um pool
  // vazio em vez de somar num estado que a UI nao mostra.
  const state = fromNotation(notation);
  const base = state ?? EMPTY_COMPOSER;
  const isEmpty = base.terms.length === 0 && base.modifier === 0;

  const apply = (next: ComposerState) => onChange(toNotation(next));

  return (
    <div className="composer">
      <div className="pool-tray" aria-label="Pool montado" aria-live="polite">
        {isEmpty ? (
          <p className="pool-empty">Toque nos dados pra montar a rolagem.</p>
        ) : (
          <>
            {base.terms.map((term) => {
              const kind = dieKind(term);
              return (
                <span key={String(kind)} className="pool-chip">
                  <DiceIcon kind={kind} className="pool-chip-icon" />
                  {termNotation(term)}
                  <button
                    type="button"
                    className="icon-button pool-chip-remove"
                    aria-label={`Tirar todos os ${dieKindLabel(kind)}`}
                    title={`Tirar todos os ${dieKindLabel(kind)}`}
                    onClick={() => apply(removeTerm(base, kind))}
                  >
                    <TimesIcon />
                  </button>
                </span>
              );
            })}
            {base.modifier !== 0 && (
              <span className="pool-chip pool-chip-mod">
                {base.modifier > 0 ? `+${base.modifier}` : base.modifier}
                <button
                  type="button"
                  className="icon-button pool-chip-remove"
                  aria-label="Zerar modificador"
                  title="Zerar modificador"
                  onClick={() => apply({ ...base, modifier: 0 })}
                >
                  <TimesIcon />
                </button>
              </span>
            )}
          </>
        )}
      </div>

      <div className="composer-dice" role="group" aria-label="Dados">
        {COMPOSER_DICE.map((kind) => {
          const term = base.terms.find((t) => dieKind(t) === kind);
          const label = dieKindLabel(kind);
          const addLabel = kind === "C" ? "Adicionar uma carta" : `Adicionar um ${label}`;
          const removeLabel = kind === "C" ? "Tirar uma carta" : `Tirar um ${label}`;
          return (
            <div key={String(kind)} className={`die-slot${term ? " active" : ""}`}>
              <button
                type="button"
                className="die-button"
                aria-label={addLabel}
                title={addLabel}
                onClick={() => onChange(addDieToNotation(notation, kind))}
              >
                <DiceIcon kind={kind} />
                <span className="die-button-label">{label}</span>
                {term && <span className="die-button-count">{term.count}</span>}
              </button>
              {term && (
                <button
                  type="button"
                  className="icon-button die-remove"
                  aria-label={removeLabel}
                  title={removeLabel}
                  onClick={() => onChange(removeDieFromNotation(notation, kind))}
                >
                  <MinusIcon />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="composer-row">
        <span className="composer-label">Mod</span>
        <StepperInput
          value={String(base.modifier)}
          // Nao "Modificador" cru: profiles como pbta/d20 tem um input com
          // esse MESMO rotulo, e agora o composer fica visivel do lado do
          // profile (RollPanel) — nome ambiguo pra quem usa leitor de tela
          // (e pra query de teste por label).
          aria-label="Modificador do pool"
          onChange={(v) => {
            const target = Number(v) || 0;
            apply(adjustModifier(base, target - base.modifier));
          }}
        />
        <button
          type="button"
          className="button-ghost composer-clear"
          disabled={isEmpty && notation.trim() === ""}
          onClick={() => onChange(toNotation(clearComposer()))}
        >
          Limpar
        </button>
      </div>

      <input
        type="text"
        className="notation-input"
        value={notation}
        placeholder="ex: 3d6+2"
        aria-label="Notação"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
