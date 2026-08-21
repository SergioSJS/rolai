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

// Icones dos titulos de secao em Preferencias — mesmo peso visual do MENU
// acima, so pra dar ponto de referencia rapido ao rolar a lista.

/** Sistema: regras da mesa — lista de itens (indice de regrinhas). */
export function RulesIcon() {
  return (
    <svg {...MENU}>
      <circle cx="4.3" cy="6" r="0.9" fill="currentColor" stroke="none" />
      <line x1="7.8" y1="6" x2="17" y2="6" />
      <circle cx="4.3" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <line x1="7.8" y1="10" x2="17" y2="10" />
      <circle cx="4.3" cy="14" r="0.9" fill="currentColor" stroke="none" />
      <line x1="7.8" y1="14" x2="13.5" y2="14" />
    </svg>
  );
}

/** Dados: mesmo d20 do logo (MenuBar), so reescalado pro viewBox 20x20. */
export function DiceSectionIcon() {
  return (
    <svg {...MENU}>
      <polygon points="10,2 17.3,6.1 17.3,13.9 10,18 2.7,13.9 2.7,6.1" />
      <polygon points="10,5.5 13.7,12.9 6.3,12.9" />
    </svg>
  );
}

/** Render: tela — qualidade/tema e sobre COMO o resultado aparece. */
export function RenderIcon() {
  return (
    <svg {...MENU}>
      <rect x="2.5" y="4" width="15" height="10" rx="1.3" />
      <line x1="7" y1="17" x2="13" y2="17" />
      <line x1="10" y1="14" x2="10" y2="17" />
    </svg>
  );
}

/** Baralho: duas cartas em leque — mesma leitura da escada de cartas do palco. */
export function CardsIcon() {
  return (
    <svg {...MENU}>
      <rect x="3.3" y="5.4" width="8.6" height="11.6" rx="1.3" transform="rotate(-9 7.6 11.2)" />
      <rect x="7.7" y="3.4" width="8.6" height="11.6" rx="1.3" />
    </svg>
  );
}

/** Ocultar: olho cortado — o histórico continua lá, só não à vista. */
export function HideIcon() {
  return (
    <svg {...MENU}>
      <path d="M2.5 10s2.9-4.4 7.5-4.4S17.5 10 17.5 10s-2.9 4.4-7.5 4.4S2.5 10 2.5 10Z" />
      <circle cx="10" cy="10" r="1.9" />
      <line x1="4" y1="16" x2="16" y2="4" />
    </svg>
  );
}

/** Mostrar tudo: o mesmo olho, sem o corte — desfaz o ocultar. */
export function ShowIcon() {
  return (
    <svg {...MENU}>
      <path d="M2.5 10s2.9-4.4 7.5-4.4S17.5 10 17.5 10s-2.9 4.4-7.5 4.4S2.5 10 2.5 10Z" />
      <circle cx="10" cy="10" r="1.9" />
    </svg>
  );
}

/** Limpar: lixeira — apaga de verdade, e o ícone precisa dizer isso. */
export function TrashIcon() {
  return (
    <svg {...MENU}>
      <path d="M4.4 6.2h11.2l-.9 9.4a1.4 1.4 0 0 1-1.4 1.3H6.7a1.4 1.4 0 0 1-1.4-1.3Z" />
      <path d="M3.2 6.2h13.6M7.9 6.2V4.6c0-.6.5-1.1 1.1-1.1h2c.6 0 1.1.5 1.1 1.1v1.6" />
      <line x1="8.4" y1="9.2" x2="8.4" y2="13.6" />
      <line x1="11.6" y1="9.2" x2="11.6" y2="13.6" />
    </svg>
  );
}

/**
 * Rolar: d6 em queda, com dois traços de movimento.
 *
 * Desenhado GRANDE de propósito. A primeira versão tinha o dado menor e
 * três traços finos: ao lado de um "ROLAR" em 1.05rem/800 o glifo virava
 * borrão. Menos detalhe e mais área é o que sobrevive no tamanho real.
 */
export function RollIcon() {
  return (
    <svg {...MENU} strokeWidth={1.5}>
      <rect x="4.6" y="6.8" width="11" height="11" rx="2" transform="rotate(-12 10.1 12.3)" />
      <circle cx="8" cy="10.6" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="12.6" cy="14.4" r="1.05" fill="currentColor" stroke="none" />
      <path d="M5.6 3.6 7.4 5.2M12.4 2.8 11.6 5" />
    </svg>
  );
}

