package app.meioorc.rolai

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * O compositor de chips do overlay. Era `String -> String` preso dentro de
 * 1100 linhas de construção de UI, e a 1.2.0 corrigiu "compositor apagava
 * notação de slot ao clicar botão de dado (1[d20])" sem deixar nada que
 * impedisse a volta. Este arquivo é esse "nada".
 */
class NotationComposerTest {

    // ---------- somar ----------

    @Test
    fun `primeiro dado numa notacao vazia`() {
        assertEquals("1d20", NotationComposer.addDie("", "20"))
        assertEquals("1dF", NotationComposer.addDie("", "F"))
        assertEquals("1c", NotationComposer.addDie("", "C"))
    }

    @Test
    fun `dado do mesmo tipo incrementa em vez de repetir`() {
        assertEquals("3d6", NotationComposer.addDie("2d6", "6"))
        assertEquals("2c", NotationComposer.addDie("1c", "C"))
        assertEquals("2dF", NotationComposer.addDie("1dF", "F"))
    }

    @Test
    fun `dado de outro tipo entra somando`() {
        assertEquals("2d6+1d4", NotationComposer.addDie("2d6", "4"))
    }

    // REGRESSAO 1.2.0: um toque no d6 com "1[2d6]" na tela virava "1d6",
    // apagando o slot inteiro.
    @Test
    fun `soma DENTRO do slot de cor, sem apagar o slot`() {
        assertEquals("1[3d6]", NotationComposer.addDie("1[2d6]", "6"))
        assertEquals("2[2d6+1d4]", NotationComposer.addDie("2[2d6]", "4"))
    }

    @Test
    fun `soma no ultimo slot quando ha mais de um`() {
        assertEquals("1[2d6] + 2[2d20]", NotationComposer.addDie("1[2d6] + 2[1d20]", "20"))
    }

    @Test
    fun `slot recem aberto recebe o dado ja fechando`() {
        assertEquals("1[1d6]", NotationComposer.addDie("1[", "6"))
        assertEquals("2d6 + 3[1d4]", NotationComposer.addDie("2d6 + 3[", "4"))
    }

    @Test
    fun `grupo recem aberto fecha com chave`() {
        assertEquals("{2d6} vs {1d20}", NotationComposer.addDie("{2d6} vs {", "20"))
    }

    @Test
    fun `operador pendente ganha o dado depois dele`() {
        assertEquals("2d6 + 1d4", NotationComposer.addDie("2d6 +", "4"))
        assertEquals("2d6+ 1d4", NotationComposer.addDie("2d6+", "4"))
    }

    @Test
    fun `vs pendente ganha o dado depois dele`() {
        assertEquals("2d6 vs 1d20", NotationComposer.addDie("2d6 vs", "20"))
    }

    @Test
    fun `d66 nao e confundido com d6`() {
        // "2d6" e "2d66" convivem: o \b do padrão é o que separa os dois.
        assertEquals("2d66+1d6", NotationComposer.addDie("2d66", "6"))
        assertEquals("3d66", NotationComposer.addDie("2d66", "66"))
    }

    // ---------- remover ----------

    @Test
    fun `remover decrementa`() {
        assertEquals("2d6", NotationComposer.removeDie("3d6", "6"))
    }

    @Test
    fun `remover o ultimo tira o termo e remenda a soma`() {
        assertEquals("2d6", NotationComposer.removeDie("2d6+1d4", "4"))
        assertEquals("", NotationComposer.removeDie("1d6", "6"))
    }

    @Test
    fun `remover dado que nao esta la nao mexe em nada`() {
        assertEquals("2d6", NotationComposer.removeDie("2d6", "20"))
    }

    @Test
    fun `remover de notacao vazia devolve vazio`() {
        assertEquals("", NotationComposer.removeDie("", "6"))
    }

    @Test
    fun `esvaziar o slot tira o slot junto`() {
        // "1[]" na tela seria lixo.
        assertEquals("", NotationComposer.removeDie("1[1d6]", "6"))
        assertEquals("2d6", NotationComposer.removeDie("2d6 + 1[1d4]", "4"))
    }

    @Test
    fun `remover dentro do slot mantendo o resto`() {
        assertEquals("1[1d6]", NotationComposer.removeDie("1[2d6]", "6"))
    }

    // ---------- contagem dos chips ----------

    @Test
    fun `conta o total de cada tipo, somando slots`() {
        val c = NotationComposer.countsByKey("1[2d6] + 2[3d6] + 1d20", listOf("6", "20", "4"))
        assertEquals(5, c["6"])
        assertEquals(1, c["20"])
        assertEquals(0, c["4"])
    }

    @Test
    fun `conta carta e fudge`() {
        val c = NotationComposer.countsByKey("2c+1dF", listOf("C", "F"))
        assertEquals(2, c["C"])
        assertEquals(1, c["F"])
    }

    @Test
    fun `somar e remover volta ao ponto de partida`() {
        for (inicial in listOf("2d6", "1[2d6]", "2d6+1d4", "{2d6} vs {1d20}")) {
            val ida = NotationComposer.addDie(inicial, "6")
            assertEquals(inicial, NotationComposer.removeDie(ida, "6"))
        }
    }
}
