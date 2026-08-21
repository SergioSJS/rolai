// Barra de menu do app shell: logo à esquerda; à direita, status da sala
// (quando conectado) e os atalhos Sala / Preferências / Ajuda / Sobre.
//
// Os atalhos vivem SEMPRE num menu sanduíche, em qualquer largura. A
// alternativa — quatro botões soltos na barra — disputava espaço com o
// código da sala, que é a informação mais consultada durante o jogo, e
// obrigava a duas versões da mesma barra. Com o menu recolhido, a barra tem
// só o que se olha (marca e sala) e o resto fica a um toque.

import { useEffect, useRef, useState } from "react";
import type { ConnectionStatus } from "../room/reducer";
import { AboutIcon, HelpIcon, RoomIcon, ServerIcon, SettingsIcon } from "./Glyphs";

interface MenuBarProps {
  roomCode: string | null;
  roomStatus: ConnectionStatus;
  onOpenRoom: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  onOpenStats: () => void;
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
  onOpenStats,
  onOpenAbout,
}: MenuBarProps) {
  const [aberto, setAberto] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // Fecha ao clicar fora ou apertar Esc — comportamento esperado de menu
  // suspenso; sem isso ele fica preso na tela até alguém acertar o botão.
  useEffect(() => {
    if (!aberto) return;
    const onDown = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setAberto(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [aberto]);

  // Abrir um modal fecha o menu: senão ele fica aberto atrás da janela.
  const item = (acao: () => void) => () => {
    setAberto(false);
    acao();
  };

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

      {/* Status fora do <nav>: é informação, não navegação — e assim ele
          fica na barra mesmo com o menu recolhido. */}
      {roomCode !== null && (
        <button
          type="button"
          className={`status status-${roomStatus} status-button`}
          onClick={onOpenRoom}
          title="Abrir a sala"
        >
          {STATUS_DOT[roomStatus]} · <code className="room-code">{roomCode}</code>
        </button>
      )}

      <nav className="menu-items" ref={navRef}>
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={aberto}
          aria-label="Menu"
          onClick={() => setAberto((v) => !v)}
        >
          <span className="menu-toggle-bars" aria-hidden />
        </button>

        {/* Ordem por FREQUENCIA de uso: Sala (mexe toda sessao) ->
            Preferencias -> Ajuda -> Servidor -> Sobre. Servidor e
            diagnostico: olhada rara, mas quem procura procura no menu, nao
            enterrado dentro do Sobre. O APK sai da barra: e acao de
            uma vez so na vida, e disputava espaco com o que se usa sempre.
            Mora no Sobre, que e onde se procura "o que mais tem aqui". */}
        <div className={`menu-links${aberto ? " is-open" : ""}`}>
          <button type="button" className="menu-button" onClick={item(onOpenRoom)}>
            <RoomIcon />
            Sala
          </button>
          <button type="button" className="menu-button" onClick={item(onOpenSettings)}>
            <SettingsIcon />
            Preferências
          </button>
          <button
            type="button"
            className="menu-button"
            onClick={item(onOpenHelp)}
            title="Como escrever uma rolagem"
          >
            <HelpIcon />
            Ajuda
          </button>
          <button
            type="button"
            className="menu-button"
            onClick={item(onOpenStats)}
            title="Status do servidor"
          >
            <ServerIcon />
            Servidor
          </button>
          <button type="button" className="menu-button" onClick={item(onOpenAbout)}>
            <AboutIcon />
            Sobre
          </button>
        </div>
      </nav>
    </header>
  );
}
