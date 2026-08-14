// Resultado em destaque, sobreposto ao palco. Com profile, o outcome E o
// resultado (ex: FitD nao tem "soma" — exibir o total do pool como numero
// principal induzia a erro); sem profile, o total assume. Chips por dado
// mostram a composicao em qualquer caso.

import type { RollResult } from "@rolai/rules-engine";
import type { DiceStyle } from "../settings";
import { dieFaceLabel, displayGroups, outcomeLabel, outcomeTone } from "../format";
import { PlayerTag } from "./PlayerTag";

export function ResultDisplay({
  result,
  // Quem rolou. Em sala, saber de quem e o resultado importa tanto quanto o
  // numero — sem isso, tres pessoas rolando viram tres numeros anonimos.
  // Ausente = rolagem local (nao ha "outro" pra desambiguar).
  player,
  playerStyle,
  // Modo stream/OBS: ninguem clica pra dispensar (some sozinho), entao o
  // hint nao faz sentido na saida da stream.
  showDismissHint = true,
}: {
  result: RollResult | null;
  player?: string | null;
  playerStyle?: DiceStyle | null;
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
        single.rolls.reduce((sum, v) => sum + v, 0) + (single.modifier ?? 0))
      : undefined;
  const headline =
    typeof result.outcome === "string"
      ? outcomeLabel(result.outcome)
      : singleTotal !== undefined
        ? String(singleTotal)
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
                : "result-headline"
            }
          >
            {headline}
          </div>
          {result.outcome_flags
            ?.filter((flag) => flag !== result.outcome)
            .map((flag) => (
              <div key={flag} className={`result-flag tone-${outcomeTone(flag)}`}>
                {outcomeLabel(flag)}
              </div>
            ))}
        </>
      )}
      <div className="result-groups">
        {groups.map((group, gi) => (
          <div key={`${group.name}-${gi}`} className="result-group">
            {groups.length > 1 && (
              <span className="result-group-name">{group.name}</span>
            )}
            <span className="result-chips">
              {group.rolls.map((value, i) => (
                <span key={i} className="die-chip">
                  {dieFaceLabel(value, group.fudge)}
                  {group.sides !== null && (
                    <span className="die-chip-sides">
                      {group.fudge ? "dF" : `d${group.sides}`}
                    </span>
                  )}
                </span>
              ))}
              {/* Descartados: mesma cara, apagados. A ordem (mantidos
                  primeiro) mantem o total facil de conferir. */}
              {group.dropped?.map((value, i) => (
                <span key={`d${i}`} className="die-chip is-dropped" title="descartado">
                  {dieFaceLabel(value, group.fudge)}
                  {group.sides !== null && (
                    <span className="die-chip-sides">
                      {group.fudge ? "dF" : `d${group.sides}`}
                    </span>
                  )}
                </span>
              ))}
              {group.modifier !== undefined && group.modifier !== 0 && (
                <span className="die-chip die-chip-mod">
                  {group.modifier > 0 ? `+${group.modifier}` : group.modifier}
                </span>
              )}
            </span>
            {group.total !== undefined && (
              <span className="result-group-total">= {group.total}</span>
            )}
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
