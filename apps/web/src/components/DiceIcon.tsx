// Icones SVG inline pros botoes do compositor — silhuetas monocromaticas
// dos formatos fisicos dos dados (stroke: currentColor, herdam a cor).

import type { DieKind } from "../composer";

interface DiceIconProps {
  kind: DieKind;
  className?: string;
}

// Poligonos num viewBox 24x24.
const SHAPES: Record<number, string> = {
  4: "12,3.5 20.5,19.5 3.5,19.5", // triangulo
  6: "M5,5 h14 v14 h-14 z", // quadrado (path)
  8: "12,2.5 21,12 12,21.5 3,12", // losango
  10: "12,2.5 19.5,9.5 12,21.5 4.5,9.5", // pipa (kite)
  12: "12,2.8 20.2,8.8 17,19.2 7,19.2 3.8,8.8", // pentagono
  20: "12,2.5 20.2,7.2 20.2,16.8 12,21.5 3.8,16.8 3.8,7.2", // hexagono
};

export function DiceIcon({ kind, className }: DiceIconProps) {
  const common = {
    className: className ?? "die-icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    "aria-hidden": true,
  };
  if (kind === 2) {
    // Moeda (d2): circulo com divisoria sutil.
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12,6.5 v11" />
      </svg>
    );
  }
  if (kind === 3) {
    // Prisma (d3): triangulo com aresta central.
    return (
      <svg {...common}>
        <polygon points="12,3.5 20.5,19.5 3.5,19.5" />
        <path d="M12,3.5 v16" />
      </svg>
    );
  }
  if (kind === "F") {
    // Fudge: cubo com as faces "+" e "−".
    return (
      <svg {...common}>
        <path d="M5,5 h14 v14 h-14 z" />
        <path d="M8.2,10 h3.4 M9.9,8.3 v3.4" />
        <path d="M13,15.5 h3.4" />
      </svg>
    );
  }
  if (kind === "C") {
    // Carta: retangulo com cantos arredondados e simbolo central.
    return (
      <svg {...common}>
        <rect x="5" y="3.5" width="14" height="17" rx="2" />
        <path d="M12,8.5 c-1.2,-1.5 -3,-0.5 -3,1.2 c0,1.8 3,3.8 3,3.8 c0,0 3,-2 3,-3.8 c0,-1.7 -1.8,-2.7 -3,-1.2 z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === 66) {
    // Par de d6 (d66: dezena e unidade)
    return (
      <svg {...common}>
        <rect x="3.5" y="4" width="10" height="10" rx="1.5" />
        <rect x="10.5" y="10" width="10" height="10" rx="1.5" />
      </svg>
    );
  }
  if (kind === 100) {
    // Par de losangos: dezenas + unidades.
    return (
      <svg {...common}>
        <polygon points="7.5,5 12,9.5 7.5,14 3,9.5" />
        <polygon points="16.5,10 21,14.5 16.5,19 12,14.5" />
      </svg>
    );
  }
  const shape = SHAPES[kind];
  if (shape === undefined) return null;
  if (shape.startsWith("M")) {
    return (
      <svg {...common}>
        <path d={shape} />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <polygon points={shape} />
    </svg>
  );
}