/** Puxar: carta saindo do monte — a de cima destacada pra fora. */
export function DrawCardIcon() {
  return (
    <svg {...MENU} strokeWidth={1.5}>
      <rect x="2.6" y="7.4" width="7.4" height="10" rx="1.4" />
      <rect x="10.2" y="3.6" width="7.2" height="9.8" rx="1.4" transform="rotate(14 13.8 8.5)" />
    </svg>
  );
}

/**
 * Reembaralhar: duas setas que se cruzam e saem pelo mesmo lado.
 *
 * Segunda versão. A primeira tinha os dois caminhos quebrados em cotovelos
 * mais as pontas — a 16px o conjunto virava mancha. Aqui são duas curvas
 * limpas, bem separadas nas extremidades, com uma ponta cada.
 */
export function ShuffleIcon() {
  return (
    <svg {...MENU} strokeWidth={1.5}>
      <path d="M2.6 5.6c4.6 0 6.4 8.8 11 8.8" />
      <path d="M2.6 14.4c4.6 0 6.4-8.8 11-8.8" />
      <path d="M11.8 3.4 14.2 5.6l-2.4 2.2M11.8 12.2l2.4 2.2-2.4 2.2" strokeLinejoin="round" />
    </svg>
  );
}

/** Copiar: duas folhas sobrepostas — o gesto de área de transferência. */
export function CopyIcon() {
  return (
    <svg {...MENU} strokeWidth={1.5}>
      <rect x="7" y="7" width="9.4" height="10.4" rx="1.4" />
      <path d="M13 4.6H5.2c-.8 0-1.5.7-1.5 1.5V14" />
    </svg>
  );
}

/** Sair: porta com a seta apontando pra fora. */
export function ExitIcon() {
  return (
    <svg {...MENU} strokeWidth={1.5}>
      <path d="M11.6 3.6H5.4c-.8 0-1.4.6-1.4 1.4v10c0 .8.6 1.4 1.4 1.4h6.2" />
      <path d="M9.4 10h7.2M14 7.4 16.6 10 14 12.6" />
    </svg>
  );
}

/** Entrar: a mesma porta, com a seta apontando pra dentro. */
export function EnterIcon() {
  return (
    <svg {...MENU} strokeWidth={1.5}>
      <path d="M8.4 3.6h6.2c.8 0 1.4.6 1.4 1.4v10c0 .8-.6 1.4-1.4 1.4H8.4" />
      <path d="M3.4 10h7.2M8 7.4 10.6 10 8 12.6" />
    </svg>
  );
}

/** Renomear: lápis — trocar o apelido é editar, não confirmar. */
export function PencilIcon() {
  return (
    <svg {...MENU} strokeWidth={1.5}>
      <path d="M13.4 3.9a1.8 1.8 0 0 1 2.6 2.5l-8 8-3.4.9.9-3.4Z" />
      <path d="M12.2 5.3l2.5 2.5" />
    </svg>
  );
}

/**
 * Forçar: chevron duplo pra cima — escalar a rolagem, não repetir.
 *
 * Deliberadamente diferente do RollIcon: Forçar arrisca em cima de um
 * resultado que já saiu (specs/ e yzePush.ts), e confundir os dois botões é
 * caro — não dá pra desfazer.
 */
export function PushIcon() {
  return (
    <svg {...MENU} strokeWidth={1.6}>
      <path d="M5.6 11.4 10 7l4.4 4.4M5.6 15.6 10 11.2l4.4 4.4" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Limpar o pool: seta entrando numa caixa com ×, o glifo de "apagar tudo".
 *
 * Segunda versão. A primeira era uma borracha inclinada e, a 16px em cor
 * `--muted`, lia como um losango solto. Não usa lixeira de propósito: essa
 * é do "Limpar histórico", que apaga registro — aqui só desmonta o pool.
 */
export function EraserIcon() {
  return (
    <svg {...MENU} strokeWidth={1.5}>
      <path d="M7.4 4.6h8c.8 0 1.4.6 1.4 1.4v8c0 .8-.6 1.4-1.4 1.4h-8L2.6 10Z" />
      <path d="M9.4 7.8 13.4 12.2M13.4 7.8 9.4 12.2" />
    </svg>
  );
}

/** Stream: camera de video — corpo + lente trapezoidal. */
export function StreamIcon() {
  return (
    <svg {...MENU}>
      <rect x="2.8" y="6.8" width="10.4" height="7.6" rx="1.2" />
      <path d="M13.2 9.3 17.2 6.8v7.6l-4-2.5" strokeLinejoin="round" />
    </svg>
  );
}
