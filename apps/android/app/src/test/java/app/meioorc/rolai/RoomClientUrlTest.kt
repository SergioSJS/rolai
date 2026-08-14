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

/**
 * O `style` no handshake e o que faz a mesa ver o dado deste aparelho com a
 * cor deste aparelho. Sem ele o backend guarda `style: null` e os outros
 * clientes animam a nossa rolagem com a cor DELES.
 */
class HandshakeStyleTest {

    private fun settings(
        body: String = "#B3261E",
        number: String = "#FFE082",
        outline: String = "#000000",
        texture: String = "none",
        material: String = "auto",
    ) = RolaiSettings(
        roomCode = "a1B2-c3D",
        playerName = "sergio",
        notation = "2d6",
        system = "",
        inputsJson = "",
        wsBaseUrl = "wss://api.rolai.app",
        webBaseUrl = "https://rolai.app",
        dicePreset = "",
        diceScalePercent = 100,
        diceBody = body,
        diceNumber = number,
        diceOutline = outline,
        diceTexture = texture,
        diceMaterial = material,
        quality = "",
    )

    @Test
    fun `json bate com o DiceStyle do backend`() {
        val json = org.json.JSONObject(RoomClient.styleJson(settings()))
        assertEquals("#b3261e", json.getString("body"))
        assertEquals("#ffe082", json.getString("number"))
        assertEquals("#000000", json.getString("outline"))
        assertEquals("none", json.getString("texture"))
        assertEquals("auto", json.getString("material"))
        // extra="forbid" no Pydantic: campo a mais derruba o handshake.
        assertEquals(5, json.length())
    }

    @Test
    fun `cor sem cerquilha vira hex valido`() {
        val json = org.json.JSONObject(RoomClient.styleJson(settings(body = "1D9E75")))
        assertEquals("#1d9e75", json.getString("body"))
    }

    @Test
    fun `url do handshake carrega o style`() {
        val url = RoomClient.buildHandshakeUrl(
            "wss://api.rolai.app",
            "a1B2-c3D",
            "sergio",
            settings(),
        )
        assertTrue(url.startsWith("wss://api.rolai.app/rooms/a1B2-c3D?name=sergio&style="))
        assertTrue(url.contains("%23b3261e")) // '#' escapado
    }

    @Test
    fun `sem style a url continua a de antes`() {
        assertEquals(
            "wss://api.rolai.app/rooms/a1B2-c3D?name=sergio",
            RoomClient.buildHandshakeUrl("wss://api.rolai.app", "a1B2-c3D", "sergio"),
        )
    }

    @Test
    fun `base http sai da base ws`() {
        assertEquals("https://api.rolai.app", RolaiSettings.httpBaseUrl("wss://api.rolai.app"))
        assertEquals("http://localhost:8420", RolaiSettings.httpBaseUrl("ws://localhost:8420/"))
    }
}

/**
 * Piso de entropia do codigo escolhido a mao. TERCEIRA copia da regra
 * (backend, web, aqui) — os numeros ficam travados no teste pra que mudar
 * o piso no servidor sem mudar aqui quebre o build, em vez de virar
 * "pode criar" seguido de 4404 na cara do usuario.
 */
class CustomCodeIssueTest {

    @Test
    fun `aceita codigo de mesa fixa`() {
        assertEquals(null, RolaiSettings.customCodeIssue("mesa-do-sergio-2026"))
    }

    @Test
    fun `recusa o que o backend recusa`() {
        assertTrue(RolaiSettings.customCodeIssue("sergio")!!.contains("16"))
        assertTrue(RolaiSettings.customCodeIssue("aaaaaaaaaaaaaaaaaaaa")!!.contains("diferentes"))
        assertTrue(RolaiSettings.customCodeIssue("12341234123412341234")!!.contains("diferentes"))
        assertTrue(RolaiSettings.customCodeIssue("mesa do sergio 2026")!!.contains("apenas"))
        assertEquals("digite um código", RolaiSettings.customCodeIssue("   "))
    }

    @Test
    fun `piso bate com o do backend e do web`() {
        assertEquals(16, RolaiSettings.CUSTOM_CODE_MIN_LENGTH)
        assertEquals(8, RolaiSettings.CUSTOM_CODE_MIN_DISTINCT)
    }
}

