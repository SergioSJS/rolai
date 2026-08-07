package app.meioorc.rolai

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Tom do resultado no overlay. Espelha `outcomeTone` do
 * `apps/web/src/format.ts` — se os dois divergirem, o teste aqui nao pega,
 * mas o fallback neutro garante que o pior caso seja "sem cor", nunca uma
 * falha pintada de verde.
 */
class OutcomeToneTest {

    @Test
    fun `falhas dos profiles versionados`() {
        assertEquals(OutcomeTone.FAILURE, outcomeTone("miss"))
        assertEquals(OutcomeTone.FAILURE, outcomeTone("fail"))
        assertEquals(OutcomeTone.FAILURE, outcomeTone("critical_failure"))
        assertEquals(OutcomeTone.FAILURE, outcomeTone("fumble"))
    }

    @Test
    fun `sucesso nao vira falha por conter a palavra`() {
        assertEquals(OutcomeTone.SUCCESS, outcomeTone("success_with_style"))
        assertEquals(OutcomeTone.SUCCESS, outcomeTone("critical_success"))
        assertEquals(OutcomeTone.SUCCESS, outcomeTone("full_success"))
    }

    @Test
    fun `meio-termo nao e nem um nem outro`() {
        assertEquals(OutcomeTone.PARTIAL, outcomeTone("weak_hit"))
        assertEquals(OutcomeTone.PARTIAL, outcomeTone("partial_success"))
        assertEquals(OutcomeTone.PARTIAL, outcomeTone("tie"))
    }

    /** Ironsworn: evento (dados de desafio iguais), pode vir com acerto ou falha. */
    @Test
    fun `match e neutro`() {
        assertEquals(OutcomeTone.NEUTRAL, outcomeTone("match"))
    }

    @Test
    fun `outcome desconhecido fica neutro em vez de chutar`() {
        assertEquals(OutcomeTone.NEUTRAL, outcomeTone("algo_de_profile_custom"))
        assertEquals(OutcomeTone.NEUTRAL, outcomeTone(""))
    }

    @Test
    fun `tom lido do JSON da rolagem`() {
        val falha = """{"notation":"1d20","outcome":"critical_failure"}"""
        assertEquals(OutcomeTone.FAILURE, OverlayService.toneOf(falha))
    }

    /** Rolagem livre nao tem profile, logo nao tem outcome: nada a afirmar. */
    @Test
    fun `rolagem sem outcome e JSON quebrado ficam neutros`() {
        assertEquals(OutcomeTone.NEUTRAL, OverlayService.toneOf("""{"notation":"2d6"}"""))
        assertEquals(OutcomeTone.NEUTRAL, OverlayService.toneOf("nao e json"))
    }
}
