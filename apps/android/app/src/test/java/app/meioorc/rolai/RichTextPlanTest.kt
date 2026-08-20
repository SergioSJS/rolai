package app.meioorc.rolai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Formatacao rica do overlay — a que pinta desfecho, pool e dado.
 *
 * Ate a extracao do RichTextPlan isto era `SpannableStringBuilder` cru
 * dentro da OverlayView, e nao dava pra testar em JVM: com
 * `isReturnDefaultValues = true` o stub do android.jar devolve default em
 * todo metodo de span, entao a unica conferencia possivel era olhar o
 * celular. Como o plano agora e dado puro, a decisao de cor/negrito e
 * verificavel aqui.
 */
class RichTextPlanTest {

    /** Trecho de texto coberto por pelo menos um span com este tom. */
    private fun RichText.toneOver(sub: String): SpanTone? {
        val start = text.indexOf(sub)
        require(start >= 0) { "não achei \"$sub\" em \"$text\"" }
        val end = start + sub.length
        // O ultimo span vence, igual ao setSpan sobreposto do Android.
        return spans.lastOrNull { it.tone != null && it.start <= start && it.end >= end }?.tone
    }

    private fun RichText.boldOver(sub: String): Boolean {
        val start = text.indexOf(sub)
        require(start >= 0) { "não achei \"$sub\" em \"$text\"" }
        val end = start + sub.length
        return spans.any { it.bold && it.start <= start && it.end >= end }
    }

    private fun RichText.scaleOver(sub: String): Float {
        val start = text.indexOf(sub)
        require(start >= 0) { "não achei \"$sub\" em \"$text\"" }
        val end = start + sub.length
        return spans.lastOrNull { it.sizeScale != 1f && it.start <= start && it.end >= end }?.sizeScale ?: 1f
    }

    // ---------- result(): o cartao de resultado ----------

    @Test
    fun `rolagem livre poe o total grande em cor normal`() {
        val json = """{"notation":"2d6","groups":{"roll":{"rolls":[3,4]}}}"""
        val rich = RichTextPlan.result(json)

        assertEquals("7\n2d6 [3, 4] = 7", rich.text)
        assertEquals(SpanTone.DEFAULT, rich.toneOver("7"))
        assertTrue(rich.boldOver("7"))
        assertEquals(1.25f, rich.scaleOver("7"), 0.001f)
    }

    @Test
    fun `falha pinta o headline de vermelho`() {
        val json = """{"notation":"1d20","groups":{"roll":{"rolls":[2],"total":2}},
            "outcome":"critical_failure","outcome_flags":["critical_failure"]}"""
        val rich = RichTextPlan.result(json)

        assertEquals(SpanTone.FAILURE, rich.toneOver("falha crítica"))
        assertEquals(1.1f, rich.scaleOver("falha crítica"), 0.001f)
    }

    @Test
    fun `sucesso parcial usa o tom de meio-termo`() {
        val json = """{"notation":"2d6","groups":{"roll":{"rolls":[3,4],"total":7}},
            "outcome":"weak_hit","outcome_flags":["weak_hit"]}"""
        val rich = RichTextPlan.result(json)

        assertEquals(SpanTone.PARTIAL, rich.toneOver("sucesso parcial"))
    }

    @Test
    fun `varias flags entram separadas por virgula cinza`() {
        val json = """{"notation":"3d6","groups":{"pool":{"rolls":[1,3,6]}},
            "outcome":"milagre_x1","outcome_flags":["milagre_x1","desgraca_x1","vislumbre_x1"]}"""
        val rich = RichTextPlan.result(json)

        assertTrue(rich.text.startsWith("1 milagre, 1 desgraça, 1 vislumbre"))
        assertEquals(SpanTone.MUTED, rich.toneOver(", "))
        // Cada flag carrega o proprio tom: milagre e ganho, desgraça e perda.
        assertEquals(SpanTone.SUCCESS, rich.toneOver("1 milagre"))
        assertEquals(SpanTone.FAILURE, rich.toneOver("1 desgraça"))
    }

    @Test
    fun `parametro testado fica discreto e menor ao lado do headline`() {
        val json = """{"notation":"1d20","groups":{"roll":{"rolls":[8],"total":8}},
            "outcome":"success","outcome_flags":["success"],
            "tested":[{"label":"Valor testado","value":10}]}"""
        val rich = RichTextPlan.result(json)

        assertEquals(SpanTone.MUTED, rich.toneOver("(Valor testado: 10)"))
        assertEquals(0.75f, rich.scaleOver("(Valor testado: 10)"), 0.001f)
    }

