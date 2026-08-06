// Glifos "−" e "×" como SVG em vez de texto: o caractere tipografico
// desalinha dentro de botoes redondos (a metrica da fonte joga o traco pra
// baixo da linha de base); o SVG centraliza no viewBox e nunca desloca.

const COMMON = {
  className: "glyph",
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  "aria-hidden": true,
};

export function MinusIcon() {
  return (
    <svg {...COMMON}>
      <line x1="4" y1="8" x2="12" y2="8" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg {...COMMON}>
      <line x1="4" y1="8" x2="12" y2="8" />
      <line x1="8" y1="4" x2="8" y2="12" />
    </svg>
  );
}

export function TimesIcon() {
  return (
    <svg {...COMMON}>
      <line x1="4.5" y1="4.5" x2="11.5" y2="11.5" />
      <line x1="11.5" y1="4.5" x2="4.5" y2="11.5" />
    </svg>
  );
}
