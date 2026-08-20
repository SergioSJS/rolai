package app.meioorc.rolai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A máquina de estado que o AGENTS.md registra como tendo voltado
 * "disfarçada de bug novo umas quatro vezes": o que a mini-bolha do fan
 * repete, e quando isso deixa de valer.
 *
 * Era um `(() -> Unit)?` escrito em 10 lugares e zerado em 4, sem nada
 * observável de fora. Cada caso abaixo corresponde a uma das formas com que
 * o bug já apareceu.
 */
class LastRollTest {

    // ---------- o que sobrevive a um restart do processo ----------

    @Test
    fun `notacao crua persiste`() {
        assertEquals("2d6+1", LastRoll.persisted(LastRoll.Action.Notation("2d6+1")))
    }

    @Test
    fun `overlay NAO persiste`() {
        // KEY_LAST_ROLL só sabe repetir por roll(notation) cru, sem avaliar
        // outcome_rules — repetir um roll_under assim daria número sem
        // desfecho, parecendo certo. Melhor reabrir o compositor.
        val acao = LastRoll.Action.Overlay("roll_under", "1d20", """{"target":12}""")
        assertNull(LastRoll.persisted(acao))
    }

    @Test
    fun `profile NAO persiste`() {
        val acao = LastRoll.Action.Profile("wod5", """{"regular":3}""")
        assertNull(LastRoll.persisted(acao))
    }

    @Test
    fun `carta NAO persiste`() {
        assertNull(LastRoll.persisted(LastRoll.Action.DeckDraw(2)))
    }

    @Test
    fun `sem rolagem nao persiste nada`() {
        assertNull(LastRoll.persisted(null))
    }

    // ---------- assinatura da rolagem configurada ----------

    @Test
    fun `quickKey muda quando o sistema muda`() {
        val antes = LastRoll.quickKey("", "2d6", "{}")
        val depois = LastRoll.quickKey("wod5", "2d6", "{}")
        assertTrue(antes != depois)
    }

    @Test
    fun `quickKey muda quando a notacao configurada muda`() {
        assertTrue(LastRoll.quickKey("", "2d6", "{}") != LastRoll.quickKey("", "1d20", "{}"))
    }

    @Test
    fun `quickKey igual para a mesma configuracao`() {
        assertEquals(
            LastRoll.quickKey("yze_fbl", "", """{"base":3}"""),
            LastRoll.quickKey("yze_fbl", "", """{"base":3}"""),
        )
    }

    // ---------- fechar o painel invalida? ----------

    @Test
    fun `fechar o painel DEPOIS de rolar nao invalida`() {
        // O fluxo normal: abre, rola, minimiza. Invalidar aqui zerava o que
        // o próprio rollWithInputs tinha acabado de registrar, e o botão de
        // repetir voltava a abrir o formulário — o bug clássico.
        val salvos = """{"dificuldade":2,"base":3}"""
        assertFalse(LastRoll.invalidadaPorEdicao(salvos, salvos, null, null))
    }

    @Test
    fun `ordem das chaves nao conta como edicao`() {
        assertFalse(
            LastRoll.invalidadaPorEdicao(
                """{"base":3,"dificuldade":2}""",
                """{"dificuldade":2,"base":3}""",
                null,
                null,
            ),
        )
    }

    @Test
    fun `mudar um campo invalida`() {
        assertTrue(
            LastRoll.invalidadaPorEdicao(
                """{"dificuldade":4}""",
                """{"dificuldade":2}""",
                null,
                null,
            ),
        )
    }

    @Test
    fun `no roll_under, mudar a notacao do compositor invalida`() {
        val inputs = """{"target":12}"""
        assertTrue(LastRoll.invalidadaPorEdicao(inputs, inputs, "2d20", "1d20"))
    }

    @Test
    fun `no roll_under, a MESMA notacao nao invalida`() {
        val inputs = """{"target":12}"""
        assertFalse(LastRoll.invalidadaPorEdicao(inputs, inputs, "1d20", "1d20"))
    }

    @Test
    fun `sistema sem notacao propria ignora o argumento de notacao`() {
        val inputs = """{"regular":3}"""
        assertFalse(LastRoll.invalidadaPorEdicao(inputs, inputs, null, "1d20"))
    }

    @Test
    fun `escrituracao do Forcar nao conta como edicao`() {
        // Os campos push_* não aparecem na tela, então o formulário SEMPRE
        // volta sem eles. O chamador mescla os salvos antes de comparar —
        // sem isso, minimizar depois de um Forçar parecia edição e derrubava
        // o repetir, que é o mesmo bug entrando por outra porta.
        val salvos = """{"base":3,"push_uns_travados":2}"""
        val doForm = """{"base":3}"""
        val mesclado = ResultFormat.mergePushBookkeeping(doForm, salvos)
        assertFalse(LastRoll.invalidadaPorEdicao(mesclado, salvos, null, null))
    }

    @Test
    fun `campo mudado junto de escrituracao do Forcar ainda invalida`() {
        val salvos = """{"base":3,"push_uns_travados":2}"""
        val doForm = """{"base":5}"""
        val mesclado = ResultFormat.mergePushBookkeeping(doForm, salvos)
        assertTrue(LastRoll.invalidadaPorEdicao(mesclado, salvos, null, null))
    }
}
