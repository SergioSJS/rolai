// Conteudo de Sala (renderizado dentro do modal pela App): criar, entrar
// por codigo, roster, status da conexao e links de export. Sala e opcional
// — o modo padrao do app e sem sala.
//
// Dentro da sala o apelido continua editavel: trocar reconecta (nome e cor
// do dado viajam no handshake do WS).

import { useState } from "react";
import type { RoomState } from "../room/reducer";
import { exportUrl } from "../config";
import { CopyIcon, EnterIcon, ExitIcon, PencilIcon, PlusIcon } from "./Glyphs";
import {
  MAX_PLAYER_NAME,
  MIN_DICE_SCALE,
  MAX_DICE_SCALE,
  DEFAULT_DICE_SCALE,
  clampDiceScale,
} from "../settings";
import { customCodeIssue } from "../room/code";
import { ttlPhrase, useRoomTtl } from "../roomTtl";
import { PlayerTag } from "./PlayerTag";

interface RoomPanelProps {
  room: RoomState;
  initialCode?: string;
  playerName: string;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onLeave: () => void;
  onRename: (name: string) => void;
  /** Corte do "ocultar" — vai no link de export pra não entregar no arquivo
   * o que a pessoa escondeu na tela (specs/09-limpar-historico.md). */
  hiddenBefore?: string | null;
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
  hiddenBefore = null,
}: RoomPanelProps) {
  const [name, setName] = useState(playerName === "anonymous" ? "" : playerName);
  const [code, setCode] = useState(initialCode);
  // Motivo da recusa do codigo escolhido, mostrado so depois de tentar —
  // reclamar enquanto a pessoa digita e ruido.
  const [codeIssue, setCodeIssue] = useState<string | null>(null);
  // Tamanho do dado no link do OBS. Independente das Preferencias gerais —
  // a Browser Source do OBS abre com localStorage proprio (vazio), entao sem
  // isso o `scale` que a pessoa configurou aqui no navegador nunca chega la.
  const [streamScale, setStreamScale] = useState(DEFAULT_DICE_SCALE);
  const ttl = useRoomTtl();

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
            <PlusIcon />
            Criar sala
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={code.trim() === ""}
            onClick={() => onJoin(code.trim(), name || "anonymous")}
          >
            <EnterIcon />
            Entrar
          </button>
        </div>
        {/* Expiracao dita ANTES de entrar: e o unico momento em que da pra
            decidir usar codigo fixo em vez de aleatorio. O prazo conta
            silencio, nao idade da sala — cada rolagem renova. */}
        <p className="field-hint">
          A sala some do servidor depois de {ttlPhrase(ttl)}; cada rolagem
          renova o prazo. O código volta a funcionar se alguém entrar de novo
          — o histórico não volta.
        </p>
      </div>
    );
  }

  const shareLink = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room.code)}`;
  const streamLink = `${shareLink}&stream=1&scale=${streamScale}`;
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
            <PencilIcon />
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
          <CopyIcon />
          Copiar link
        </button>
        {/* URL do modo stream: so os dados, fundo alpha — pra Browser
            Source do OBS (chroma via &chroma=rrggbb). */}
        <button
          type="button"
          className="button-secondary"
          onClick={() => void navigator.clipboard?.writeText(streamLink)}
        >
          <CopyIcon />
          Copiar link pro OBS
        </button>
        <button type="button" className="button-secondary" onClick={onLeave}>
          <ExitIcon />
          Sair da sala
        </button>
      </div>
      <label className="field">
        Tamanho do dado no OBS ({Math.round(streamScale * 100)}%)
        <input
          type="range"
          min={Math.round(MIN_DICE_SCALE * 100)}
          max={Math.round(MAX_DICE_SCALE * 100)}
          step={5}
          value={Math.round(streamScale * 100)}
          onChange={(e) =>
            setStreamScale(clampDiceScale(Number(e.target.value) / 100))
          }
        />
      </label>
      <p className="field-hint">
        Ajuste antes de copiar — o link leva esse tamanho embutido (&amp;scale=).
      </p>
      <h3>Na sala ({room.roster.length})</h3>
      <ul className="roster">
        {room.roster.map((member) => (
          <li key={member.name}>
            <PlayerTag name={member.name} style={member.style} />
          </li>
        ))}
      </ul>
      <h3>Exportar histórico</h3>
      <p className="field-hint">
        O histórico vive no servidor e some junto com a sala, depois de{" "}
        {ttlPhrase(ttl)}. Exporte o que quiser guardar.
      </p>
      {hiddenBefore !== null && (
        <p className="field-hint">
          O export segue o que está à vista: o que você ocultou fica de fora.
        </p>
      )}
      <div className="room-actions export-links">
        {(["json", "csv", "md"] as const).map((format) => (
          <a
            key={format}
            href={exportUrl(room.code!, format, hiddenBefore)}
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
