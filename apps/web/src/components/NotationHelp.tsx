// Ajuda da notação, com exemplos extraídos de `docs/roll-notation.md` (a
// gramática que o rules-engine de fato aceita — não uma lista de memória).
//
// Fica num modal em vez de tooltip: são ~15 formas, e quem está aprendendo
// precisa comparar exemplos lado a lado.

interface Linha {
  exemplo: string;
  explica: string;
}

const BASICO: Linha[] = [
  { exemplo: "2d6", explica: "dois dados de seis faces" },
  { exemplo: "2d6+3", explica: "com modificador (também aceita −)" },
  { exemplo: "1d20", explica: "um dado de vinte" },
  { exemplo: "1d100", explica: "percentil (rola como dois d10)" },
  { exemplo: "4dF", explica: "dados Fate/Fudge — cada um vale −1, 0 ou +1" },
];

const SELECAO: Linha[] = [
  { exemplo: "4d6kh3", explica: "fica com os 3 maiores" },
  { exemplo: "4d6dl1", explica: "descarta o menor (mesmo efeito acima)" },
  { exemplo: "4d6kl1", explica: "fica com o menor" },
  { exemplo: "1d20adv", explica: "vantagem — rola 2d20 e fica com o maior" },
  { exemplo: "1d20dis", explica: "desvantagem — fica com o menor" },
  { exemplo: "4d6!r<2", explica: "rerrola o que sair abaixo de 2" },
];

const COMBINADO: Linha[] = [
  { exemplo: "2d6+1d4+3", explica: "soma vários grupos de dados e um número" },
  { exemplo: "1d20-1d4", explica: "subtrai um grupo do outro" },
  { exemplo: "4d6kh3+1d20", explica: "seleção vale só no grupo em que está" },
  { exemplo: "{1d6+2} vs {2d10}", explica: "dois lados separados, sem somar um no outro" },
];

/** Todos os exemplos exibidos — o teste garante que o parser aceita cada um. */
export const HELP_EXAMPLES: string[] = [...BASICO, ...SELECAO, ...COMBINADO].map(
  (linha) => linha.exemplo,
);

function Bloco({ titulo, linhas }: { titulo: string; linhas: Linha[] }) {
  return (
    <section className="notation-block">
      <h3>{titulo}</h3>
      <dl className="notation-list">
        {linhas.map((linha) => (
          <div key={linha.exemplo} className="notation-row">
            <dt>
              <code>{linha.exemplo}</code>
            </dt>
            <dd>{linha.explica}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function NotationHelp() {
  return (
    <div className="notation-help">
      <p className="notation-intro">
        Escreva no campo de rolagem. Maiúsculas e minúsculas dão no mesmo, e
        espaços são ignorados.
      </p>
      <Bloco titulo="Básico" linhas={BASICO} />
      <Bloco titulo="Escolher e rerrolar" linhas={SELECAO} />
      <Bloco titulo="Combinar" linhas={COMBINADO} />
      <p className="notation-foot">
        Escolher sistema em <strong>Preferências</strong> troca o painel por
        campos prontos (Ironsworn, PbtA, FitD, Fate, d20, d100) — a notação
        livre continua disponível.
      </p>
    </div>
  );
}
