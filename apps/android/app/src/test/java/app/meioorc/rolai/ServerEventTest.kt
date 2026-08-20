package app.meioorc.rolai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Leitura dos eventos do backend (services/backend/app/schemas.py).
 *
 * Estava inline no `onMessage`, a 0%. É o tipo de código que apodrece calado
 * quando o contrato muda: o `smoke_ws.py` ficou meses quebrado porque o
 * roster deixou de ser lista de strings e virou lista de objetos, e ninguém
 * percebeu até tentar rodá-lo.
 */
class ServerEventTest {

    @Test
    fun `snapshot le os nomes do roster de OBJETOS`() {
        // O formato que quebrou o smoke: {name, style}, não string solta.
        val json = """{"type":"snapshot","roster":[{"name":"ana","style":null},
            {"name":"bia"}],"history":[]}"""
        val e = ServerEvent.parse(json) as ServerEvent.Snapshot
        assertEquals(listOf("ana", "bia"), e.memberNames)
    }

    @Test
    fun `roster sem membros vira lista vazia`() {
        val e = ServerEvent.parse("""{"type":"roster","roster":[]}""") as ServerEvent.Roster
        assertTrue(e.memberNames.isEmpty())
    }

    @Test
    fun `roster ausente nao estoura`() {
        val e = ServerEvent.parse("""{"type":"roster"}""") as ServerEvent.Roster
        assertTrue(e.memberNames.isEmpty())
    }

    @Test
    fun `roll carrega resultado e a aparencia de quem rolou`() {
        val json = """{"type":"roll","player":"ana",
            "result":{"notation":"2d6","groups":{"roll":{"rolls":[3,4]}}},
            "style":{"body":"#aa1122"},
            "styles":{"1":{"body":"#aa1122"}}}"""
        val e = ServerEvent.parse(json) as ServerEvent.Roll
        assertEquals("ana", e.player)
        assertTrue(e.resultJson.contains("2d6"))
        assertTrue(e.styleJson!!.contains("aa1122"))
        assertTrue(e.stylesJson!!.contains("aa1122"))
    }

    @Test
    fun `roll sem estilo tem estilo nulo, nao string vazia`() {
        val json = """{"type":"roll","player":"ana","result":{"notation":"2d6"}}"""
        val e = ServerEvent.parse(json) as ServerEvent.Roll
        assertNull(e.styleJson)
        assertNull(e.stylesJson)
    }

    @Test
    fun `roll sem result e descartado`() {
        // Sem resultado não há o que animar; ignorar é melhor que empurrar
        // lixo pro palco.
        assertNull(ServerEvent.parse("""{"type":"roll","player":"ana"}"""))
    }

    @Test
    fun `deck_draw carrega cartas e o que sobrou`() {
        val json = """{"type":"deck_draw","player":"bia",
            "cards":[{"id":"as","rank":"A","suit":"spades"}],"remaining":51}"""
        val e = ServerEvent.parse(json) as ServerEvent.DeckDraw
        assertEquals("bia", e.player)
        assertEquals(51, e.remaining)
        assertTrue(e.cardsJson.contains("spades"))
    }

    @Test
    fun `deck_draw sem cartas e descartado`() {
        assertNull(ServerEvent.parse("""{"type":"deck_draw","player":"bia"}"""))
    }

    @Test
    fun `deck_shuffle so precisa de quem operou`() {
        val e = ServerEvent.parse("""{"type":"deck_shuffle","player":"ana"}""")
        assertEquals("ana", (e as ServerEvent.DeckShuffle).player)
    }

    @Test
    fun `deck_config distingue ausente de false`() {
        // Só o que mudou vem no evento. Ausente tem que virar null, senão
        // um "sem curinga" que ninguém pediu seria aplicado por engano.
        val json = """{"type":"deck_config","player":"ana","include_jokers":false}"""
        val e = ServerEvent.parse(json) as ServerEvent.DeckConfig
        assertEquals(false, e.includeJokers)
        assertNull(e.removalMode)
        assertNull(e.autoReshuffleOnEmpty)
    }

    @Test
    fun `deck_config com os tres campos`() {
        val json = """{"type":"deck_config","player":"ana","include_jokers":true,
            "removal_mode":"returns","auto_reshuffle_on_empty":true}"""
        val e = ServerEvent.parse(json) as ServerEvent.DeckConfig
        assertEquals(true, e.includeJokers)
        assertEquals("returns", e.removalMode)
        assertEquals(true, e.autoReshuffleOnEmpty)
    }

    @Test
    fun `error usa a mensagem do servidor`() {
        val e = ServerEvent.parse("""{"type":"error","message":"rate_limit_exceeded"}""")
        assertEquals("rate_limit_exceeded", (e as ServerEvent.Error).message)
    }

    @Test
    fun `error sem mensagem tem texto de reserva`() {
        val e = ServerEvent.parse("""{"type":"error"}""") as ServerEvent.Error
        assertTrue(e.message.isNotEmpty())
    }

    @Test
    fun `ping e reconhecido`() {
        assertEquals(ServerEvent.Ping, ServerEvent.parse("""{"type":"ping"}"""))
    }

    @Test
    fun `json invalido nao derruba a conexao`() {
        assertNull(ServerEvent.parse("nao e json"))
        assertNull(ServerEvent.parse(""))
    }

    @Test
    fun `tipo desconhecido e ignorado em silencio`() {
        // Servidor mais novo que o APK: ignorar é melhor que cair.
        assertNull(ServerEvent.parse("""{"type":"evento_do_futuro","x":1}"""))
        assertNull(ServerEvent.parse("""{"sem":"tipo"}"""))
    }
}
