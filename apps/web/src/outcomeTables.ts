// Tabelas de apresentação de outcome/pool. Só DADO: nenhum import além
// deste arquivo pra si mesmo.
//
// Ficavam em format.ts, mas format.ts importa `cardFormat` -> React
// (@letele/playing-cards), e o catálogo do Android (catalog.ts) precisa
// exatamente destas tabelas e de mais nada. Importar format.ts de lá
// arrastou o React inteiro pro bundle headless, que quebrou na WebView com
// "process is not defined" — a rolagem no aparelho simplesmente parava de
// acontecer, sem erro visível. Mantenha este arquivo SEM dependências.

export type OutcomeTone = "success" | "partial" | "failure" | "neutral";

// Labels pt-BR pros outcomes conhecidos dos profiles versionados
// (packages/rules-engine/profiles/*.yaml). Outcome desconhecido (profile
// custom) cai no id cru.
export const OUTCOME_LABELS: Record<string, string> = {
  strong_hit: "sucesso completo",
  weak_hit: "sucesso parcial",
  miss: "falha",
  match: "combinação!",
  critical: "crítico",
  full_success: "sucesso total",
  partial_success: "sucesso parcial",
  // fate
  success_with_style: "sucesso com estilo",
  success: "sucesso",
  tie: "empate",
  fail: "falha",
  // d20
  critical_success: "acerto crítico",
  critical_failure: "falha crítica",
  // d100 (BRP)
  extreme_success: "sucesso extremo",
  hard_success: "sucesso difícil",
  regular_success: "sucesso",
  fumble: "desastre",
  // roll_under e wod5/pool_d6 (vs dificuldade/limite) reusam success/fail
  // do fate, ja mapeados acima.
  // infaernum — sim ou não
  sim: "sim",
  nao: "não",
  // infaernum — rolagem padrão (3d6 individual, quantizado: pool fixo em
  // 3 dados, cada categoria so ocorre 0 a 3 vezes).
  desgraca_x1: "1 desgraça",
  desgraca_x2: "2 desgraças",
  desgraca_x3: "3 desgraças",
  vislumbre_x1: "1 vislumbre",
  vislumbre_x2: "2 vislumbres",
  vislumbre_x3: "3 vislumbres",
  facanha_x1: "1 façanha",
  facanha_x2: "2 façanhas",
  facanha_x3: "3 façanhas",
  milagre_x1: "1 milagre",
  milagre_x2: "2 milagres",
  milagre_x3: "3 milagres",
  // wod5 — pool Fome/Ira (critical reusa o do fitd, ja mapeado acima)
  messy_critical: "crítico manchado",
  bestial_failure: "fracasso bestial",
  // pool_d6 (Shadowrun-style)
  glitch: "pane",
  critical_glitch: "pane crítica",
  // fractal — pool de d6, maior dado decide. success/fail reusam fate/pool_d6
  // (ja mapeados acima). Impulso conta os seis ALEM do primeiro; ruptura
  // conta os dados em 1 (evento paralelo, nunca outcome primario).
  sucesso_impulso_x2: "sucesso com 1 impulso extra",
  sucesso_impulso_x3: "sucesso com 2 impulsos extras",
  sucesso_impulso_x4: "sucesso com 3 impulsos extras",
  ruptura_x1: "ruptura: 1 fato quebrado",
  ruptura_x2: "ruptura: 2 fatos quebrados",
  ruptura_x3: "ruptura: 3 fatos quebrados",
  ruptura_x4: "ruptura: 4 fatos quebrados",
  // year zero (yze/yze_fbl/yze_alien/yze_wdu) — success/fail reusam os do
  // fate, ja mapeados acima. Dano e evento PARALELO ao sucesso (o 1 conta
  // na rolagem empurrada mesmo quando ela acerta), e o x3 e "3 ou mais".
  yze_dano_atributo_x1: "1 dano de atributo",
  yze_dano_atributo_x2: "2 danos de atributo",
  yze_dano_atributo_x3: "3+ danos de atributo",
  yze_dano_equipamento_x1: "1 dano de equipamento",
  yze_dano_equipamento_x2: "2 danos de equipamento",
  yze_dano_equipamento_x3: "3+ danos de equipamento",
  yze_panico: "pânico!",
  yze_descontrole: "descontrole!",
  // trophy (trophy_dark / trophy_gold)
  trophy_ruina_aumenta: "ruína aumenta (+1)",
};


