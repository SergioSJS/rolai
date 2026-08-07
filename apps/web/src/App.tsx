// App shell: barra de menu no topo (Sala / Preferências / Sobre em modais),
// sidebar com o fluxo de rolagem, historico na coluna principal. O palco
// de dados e um OVERLAY fixed full-viewport ACIMA de toda a UI
// (pointer-events: none — os controles continuam clicaveis): os dados
// voam pela tela inteira, por cima dos paineis, como overlay de stream.
// O resultado (headline + chips) fica num overlay proprio, acima do canvas.
//
// Fluxo de uma rolagem (docs/architecture.md): calcula local via
// rules-engine, anima local com o valor decidido, envia pronto via WS;
// o echo entra no historico (ordem canonica) sem re-animar (echo.ts).

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { RollResult } from "@rolai/rules-engine";
import { availableProfiles } from "./profiles";
import type {
  DiceStyle,
  QualityTier,
  ThemeName,
} from "./settings";
import {
  loadDiceScale,
  loadDiceStyle,
  loadPlayerName,
  loadQualityTier,
  loadSystem,
  loadTheme,
  saveDiceScale,
  saveDiceStyle,
  savePlayerName,
  saveQualityTier,
  saveSystem,
  saveTheme,
} from "./settings";
import type { RollRenderer } from "./renderers/types";
import { exceedsAnimationCap } from "./renderers/types";
import { createRenderer } from "./renderers";
import { TextRenderer } from "./renderers/text";
import { initialRoomState, roomReducer } from "./room/reducer";
import type { HistoryEntry, RoomEvent } from "./room/reducer";
import { createRoom, RoomClient } from "./room/client";
import { PendingRolls } from "./room/echo";
import { RollPanel } from "./components/RollPanel";
import { RoomPanel } from "./components/RoomPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { HistoryList } from "./components/HistoryList";
import { ResultDisplay } from "./components/ResultDisplay";
import { RosterCard } from "./components/RosterCard";
import { NotationHelp } from "./components/NotationHelp";
import { checkCooldown, initialCooldown } from "./rollCooldown";
import { MenuBar } from "./components/MenuBar";
import { Modal } from "./components/Modal";
import { useOnline } from "./useOnline";

function roomParamFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("room") ?? "";
}

type ModalKind = "room" | "settings" | "about" | "help" | null;

