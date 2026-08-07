// Barra de menu do app shell: logo a esquerda; a direita, status da sala
// (quando conectado) e os atalhos Sala / Preferências / Sobre.

import type { ConnectionStatus } from "../room/reducer";

interface MenuBarProps {
  roomCode: string | null;
  roomStatus: ConnectionStatus;
  onOpenRoom: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
}

const STATUS_DOT: Record<ConnectionStatus, string> = {
  idle: "",
  connecting: "conectando…",
  connected: "em sala",
  reconnecting: "reconectando…",
  closed: "desconectado",
};

export function MenuBar({
  roomCode,
  roomStatus,
  onOpenRoom,
  onOpenHelp,
  onOpenSettings,
  onOpenAbout,
}: MenuBarProps) {
  return (
    <header className="menu-bar">
      <div className="menu-brand">
        {/* d20 desenhado — o caractere de dado do Unicode nao existe em
            toda fonte e vira quadradinho vazio em alguns sistemas. */}
        <svg
          className="logo"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          aria-hidden
        >
          <polygon points="12,2 21,7.2 21,16.8 12,22 3,16.8 3,7.2" />
          <polygon points="12,6.5 16.5,15.5 7.5,15.5" />
        </svg>
        <span className="brand-name">Rolaí</span>
      </div>
      <nav className="menu-items">
        {roomCode !== null && (
          <span className={`status status-${roomStatus}`}>
            {STATUS_DOT[roomStatus]} · <code className="room-code">{roomCode}</code>
          </span>
        )}
        {/* Ordem por FREQUENCIA de uso: Sala (mexe toda sessao) ->
            Preferencias -> Ajuda -> Sobre. O APK sai da barra: e acao de
            uma vez so na vida, e disputava espaco com o que se usa sempre.
            Mora no Sobre, que e onde se procura "o que mais tem aqui". */}
        <button type="button" className="menu-button" onClick={onOpenRoom}>
          Sala
        </button>
        <button type="button" className="menu-button" onClick={onOpenSettings}>
          Preferências
        </button>
        <button
          type="button"
          className="menu-button"
          onClick={onOpenHelp}
          title="Como escrever uma rolagem"
        >
          Ajuda
        </button>
        <button type="button" className="menu-button" onClick={onOpenAbout}>
          Sobre
        </button>
      </nav>
    </header>
  );
}