export const GROUP_LABELS: Record<string, string> = {
  action: "ação",
  challenge: "desafio",
  verb: "verbo",
  noun: "substantivo",
  regular: "regulares",
  hunger: "fome/ira",
  pool: "pool",
  roll: "rolagem",
  // year zero
  base: "base",
  pericia: "perícia",
  equipamento: "equipamento",
  estresse: "estresse",
  // trophy
  claros: "claros",
  escuros: "escuros",
  ruina: "ruína",
};


/**
 * Tom do resultado, pra UI pintar sucesso e falha diferente.
 *
 * Ate aqui TODO outcome saia verde — uma falha crítica no d20 tinha
 * exatamente a mesma cara de um acerto crítico, e quem le de longe (ou na
 * stream) so via "deu alguma coisa".
 *
 * `neutral` e a resposta honesta pra outcome que este mapa nao conhece
 * (profile custom, versao nova de um profile): pintar de verde uma falha e
 * pior do que nao pintar. Fica com a cor de acento, como antes.
 *
 * Isto e APRESENTACAO, nao regra: quem decide o outcome sao as
 * `outcome_rules` do profile (packages/rules-engine/profiles/*.yaml). Por
 * isso mora aqui e nao no motor — e por isso o bundle headless do Android
 * nao muda por causa dele.
 */
export const OUTCOME_TONES: Record<string, OutcomeTone> = {
  // Falha: e o que precisava de vermelho.
  miss: "failure",
  fail: "failure",
  critical_failure: "failure",
  fumble: "failure",
  // Infaernum (3d6 individual): desgraca e sempre o lado ruim, em qualquer
  // quantidade.
  desgraca_x1: "failure",
  desgraca_x2: "failure",
  desgraca_x3: "failure",
  // wod5: fracasso com custo extra — ainda fracasso.
  bestial_failure: "failure",
  // pool_d6 (Shadowrun-style): glitch e sempre revés, mesmo o nao-critico.
  glitch: "failure",
  critical_glitch: "failure",
  // Infaernum — oraculo sim ou não.
  nao: "failure",
  // Meio do caminho — sucesso com custo, ou empate. Nem verde, nem vermelho.
  weak_hit: "partial",
  partial_success: "partial",
  tie: "partial",
  vislumbre_x1: "partial",
  vislumbre_x2: "partial",
  vislumbre_x3: "partial",
  // Sucesso.
  strong_hit: "success",
  full_success: "success",
  success: "success",
  success_with_style: "success",
  critical_success: "success",
  critical: "success",
  extreme_success: "success",
  hard_success: "success",
  regular_success: "success",
  facanha_x1: "success",
  facanha_x2: "success",
  facanha_x3: "success",
  milagre_x1: "success",
  milagre_x2: "success",
  milagre_x3: "success",
  // wod5: critico "sujo" — ainda um sucesso, so com custo narrativo.
  messy_critical: "success",
  // Infaernum — oraculo sim ou não.
  sim: "success",
  // fractal: impulso e sucesso "mais forte", mesma cor do sucesso normal —
  // igual critical_success do d20, a distincao e so no texto do label.
  sucesso_impulso_x2: "success",
  sucesso_impulso_x3: "success",
  sucesso_impulso_x4: "success",
  // Ironsworn: "match" e os dois dados de desafio iguais — um EVENTO que
  // pode acontecer junto de acerto ou de falha, entao nao tem tom proprio.
  match: "neutral",
  // fractal: ruptura e complicacao PARALELA (Fato quebrado) — pode vir
  // junto de sucesso ou falha, entao tambem nao tem tom proprio.
  ruptura_x1: "neutral",
  ruptura_x2: "neutral",
  ruptura_x3: "neutral",
  ruptura_x4: "neutral",
  // year zero: dano, panico e descontrole sao paralelos ao sucesso/falha,
  // mas nenhum deles e ambiguo do jeito que o "match" do Ironsworn e — sao
  // preju, ponto. Neutro os pintava com a cor de acento (verde neste tema)
  // e um "2 danos de atributo" tinha a mesma cara de um acerto. Vermelho,
  // mesmo quando a rolagem em si deu sucesso.
  yze_dano_atributo_x1: "failure",
  yze_dano_atributo_x2: "failure",
  yze_dano_atributo_x3: "failure",
  yze_dano_equipamento_x1: "failure",
  yze_dano_equipamento_x2: "failure",
  yze_dano_equipamento_x3: "failure",
  yze_panico: "failure",
  yze_descontrole: "failure",
  // trophy
  trophy_ruina_aumenta: "failure",
};