/**
 * O "Copiar link"/"Copiar link pro OBS" da web (RoomPanel.tsx) gera a URL
 * inteira, nao so o codigo — colar isso no campo de sala do app tem que
 * funcionar tanto quanto digitar o codigo puro.
 */
class ExtractRoomCodeTest {

    @Test
    fun `codigo puro passa direto`() {
        assertEquals("a1B2-c3D", RolaiSettings.extractRoomCode("a1B2-c3D"))
        assertEquals("a1B2-c3D", RolaiSettings.extractRoomCode("  a1B2-c3D  "))
    }

    @Test
    fun `extrai o codigo do link normal e do link de OBS`() {
        assertEquals(
            "a1B2-c3D",
            RolaiSettings.extractRoomCode("https://rolai.app/?room=a1B2-c3D"),
        )
        assertEquals(
            "a1B2-c3D",
            RolaiSettings.extractRoomCode(
                "https://rolai.app/?room=a1B2-c3D&stream=1&scale=1.6",
            ),
        )
        // Dev local (http, porta, sem stream).
        assertEquals(
            "abcd1234",
            RolaiSettings.extractRoomCode("http://localhost:5273/?room=abcd1234"),
        )
    }

    @Test
    fun `room no meio da query string tambem funciona`() {
        assertEquals(
            "a1B2-c3D",
            RolaiSettings.extractRoomCode("https://rolai.app/?utm=x&room=a1B2-c3D&scale=1"),
        )
    }

    @Test
    fun `codigo com caractere especial vem decodificado`() {
        assertEquals(
            "mesa do sergio",
            RolaiSettings.extractRoomCode("https://rolai.app/?room=mesa+do+sergio"),
        )
    }

    @Test
    fun `link sem parametro room ou sem query devolve a string original`() {
        assertEquals(
            "https://rolai.app/",
            RolaiSettings.extractRoomCode("https://rolai.app/"),
        )
        assertEquals(
            "https://rolai.app/?stream=1",
            RolaiSettings.extractRoomCode("https://rolai.app/?stream=1"),
        )
    }
}

/**
 * Mao inversa do ExtractRoomCodeTest: montar o link que vai pro clipboard
 * (botoes "Copiar link"/"Copiar link pro OBS" da tela de configuracoes).
 */
class RoomShareUrlTest {

    @Test
    fun `link normal leva a base e o codigo`() {
        assertEquals(
            "https://rolai.app/?room=a1B2-c3D",
            RolaiSettings.roomShareUrl("https://rolai.app", "a1B2-c3D"),
        )
        // Barra final na base nao duplica.
        assertEquals(
            "https://rolai.app/?room=a1B2-c3D",
            RolaiSettings.roomShareUrl("https://rolai.app/", "a1B2-c3D"),
        )
    }

    @Test
    fun `base vazia cai no default do buildType`() {
        assertEquals(
            "${RolaiSettings.DEFAULT_WEB_BASE_URL}/?room=abcd1234",
            RolaiSettings.roomShareUrl("", "abcd1234"),
        )
    }

    @Test
    fun `link do OBS leva stream e scale, escala capada na mesma faixa da web`() {
        assertEquals(
            "https://rolai.app/?room=a1B2-c3D&stream=1&scale=1.0",
            RolaiSettings.roomObsShareUrl("https://rolai.app", "a1B2-c3D", 100),
        )
        assertEquals(
            "https://rolai.app/?room=a1B2-c3D&stream=1&scale=1.6",
            RolaiSettings.roomObsShareUrl("https://rolai.app", "a1B2-c3D", 160),
        )
        // Fora da faixa capa pro extremo mais proximo (70..160), no sentido
        // certo — 999 e ALTO demais, cai no teto, nao no piso.
        assertEquals(
            "https://rolai.app/?room=a1B2-c3D&stream=1&scale=1.6",
            RolaiSettings.roomObsShareUrl("https://rolai.app", "a1B2-c3D", 999),
        )
        assertEquals(
            "https://rolai.app/?room=a1B2-c3D&stream=1&scale=0.7",
            RolaiSettings.roomObsShareUrl("https://rolai.app", "a1B2-c3D", 10),
        )
    }
}
