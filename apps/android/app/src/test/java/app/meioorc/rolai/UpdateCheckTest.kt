package app.meioorc.rolai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Comparacao de versao e leitura da resposta da API de Releases. Logica pura
 * — a parte de rede nao entra aqui.
 */
class UpdateCheckTest {

    @Test
    fun `tira o v e o sufixo da tag`() {
        assertEquals("0.12.4", UpdateCheck.normalize("v0.12.4"))
        assertEquals("0.12.4", UpdateCheck.normalize(" 0.12.4 "))
        assertEquals("1.0.0", UpdateCheck.normalize("v1.0.0-beta2"))
    }

    @Test
    fun `versao maior e reconhecida`() {
        assertTrue(UpdateCheck.isNewer("0.12.4", "v0.12.5"))
        assertTrue(UpdateCheck.isNewer("0.12.4", "v0.13.0"))
        assertTrue(UpdateCheck.isNewer("0.12.4", "v1.0.0"))
    }

    @Test
    fun `mesma versao ou mais velha nao avisa`() {
        assertFalse(UpdateCheck.isNewer("0.12.4", "v0.12.4"))
        assertFalse(UpdateCheck.isNewer("0.12.4", "v0.12.3"))
        assertFalse(UpdateCheck.isNewer("0.12.4", "v0.11.9"))
    }

    /**
     * O bug que a comparacao por string traria: alfabeticamente "0.9.0" e
     * MAIOR que "0.12.0". O projeto ja passou da 0.9, entao o app estaria
     * mandando "atualizar" pra uma versao mais velha.
     */
    @Test
    fun `compara campo a campo como numero, nao como texto`() {
        assertTrue(UpdateCheck.isNewer("0.9.0", "v0.12.0"))
        assertFalse(UpdateCheck.isNewer("0.12.0", "v0.9.0"))
        assertTrue(UpdateCheck.isNewer("0.12.9", "v0.12.10"))
    }

    @Test
    fun `versao com menos campos vale como zero`() {
        assertFalse(UpdateCheck.isNewer("0.13.0", "v0.13"))
        assertTrue(UpdateCheck.isNewer("0.13", "v0.13.1"))
    }

    @Test
    fun `le tag e pagina da resposta da API`() {
        val release = UpdateCheck.parseLatest(
            """
            {"tag_name":"v0.12.5",
             "html_url":"https://github.com/SergioSJS/rolai/releases/tag/v0.12.5"}
            """.trimIndent(),
        )
        assertEquals("0.12.5", release?.version)
        assertEquals("https://github.com/SergioSJS/rolai/releases/tag/v0.12.5", release?.pageUrl)
    }

    /** Sem release, JSON de erro do GitHub ou corpo vazio: nao ha aviso. */
    @Test
    fun `resposta sem tag nao vira aviso`() {
        assertNull(UpdateCheck.parseLatest(""))
        assertNull(UpdateCheck.parseLatest("""{"message":"Not Found"}"""))
        assertNull(UpdateCheck.parseLatest("nao e json"))
    }

    /** Tag sem html_url ainda leva a pessoa pra lista de Releases. */
    @Test
    fun `sem html_url cai na lista de releases`() {
        val release = UpdateCheck.parseLatest("""{"tag_name":"v0.13.0"}""")
        assertEquals("https://github.com/SergioSJS/rolai/releases", release?.pageUrl)
    }
}
