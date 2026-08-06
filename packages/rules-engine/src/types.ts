// Contrato canonico de saida de uma rolagem — ver docs/roll-notation.md.
// Todo resultado que trafega pelo WS ou vai pro historico usa este formato.

export interface RollGroup {
  rolls: number[];
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
  timestamp: string;
}

// Fonte de RNG injetavel — default deve usar crypto.getRandomValues.
// Nunca Math.random() puro (ver docs/security.md).
export type RandomSource = () => number;