    @Test
    fun `pools do forbidden lands ganham a cor do proprio slot`() {
        val json = """{"notation":"{2d6+1} + {0d6} + {1d6}",
            "groups":{"base":{"rolls":[6,2],"modifier":1,"total":2},
            "pericia":{"rolls":[],"total":0},
            "equipamento":{"rolls":[1],"total":0}},
            "outcome":"success","outcome_flags":["success"]}"""
        val rich = RichTextPlan.result(json)

        assertEquals(SpanTone.SLOT_1, rich.toneOver("base"))
        assertEquals(SpanTone.SLOT_2, rich.toneOver("perícia"))
        assertEquals(SpanTone.SLOT_3, rich.toneOver("equipamento"))
        assertTrue(rich.boldOver("base"))
        // O separador entre pools nao compete com os rotulos.
        assertEquals(SpanTone.MUTED, rich.toneOver("•"))
    }

    @Test
    fun `dado seis ou mais brilha e o dez usa o tom de critico`() {
        val json = """{"notation":"{3d10} + {2d10}","profile":"wod5",
            "groups":{"regular":{"rolls":[10,8,3],"total":2},"hunger":{"rolls":[10,1],"total":1}}}"""
        val rich = RichTextPlan.result(json)

        assertEquals(SpanTone.PARTIAL, rich.toneOver("10"))
        assertEquals(SpanTone.SUCCESS, rich.toneOver("8"))
        // 3 nao e acerto: fica sem cor propria, so no negrito do bloco.
        val threeStart = rich.text.indexOf(", 3]") + 2
        assertFalse(rich.spans.any { it.tone != null && it.start == threeStart })
    }

    @Test
    fun `detalhe inteiro entra em corpo menor que o headline`() {
        val json = """{"notation":"2d6","groups":{"roll":{"rolls":[3,4]}}}"""
        val rich = RichTextPlan.result(json)

        assertEquals(0.75f, rich.scaleOver("2d6 [3, 4] = 7"), 0.001f)
    }

    @Test
    fun `json quebrado cai na linha simples em vez de estourar`() {
        val rich = RichTextPlan.result("nao e json")
        assertEquals("nao e json", rich.text)
    }

    // ---------- line(): a linha de historico ----------

    @Test
    fun `nome de quem rolou fica em destaque antes dos dois pontos`() {
        val rich = RichTextPlan.line("Sergio: 2d6 [3, 4] = 7")

        assertEquals(SpanTone.PLAYER, rich.toneOver("Sergio"))
        assertTrue(rich.boldOver("Sergio"))
        assertEquals(SpanTone.MUTED, rich.toneOver(": "))
    }

    @Test
    fun `linha sem dois pontos nao inventa jogador`() {
        val rich = RichTextPlan.line("sala fechada")

        assertEquals("sala fechada", rich.text)
        assertTrue(rich.spans.none { it.tone == SpanTone.PLAYER })
    }

    @Test
    fun `notacao no comeco da linha fica apagada`() {
        val rich = RichTextPlan.line("Ana: {2d6+1} + {0d6} base [6, 2] — sucesso")

        assertEquals(SpanTone.MUTED, rich.toneOver("{2d6+1} + {0d6}"))
    }

    @Test
    fun `desfecho de falha na linha vai de vermelho`() {
        val rich = RichTextPlan.line("Ana: 1d20 [2] = 2 — falha crítica")

        assertEquals(SpanTone.FAILURE, rich.toneOver("falha crítica"))
        assertTrue(rich.boldOver("falha crítica"))
    }

    @Test
    fun `desfecho parcial na linha usa o tom de meio-termo`() {
        val rich = RichTextPlan.line("Ana: 2d6 [3, 4] = 7 — sucesso parcial")

        assertEquals(SpanTone.PARTIAL, rich.toneOver("sucesso parcial"))
    }

    @Test
    fun `desfecho para no parametro testado, que continua discreto`() {
        val rich = RichTextPlan.line("Ana: 3d6 [1, 2, 3] — sucesso (Dificuldade: 2)")

        assertEquals(SpanTone.SUCCESS, rich.toneOver("sucesso"))
        assertEquals(SpanTone.MUTED, rich.toneOver("(Dificuldade: 2)"))
    }

    @Test
    fun `carta vermelha se destaca das pretas`() {
        val rich = RichTextPlan.line("Ana: puxou 2 cartas: 10♥, K♠")

        assertEquals(SpanTone.CARD_RED, rich.toneOver("10♥"))
        assertTrue(rich.spans.none { it.tone == SpanTone.CARD_RED && rich.text.substring(it.start, it.end) == "K♠" })
    }

    @Test
    fun `pool nomeado na linha usa a cor do slot`() {
        val rich = RichTextPlan.line("Ana: base [6, 2] = 2 • perícia [1] = 0")

        assertEquals(SpanTone.SLOT_1, rich.toneOver("base"))
        assertEquals(SpanTone.SLOT_2, rich.toneOver("perícia"))
    }

    @Test
    fun `spans nunca saem do texto`() {
        val rich = RichTextPlan.line("Ana: {2d6+1} base [6, 10] = 2 — sucesso (Dificuldade: 1)")

        assertTrue(
            rich.spans.all { it.start >= 0 && it.end <= rich.text.length && it.start < it.end },
        )
    }
}
