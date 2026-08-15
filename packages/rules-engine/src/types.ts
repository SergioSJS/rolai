// Contrato canonico de saida de uma rolagem — ver docs/roll-notation.md.
// Todo resultado que trafega pelo WS ou vai pro historico usa este formato.

export interface RollGroup {
  /** Dados que CONTAM no total (após keep/drop). */
  rolls: number[];
  /**
   * Dados descartados pelo keep/drop, na ordem em que caíram.
   *
   * Ausente quando não houve descarte. Existe pra UI poder mostrar a
   * rolagem inteira — `4d6kh3` que exibe só 3 dados esconde metade do que
   * aconteceu, e em pool grande (`10d6kh1`) fica absurdo: 10 dados rolam,
   * 1 aparece. O total ignora estes valores.
   */
  dropped?: number[];
  modifier?: number;
  total?: number;
}

export interface RollResult {
  notation: string;
  groups: Record<string, RollGroup>;
  profile?: string;
  outcome?: string;
  // Todas as outcome_rules cuja condition bateu, em ordem de avaliacao.
  // `outcome` e sempre o primeiro elemento (eventos independentes do
  // resultado principal, como o "match" do Ironsworn, aparecem aqui).
  outcome_flags?: string[];
  // Inputs do profile citados nas outcome_rules — o numero contra o qual o
  // resultado foi medido (CD, perícia, valor testado, limite...). So
  // ESTES, nao todos os inputs: "mod"/"mode" ja aparecem embutidos na
  // notacao/nos dados, e repetir escondia o motivo de existir (mostrar o
  // que nao da pra ver so olhando pro resultado). Ausente = profile sem
  // nenhum input desse tipo, ou nenhum foi preenchido.
  tested?: { label: string; value: number | string }[];
  timestamp: string;
}

// Fonte de RNG injetavel — default deve usar crypto.getRandomValues.
// Nunca Math.random() puro (ver docs/security.md).
export type RandomSource = () => number;
