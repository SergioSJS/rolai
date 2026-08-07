// Quem esta na sala, visivel SEM abrir modal.
//
// Antes o roster so existia dentro de "Sala": pra saber quem estava na mesa
// era preciso abrir um modal que tampa o palco. Numa mesa isso e informacao
// de consulta constante ("o Beto ja entrou?"), entao mora ao lado da
// rolagem.

import type { RoomState } from "../room/reducer";
import { PlayerTag } from "./PlayerTag";

const STATUS_LABEL: Record<RoomState["status"], string> = {
  idle: "sem sala",
  connecting: "conectando…",
  connected: "conectado",
  reconnecting: "reconectando…",
  closed: "desconectado",
};

export function RosterCard({ room }: { room: RoomState }) {
  // Fora de sala nao ha roster — e o card viraria um vazio permanente.
  if (room.code === null) return null;

  return (
    <section className="panel roster-card">
      <header className="roster-card-head">
        <h2>Na sala ({room.roster.length})</h2>
        <span className={`status status-${room.status}`}>
          {STATUS_LABEL[room.status]}
        </span>
      </header>
      <ul className="roster">
        {room.roster.map((member) => (
          <li key={member.name}>
            <PlayerTag name={member.name} style={member.style} />
          </li>
        ))}
      </ul>
    </section>
  );
}
