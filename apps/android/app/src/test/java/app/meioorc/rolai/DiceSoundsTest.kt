package app.meioorc.rolai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/**
 * Ritmo do som da queda e leitura da contagem de dados. O SoundPool em si e
 * Android puro — o que da pra fixar em teste JVM e a dosagem.
 */
class DiceSoundsTest {

    @Test
    fun `um dado bate uma vez, no instante zero`() {
        assertEquals(listOf(0L), DiceSounds.impactDelays(1, Random(1)))
    }

    @Test
    fun `varios dados batem em sequencia, sempre pra frente`() {
        val delays = DiceSounds.impactDelays(3, Random(7))
        assertEquals(3, delays.size)
        assertEquals(0L, delays[0])
        assertTrue("atrasos devem crescer: $delays", delays.zipWithNext().all { it.first < it.second })
    }

    /** Pool grande nao vira metralhadora: o teto vale. */
    @Test
    fun `20 dados nao viram 20 cliques`() {
        assertEquals(DiceSounds.MAX_IMPACTS, DiceSounds.impactDelays(20, Random(3)).size)
    }

    /** Zero ou negativo (JSON estranho) ainda produz um impacto. */
    @Test
    fun `contagem invalida ainda toca uma vez`() {
        assertEquals(1, DiceSounds.impactDelays(0, Random(3)).size)
        assertEquals(1, DiceSounds.impactDelays(-5, Random(3)).size)
    }

    /** Ritmo igualzinho soa a metronomo — o sorteio tem que variar. */
    @Test
    fun `intervalos variam entre rolagens`() {
        val a = DiceSounds.impactDelays(4, Random(1))
        val b = DiceSounds.impactDelays(4, Random(2))
        assertTrue("esperado ritmos diferentes: $a vs $b", a != b)
    }

    /**
     * Volume: piso alto porque o som nao pede foco de audio — a musica de
     * quem estiver ouvindo continua no volume normal, e um impacto fraco
     * precisa ser audivel por cima dela.
     */
    @Test
    fun `volume respeita o piso e o teto`() {
        assertEquals(0.45f, DiceSounds.volumeFor(0f), 0.001f)
        assertEquals(1.0f, DiceSounds.volumeFor(1f), 0.001f)
        // Fora da faixa nao estoura nem silencia.
        assertEquals(0.45f, DiceSounds.volumeFor(-3f), 0.001f)
        assertEquals(1.0f, DiceSounds.volumeFor(9f), 0.001f)
    }

    @Test
    fun `impacto mais forte soa mais alto`() {
        assertTrue(DiceSounds.volumeFor(0.9f) > DiceSounds.volumeFor(0.2f))
    }

    @Test
    fun `conta os dados de todos os grupos do resultado`() {
        val vs = """{"groups":{"action":{"rolls":[4]},"challenge":{"rolls":[7,7]}}}"""
        assertEquals(3, ResultFormat.diceCountOf(vs))
    }

    /** JSON quebrado ou sem grupos: melhor um clique do que silencio. */
    @Test
    fun `resultado sem grupos toca uma vez`() {
        assertEquals(1, ResultFormat.diceCountOf("""{"notation":"2d6"}"""))
        assertEquals(1, ResultFormat.diceCountOf("nao e json"))
    }

    // ---------- carta ----------

    @Test
    fun `uma carta toca uma vez, na hora`() {
        assertEquals(listOf(0L), DiceSounds.cardDelays(1))
    }

    @Test
    fun `cartas da mesma puxada saem em ritmo, nao juntas`() {
        // Tres cartas tocando no mesmo instante viram um estalo so.
        val atrasos = DiceSounds.cardDelays(3)
        assertEquals(3, atrasos.size)
        assertEquals(0L, atrasos[0])
        assertTrue("cada carta depois da anterior", atrasos[1] > atrasos[0])
        assertTrue(atrasos[2] > atrasos[1])
    }

    @Test
    fun `ritmo de carta e fixo, sem sorteio`() {
        // Ao contrario do dado: carta pousando e um gesto so.
        assertEquals(DiceSounds.cardDelays(4), DiceSounds.cardDelays(4))
    }

    @Test
    fun `puxada gigante e capada no teto de vozes do SoundPool`() {
        // Pedir mais que o teto tocaria MENOS, nao mais.
        assertTrue(DiceSounds.cardDelays(50).size <= 6)
    }

    @Test
    fun `contagem invalida ainda toca uma carta`() {
        assertEquals(listOf(0L), DiceSounds.cardDelays(0))
        assertEquals(listOf(0L), DiceSounds.cardDelays(-3))
    }

    @Test
    fun `contagem de cartas do evento da sala`() {
        // Alimenta a dosagem acima; JSON quebrado nao pode silenciar a carta.
        assertEquals(2, ResultFormat.cardCountOf("""[{"rank":"A"},{"rank":"K"}]"""))
        assertEquals(1, ResultFormat.cardCountOf("""[]"""))
        assertEquals(1, ResultFormat.cardCountOf("nao e json"))
    }
}
