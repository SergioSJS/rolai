package app.meioorc.rolai

/**
 * Tom do resultado (sucesso / meio-termo / falha) pro overlay pintar falha de
 * vermelho, em vez de tudo sair com a mesma cara.
 *
 * Nao e regra: quem decide o outcome sao as `outcome_rules` do profile,
 * calculadas pela WebView headless (AGENTS.md — o motor nunca e duplicado
 * em Kotlin). Aqui e so APRESENTACAO, e a lista de ids vem GERADA de
 * `apps/web/src/format.ts` (ver OutcomeCatalog.kt).
 *
 * Desconhecido cai em [NEUTRAL]: se um profile novo trouxer um outcome que
 * o catalogo nao conhece, o pior que acontece e a linha ficar na cor normal
 * — nunca uma falha pintada de verde.
 */
enum class OutcomeTone { SUCCESS, PARTIAL, FAILURE, NEUTRAL }

/**
 * Tom de um id de outcome. `match` (Ironsworn: dados de desafio iguais) e
 * `ruptura_x1`..`x4` (fractal: Fato quebrado) sao eventos que podem vir
 * junto de acerto OU de falha — ficam neutros de proposito, e por isso o
 * catalogo nem os lista (so entra quem tem tom declarado).
 */
fun outcomeTone(outcome: String): OutcomeTone = when (outcome) {
    in OutcomeCatalog.FAILURE -> OutcomeTone.FAILURE
    in OutcomeCatalog.PARTIAL -> OutcomeTone.PARTIAL
    in OutcomeCatalog.SUCCESS -> OutcomeTone.SUCCESS
    else -> OutcomeTone.NEUTRAL
}
