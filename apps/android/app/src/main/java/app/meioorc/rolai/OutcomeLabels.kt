package app.meioorc.rolai

/**
 * Labels pt-BR pros outcomes conhecidos dos profiles versionados em
 * packages/rules-engine/profiles (arquivos yaml). Espelha `OUTCOME_LABELS` de
 * `apps/web/src/format.ts` — outcome desconhecido (profile custom) cai no
 * id cru, igual na web.
 *
 * Sem isto, `formatResult` mostrava o id interno da regra ("desgraca_x1",
 * "milagre_x2") direto na tela do overlay — o mesmo dado que a web ja
 * traduz pra "1 desgraça"/"2 milagres".
 */
private val OUTCOME_LABELS: Map<String, String> = mapOf(
    "strong_hit" to "sucesso completo",
    "weak_hit" to "sucesso parcial",
    "miss" to "falha",
    "match" to "match!",
    "critical" to "crítico",
    "full_success" to "sucesso total",
    "partial_success" to "sucesso parcial",
    // fate
    "success_with_style" to "sucesso com estilo",
    "success" to "sucesso",
    "tie" to "empate",
    "fail" to "falha",
    // d20
    "critical_success" to "acerto crítico",
    "critical_failure" to "falha crítica",
    // d100 (BRP)
    "extreme_success" to "sucesso extremo",
    "hard_success" to "sucesso difícil",
    "regular_success" to "sucesso",
    "fumble" to "desastre",
    // infaernum — sim ou nao
    "sim" to "sim",
    "nao" to "não",
    // infaernum — rolagem padrao (3d6 individual, quantizado)
    "desgraca_x1" to "1 desgraça",
    "desgraca_x2" to "2 desgraças",
    "desgraca_x3" to "3 desgraças",
    "vislumbre_x1" to "1 vislumbre",
    "vislumbre_x2" to "2 vislumbres",
    "vislumbre_x3" to "3 vislumbres",
    "facanha_x1" to "1 façanha",
    "facanha_x2" to "2 façanhas",
    "facanha_x3" to "3 façanhas",
    "milagre_x1" to "1 milagre",
    "milagre_x2" to "2 milagres",
    "milagre_x3" to "3 milagres",
    // wod5
    "messy_critical" to "crítico manchado",
    "bestial_failure" to "fracasso bestial",
    // pool_d6 (Shadowrun-style)
    "glitch" to "pane",
    "critical_glitch" to "pane crítica",
    // fractal — pool de d6, maior dado decide. success/fail reusam fate/pool_d6
    // (ja mapeados acima). Impulso conta os seis alem do primeiro; ruptura
    // conta os dados em 1 (evento paralelo, nunca outcome primario).
    "sucesso_impulso_x2" to "sucesso com 1 impulso extra",
    "sucesso_impulso_x3" to "sucesso com 2 impulsos extras",
    "sucesso_impulso_x4" to "sucesso com 3 impulsos extras",
    "ruptura_x1" to "ruptura: 1 fato quebrado",
    "ruptura_x2" to "ruptura: 2 fatos quebrados",
    "ruptura_x3" to "ruptura: 3 fatos quebrados",
    "ruptura_x4" to "ruptura: 4 fatos quebrados",
)

fun outcomeLabel(outcome: String): String = OUTCOME_LABELS[outcome] ?: outcome
