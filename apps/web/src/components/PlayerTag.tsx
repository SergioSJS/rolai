// Nome do jogador com a cara do dado dele: fundo na cor do corpo, texto na
// cor do numero. Serve de legenda visual — na sala, dá pra saber de quem e o
// dado que esta rolando sem ler nome nenhum.
//
// Sem estilo (jogador de cliente antigo, ou rolagem local) cai no verde do
// tema, que e o comportamento de antes.

import type { DiceStyle } from "../settings";

interface PlayerTagProps {
  name: string;
  style?: DiceStyle | null;
}

export function PlayerTag({ name, style }: PlayerTagProps) {
  if (!style) return <span className="player-tag">{name}</span>;
  return (
    <span
      className="player-tag has-style"
      style={{ background: style.body, color: style.number }}
    >
      {name}
    </span>
  );
}
