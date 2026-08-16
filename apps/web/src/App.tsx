// App shell: barra de menu no topo (Sala / Preferências / Sobre em modais),
// sidebar com o fluxo de rolagem, historico na coluna principal. O palco
// de dados e um OVERLAY fixed full-viewport ACIMA de toda a UI
// (pointer-events: none — os controles continuam clicaveis): os dados
// voam pela tela inteira, por cima dos paineis, como overlay de stream.
// O resultado (headline + chips) fica num overlay proprio, acima do canvas.
// Baralho usa o MESMO overlay (specs/08-baralho.md) — cartas puxadas
// aparecem la tambem, nunca dado e carta ao mesmo tempo (animate/
// animateCards zeram um ao mostrar o outro).
//
// Fluxo de uma rolagem (docs/architecture.md): calcula local via
// rules-engine, anima local com o valor decidido, envia pronto via WS;
// o echo entra no historico (ordem canonica) sem re-animar (echo.ts).

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { RollResult } from "@rolai/rules-engine";
import type { Card, DeckConfig, DrawResult } from "@rolai/deck-engine";
import { playCardDraw } from "./deckSound";
import { availableProfiles } from "./profiles";
import { familyFor } from "./profileFamilies";
import { APK_LATEST_URL } from "./config";
import { CHANGELOG } from "./changelog";
import type {
  DiceStyle,
  QualityTier,
  ThemeName,
} from "./settings";
import {
  clearRoomCode,
  loadDeckConfig,
  loadDiceScale,
  loadDiceStyle,
  loadPlayerName,
  loadQualityTier,
  loadRoomCode,
  loadSystem,
  loadTheme,
  saveDeckConfig,
  saveDiceScale,
  saveDiceStyle,
  savePlayerName,
  saveQualityTier,
  saveRoomCode,
  saveSystem,
  saveTheme,
} from "./settings";
import type { RollRenderer } from "./renderers/types";
import { exceedsAnimationCap, cardsFromResult } from "./renderers/types";
import { createRenderer } from "./renderers";
import { TextRenderer } from "./renderers/text";
import { initialRoomState, roomReducer } from "./room/reducer";
import type { HistoryEntry, RoomEvent } from "./room/reducer";
import { createRoom, RoomClient } from "./room/client";
import { PendingDeckDraws, PendingRolls } from "./room/echo";
import { RollPanel } from "./components/RollPanel";
import { DeckPanel } from "./components/DeckPanel";
import { RoomPanel } from "./components/RoomPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { HistoryList } from "./components/HistoryList";
import { ResultDisplay } from "./components/ResultDisplay";
import { CardStack } from "./components/CardStack";
import { CardStage3D } from "./components/CardStage3D";
import { PlayerTag } from "./components/PlayerTag";
import { cardLabel, isRedSuit } from "./cardFormat";
import { useStageFloor } from "./stage/floor";
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

