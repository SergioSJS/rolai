// Painel de baralho — so quantidade + puxar/reembaralhar. Config (curinga/
// modo de remocao/monte vazio) mora em Preferencias agora (SettingsPanel),
// igual ao resto das preferencias de mesa — cravar select de config aqui
// dentro ficava poluido pra uma caixa que devia ser so "puxar carta".
// `config` chega como prop CONTROLADA por App.tsx (dono do estado e do
// localStorage); este componente so aplica no DeckState local quando ela
// muda (curinga reconstroi o monte, o resto so atualiza).
//
// O RESULTADO (cartas puxadas) aparece no palco compartilhado em App.tsx,
// igual ao dado — nao mais aqui dentro (specs/08-baralho.md).
//
// App.tsx recebe onDraw/onReshuffle DEPOIS do estado local ja ter mudado,
// tanto pra mostrar no palco quanto pra retransmitir pro log da sala —
// mesmo papel do onRoll do RollPanel.

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createDeck, draw, reshuffleDeck } from "@rolai/deck-engine";
import type { DeckConfig, DeckState, DrawResult } from "@rolai/deck-engine";
import { playCardDraw, playCardShuffle } from "../deckSound";
import { StepperInput } from "./StepperInput";

interface DeckPanelProps {
  config: DeckConfig;
  onDraw?: (result: DrawResult, timestamp: string) => void;
  onReshuffle?: () => void;
}

export function DeckPanel({ config, onDraw, onReshuffle }: DeckPanelProps) {
  const [deck, setDeck] = useState<DeckState>(() => createDeck(config));
  const [count, setCount] = useState("1");
  const [error, setError] = useState<string | null>(null);

  // Preferencias mudou a config: aplica no monte local. Curinga muda a
  // COMPOSICAO (52 vs 54 cartas) — reshuffleDeck so reordena o que ja
  // existe, nunca adiciona/remove carta, entao so um baralho novo reflete
  // isso de verdade. O resto (removalMode/autoReshuffleOnEmpty) e so
  // atualizar o campo, sem mexer nas pilhas.
  useEffect(() => {
    setDeck((d) => {
      if (
        d.config.includeJokers === config.includeJokers &&
        d.config.removalMode === config.removalMode &&
        d.config.autoReshuffleOnEmpty === config.autoReshuffleOnEmpty
      ) {
        return d;
      }
      if (d.config.includeJokers !== config.includeJokers) {
        return createDeck(config);
      }
      return { ...d, config: { ...config } };
    });
  }, [config]);

  // DeckState e mutado in-place pelo engine (draw/reshuffleDeck) — clonar
  // o topo forca o React a perceber a mudanca depois da mutacao.
  const refresh = () => setDeck((d) => ({ ...d }));

  function handleDraw(event: FormEvent) {
    event.preventDefault();
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1) {
      setError("Quantidade precisa ser um número inteiro maior que zero.");
      return;
    }
    try {
      const result = draw(deck, n);
      setError(null);
      playCardDraw();
      refresh();
      // Gerado aqui (nao dentro do client): e a mesma chave que dedupa o
      // echo do broadcast (room/echo.ts) com o que ja foi mostrado local.
      onDraw?.(result, new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleReshuffle() {
    reshuffleDeck(deck);
    setError(null);
    playCardShuffle();
    refresh();
    onReshuffle?.();
  }

  return (
    <form className="panel roll-panel" onSubmit={handleDraw}>
      <h2>Baralho</h2>

      <div className="field">
        <label htmlFor="deck-count">Cartas a puxar</label>
        <StepperInput
          id="deck-count"
          value={count}
          onChange={setCount}
          min={1}
          max={deck.config.removalMode === "returns" ? 54 : undefined}
        />
      </div>

      <p className="deck-remaining">
        {deck.drawPile.length} carta{deck.drawPile.length === 1 ? "" : "s"} restante
        {deck.drawPile.length === 1 ? "" : "s"}
        {deck.config.removalMode === "permanent" && deck.discardPile.length > 0 && (
          <> · {deck.discardPile.length} no descarte</>
        )}
      </p>

      <button
        type="submit"
        className="roll-button"
        disabled={deck.drawPile.length === 0 && !deck.config.autoReshuffleOnEmpty}
      >
        Puxar
      </button>
      <button type="button" className="button-secondary deck-reshuffle-button" onClick={handleReshuffle}>
        Reembaralhar
      </button>

      {error !== null && <p className="error">{error}</p>}
    </form>
  );
}
