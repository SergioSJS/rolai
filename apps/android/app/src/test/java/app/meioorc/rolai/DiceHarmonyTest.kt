package app.meioorc.rolai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Harmonia da aparencia do dado. Roda na JVM com o Color stubado pelo
 * unitTests.isReturnDefaultValues — por isso o teste checa REGRAS
 * (contraste, escurecer/clarear), nao valores hex exatos.
 */
class DiceHarmonyTest {

    @Test
    fun `numero e claro em corpo escuro e escuro em corpo claro`() {
        assertEquals("#f4f7f5", DiceHarmony.numberFor("#14181c"))
        assertEquals("#f4f7f5", DiceHarmony.numberFor("#22307a"))
        assertEquals("#14181c", DiceHarmony.numberFor("#ffffff"))
        assertEquals("#14181c", DiceHarmony.numberFor("#e8e0cd"))
    }

    @Test
    fun `luminancia manda, nao o canal mais alto`() {
        // Azul puro tem canal 255 mas luminancia baixissima (0.07) -> numero
        // claro. Ciano claro tem os mesmos 255 no B e luminancia alta ->
        // numero escuro. Brilho ingenuo (max de canal) erraria os dois.
        assertEquals("#f4f7f5", DiceHarmony.numberFor("#0000ff"))
        assertEquals("#14181c", DiceHarmony.numberFor("#7fd4c8"))
    }

    @Test
    fun `contorno escurece corpo claro e clareia corpo quase preto`() {
        assertTrue(DiceHarmony.luminance(DiceHarmony.outlineFor("#1d9e75")) < DiceHarmony.luminance("#1d9e75"))
        assertTrue(DiceHarmony.luminance(DiceHarmony.outlineFor("#05070a")) > DiceHarmony.luminance("#05070a"))
    }

    @Test
    fun `hex invalido nao explode`() {
        assertEquals("#f4f7f5", DiceHarmony.numberFor("nao-e-cor"))
        assertTrue(DiceHarmony.outlineFor("nao-e-cor").startsWith("#"))
    }
}
