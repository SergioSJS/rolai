// Conteudo de Sala (renderizado dentro do modal pela App): criar, entrar
// por codigo, roster, status da conexao e links de export. Sala e opcional
// — o modo padrao do app e sem sala.
//
// Dentro da sala o apelido continua editavel: trocar reconecta (nome e cor
// do dado viajam no handshake do WS).

import { useState } from "react";
import type { RoomState } from "../room/reducer";
import { exportUrl } from "../config";
import { MAX_PLAYER_NAME } from "../settings";
import { customCodeIssue } from "../room/code";
import { PlayerTag } from "./PlayerTag";

interface RoomPanelProps {
  room: RoomState;
  initialCode?: string;
  playerName: string;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onLeave: () => void;
  onRename: (name: string) => void;
}

const STATUS_LABELS: Record<RoomState["status"], string> = {
  idle: "sem sala",
  connecting: "conectando…",
  connected: "conectado",
  reconnecting: "reconectando…",
  closed: "desconectado",
};

export function RoomPanel({
  room,
  initialCode = "",
  playerName,
  onCreate,
  onJoin,
  onLeave,
  onRename,
}: RoomPanelProps) {
  const [name, setName] = useState(playerName === "anonymous" ? "" : playerName);
  const [code, setCode] = useState(initialCode);
  // Motivo da recusa do codigo escolhido, mostrado so depois de tentar —
  // reclamar enquanto a pessoa digita e ruido.
  const [codeIssue, setCodeIssue] = useState<string | null>(null);

  // Criar: campo vazio = codigo aleatorio do backend (sala privada). Campo
  // preenchido = a sala QUE VOCE ESCOLHEU. Entrar num codigo inexistente ja
  // cria a sala no backend, entao aqui e o mesmo caminho do Entrar — o que
  // muda e validar antes e explicar o motivo, em vez de um 4404 seco.
  const criar = (apelido: string) => {
    const escolhido = code.trim();
    if (escolhido === "") {
      setCodeIssue(null);
      onCreate(apelido);
      return;
    }
    const issue = customCodeIssue(escolhido);
    setCodeIssue(issue);
    if (issue === null) onJoin(escolhido, apelido);
  };

  if (room.code === null) {
    return (
      <div className="room-panel">
        <label>
          Apelido
          <input
            type="text"
            value={name}
            maxLength={MAX_PLAYER_NAME}
            placeholder="anonymous"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Código da sala
          <input
            type="text"
            value={code}
            maxLength={32}
            placeholder="deixe vazio para um código aleatório"
            aria-describedby="room-code-hint"
            onChange={(e) => {
              setCode(e.target.value);
              if (codeIssue !== null) setCodeIssue(null);
            }}
          />
        </label>
        <p
          id="room-code-hint"
          className={codeIssue === null ? "field-hint" : "field-hint is-error"}
        >
          {codeIssue === null
            ? "Um código escolhido por você funciona como mesa fixa (bom pro OBS): mínimo 16 caracteres, 8 diferentes. Quem tiver o link entra."
            : codeIssue}
        </p>
        <div className="room-actions">
          <button type="button" onClick={() => criar(name || "anonymous")}>
            Criar sala
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={code.trim() === ""}
            onClick={() => onJoin(code.trim(), name || "anonymous")}
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  const shareLink = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room.code)}`;
  const renamed = name.trim() !== "" && name.trim() !== playerName;

  return (
    <div className="room-panel">
      <p className="room-status-line">
        <code className="room-code">{room.code}</code>{" "}
        <span className={`status status-${room.status}`}>
          {STATUS_LABELS[room.status]}
        </span>
      </p>
      <div className="field">
        <label htmlFor="room-nickname">Seu apelido</label>
        <div className="room-actions">
          <input
            id="room-nickname"
            type="text"
            value={name}
            maxLength={MAX_PLAYER_NAME}
            placeholder={playerName}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renamed) onRename(name);
            }}
          />
          <button
            type="button"
            className="button-secondary"
            disabled={!renamed}
            onClick={() => onRename(name)}
          >
            Trocar
          </button>
        </div>
      </div>
      <div className="room-actions">
        <button
          type="button"
          className="button-secondary"
          onClick={() => void navigator.clipboard?.writeText(shareLink)}
        >
          Copiar link
        </button>
        {/* URL do modo stream: so os dados, fundo alpha — pra Browser
            Source do OBS (chroma via &chroma=rrggbb). */}
        <button
          type="button"
          className="button-secondary"
          onClick={() => void navigator.clipboard?.writeText(`${shareLink}&stream=1`)}
        >
          Copiar link pro OBS
        </button>
        <button type="button" className="button-secondary" onClick={onLeave}>
          Sair da sala
        </button>
      </div>
      <h3>Na sala ({room.roster.length})</h3>
      <ul className="roster">
        {room.roster.map((member) => (
          <li key={member.name}>
            <PlayerTag name={member.name} style={member.style} />
          </li>
        ))}
      </ul>
      <h3>Exportar histórico</h3>
      <div className="room-actions export-links">
        {(["json", "csv", "md"] as const).map((format) => (
          <a
            key={format}
            href={exportUrl(room.code!, format)}
            target="_blank"
            rel="noreferrer"
          >
            {format}
          </a>
        ))}
      </div>
      {room.error !== null && <p className="error">{room.error}</p>}
    </div>
  );
}
