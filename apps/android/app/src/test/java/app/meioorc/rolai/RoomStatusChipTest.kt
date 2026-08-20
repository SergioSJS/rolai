package app.meioorc.rolai

import app.meioorc.rolai.OverlayService.Companion.RoomState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * O chip de status da tela de configurações: uma tabela de decisão com três
 * entradas (botão ligado, código digitado, estado da conexão) que vivia
 * misturada com ColorStateList dentro de uma Activity a 0% de cobertura.
 *
 * Errar aqui é errar em silêncio: um estado a menos e a pessoa lê "SEM SALA"
 * enquanto está conectada.
 */
class RoomStatusChipTest {

    private fun chip(
        ligado: Boolean = true,
        codigo: String = "",
        estado: RoomState = RoomState.NONE,
        status: String = "",
    ) = RoomStatusChip.de(ligado, codigo, estado, status)

    @Test
    fun `sem overlay e sem codigo e so informacao`() {
        val c = chip(ligado = false)
        assertEquals("SEM SALA", c.rotulo)
        assertEquals(RoomStatusChip.Tom.NEUTRO, c.tom)
        assertTrue(c.detalhe.contains("só neste aparelho"))
    }

    @Test
    fun `codigo salvo com overlay desligado nao acusa a rede`() {
        // Sem Service não há conexão — dizer "SEM CONEXÃO" culparia a rede
        // por uma escolha da pessoa.
        val c = chip(ligado = false, codigo = "Z8LciLxv")
        assertEquals("AGUARDANDO", c.rotulo)
        assertEquals(RoomStatusChip.Tom.ESPERA, c.tom)
        assertTrue(c.detalhe.contains("ative o botão flutuante"))
    }

    @Test
    fun `conectado mostra o codigo e o que o servico publicou`() {
        val c = chip(codigo = "Z8LciLxv", estado = RoomState.CONNECTED, status = "3 na sala")
        assertEquals("CONECTADO", c.rotulo)
        assertEquals(RoomStatusChip.Tom.CONECTADO, c.tom)
        assertEquals("Z8LciLxv · 3 na sala", c.detalhe)
    }

    @Test
    fun `conectado sem texto do servico mostra so o codigo`() {
        val c = chip(codigo = "Z8LciLxv", estado = RoomState.CONNECTED)
        assertEquals("Z8LciLxv", c.detalhe)
    }

    @Test
    fun `conectando e espera, nao problema`() {
        val c = chip(codigo = "Z8LciLxv", estado = RoomState.CONNECTING)
        assertEquals("CONECTANDO…", c.rotulo)
        assertEquals(RoomStatusChip.Tom.ESPERA, c.tom)
    }

    @Test
    fun `erro de conexao e problema`() {
        val c = chip(codigo = "Z8LciLxv", estado = RoomState.ERROR)
        assertEquals("SEM CONEXÃO", c.rotulo)
        assertEquals(RoomStatusChip.Tom.PROBLEMA, c.tom)
    }

    @Test
    fun `overlay ligado sem codigo continua sendo SEM SALA`() {
        val c = chip(ligado = true)
        assertEquals("SEM SALA", c.rotulo)
        assertEquals(RoomStatusChip.Tom.NEUTRO, c.tom)
    }

    @Test
    fun `codigo digitado e servico ainda em NONE acusa falta de conexao`() {
        // Tem código e overlay ligado, mas o Service não reportou nada: é
        // problema, não "sem sala".
        val c = chip(codigo = "Z8LciLxv", estado = RoomState.NONE)
        assertEquals("SEM CONEXÃO", c.rotulo)
        assertEquals(RoomStatusChip.Tom.PROBLEMA, c.tom)
    }

    @Test
    fun `o rotulo sempre vem antes do detalhe`() {
        for (c in listOf(
            chip(ligado = false),
            chip(codigo = "abc12345", estado = RoomState.CONNECTED, status = "2 na sala"),
            chip(codigo = "abc12345", estado = RoomState.ERROR),
        )) {
            assertTrue(c.rotulo.isNotEmpty() && c.detalhe.isNotEmpty())
            assertEquals(c.rotulo, c.rotulo.uppercase())
        }
    }
}