// Mantem `?room=` na barra de enderecos em sincronia com a sala atual.
// Sem isto a URL fica presa na sala com que a pagina foi carregada: criar
// ou trocar de sala pelo modal muda o estado por dentro, mas quem olhar a
// barra (ou copiar dali, ou so der F5) ve/volta pra sala ERRADA — inclusive
// uma que ja nao existe mais, derrubando de novo uma sala boa por cima.
function setRoomUrlParam(code: string | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (code === null) {
    url.searchParams.delete("room");
  } else {
    url.searchParams.set("room", code);
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
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
  // Config do baralho tambem mora em Preferências (mesmo motivo do sistema
  // de regras) — DeckPanel so recebe e aplica, nao e mais dono disso.
  const [deckConfig, setDeckConfig] = useState<DeckConfig>(() =>
    loadDeckConfig(window.localStorage),
  );
  const [room, dispatch] = useReducer(roomReducer, initialRoomState);
  const [localHistory, setLocalHistory] = useState<HistoryEntry[]>([]);
  const [lastResult, setLastResult] = useState<RollResult | null>(null);
  // Quem rolou o que esta na tela (null = eu mesmo, ou rolagem local).
  const [lastRoller, setLastRoller] = useState<
    { name: string; style?: DiceStyle | null } | null
  >(null);
  // Cartas puxadas na tela — mesmo palco compartilhado do dado, so que sem
  // renderer proprio (CardFlip e sempre CSS). Mutuamente exclusivo com
  // lastResult: um substitui o outro, nunca os dois ao mesmo tempo (ver
  // animate/animateCards).
  const [lastCards, setLastCards] = useState<Card[] | null>(null);
  const [lastCardPlayer, setLastCardPlayer] = useState<string | null>(null);
  // Freio de spam (ver rollCooldown.ts). Em ref porque muda a cada rolagem
  // e nao deve re-renderizar nada por si.
  const cooldownRef = useRef(initialCooldown);
  const [notice, setNotice] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  // Alterna a caixa de sorteio da sidebar entre dado e baralho
  // (specs/08-baralho.md) — dois modos, nunca os dois ao mesmo tempo.
  const [sidebarView, setSidebarView] = useState<"dice" | "deck">("dice");

  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<RollRenderer | null>(null);
  const clientRef = useRef<RoomClient | null>(null);
  const pendingRef = useRef(new PendingRolls());
  const pendingDeckRef = useRef(new PendingDeckDraws());
  const selfNameRef = useRef("anonymous");
  // Reserva a faixa do pe do palco com a placa JA na tela e so entao rola.
  const queueRoll = useStageFloor(stageRef, overlayRef, rendererRef);

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

  // Tira os dados/cartas da tela. Eles ficam parados depois que assentam (a
  // mesa quer ler o resultado), entao precisa de uma saida explicita.
  const dismissDice = useCallback(() => {
    rendererRef.current?.clear();
    setLastResult(null);
    setLastCards(null);
    setLastCardPlayer(null);
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
    if (lastResult === null && lastCards === null) return;
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
  }, [lastResult, lastCards, dismissDice]);

  // `style` = aparencia dos dados de quem rolou (nulo = rolagem local, vale
  // a propria). Cada cliente ve o dado do outro na cor do outro.
  const animate = useCallback(
    (result: RollResult, style?: DiceStyle | null, player?: string) => {
      const cards = cardsFromResult(result);
      if (cards.length > 0) {
        setLastCards(cards);
        setLastCardPlayer(player ?? null);
        playCardDraw();
      } else {
        setLastCards(null);
        setLastCardPlayer(null);
      }
      setLastResult(result);
      setLastRoller(player === undefined ? null : { name: player, style });
      if (exceedsAnimationCap(result)) {
        // Pool grande demais: o resultado vale igual — so nao anima.
        setNotice("Pool grande demais pra animar — mostrando só o resultado.");
        return;
      }
      setNotice(null);
      // Depois do commit: a faixa do pe do palco e medida da placa que
      // acabou de entrar na tela, e so entao o dado voa (stage/floor.ts).
      queueRoll(() => {
        rendererRef.current?.roll(result, style).catch((err: unknown) => {
          console.warn("animacao falhou:", err);
        });
      });
    },
    [queueRoll],
  );

  // Cartas puxadas: mesmo palco compartilhado do dado (specs/08-baralho.md,
  // ajuste pos-review — cravado dentro do DeckPanel ficava pequeno demais).
  // Sem fisica pra esperar: aparece na hora, igual ao tier texto do dado.
  const animateCards = useCallback((cards: Card[], player?: string) => {
    rendererRef.current?.clear();
    setLastResult(null);
    setLastRoller(null);
    setNotice(null);
    setLastCards(cards);
    setLastCardPlayer(player ?? null);
  }, []);

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
      } else if (event.type === "deck_draw") {
        // Mesma logica do roll acima, so que pro baralho (echo.ts).
        if (!pendingDeckRef.current.consumeEcho(event.player, event.timestamp)) {
          animateCards(event.cards, event.player);
        }
      } else if (event.type === "rejected") {
        // Codigo recusado (sala nao encontrada/cheia/origem barrada): nao
        // adianta guardar pra reentrar sozinho no proximo carregamento, nem
        // deixar a URL apontando pra ele.
        clearRoomCode(window.localStorage);
        setRoomUrlParam(null);
      }
    },
    [animate, animateCards],
  );

  const joinRoom = useCallback(
    (code: string, name: string) => {
      clientRef.current?.leave();
      selfNameRef.current = name;
      setPlayerName(name);
      savePlayerName(window.localStorage, name);
      saveRoomCode(window.localStorage, code);
      setRoomUrlParam(code);
      pendingRef.current = new PendingRolls();
      pendingDeckRef.current = new PendingDeckDraws();
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
  // o apelido salvo (ou "anonymous"), que da pra trocar depois em Sala. Sem
  // link, cai pra ultima sala em que a pessoa esteve (localStorage): reabrir
  // o app nao devia pedir pra digitar o codigo de novo — "sair da sala" e
  // que apaga isso (handleLeave), senao reentraria numa sala que a pessoa
  // deixou por querer.
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (autoJoinedRef.current) return;
    const code = roomParamFromUrl() || loadRoomCode(window.localStorage);
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
    clearRoomCode(window.localStorage);
    setRoomUrlParam(null);
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
        setLocalHistory((prev) => [...prev, { type: "roll", player: "você", result }]);
        if (room.code !== null) {
          // Dentro de uma sala mas sem conexao agora (reconectando/caida):
          // sem isto a rolagem anima igual e some no vazio, sem ninguem mais
          // ver — e a pessoa so descobre muito depois, quando reparar que a
          // mesa nao tem a rolagem dela.
          setNotice("Sem conexão com a sala agora — essa rolagem ficou só com você.");
        }
      }
    },
    [animate, room.status, room.code, room.roster.length],
  );

  // Baralho: DeckPanel calcula local (deck-engine) e chama isto DEPOIS do
  // estado local ja ter sido atualizado — mesmo papel do handleRoll acima,
  // sem freio de cooldown (puxar carta nao e ruidoso pra mesa do jeito que
  // rolagem repetida e). `timestamp` vem do PROPRIO DeckPanel (nao gerado
  // aqui) pra ser a mesma chave usada no envelope WS e no dedupe do echo.
  // Fora de sala (ou sem conexao agora): mesmo fallback do handleRoll —
  // entra no historico local, senao a puxada acontece e nao fica log
  // nenhum em lugar nenhum.
  const handleDeckDraw = useCallback(
    (result: DrawResult, timestamp: string) => {
      animateCards(result.cards, "você");
      const client = clientRef.current;
      if (client && room.status === "connected") {
        pendingDeckRef.current.track(selfNameRef.current, timestamp);
        client.sendDeckDraw(result.cards, result.remaining, timestamp);
      } else {
        setLocalHistory((prev) => [
          ...prev,
          {
            type: "deck_draw",
            player: "você",
            cards: result.cards,
            remaining: result.remaining,
            timestamp,
          },
        ]);
      }
    },
    [animateCards, room.status],
  );

  const handleDeckReshuffle = useCallback(() => {
    const client = clientRef.current;
    if (client && room.status === "connected") {
      client.sendDeckShuffle();
    }
  }, [room.status]);

  // Config do baralho vive aqui (Preferências) — igual ao sistema de
  // regras. Salva local sempre; retransmite pra sala so quando conectado.
  const handleDeckConfigChange = useCallback(
    (changes: Partial<DeckConfig>) => {
      setDeckConfig((prev) => {
        const next = { ...prev, ...changes };
        saveDeckConfig(window.localStorage, next);
        return next;
      });
      const client = clientRef.current;
      if (client && room.status === "connected") {
        client.sendDeckConfig(changes);
      }
    },
    [room.status],
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
          <div className="family-tabs" role="tablist" aria-label="Modo de sorteio">
            <button
              type="button"
              role="tab"
              aria-selected={sidebarView === "dice"}
              className={sidebarView === "dice" ? "family-tab is-active" : "family-tab"}
              onClick={() => setSidebarView("dice")}
            >
              Dados
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sidebarView === "deck"}
              className={sidebarView === "deck" ? "family-tab is-active" : "family-tab"}
              onClick={() => setSidebarView("deck")}
            >
              Baralho
            </button>
          </div>
          {sidebarView === "dice" ? (
            // key: trocar de sistema recomeça os inputs do zero
            <RollPanel
              key={system}
              profile={profiles.find((p) => p.system === system)}
              family={familyFor(system)}
              onSelectFamilyMember={handleSystemChange}
              onRoll={handleRoll}
            />
          ) : (
            <DeckPanel
              config={deckConfig}
              onDraw={handleDeckDraw}
              onReshuffle={handleDeckReshuffle}
            />
          )}
          <RosterCard room={room} />
        </aside>
      </div>

      {/* Palco: overlay fixed acima de TODA a UI (dados voam pela tela
          inteira); o resultado fica num overlay logo acima do canvas. */}
      <div className="stage" ref={stageRef} aria-label="Palco de rolagem" />
      {/* Cartas animadas (tier != texto) vivem NESTA camada, separada da
          caixa de resultado — mesma divisao do dado: o dado caindo fica no
          `.stage` acima, solto por cima de tudo, sem caixa nenhuma ao
          redor; a caixa abaixo (`.result-display`) so mostra o VALOR
          (texto), nunca a animacao em si. */}
      {lastCards !== null && lastCards.length > 0 && tier !== "text" && (
        <div className="card-stage" aria-hidden>
          {tier === "2d" ? (
            <CardStack cards={lastCards} />
          ) : (
            <CardStage3D cards={lastCards} />
          )}
        </div>
      )}
      <div className="stage-overlay" ref={overlayRef}>
        {notice !== null && <p className="notice">{notice}</p>}
        <ResultDisplay
          result={lastResult}
          player={lastRoller?.name}
          playerStyle={lastRoller?.style}
        />
        {lastCards !== null && lastCards.length > 0 && lastResult === null && (
          <div className="result-display">
            {lastCardPlayer !== null && lastCardPlayer !== "" && (
              <div className="result-player">
                <PlayerTag name={lastCardPlayer} />
                <span className="result-player-verb">puxou</span>
              </div>
            )}
            <div className="result-chips">
              {lastCards.map((card, i) => (
                <span
                  key={`${card.id}-${i}`}
                  className={`die-chip card-chip${isRedSuit(card) ? " is-red" : ""}`}
                >
                  {cardLabel(card)}
                </span>
              ))}
            </div>
            <p className="result-dismiss-hint">clique ou Esc pra tirar as cartas</p>
          </div>
        )}
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
            deckConfig={deckConfig}
            onTierChange={handleTierChange}
            onThemeChange={handleThemeChange}
            onDiceStyleChange={handleDiceStyleChange}
            onDiceScaleChange={handleDiceScaleChange}
            onSystemChange={handleSystemChange}
            onDeckConfigChange={handleDeckConfigChange}
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
            <p className="about-lead">
              Dice roller multiplayer pra mesas de RPG: dados 3D com física,
              sala compartilhada por link e histórico exportável.
            </p>

            <h3>Contato</h3>
            <div className="about-contact">
              <span className="about-contact-name">Sérgio Sousa</span>
              <div className="about-contact-links">
                <span className="about-contact-chip is-static">@sergiosjs</span>
                <a
                  className="about-contact-chip"
                  href="https://meioorc.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  meioorc.com
                </a>
                <a className="about-contact-chip" href="mailto:sergiosjs@pm.me">
                  sergiosjs@pm.me
                </a>
              </div>
            </div>

            <h3>Como funciona</h3>
            <p>
              As rolagens são calculadas no seu aparelho (Ironsworn, PbtA,
              FitD, Fate, d20 e d100 embutidos, ou notação livre) e
              retransmitidas pra sala — todo mundo vê o mesmo resultado, com o
              dado na cor de quem rolou.
            </p>

            <h3>App Android</h3>
            <p>
              Botão flutuante que rola dados por cima de qualquer outro app —
              leitor de PDF, ficha, o que estiver aberto. Funciona{" "}
              <strong>sem internet</strong>: só a sala precisa de rede.
            </p>
            <a
              className="apk-link"
              href={APK_LATEST_URL}
              target="_blank"
              rel="noreferrer"
            >
              Baixar o APK
            </a>
            <p className="settings-hint">
              Não está na Play Store — baixe o <code>.apk</code> da página de
              Releases e permita a instalação quando o Android perguntar.
            </p>

            <h3>Transmissão (OBS)</h3>
            <p className="settings-hint">
              Em <strong>Sala</strong>, use "Copiar link pro OBS" e cadastre a
              URL como Browser Source: só os dados, com fundo transparente. Um
              código de sala escolhido por você funciona como mesa fixa — a
              mesma URL vale pra sempre.
            </p>

            <h3>Notas de versão</h3>
            <dl className="changelog">
              {CHANGELOG.map((entry) => (
                <div key={entry.version} className="changelog-entry">
                  <dt>
                    {entry.version} <span className="changelog-date">{entry.date}</span>
                  </dt>
                  <dd>
                    <ul>
                      {entry.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ))}
            </dl>

            <h3>Agradecimentos e Créditos</h3>
            <div className="about-credits">
              <div className="about-credit-item">
                <strong>Sons de Baralho:</strong>{" "}
                <a href="https://kenney.nl" target="_blank" rel="noreferrer">
                  Kenney.nl
                </a>{" "}
                — <em>Casino Audio</em> (efeitos sonoros gravados de manuseio e embaralhamento de cartas, licença CC0 / Domínio Público).
              </div>
              <div className="about-credit-item">
                <strong>Cartas Vetoriais:</strong>{" "}
                <a href="https://github.com/letele/playing-cards" target="_blank" rel="noreferrer">
                  @letele
                </a>{" "}
                — Cartas de baralho clássicas em SVG vetorial de alta definição (licença MIT / CC-BY).
              </div>
              <div className="about-credit-item">
                <strong>Dados 3D e Física:</strong>{" "}
                <a href="https://github.com/3d-dice/dice-box-threejs" target="_blank" rel="noreferrer">
                  Frank Ali
                </a>{" "}
                e comunidade — <code>@3d-dice/dice-box-threejs</code> (renderização com Three.js e Cannon-es, licença MIT).
              </div>
              <div className="about-credit-item">
                <strong>Texturas de Dados:</strong> MajorVictory, SpencerThayer e contribuidores do ecossistema de dados 3D.
              </div>
              <div className="about-credit-item">
                <strong>Tipografia:</strong> Fontes <em>Cinzel</em> (Natanael Gama) e <em>Inter</em> (Rasmus Andersson) via Google Fonts (SIL Open Font License).
              </div>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
