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
        assertEquals("2d6+1 [6, 6] + 1 = 13 — sucesso completo", OverlayService.formatResult(json))
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

    /** Ironsworn: ambos os grupos (acao vs desafio) aparecem, e match traduz pra combinacao. */
    @Test
    fun `match do ironsworn aparece junto do hit com ambos os grupos`() {
        val json = """{"notation":"{1d6+2} vs {2d10}",
            "groups":{"action":{"rolls":[4],"modifier":2,"total":6},
            "challenge":{"rolls":[5,5]}},
            "outcome":"strong_hit","outcome_flags":["strong_hit","match"]}"""
        assertEquals(
            "{1d6+2} vs {2d10} [4] + 2 = 6 vs [5, 5] — sucesso completo, combinação!",
            OverlayService.formatResult(json),
        )
    }

    /** Firelights: acao (dados) vs desafio (cartas de baralho formatadas). */
    @Test
    fun `firelights formata cartas do desafio e dados da acao`() {
        val json = """{"notation":"{2d6+1} vs {2c}",
            "groups":{"action":{"rolls":[6,4],"modifier":1,"total":11},
            "challenge":{"rolls":[11,4]}},
            "outcome":"weak_hit","outcome_flags":["weak_hit"]}"""
        assertEquals(
            "{2d6+1} vs {2c} [6, 4] + 1 = 11 vs [J♣, 4♦] — sucesso parcial",
            OverlayService.formatResult(json),
        )
    }

    /** roll_under: "tested" traz o valor testado, que nao mora em nenhum
     *  grupo/dado — sem isto "sucesso" nao dizia contra o que. */
    @Test
    fun `tested aparece entre parenteses no fim`() {
        val json = """{"notation":"1d20","groups":{"roll":{"rolls":[8],"total":8}},
            "outcome":"success","outcome_flags":["success"],
            "tested":[{"label":"Valor testado","value":10}]}"""
        assertEquals(
            "1d20 [8] = 8 — sucesso (Valor testado: 10)",
            OverlayService.formatResult(json),
        )
    }

    @Test
    fun `sem outcome nao aparece traco nenhum`() {
        val json = """{"notation":"2d6","groups":{"roll":{"rolls":[3,4]}}}"""
        assertEquals("2d6 [3, 4] = 7", OverlayService.formatResult(json))
    }

    @Test
    fun `formatDeckDrawAction formata contagem e naipes`() {
        val json = """[{"id":"10-hearts","rank":"10","suit":"hearts"},{"id":"K-spades","rank":"K","suit":"spades"}]"""
        assertEquals("puxou 2 cartas: 10♥, K♠", OverlayService.formatDeckDrawAction(json))
    }

    @Test
    fun `json quebrado nao derruba, so mostra o texto cru`() {
        assertEquals("nao e json", OverlayService.formatResult("nao e json"))
    }
}
