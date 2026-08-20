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
    // year zero: dano, panico e descontrole vem JUNTO do sucesso/falha, mas
    // nenhum e ambiguo do jeito que o "match" do Ironsworn e — sao preju,
    // ponto. Neutro os deixava com a cor de acento (verde), e "2 danos de
    // atributo" ficava com a mesma cara de um acerto.
    "yze_dano_atributo_x1",
    "yze_dano_atributo_x2",
    "yze_dano_atributo_x3",
    "yze_dano_equipamento_x1",
    "yze_dano_equipamento_x2",
    "yze_dano_equipamento_x3",
    "yze_panico",
    "yze_descontrole",
    // trophy
    "trophy_ruina_aumenta",
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
    // fractal: impulso e sucesso "mais forte", mesma cor do sucesso normal —
    // igual critical_success do d20, a distincao e so no texto do label.
    "sucesso_impulso_x2",
    "sucesso_impulso_x3",
    "sucesso_impulso_x4",
)

/**
 * Tom de um id de outcome. `match` (Ironsworn: dados de desafio iguais) e
 * `ruptura_x1`..`x4` (fractal: Fato quebrado) sao eventos que podem vir
 * junto de acerto OU de falha — ficam neutros de proposito, caindo no
 * `else` abaixo (nao precisam de set proprio, ja que nao concorrem com
 * FAILURE/PARTIAL/SUCCESS).
 */
fun outcomeTone(outcome: String): OutcomeTone = when (outcome) {
    in FAILURE -> OutcomeTone.FAILURE
    in PARTIAL -> OutcomeTone.PARTIAL
    in SUCCESS -> OutcomeTone.SUCCESS
    else -> OutcomeTone.NEUTRAL
}
