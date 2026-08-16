// Tipos minimos da @letele/playing-cards 0.1.0 — o pacote anuncia
// "types": "lib/index.d.ts" no package.json mas nao publica esse arquivo no
// tarball (so dist/index.esm.js). Um componente SVG por carta: naipe (C/D/H/S)
// + rank (2-10 maiusculo, A/J/Q/K minusculo — convencao da lib), mais B1/B2
// (versos) e J1/J2 (curingas).

declare module "@letele/playing-cards" {
  import type { ComponentType, SVGProps } from "react";

  export type CardSvgComponent = ComponentType<
    SVGProps<SVGSVGElement> & { title?: string; titleId?: string }
  >;

  export const B1: CardSvgComponent;
  export const B2: CardSvgComponent;
  export const J1: CardSvgComponent;
  export const J2: CardSvgComponent;

  export const Ca: CardSvgComponent;
  export const C2: CardSvgComponent;
  export const C3: CardSvgComponent;
  export const C4: CardSvgComponent;
  export const C5: CardSvgComponent;
  export const C6: CardSvgComponent;
  export const C7: CardSvgComponent;
  export const C8: CardSvgComponent;
  export const C9: CardSvgComponent;
  export const C10: CardSvgComponent;
  export const Cj: CardSvgComponent;
  export const Cq: CardSvgComponent;
  export const Ck: CardSvgComponent;

  export const Da: CardSvgComponent;
  export const D2: CardSvgComponent;
  export const D3: CardSvgComponent;
  export const D4: CardSvgComponent;
  export const D5: CardSvgComponent;
  export const D6: CardSvgComponent;
  export const D7: CardSvgComponent;
  export const D8: CardSvgComponent;
  export const D9: CardSvgComponent;
  export const D10: CardSvgComponent;
  export const Dj: CardSvgComponent;
  export const Dq: CardSvgComponent;
  export const Dk: CardSvgComponent;

  export const Ha: CardSvgComponent;
  export const H2: CardSvgComponent;
  export const H3: CardSvgComponent;
  export const H4: CardSvgComponent;
  export const H5: CardSvgComponent;
  export const H6: CardSvgComponent;
  export const H7: CardSvgComponent;
  export const H8: CardSvgComponent;
  export const H9: CardSvgComponent;
  export const H10: CardSvgComponent;
  export const Hj: CardSvgComponent;
  export const Hq: CardSvgComponent;
  export const Hk: CardSvgComponent;

  export const Sa: CardSvgComponent;
  export const S2: CardSvgComponent;
  export const S3: CardSvgComponent;
  export const S4: CardSvgComponent;
  export const S5: CardSvgComponent;
  export const S6: CardSvgComponent;
  export const S7: CardSvgComponent;
  export const S8: CardSvgComponent;
  export const S9: CardSvgComponent;
  export const S10: CardSvgComponent;
  export const Sj: CardSvgComponent;
  export const Sq: CardSvgComponent;
  export const Sk: CardSvgComponent;
}
