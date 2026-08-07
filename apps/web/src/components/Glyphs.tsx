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

// Ícones do menu. Traço em vez de preenchimento, no mesmo peso do logo,
// pra não competir com o texto do item.
const MENU = {
  className: "menu-icon",
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Sala: duas pessoas — quem está na mesa. */
export function RoomIcon() {
  return (
    <svg {...MENU}>
      <circle cx="7.5" cy="7" r="2.6" />
      <path d="M2.8 16c0-2.4 2.1-4 4.7-4s4.7 1.6 4.7 4" />
      <path d="M13.8 5.2a2.6 2.6 0 0 1 0 4.6" />
      <path d="M15.2 12.4c1.3.5 2 1.5 2 3.6" />
    </svg>
  );
}

/** Preferências: engrenagem simplificada (6 dentes bastam neste tamanho). */
export function SettingsIcon() {
  return (
    <svg {...MENU}>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.5v2.2M10 15.3v2.2M17.5 10h-2.2M4.7 10H2.5M15.3 4.7l-1.6 1.6M6.3 13.7l-1.6 1.6M15.3 15.3l-1.6-1.6M6.3 6.3 4.7 4.7" />
    </svg>
  );
}

/** Ajuda: interrogação. */
export function HelpIcon() {
  return (
    <svg {...MENU}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M7.8 7.6a2.3 2.3 0 0 1 4.4.8c0 1.5-2.2 1.9-2.2 3.2" />
      <path d="M10 14.6v.1" strokeWidth={2} />
    </svg>
  );
}

/** Sobre: "i" de informação. */
export function AboutIcon() {
  return (
    <svg {...MENU}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9.2v4.6" />
      <path d="M10 6.4v.1" strokeWidth={2} />
    </svg>
  );
}
