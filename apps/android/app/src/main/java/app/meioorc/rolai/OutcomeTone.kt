package app.meioorc.rolai

/**
 * Tom do resultado (sucesso / meio-termo / falha) pro overlay pintar falha de
 * vermelho, em vez de tudo sair com a mesma cara.
 *
 * Espelha `outcomeTone` de `apps/web/src/format.ts`. Nao e regra: quem decide
 * o outcome sao as `outcome_rules` do profile, calculadas pela WebView
 * headless (AGENTS.md — o motor nunca e duplicado em Kotlin). Aqui e so
 * APRESENTACAO, e o que esta duplicado e uma lista de ids conhecidos.
 *
 * Por isso o desconhecido cai em [NEUTRAL]: se um profile novo trouxer um
 * outcome que este arquivo nao conhece, o pior que acontece e a linha ficar
 * na cor normal — nunca uma falha pintada de verde.
 */
enum class OutcomeTone { SUCCESS, PARTIAL, FAILURE, NEUTRAL }

private val FAILURE = setOf(
    "miss",
    "fail",
    "critical_failure",
    "fumble",
    // wod5: fracasso com custo extra — ainda fracasso.
    "bestial_failure",
    // pool_d6 (Shadowrun-style): glitch e sempre reves, mesmo o nao-critico.
    "glitch",
    "critical_glitch",
    // Infaernum (3d6 individual): desgraca e sempre o lado ruim, em qualquer
    // quantidade.
    "desgraca_x1",
    "desgraca_x2",
    "desgraca_x3",
    // Infaernum — oraculo sim ou não.
    "nao",
)

private val PARTIAL = setOf(
    "weak_hit",
    "partial_success",
    "tie",
    "vislumbre_x1",
    "vislumbre_x2",
    "vislumbre_x3",
)

private val SUCCESS = setOf(
    "strong_hit",
    "full_success",
    "success",
    "success_with_style",
    "critical_success",
    "critical",
    "extreme_success",
    "hard_success",
    "regular_success",
    "facanha_x1",
    "facanha_x2",
    "facanha_x3",
    "milagre_x1",
    "milagre_x2",
    "milagre_x3",
    // wod5: critico "sujo" — ainda um sucesso, so com custo narrativo.
    "messy_critical",
    // Infaernum — oraculo sim ou não.
    "sim",
)

/**
 * Tom de um id de outcome. `match` (Ironsworn: dados de desafio iguais) e
 * evento, pode vir junto de acerto OU de falha — fica neutro de proposito.
 */
fun outcomeTone(outcome: String): OutcomeTone = when (outcome) {
    in FAILURE -> OutcomeTone.FAILURE
    in PARTIAL -> OutcomeTone.PARTIAL
    in SUCCESS -> OutcomeTone.SUCCESS
    else -> OutcomeTone.NEUTRAL
}
