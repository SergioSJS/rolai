package app.meioorc.rolai

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * `formatResult`: uma linha curta pro overlay ("2d6 [3, 4] = 7 — outcome").
 * Sem UI rica pra headline + pills como o apps/web — quando mais de uma
 * `outcome_flags` bate (Infaernum: varias categorias no mesmo 3d6;
 * Ironsworn: "match" junto do hit/miss), a linha mostra TODAS juntas em vez
 * de so a primeira (`outcome`), que escondia o resto sem erro nenhum.
 */
class OverlayServiceFormatTest {

    @Test
    fun `uma so flag mostra so o outcome`() {
        val json = """{"notation":"2d6+1","groups":{"roll":{"rolls":[6,6],"modifier":1,"total":13}},
            "outcome":"strong_hit","outcome_flags":["strong_hit"]}"""
        assertEquals("2d6+1 [6, 6] = 13 — sucesso completo", OverlayService.formatResult(json))
    }

    /** Infaernum padrao (3d6 individual): milagre + desgraca no mesmo pool. */
    @Test
    fun `varias flags juntas, nao so a primeira`() {
        val json = """{"notation":"3d6","groups":{"pool":{"rolls":[1,3,6]}},
            "outcome":"milagre_x1","outcome_flags":["milagre_x1","desgraca_x1","vislumbre_x1"]}"""
        assertEquals(
            "3d6 [1, 3, 6] = 10 — 1 milagre, 1 desgraça, 1 vislumbre",
            OverlayService.formatResult(json),
        )
    }

    /** Ironsworn: "match" e evento independente do hit/miss. */
    @Test
    fun `match do ironsworn aparece junto do hit`() {
        val json = """{"notation":"{1d6+2} vs {2d10}",
            "groups":{"action":{"rolls":[4],"modifier":2,"total":6},
            "challenge":{"rolls":[5,5]}},
            "outcome":"strong_hit","outcome_flags":["strong_hit","match"]}"""
        assertEquals(true, OverlayService.formatResult(json).endsWith("sucesso completo, match!"))
    }

    @Test
    fun `sem outcome nao aparece traco nenhum`() {
        val json = """{"notation":"2d6","groups":{"roll":{"rolls":[3,4]}}}"""
        assertEquals("2d6 [3, 4] = 7", OverlayService.formatResult(json))
    }

    @Test
    fun `json quebrado nao derruba, so mostra o texto cru`() {
        assertEquals("nao e json", OverlayService.formatResult("nao e json"))
    }
}
