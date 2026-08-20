// Resultado em destaque, sobreposto ao palco. Com profile, o outcome E o
// resultado (ex: FitD nao tem "soma" — exibir o total do pool como numero
// principal induzia a erro); sem profile, o total assume. Chips por dado
// mostram a composicao em qualquer caso.

import type { RollResult } from "@rolai/rules-engine";
import type { DiceStyle, DiceStyles } from "../settings";
import { dieFaceLabel, displayGroups, groupLabel, outcomeLabel, outcomeTone } from "../format";
import { isYzeSystem } from "../yzePush";
import { PlayerTag } from "./PlayerTag";

export function ResultDisplay({
  result,
  // Quem rolou. Em sala, saber de quem e o resultado importa tanto quanto o
  // numero — sem isso, tres pessoas rolando viram tres numeros anonimos.
  // Ausente = rolagem local (nao ha "outro" pra desambiguar).
  player,
  playerStyle,
  playerStyles,
  // Modo stream/OBS: ninguem clica pra dispensar (some sozinho), entao o
  // hint nao faz sentido na saida da stream.
  showDismissHint = true,
}: {
  result: RollResult | null;
  player?: string | null;
  playerStyle?: DiceStyle | null;
  playerStyles?: DiceStyles | null;
  showDismissHint?: boolean;
}) {
  // Sem resultado, nada: este overlay fica FIXO acima de toda a UI, entao
  // qualquer placeholder aqui vira texto flutuando por cima do historico e
  // dos controles. Quem convida a rolar e o painel lateral.
  if (result === null) return null;

  const groups = displayGroups(result);
  // Grupo unico sem total do engine (ex: "2d6" livre — o engine so emite
  // total com operador de soma explicito): a soma e a leitura natural da
  // rolagem, entao exibimos. Em multi-grupo (vs), vale so o total do
  // engine — somar o challenge do Ironsworn seria errado.
  const single = groups.length === 1 ? groups[0]! : undefined;
  // `?? undefined` tambem cobre null vindo de outro cliente (ver format.ts).
  const singleTotal =
    single !== undefined
      ? (single.total ??
        single.rolls.reduce((sum, r) => sum + r.value, 0) + (single.modifier ?? 0))
      : undefined;

  // Notação com múltiplos grupos somados (ex: "1[1d6] + 2[2d6]", "1[2d12]+2[1d20+2d12]", "{1d6} + {2d6}"):
  const isVsNotation = result.notation.includes(" vs ");
  const isSumNotation = !isVsNotation && !isYzeSystem(result.profile);
  const grandTotal =
    isSumNotation && groups.length > 1
      ? groups.reduce(
          (sum, g) =>
            sum +
            (g.total ?? g.rolls.reduce((s, r) => s + r.value, 0) + (g.modifier ?? 0)),
          0,
        )
      : undefined;

  // Em notação "vs" (ex: "{2d6} vs {1d10}"), o headline mostra os totais comparados se não houver outcome do sistema
  const vsHeadline =
    isVsNotation && groups.length === 2 && typeof result.outcome !== "string"
      ? `${groups[0]?.total ?? groups[0]?.rolls.reduce((s, r) => s + r.value, 0) ?? 0} vs ${groups[1]?.total ?? groups[1]?.rolls.reduce((s, r) => s + r.value, 0) ?? 0}`
      : undefined;

  // Year Zero de varios pools (Base/Perícia/Equipamento, Base/Estresse): os
  // sucessos estao espalhados em "= 1" por grupo e o numero que a mesa usa
  // e a SOMA — sem esta linha o jogador soma de cabeca justo no sistema que
  // ganhou success_rule pra nao ter que contar dado na mao. Pool unico nao
  // precisa: o total do proprio grupo ja e a resposta.
  const yzeSuccesses =
    isYzeSystem(result.profile) && groups.length > 1
      ? groups.reduce((sum, g) => sum + (g.total ?? 0), 0)
      : null;
  const headline =
    typeof result.outcome === "string"
      ? outcomeLabel(result.outcome)
      : yzeSuccesses !== null
        ? `${yzeSuccesses} ${yzeSuccesses === 1 ? "sucesso" : "sucessos"}`
        : singleTotal !== undefined
          ? String(singleTotal)
          : grandTotal !== undefined
            ? String(grandTotal)
            : vsHeadline !== undefined
              ? vsHeadline
              : result.notation;

  return (
    // A caixa existe pro resultado sobreviver a fundo claro/colorido: o
    // palco e transparente e o texto ficava ilegivel sobre dado claro ou
    // wallpaper no modo stream.
    <div className="result-display">
      {typeof player === "string" && player !== "" && (
        <div className="result-player">
          <PlayerTag name={player} style={playerStyle} />
          <span className="result-player-verb">rolou</span>
        </div>
      )}
      {/* Infaernum padrao (3d6 individual): cada categoria e uma CONTAGEM
          ("2 milagres"), nao um hit/miss — uma palavra gigante escondia
          que mais de uma bateu junto. Lista de linhas de peso igual em
          vez de headline + pills pequenos. */}
      {result.profile === "infaernum" ? (
        <div className="result-tally">
          {result.outcome_flags?.map((flag) => (
            <div key={flag} className={`result-tally-item tone-${outcomeTone(flag)}`}>
              {outcomeLabel(flag)}
            </div>
          ))}
        </div>
      ) : result.profile === "infaernum_ideias" ? (
        /* Verbo + substantivo sao um PAR — nenhum dos dois e "o resultado
           principal" com o outro de coadjuvante. Lado a lado, mesmo estilo. */
        <div className="result-tally result-tally-row">
          {result.outcome_flags?.map((flag) => (
            <div key={flag} className={`result-tally-item tone-${outcomeTone(flag)}`}>
              {outcomeLabel(flag)}
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Falha nao pode ter a cara de acerto: o tom vem do outcome (ver
              outcomeTone). Sem outcome — rolagem livre — nao ha o que afirmar. */}
          <div
            className={
              typeof result.outcome === "string"
                ? `result-headline is-outcome tone-${outcomeTone(result.outcome)}`
                : headline.length > 6
                  ? "result-headline is-long"
                  : "result-headline"
            }
          >
            {headline}
          </div>
          {yzeSuccesses !== null && (
            <div className="result-yze-total">
              {yzeSuccesses} {yzeSuccesses === 1 ? "sucesso" : "sucessos"}
            </div>
          )}
          {result.outcome_flags
            ?.filter((flag) => flag !== result.outcome)
            .map((flag) => (
              <div key={flag} className={`result-flag tone-${outcomeTone(flag)}`}>
                {outcomeLabel(flag)}
              </div>
            ))}
        </>
      )}
      {/* Contra o que o resultado foi medido (CD, pericia, valor testado,
          limite...) — sem isto, "sucesso" sozinho nao diz muito nem pra
          quem rolou, nem pros outros vendo pela sala. */}
      {result.tested !== undefined && result.tested.length > 0 && (
        <div className="result-tested">
          {result.tested.map((t) => (
            <span key={t.label} className="result-tested-item">
              {t.label}: {t.value}
            </span>
          ))}
        </div>
      )}
      <div className="result-groups">
        {groups.map((group, gi) => (
          <div key={`${group.name}-${gi}`} className="result-group">
            {groups.length > 1 && (
              <span className="result-group-name">{groupLabel(group.name)}</span>
            )}
            <span className="result-chips">
              {/* Pool de zero dados (o Forçar do Year Zero pode zerar um
                  deles): o motor precisa de uma notacao valida e usa o
                  zero_dice_fallback, que rola um dado e descarta. Mostrar
                  esse dado seria mostrar um dado que nao esta na mesa. */}
              {group.rolls.length === 0 && (
                <span className="result-empty">sem dados</span>
              )}
              {group.rolls.map((roll, i) => {
                const slotKey = String(roll.slot) as "1" | "2" | "3";
                const slotStyle =
                  roll.slot
                    ? playerStyles?.[slotKey] ??
                      (roll.slot === 1 ? playerStyle : undefined)
                    : undefined;
                const inlineStyle = slotStyle
                  ? {
                      background: slotStyle.body,
                      color: slotStyle.number,
                      borderColor: slotStyle.outline,
                    }
                  : undefined;
                return (
                  <span
                    key={i}
                    className={`die-chip${roll.card ? ` card-chip${roll.isRed ? " is-red" : ""}` : ""}${roll.slot ? ` die-chip-slot-${roll.slot}` : ""}${roll.theme ? ` die-chip-${roll.theme}` : ""}`}
                    style={inlineStyle}
                  >
                    {dieFaceLabel(roll.value, roll.fudge, roll.card)}
                    {roll.symbol ?? ""}
                    {roll.sides !== null && (
                      <span
                        className="die-chip-sides"
                        style={slotStyle ? { color: slotStyle.outline } : undefined}
                      >
                        {roll.card ? "carta" : roll.fudge ? "dF" : `d${roll.sides}`}
                      </span>
                    )}
                  </span>
                );
              })}
              {/* Descartados: mesma cara, apagados. A ordem (mantidos
                  primeiro) mantem o total facil de conferir. */}
              {group.rolls.length > 0 &&
                group.dropped?.map((roll, i) => {
                  const slotKey = String(roll.slot) as "1" | "2" | "3";
                  const slotStyle =
                    roll.slot
                      ? playerStyles?.[slotKey] ??
                        (roll.slot === 1 ? playerStyle : undefined)
                      : undefined;
                  const inlineStyle = slotStyle
                    ? {
                        background: slotStyle.body,
                        color: slotStyle.number,
                        borderColor: slotStyle.outline,
                      }
                    : undefined;
                  return (
                    <span
                      key={`d${i}`}
                      className={`die-chip is-dropped${roll.card ? ` card-chip${roll.isRed ? " is-red" : ""}` : ""}${roll.slot ? ` die-chip-slot-${roll.slot}` : ""}${roll.theme ? ` die-chip-${roll.theme}` : ""}`}
                      style={inlineStyle}
                      title="descartado"
                    >
                      {dieFaceLabel(roll.value, roll.fudge, roll.card)}
                      {roll.symbol ?? ""}
                      {roll.sides !== null && (
                        <span
                          className="die-chip-sides"
                          style={slotStyle ? { color: slotStyle.outline } : undefined}
                        >
                          {roll.card ? "carta" : roll.fudge ? "dF" : `d${roll.sides}`}
                        </span>
                      )}
                    </span>
                  );
                })}
              {group.modifier !== undefined && group.modifier !== 0 && (
                <span className="die-chip die-chip-mod">
                  {group.modifier > 0 ? `+${group.modifier}` : group.modifier}
                </span>
              )}
            </span>
            {(() => {
              const groupTotal =
                group.total ??
                (isSumNotation && typeof result.outcome !== "string"
                  ? group.rolls.reduce((sum, r) => sum + r.value, 0) +
                    (group.modifier ?? 0)
                  : undefined);
              return (
                groupTotal !== undefined && (
                  <span className="result-group-total">= {groupTotal}</span>
                )
              );
            })()}
          </div>
        ))}
      </div>
      <div className="result-notation">
        <span>{result.notation}</span>
        {showDismissHint && (
          <span className="result-dismiss-hint">clique ou Esc pra tirar os dados</span>
        )}
      </div>
    </div>
  );
}
