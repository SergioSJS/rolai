package app.meioorc.rolai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
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
            "{1d6+2} vs {2d10} ação [4] + 2 = 6 vs desafio [5, 5] — sucesso completo, combinação!",
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
            "{2d6+1} vs {2c} ação [6, 4] + 1 = 11 vs desafio [J♣, 4♦] — sucesso parcial",
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

    /**
     * Year Zero / Forbidden Lands: tres pools de d6 iguais. Sem o nome do
     * grupo, eram tres listas anonimas e nao dava pra saber qual "= 1" veio
     * de onde. O pool vazio ("0d6", forcada sem dado sobrando) sai como "—"
     * — o "[]" de antes parecia bug.
     */
    @Test
    fun `year zero mostra o nome de cada pool e marca o pool vazio`() {
        val json = """{"notation":"{2d6+1} + {0d6} + {1d6}",
            "groups":{"base":{"rolls":[6,2],"modifier":1,"total":2},
            "pericia":{"rolls":[],"total":0},
            "equipamento":{"rolls":[1],"total":0}},
            "outcome":"success","outcome_flags":["success","yze_dano_equipamento_x1"]}"""
        assertEquals(
            "{2d6+1} + {0d6} + {1d6} base [6, 2] + 1 = 2 + perícia — = 0 + " +
                "equipamento [1] = 0 — sucesso, 1 dano de equipamento",
            OverlayService.formatResult(json),
        )
    }

    /** Dano do Year Zero e preju, mesmo numa rolagem que acertou: o tom da
     *  LINHA continua vindo do outcome principal, mas o label do dano tem que
     *  existir (sem ele, "yze_dano_atributo_x2" cru ia pra tela). */
    @Test
    fun `labels do year zero traduzem dano, panico e descontrole`() {
        assertEquals("2 danos de atributo", outcomeLabel("yze_dano_atributo_x2"))
        assertEquals("3+ danos de equipamento", outcomeLabel("yze_dano_equipamento_x3"))
        assertEquals("pânico!", outcomeLabel("yze_panico"))
        assertEquals("descontrole!", outcomeLabel("yze_descontrole"))
        assertEquals(OutcomeTone.FAILURE, outcomeTone("yze_dano_atributo_x1"))
        assertEquals(OutcomeTone.FAILURE, outcomeTone("yze_panico"))
        assertEquals(OutcomeTone.FAILURE, outcomeTone("yze_descontrole"))
    }

    /**
     * Minimizar o painel depois de um Forçar nao pode invalidar o "repetir
     * ultima rolagem": o formulario volta SEM os campos "push_*" (eles nao
     * aparecem na tela), e comparar cru dizia "o jogador mexeu nos campos".
     */
    @Test
    fun `escrituracao do forcar sobrevive ao fechar o painel`() {
        val form = """{"base":5,"pericia":0,"equipamento":0,"sucessos_anteriores":2,"dificuldade":1}"""
        val salvo = """{"base":5,"pericia":0,"equipamento":0,"sucessos_anteriores":2,
            "dificuldade":1,"push_banes_base":1,"push_banes_equip":0}"""
        val merged = OverlayService.mergePushBookkeeping(form, salvo)
        assertTrue(OverlayService.sameInputs(merged, salvo))
    }

    /** Mexer num campo de verdade continua contando como mudanca. */
    @Test
    fun `campo editado ainda conta como mudanca`() {
        val form = """{"base":3,"pericia":0,"equipamento":0,"sucessos_anteriores":2,"dificuldade":1}"""
        val salvo = """{"base":5,"pericia":0,"equipamento":0,"sucessos_anteriores":2,
            "dificuldade":1,"push_banes_base":1}"""
        val merged = OverlayService.mergePushBookkeeping(form, salvo)
        assertFalse(OverlayService.sameInputs(merged, salvo))
    }

    /** Ordem de chave em JSON nao e conteudo diferente. */
    @Test
    fun `mesma coisa em outra ordem nao e mudanca`() {
        assertTrue(
            OverlayService.sameInputs(
                """{"base":5,"dificuldade":1}""",
                """{"dificuldade":1,"base":5}""",
            ),
        )
    }
}
