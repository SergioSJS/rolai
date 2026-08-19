// Stepper numerico (+/-) pra inputs de profile e modificador do compositor.
//
// O "X" de limpar NAO mora aqui: ele fica na linha do rotulo (ver
// RollPanel.tsx). Como quarto botao da fileira ele somava largura fixa ao
// campo, e era o que impedia tres steppers na mesma linha do formulario
// (os pools de Base/Perícia/Equipamento do Forbidden Lands).

import { MinusIcon, PlusIcon } from "./Glyphs";

interface StepperInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  "aria-label"?: string;
}

export function StepperInput({
  id,
  value,
  onChange,
  min,
  max,
  "aria-label": ariaLabel,
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
    </div>
  );
}
