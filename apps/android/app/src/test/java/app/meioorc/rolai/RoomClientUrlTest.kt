package app.meioorc.rolai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Validacao de entrada e montagem da URL do handshake — logica pura, roda
 * em JVM local sem SDK. Os mesmos formatos sao conferidos no backend
 * (docs/security.md); validar aqui evita abrir WS fadado a rejeicao.
 */
class RoomClientUrlTest {

    @Test
    fun `codigo de sala segue o formato do backend`() {
        assertTrue(RolaiSettings.isValidRoomCode("a1B2-c3D"))
        assertTrue(RolaiSettings.isValidRoomCode("abcd"))
        assertTrue(RolaiSettings.isValidRoomCode("a_b-c_d".padEnd(32, 'x')))
        assertFalse(RolaiSettings.isValidRoomCode("abc")) // curto demais
        assertFalse(RolaiSettings.isValidRoomCode("a".repeat(33))) // longo demais
        assertFalse(RolaiSettings.isValidRoomCode("tem espaço"))
        assertFalse(RolaiSettings.isValidRoomCode("../etc"))
        assertFalse(RolaiSettings.isValidRoomCode(""))
    }

    @Test
    fun `apelido e cortado no teto do servidor e nunca fica vazio`() {
        assertEquals("sergio", RolaiSettings.sanitizeName("  sergio  "))
        assertEquals(RolaiSettings.DEFAULT_NAME, RolaiSettings.sanitizeName("   "))
        assertEquals(
            "x".repeat(RolaiSettings.MAX_NAME_LENGTH),
            RolaiSettings.sanitizeName("x".repeat(100)),
        )
    }

    @Test
    fun `url do handshake tem path e query corretos`() {
        assertEquals(
            "wss://api.rolai.app/rooms/a1B2-c3D?name=sergio",
            RoomClient.buildHandshakeUrl("wss://api.rolai.app", "a1B2-c3D", "sergio"),
        )
        // Barra final na base nao duplica path.
        assertEquals(
            "wss://api.rolai.app/rooms/a1B2-c3D?name=sergio",
            RoomClient.buildHandshakeUrl("wss://api.rolai.app/", "a1B2-c3D", "sergio"),
        )
        // Apelido vazio vira o default; espacos viram query valida.
        assertEquals(
            "ws://10.0.2.2:8420/rooms/abcd?name=mestre+joao",
            RoomClient.buildHandshakeUrl("ws://10.0.2.2:8420", "abcd", "mestre joao"),
        )
    }

    @Test
    fun `handshake rejeita codigo invalido e base sem ws`() {
        assertThrows(IllegalArgumentException::class.java) {
            RoomClient.buildHandshakeUrl("wss://api.rolai.app", "x", "sergio")
        }
        assertThrows(IllegalArgumentException::class.java) {
            RoomClient.buildHandshakeUrl("https://api.rolai.app", "abcd", "sergio")
        }
    }

    @Test
    fun `base ws valida`() {
        assertTrue(RolaiSettings.isValidWsBaseUrl("wss://api.rolai.app"))
        assertTrue(RolaiSettings.isValidWsBaseUrl("ws://10.0.2.2:8420"))
        assertFalse(RolaiSettings.isValidWsBaseUrl("https://api.rolai.app"))
        assertFalse(RolaiSettings.isValidWsBaseUrl(""))
    }
}
