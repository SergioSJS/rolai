package app.meioorc.rolai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * A regra que fazia o modo salvo sumir sozinho.
 *
 * Bug real, que apareceu duas vezes (Infaernum e depois Year Zero): a
 * familia entra no spinner com o PRIMEIRO member, um modo salvo diferente
 * dele nao esta na lista, `indexOf` da -1, o fallback e "Notação livre" e o
 * `saveFromViews` grava isso por cima. Abrir configuracoes apagava a
 * escolha do jogador. A correcao vivia `private` dentro da Activity, sem
 * teste possivel — agora e funcao pura.
 */
class SystemSpinnerTest {

    private fun info(id: String) = SystemInfo(id, id, emptyList(), "simple")

    // Espelha o que loadSystemsFromAssets monta: indice 0 = notacao livre,
    // depois sistemas soltos, e a familia ocupando UMA posicao.
    private val ids = mutableListOf("", "d20", "yze", "infaernum")
    private val familias = mapOf(
        2 to ProfileFamilies.familyFor("yze")!!,
        3 to ProfileFamilies.familyFor("infaernum")!!,
    )
    private val porId = listOf(
        "d20", "yze", "yze_fbl", "yze_alien", "yze_wdu",
        "infaernum", "infaernum_ideias", "infaernum_sim_ou_nao",
    ).associateWith { info(it) }

    @Test
    fun `sistema solto cai na propria posicao`() {
        val r = SystemSpinner.resolve("d20", ids, familias, porId)
        assertEquals(1, r.position)
        assertNull("nao ha member pra trocar num sistema solto", r.activeMember)
    }

    @Test
    fun `notacao livre e a posicao zero`() {
        assertEquals(0, SystemSpinner.resolve("", ids, familias, porId).position)
    }

    @Test
    fun `primeiro member da familia resolve direto, sem troca`() {
        val r = SystemSpinner.resolve("yze", ids, familias, porId)
        assertEquals(2, r.position)
        assertNull(r.activeMember)
    }

    @Test
    fun `member que NAO e o primeiro acha a familia e vira o valor ativo`() {
        // O caso do bug: "yze_fbl" nao esta em `ids`.
        val r = SystemSpinner.resolve("yze_fbl", ids, familias, porId)
        assertEquals("tem que cair na posicao da familia, nao na 0", 2, r.position)
        assertEquals("yze_fbl", r.activeMember?.system)
    }

    @Test
    fun `vale pra qualquer familia, nao so a primeira`() {
        val r = SystemSpinner.resolve("infaernum_ideias", ids, familias, porId)
        assertEquals(3, r.position)
        assertEquals("infaernum_ideias", r.activeMember?.system)
    }

    @Test
    fun `sistema desconhecido cai na notacao livre`() {
        val r = SystemSpinner.resolve("sistema_que_nao_existe", ids, familias, porId)
        assertEquals(0, r.position)
        assertNull(r.activeMember)
    }

    @Test
    fun `familia conhecida mas fora do spinner cai na notacao livre`() {
        // Trophy existe no catalogo, mas este spinner nao tem posicao pra ela.
        val r = SystemSpinner.resolve("trophy_gold", ids, familias, porId)
        assertEquals(0, r.position)
        assertNull(r.activeMember)
    }

    @Test
    fun `systems_json defasado ainda marca a familia certa`() {
        // O member e conhecido pelo catalogo, mas nao veio no systems.json:
        // melhor a familia certa com o primeiro modo do que "Notação livre".
        val semInfo = porId.filterKeys { it != "yze_alien" }
        val r = SystemSpinner.resolve("yze_alien", ids, familias, semInfo)
        assertEquals(2, r.position)
        assertNull(r.activeMember)
    }
}
