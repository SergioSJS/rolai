import type { HistoryEntry } from "../room/reducer";
import type { RollResult } from "@rolai/rules-engine";
import { dieFaceLabel, displayGroups, groupLabel, outcomeLabel, outcomeTone } from "../format";
import { cardLabel, deckConfigChangeLabel, isRedSuit } from "../cardFormat";
import { PlayerTag } from "./PlayerTag";
import type { DiceStyle, DiceStyles } from "../settings";

function HistoryRollResult({
  result,
  styles,
  style,
}: {
  result: RollResult;
  styles?: DiceStyles | null;
  style?: DiceStyle | null;
}) {
  const groups = displayGroups(result);
  const joiner = result.notation.includes(" + ") ? " + " : " vs ";
  const isSumNotation = !result.notation.includes(" vs ") && result.notation.includes(" + ");
  const grandTotal =
    isSumNotation && groups.length > 1 && typeof result.outcome !== "string"
      ? groups.reduce(
          (sum, g) =>
            sum +
            (g.total ?? g.rolls.reduce((s, r) => s + r.value, 0) + (g.modifier ?? 0)),
          0,
        )
      : undefined;

  return (
    <span className="history-result">
      {groups.map((group, gi) => {
        const groupTotal =
          group.total ??
          (isSumNotation && typeof result.outcome !== "string"
            ? group.rolls.reduce((sum, r) => sum + r.value, 0) + (group.modifier ?? 0)
            : undefined);

        return (
          <span key={`${group.name}-${gi}`}>
            {gi > 0 && <span>{joiner}</span>}
            {/* Tres pools de d6 iguais (Forbidden Lands) viravam tres arrays
                anonimos na linha do historico — sem o nome nao da pra saber
                qual "= 1" veio de onde. Grupo unico continua sem rotulo. */}
            {groups.length > 1 && (
              <span className="history-group-name">{groupLabel(group.name)} </span>
            )}
            {group.rolls.length === 0 ? (
              // Pool zerado: o motor rola e descarta um dado so pra ter
              // notacao valida (zero_dice_fallback) — "[]" parece bug.
              <span>—</span>
            ) : (
              <>
                <span>[</span>
                {group.rolls.map((roll, ri) => {
                  const slotKey = String(roll.slot) as "1" | "2" | "3";
                  const slotStyle = roll.slot
                    ? styles?.[slotKey] ??
                      (roll.slot === 1 ? style : undefined)
                    : undefined;
                  const inlineStyle = slotStyle
                    ? {
                        background: slotStyle.body,
                        color: slotStyle.number,
                        borderColor: slotStyle.outline,
                      }
                    : undefined;

                  return (
                    <span key={ri}>
                      {ri > 0 && <span>, </span>}
                      {roll.card ? (
                        <span className={`history-card${roll.isRed ? " is-red" : ""}`}>
                          {dieFaceLabel(roll.value, roll.fudge, roll.card)}{roll.symbol ?? ""}
                        </span>
                      ) : roll.slot ? (
                        <span
                          className={`history-die history-die-slot-${roll.slot}`}
                          style={inlineStyle}
                        >
                          {dieFaceLabel(roll.value, roll.fudge, roll.card)}
                        </span>
                      ) : roll.theme ? (
                        <span className={`history-die history-die-${roll.theme}`}>
                          {dieFaceLabel(roll.value, roll.fudge, roll.card)}
                        </span>
                      ) : (
                        dieFaceLabel(roll.value, roll.fudge, roll.card)
                      )}
                    </span>
                  );
                })}
                <span>]</span>
              </>
            )}
            {group.modifier !== undefined && group.modifier !== 0 && (
              <span>
                {group.modifier > 0 ? ` + ${group.modifier}` : ` − ${Math.abs(group.modifier)}`}
              </span>
            )}
            {groupTotal !== undefined && <span> = {groupTotal}</span>}
          </span>
        );
      })}
      {grandTotal !== undefined && <span> = {grandTotal}</span>}
    </span>
  );
}

function entryDetail(entry: HistoryEntry) {
  switch (entry.type) {
    case "roll":
      return (
        <>
          <span className="history-notation">{entry.result.notation}</span>
          <HistoryRollResult
            result={entry.result}
            styles={entry.styles}
            style={entry.style}
          />
          {/* Outcome separado dos numeros justamente pra poder ir vermelho
              sem levar os dados junto. */}
          {entry.result.profile === "infaernum_ideias" ? (
            <span className="history-ideias">
              <span className="history-dash">—</span>
              {entry.result.outcome_flags?.map((flag) => (
                <span key={flag} className={`history-flag tone-${outcomeTone(flag)}`}>
                  {outcomeLabel(flag)}
                </span>
              ))}
            </span>
          ) : (
            <>
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
            </>
          )}
        </>
      );
    case "deck_draw":
      return (
        <span className="history-result">
          puxou {entry.cards.length} carta{entry.cards.length === 1 ? "" : "s"}:{" "}
          {entry.cards.map((card, i) => (
            <span
              key={`${card.id}-${i}`}
              className={`history-card${isRedSuit(card) ? " is-red" : ""}`}
            >
              {cardLabel(card)}
            </span>
          ))}
        </span>
      );
    case "deck_shuffle":
      return <span className="history-result">reembaralhou o baralho</span>;
    case "deck_config":
      return <span className="history-result">mudou o baralho: {deckConfigChangeLabel(entry)}</span>;
  }
}

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
        <li key={`${entry.type}-${i}`}>
          <PlayerTag name={entry.player} style={entry.type === "roll" ? entry.style : undefined} />
          {entryDetail(entry)}
        </li>
      ))}
    </ul>
  );
}
