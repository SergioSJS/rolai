// Stepper numerico (+/-) pra inputs de profile e modificador do compositor.

import { MinusIcon, PlusIcon, TimesIcon } from "./Glyphs";

interface StepperInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  "aria-label"?: string;
  // So pra campo OPCIONAL (roll_under sem "valor testado", wod5 sem
  // "dificuldade"...): voltar pra "sem valor" nao e a mesma coisa que
  // "zero" — dar um jeito de esvaziar sem apertar backspace repetido.
  onClear?: () => void;
}

export function StepperInput({
  id,
  value,
  onChange,
  min,
  max,
  "aria-label": ariaLabel,
  onClear,
}: StepperInputProps) {
  const clamp = (n: number) =>
    Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min ?? Number.MIN_SAFE_INTEGER, n));

  const step = (delta: number) => {
    const current = Number(value);
    onChange(String(clamp((Number.isFinite(current) ? current : 0) + delta)));
  };

  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper-button"
        aria-label="diminuir"
        onClick={() => step(-1)}
      >
        <MinusIcon />
      </button>
      <input
        id={id}
        type="number"
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="stepper-button"
        aria-label="aumentar"
        onClick={() => step(1)}
      >
        <PlusIcon />
      </button>
      {onClear && (
        <button
          type="button"
          className="stepper-button stepper-clear"
          aria-label="limpar"
          disabled={value === ""}
          onClick={onClear}
        >
          <TimesIcon />
        </button>
      )}
    </div>
  );
}