export function App() {
  const profiles = useMemo(() => availableProfiles(), []);
  const [tier, setTier] = useState<QualityTier>(() =>
    loadQualityTier(window.localStorage),
  );
  const [theme, setTheme] = useState<ThemeName>(() =>
    loadTheme(window.localStorage),
  );
  const [diceStyle, setDiceStyle] = useState<DiceStyle>(() =>
    loadDiceStyle(window.localStorage),
  );
  const [diceScale, setDiceScale] = useState<number>(() =>
    loadDiceScale(window.localStorage),
  );
  const [playerName, setPlayerName] = useState<string>(
    () => loadPlayerName(window.localStorage) || "anonymous",
  );
  // Sistema de regras vive em Preferências: e escolha de mesa, nao algo que
  // se troca a cada rolagem.
  const [system, setSystem] = useState<string>(() => loadSystem(window.localStorage));
  const [room, dispatch] = useReducer(roomReducer, initialRoomState);
  const [localHistory, setLocalHistory] = useState<HistoryEntry[]>([]);
  const [lastResult, setLastResult] = useState<RollResult | null>(null);
  // Quem rolou o que esta na tela (null = eu mesmo, ou rolagem local).
  const [lastRoller, setLastRoller] = useState<
    { name: string; style?: DiceStyle | null } | null
  >(null);
  // Freio de spam (ver rollCooldown.ts). Em ref porque muda a cada rolagem
  // e nao deve re-renderizar nada por si.
  const cooldownRef = useRef(initialCooldown);
  const [notice, setNotice] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<RollRenderer | null>(null);
  const clientRef = useRef<RoomClient | null>(null);
  const pendingRef = useRef(new PendingRolls());
  const selfNameRef = useRef("anonymous");

  // Ciclo de vida do renderer: recria quando o tier ou a aparencia dos dados
  // muda (a dice-box aplica o colorset na inicializacao). Se o 3D falhar
  // (sem WebGL, asset quebrado), cai pro texto puro sem derrubar o app.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let disposed = false;
    const renderer = createRenderer(tier, diceStyle, diceScale);
    renderer.init(stage).catch((err: unknown) => {
      console.warn("renderer falhou, caindo pra texto puro:", err);
      if (disposed) return;
      const fallback = new TextRenderer();
      rendererRef.current = fallback;
      void fallback.init(stage);
    });
    rendererRef.current = renderer;
    return () => {
      disposed = true;
      renderer.dispose();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [tier, diceStyle, diceScale]);

  // Tema visual: atributo no <html>, as CSS custom properties fazem o resto.
  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
  }, [theme]);

  // Tira os dados da tela. Eles ficam parados depois que assentam (a mesa
  // quer ler o resultado), entao precisa de uma saida explicita.
  const dismissDice = useCallback(() => {
    rendererRef.current?.clear();
    setLastResult(null);
    setNotice(null);
  }, []);

  // Clique em qualquer lugar — ou Esc — dispensa. O listener so existe
  // enquanto ha dado na tela.
  //
  // So escapam os CONTROLES (botao, campo, link) e o modal: o canvas dos
  // dados tem pointer-events: none, entao clicar num dado entrega o clique
  // pro que estiver embaixo dele — quase sempre um painel. Ignorar painel
  // inteiro fazia o clique no proprio dado nao funcionar, que e justo o
  // gesto natural.
  useEffect(() => {
    if (lastResult === null) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("button, a, input, select, textarea, label, .modal-backdrop")
      ) {
        return;
      }
      dismissDice();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissDice();
    };
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [lastResult, dismissDice]);

  // `style` = aparencia dos dados de quem rolou (nulo = rolagem local, vale
  // a propria). Cada cliente ve o dado do outro na cor do outro.
  const animate = useCallback(
    (result: RollResult, style?: DiceStyle | null, player?: string) => {
      setLastResult(result);
      setLastRoller(player === undefined ? null : { name: player, style });
      if (exceedsAnimationCap(result)) {
        // Pool grande demais: o resultado vale igual — so nao anima.
        setNotice("Pool grande demais pra animar — mostrando só o resultado.");
        return;
      }
      setNotice(null);
      rendererRef.current?.roll(result, style).catch((err: unknown) => {
        console.warn("animacao falhou:", err);
      });
    },
    [],
  );

  // Eventos WS vindos do RoomClient.
  const handleRoomEvent = useCallback(
    (event: RoomEvent) => {
      dispatch(event);
      if (event.type === "roll") {
        // Echo da propria rolagem: ja animada no disparo local — so entra
        // no historico (via reducer acima). Rolagem dos outros: anima com a
        // aparencia de dado de quem rolou.
        if (!pendingRef.current.consumeEcho(event.player, event.result)) {
          animate(event.result, event.style, event.player);
        }
      }
    },
    [animate],
  );

  const joinRoom = useCallback(
    (code: string, name: string) => {
      clientRef.current?.leave();
      selfNameRef.current = name;
      setPlayerName(name);
      savePlayerName(window.localStorage, name);
      pendingRef.current = new PendingRolls();
      dispatch({ type: "joining", code });
      // O estilo do dado vai no join: a sala inteira anima a rolagem de
      // cada um com a cor de cada um.
      const client = new RoomClient(code, name, handleRoomEvent, diceStyle);
      clientRef.current = client;
      client.connect();
    },
    [handleRoomEvent, diceStyle],
  );

  // Link de convite (?room=CODIGO) entra direto, sem passar pelo modal — com
  // o apelido salvo (ou "anonymous"), que da pra trocar depois em Sala.
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (autoJoinedRef.current) return;
    const code = roomParamFromUrl();
    if (code === "") return;
    autoJoinedRef.current = true;
    joinRoom(code, playerName);
  }, [joinRoom, playerName]);

  // Trocar de apelido (ou de cor de dado) dentro da sala reconecta: nome e
  // estilo viajam no handshake do WS.
  const handleRename = useCallback(
    (name: string) => {
      const next = name.trim() || "anonymous";
      setPlayerName(next);
      savePlayerName(window.localStorage, next);
      if (room.code !== null) joinRoom(room.code, next);
    },
    [joinRoom, room.code],
  );

  // Previa REAL: com Preferências aberto, qualquer mudanca na aparencia ou
  // no tamanho rola um d20 no palco (o dado de verdade, atras do modal). O
  // debounce segura a rajada do color picker enquanto o renderer recria.
  const previewArmed = useRef(false);
  useEffect(() => {
    if (modal !== "settings") {
      previewArmed.current = false;
      return;
    }
    if (!previewArmed.current) {
      // A abertura do modal em si nao rola — so mudancas feitas nele.
      previewArmed.current = true;
      return;
    }
    const timer = setTimeout(() => {
      const preview: RollResult = {
        notation: "1d20",
        groups: { roll: { rolls: [20], total: 20 } },
        timestamp: new Date().toISOString(),
      };
      setLastResult(null);
      rendererRef.current?.roll(preview).catch(() => {
        // WebGL ainda subindo apos a recriacao: a proxima mudanca tenta.
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [modal, diceStyle, diceScale]);

  const openModal = useCallback(
    (kind: Exclude<ModalKind, null>) => {
      dismissDice();
      setModal(kind);
    },
    [dismissDice],
  );

  const handleCreate = useCallback(
    (name: string) => {
      createRoom()
        .then((code) => joinRoom(code, name))
        .catch((err: unknown) =>
          dispatch({
            type: "serverError",
            message: err instanceof Error ? err.message : String(err),
          }),
        );
    },
    [joinRoom],
  );

  const handleLeave = useCallback(() => {
    clientRef.current?.leave();
    clientRef.current = null;
    setLocalHistory([]);
  }, []);

  const handleRoll = useCallback(
    (result: RollResult) => {
      // Freio de mesa: so vale com gente junto (ver rollCooldown.ts). O
      // aviso e a UNICA resposta — engolir o clique sem explicar pareceria
      // travamento.
      const veredito = checkCooldown(
        cooldownRef.current,
        Date.now(),
        room.status === "connected" ? room.roster.length : 0,
      );
      cooldownRef.current = veredito.state;
      if (!veredito.allowed) {
        setNotice(
          `Calma lá — espere ${veredito.waitSeconds}s para rolar de novo.`,
        );
        return;
      }
      // "você" tambem na propria rolagem: em sala, a dos outros mostra o
      // nome e a nossa mostrava nada — ficava parecendo que so o resultado
      // alheio tem dono. O historico ja usa a mesma palavra.
      animate(result, undefined, "você");
      const client = clientRef.current;
      if (client && room.status === "connected") {
        pendingRef.current.track(selfNameRef.current, result);
        client.send(result);
      } else {
        setLocalHistory((prev) => [...prev, { player: "você", result }]);
      }
    },
    [animate, room.status, room.roster.length],
  );

  const handleTierChange = useCallback((next: QualityTier) => {
    setTier(next);
    saveQualityTier(window.localStorage, next);
  }, []);

  const handleSystemChange = useCallback((next: string) => {
    setSystem(next);
    saveSystem(window.localStorage, next);
  }, []);

  const handleThemeChange = useCallback((next: ThemeName) => {
    setTheme(next);
    saveTheme(window.localStorage, next);
  }, []);

  const handleDiceScaleChange = useCallback((next: number) => {
    setDiceScale(next);
    saveDiceScale(window.localStorage, next);
  }, []);

  const handleDiceStyleChange = useCallback(
    (next: DiceStyle) => {
      setDiceStyle(next);
      saveDiceStyle(window.localStorage, next);
      // Reconecta pra sala saber a cor nova (o estilo vai no handshake).
      if (room.code !== null) {
        clientRef.current?.leave();
        dispatch({ type: "joining", code: room.code });
        const client = new RoomClient(
          room.code,
          selfNameRef.current,
          handleRoomEvent,
          next,
        );
        clientRef.current = client;
        client.connect();
      }
    },
    [handleRoomEvent, room.code],
  );

  const inRoom = room.code !== null;
  const online = useOnline();

  return (
    <main className="app">
      {/* Abrir qualquer modal tira os dados da tela: o menu e uso da UI,
          e dado parado por cima do painel atrapalha. */}
      <MenuBar
        roomCode={room.code}
        roomStatus={room.status}
        onOpenRoom={() => openModal("room")}
        onOpenHelp={() => openModal("help")}
        onOpenSettings={() => openModal("settings")}
        onOpenAbout={() => openModal("about")}
      />

      {/* Offline: a rolagem continua funcionando (calculo local) — so as
          salas dependem de rede. */}
      {!online && (
        <p className="offline-badge" role="status">
          Sem conexão — rolando offline (salas indisponíveis)
        </p>
      )}

      <div className="layout">
        <div className="main-col">
          <section className="panel history-panel">
            <h2>Histórico{inRoom ? "" : " (local)"}</h2>
            <HistoryList entries={inRoom ? room.history : localHistory} />
          </section>
        </div>

        <aside className="sidebar">
          {/* key: trocar de sistema recomeça os inputs do zero */}
          <RollPanel
            key={system}
            profile={profiles.find((p) => p.system === system)}
            onRoll={handleRoll}
          />
          <RosterCard room={room} />
        </aside>
      </div>

      {/* Palco: overlay fixed acima de TODA a UI (dados voam pela tela
          inteira); o resultado fica num overlay logo acima do canvas. */}
      <div className="stage" ref={stageRef} aria-label="Palco de rolagem" />
      <div className="stage-overlay">
        {notice !== null && <p className="notice">{notice}</p>}
        <ResultDisplay
          result={lastResult}
          player={lastRoller?.name}
          playerStyle={lastRoller?.style}
        />
      </div>

      {modal === "room" && (
        <Modal title="Sala" onClose={() => setModal(null)}>
          <RoomPanel
            room={room}
            initialCode={roomParamFromUrl()}
            playerName={playerName}
            onCreate={handleCreate}
            onJoin={joinRoom}
            onLeave={handleLeave}
            onRename={handleRename}
          />
        </Modal>
      )}
      {modal === "settings" && (
        <Modal
          title="Preferências"
          onClose={() => {
            setModal(null);
            dismissDice();
          }}
        >
          <SettingsPanel
            tier={tier}
            theme={theme}
            diceStyle={diceStyle}
            diceScale={diceScale}
            system={system}
            profiles={profiles}
            onTierChange={handleTierChange}
            onThemeChange={handleThemeChange}
            onDiceStyleChange={handleDiceStyleChange}
            onDiceScaleChange={handleDiceScaleChange}
            onSystemChange={handleSystemChange}
          />
        </Modal>
      )}
      {modal === "help" && (
        <Modal title="Como escrever uma rolagem" onClose={() => setModal(null)}>
          <NotationHelp />
        </Modal>
      )}

      {modal === "about" && (
        <Modal title="Sobre" onClose={() => setModal(null)}>
          <div className="about">
            <p>
              <strong>Rolaí</strong> — dice roller multiplayer pra mesas de RPG.
              Role dados 3D com física, compartilhe uma sala com a mesa via link
              e exporte o histórico da sessão.
            </p>
            <p>
              As rolagens são calculadas localmente pelo rules-engine
              (Ironsworn, PbtA e FitD embutidos, ou notação livre) e retransmitidas
              pra sala — todo mundo vê o mesmo resultado.
            </p>
            <p className="settings-hint">
              Dica pra stream: Sala → "Copiar link pro OBS" e cadastre essa
              URL como Browser Source — só os dados, com fundo transparente.
            </p>
          </div>
        </Modal>
      )}
    </main>
  );
}
