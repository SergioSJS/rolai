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
)

fun outcomeLabel(outcome: String): String = OUTCOME_LABELS[outcome] ?: outcome
