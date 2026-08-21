// Os dois botões do histórico (specs/09-limpar-historico.md). Os nomes são
// parte do desenho: "Ocultar" some só pra quem clicou e volta atrás;
// "Limpar a sala" apaga no servidor pra mesa inteira e não volta.
import { useEffect, useState } from "react";
import { HideIcon, ShowIcon, TrashIcon } from "./Glyphs";

/**
 * Janela em que o segundo clique confirma, antes do botão voltar ao normal.
 *
 * Oito segundos, não quatro: quem para pra LER "Confirmar?" já estoura
 * quatro, e aí o clique seguinte só rearma a confirmação — parece que o
 * botão não funciona.
 */
const CONFIRM_TIMEOUT_MS = 8000;

export function HistoryActions({
  hasEntries,
  hiddenBefore,
  inRoom,
  canClear,
  onHide,
  onShowAll,
  onClear,
}: {
  hasEntries: boolean;
  hiddenBefore: string | null;
  inRoom: boolean;
  /** `false` = sala fora do ar; não há como apagar na mesa agora. */
  canClear: boolean;
  onHide: () => void;
  onShowAll: () => void;
  onClear: () => void;
}) {
  // Confirmação em dois cliques no próprio botão, não em window.confirm: o
  // diálogo nativo trava a janela inteira e some atrás do palco 3D em tela
  // cheia.
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    if (!canClear) {
      setConfirming(false);
      return;
    }
    const timer = setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [confirming, canClear]);

  return (
    <div className="history-actions">
      {hiddenBefore !== null && (
        <button type="button" onClick={onShowAll} title="Traz de volta o que foi ocultado">
          <ShowIcon />
          Mostrar tudo
        </button>
      )}
      <button
        type="button"
        onClick={onHide}
        disabled={!hasEntries}
        title="Some da SUA tela; o resto da mesa continua vendo"
      >
        <HideIcon />
        Ocultar
      </button>
      <button
        type="button"
        className={confirming ? "is-danger" : undefined}
        disabled={!canClear || !hasEntries}
        onClick={() => {
          if (!confirming) {
            setConfirming(true);
            return;
          }
          setConfirming(false);
          onClear();
        }}
        title={
          !canClear
            ? "Sem conexão com a sala agora"
            : inRoom
              ? "Apaga o histórico pra TODO MUNDO na sala, sem desfazer"
              : "Apaga o histórico local, sem desfazer"
        }
      >
        <TrashIcon />
        {/* "Limpar histórico", não só "Limpar": o compositor já tem um botão
            Limpar do lado (esvazia a notação), e dois botões com o mesmo
            rótulo e efeitos bem diferentes na mesma tela é pedir engano. */}
        {confirming ? "Confirmar?" : inRoom ? "Limpar a sala" : "Limpar histórico"}
      </button>
    </div>
  );
}
