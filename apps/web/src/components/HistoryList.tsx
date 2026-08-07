// Historico de rolagens (da sala, em ordem canonica do servidor, ou local
// quando fora de sala).

import type { HistoryEntry } from "../room/reducer";
import { outcomeLabel, outcomeTone, summarizeDice } from "../format";
import { PlayerTag } from "./PlayerTag";

export function HistoryList({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="history-empty">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
          aria-hidden
        >
          <polygon points="12,2 21,7.2 21,16.8 12,22 3,16.8 3,7.2" />
          <polygon points="12,6.5 16.5,15.5 7.5,15.5" />
        </svg>
        <p>Nenhuma rolagem ainda.</p>
        <p className="history-empty-hint">
          Monte o pool ao lado e mande ver — o histórico da mesa aparece aqui.
        </p>
      </div>
    );
  }
  return (
    <ul className="history">
      {[...entries].reverse().map((entry, i) => (
        <li key={`${entry.result.timestamp}-${i}`}>
          <PlayerTag name={entry.player} style={entry.style} />
          <span className="history-notation">{entry.result.notation}</span>
          <span className="history-result">{summarizeDice(entry.result)}</span>
          {/* Outcome separado dos numeros justamente pra poder ir vermelho
              sem levar os dados junto. */}
          {typeof entry.result.outcome === "string" && (
            <span className={`history-outcome tone-${outcomeTone(entry.result.outcome)}`}>
              {outcomeLabel(entry.result.outcome)}
            </span>
          )}
          {entry.result.outcome_flags?.map((flag) =>
            flag === entry.result.outcome ? null : (
              <span key={flag} className={`history-flag tone-${outcomeTone(flag)}`}>
                {outcomeLabel(flag)}
              </span>
            ),
          )}
        </li>
      ))}
    </ul>
  );
}
