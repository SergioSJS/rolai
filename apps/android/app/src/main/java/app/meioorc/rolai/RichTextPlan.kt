package app.meioorc.rolai

/**
 * Formatacao rica do overlay como DADO, nao como `SpannableStringBuilder`.
 *
 * A decisao ("este trecho e um pool de pericia, entao pinta de slot 2, em
 * negrito") e regex e comparacao de texto puro — nada de Android. So a
 * aplicacao final precisa das classes de span, e ela mora em ResultSpans.kt.
 *
 * Motivo da separacao: em teste JVM o `android.jar` e stub e
 * `isReturnDefaultValues = true` faz todo metodo de `SpannableStringBuilder`
 * devolver default, entao a formatacao antiga (~350 linhas dentro da
 * OverlayView) so podia ser conferida olhando o celular. Aqui ela roda em
 * `./gradlew testDebugUnitTest` — ver RichTextPlanTest.
 *
 * A ORDEM da lista de spans importa: spans de cor que se sobrepoem sao
 * resolvidos pelo ultimo aplicado, igual ao comportamento original.
 */

/** Papel semantico do trecho. A cor concreta vive em OverlayPalette. */
enum class SpanTone {
    /** Cor normal de texto (TEXT). */
    DEFAULT,
    SUCCESS,
    PARTIAL,
    FAILURE,
    MUTED,

    /** Nome de quem rolou, na linha de historico. */
    PLAYER,
    SLOT_1,
    SLOT_2,
    SLOT_3,
    CARD_RED,
}

/**
 * Um trecho marcado. `tone` nulo = nao mexe na cor (usado quando so o
 * negrito ou o tamanho mudam).
 */
data class TextSpan(
    val start: Int,
    val end: Int,
    val tone: SpanTone? = null,
    val bold: Boolean = false,
    val sizeScale: Float = 1f,
)

/** Texto final + o que pintar nele. */
data class RichText(val text: String, val spans: List<TextSpan>)

private class RichTextBuilder {
    private val sb = StringBuilder()
    private val spans = mutableListOf<TextSpan>()

    val length: Int get() = sb.length

    fun append(text: String): Int {
        val start = sb.length
        sb.append(text)
        return start
    }

    fun mark(start: Int, end: Int, tone: SpanTone? = null, bold: Boolean = false, sizeScale: Float = 1f) {
        if (end <= start) return
        spans.add(TextSpan(start, end, tone, bold, sizeScale))
    }

    fun build(): RichText = RichText(sb.toString(), spans.toList())
}

/** Rotulos de pool pintados com a cor do slot 1 no DETALHE do resultado. */
private val DETAIL_SLOT_1 = Regex("""\b(base|ação|acao|claros|grupo 1|regulares|verbo)\b""", RegexOption.IGNORE_CASE)
private val DETAIL_SLOT_2 = Regex(
    """\b(perícia|pericia|desafio|escuros|fome/ira|fome|ira|grupo 2|substantivo)\b""",
    RegexOption.IGNORE_CASE,
)
private val DETAIL_SLOT_3 = Regex("""\b(equipamento|ruína|ruina|estresse|grupo 3)\b""", RegexOption.IGNORE_CASE)

/**
 * Os mesmos rotulos na LINHA de historico. A lista e mais curta de
 * proposito: "fome"/"ira" soltos e "substantivo" aparecem no detalhe do
 * resultado, nao na linha compacta.
 */
private val LINE_SLOT_1 = Regex("""\b(base|ação|acao|claros|grupo 1|regulares)\b""", RegexOption.IGNORE_CASE)
private val LINE_SLOT_2 = Regex("""\b(perícia|pericia|desafio|escuros|fome/ira|grupo 2)\b""", RegexOption.IGNORE_CASE)
private val LINE_SLOT_3 = Regex("""\b(equipamento|ruína|ruina|grupo 3)\b""", RegexOption.IGNORE_CASE)

private val BRACKETS = Regex("""\[([^\]]+)\]""")
private val NUMBER = Regex("""\b(\d+)\b""")
private val CARD_RED = Regex("""(10|[A2-9JQK])([♥♦])""")
private val SEPARATOR = Regex("""(•|\bvs\b)""")
private val PARENTHESIZED = Regex("""\(([^)]+)\)""")

/**
 * Notacao no inicio da linha ("{2d6+1} + {0d6}", "1[1d6] + 2[2d6]", "2d6+1"):
 * fica discreta, porque o que interessa na linha e o resultado.
 */
private val LEADING_NOTATION = Regex(
    """^(\{[^}]+\}(\s*(\+|\bvs\b)\s*\{[^}]+\})*|\d*\[[^\]]+\](\s*(\+|\bvs\b)\s*\d*\[[^\]]+\])*|\b\d+d\w+[^\s]*)\s+""",
)

/** Palavras que fazem um desfecho contar como falha na linha de historico. */
private val FAILURE_WORDS = listOf(
    "falha", "fracasso", "bestial", "dano", "desgraça", "desgraca", "pânico", "panico", "descontrole",
)

/** ...e como meio-termo. */
private val PARTIAL_WORDS = listOf("parcial", "manchado", "vislumbre", "complicada")

object RichTextPlan {

    /**
     * Resultado completo de uma rolagem com hierarquia visual:
     *  - linha 1: desfecho(s) ou total, grande e colorido, com o parametro
     *    testado ao lado em cinza menor;
     *  - linha 2: detalhamento dos pools em fonte menor, com rotulo de slot
     *    colorido e os dados em negrito.
     */
    fun result(resultJson: String): RichText {
        return try {
            val lines = ResultFormat.formatDisplayLines(resultJson)
            val b = RichTextBuilder()

            if (lines.flags.isNotEmpty()) {
                for (i in lines.flags.indices) {
                    val (label, rawFlag) = lines.flags[i]
                    if (i > 0) {
                        val commaStart = b.append(", ")
                        b.mark(commaStart, b.length, SpanTone.MUTED)
                    }
                    val flagStart = b.append(label)
                    val tone = when (outcomeTone(rawFlag)) {
                        OutcomeTone.FAILURE -> SpanTone.FAILURE
                        OutcomeTone.PARTIAL -> SpanTone.PARTIAL
                        else -> SpanTone.SUCCESS
                    }
                    b.mark(flagStart, b.length, tone, bold = true, sizeScale = 1.1f)
                }
            } else {
                val headlineStart = b.append(lines.headline)
                val tone = when (ResultFormat.toneOf(resultJson)) {
                    OutcomeTone.FAILURE -> SpanTone.FAILURE
                    OutcomeTone.PARTIAL -> SpanTone.PARTIAL
                    OutcomeTone.SUCCESS -> SpanTone.SUCCESS
                    else -> SpanTone.DEFAULT
                }
                b.mark(headlineStart, b.length, tone, bold = true, sizeScale = 1.25f)
            }

            if (!lines.tested.isNullOrEmpty()) {
                val testedStart = b.append("  (${lines.tested})")
                b.mark(testedStart, b.length, SpanTone.MUTED, sizeScale = 0.75f)
            }

            if (!lines.detail.isNullOrEmpty()) {
                b.append("\n")
                val detailStart = b.append(lines.detail)
                b.mark(detailStart, b.length, sizeScale = 0.75f)
                markDetail(b, lines.detail, detailStart)
            }

            b.build()
        } catch (e: Exception) {
            line(resultJson.take(80))
        }
    }

    /**
     * Linha de historico / atividade: nome de quem rolou, rotulos de pool,
     * cartas, dados e desfecho.
     */
    fun line(rawLine: String): RichText {
        val b = RichTextBuilder()
        val colonIdx = rawLine.indexOf(": ")

        val content = if (colonIdx != -1) {
            val nameStart = b.append(rawLine.substring(0, colonIdx))
            b.mark(nameStart, b.length, SpanTone.PLAYER, bold = true)
            val colonStart = b.append(": ")
            b.mark(colonStart, b.length, SpanTone.MUTED)
            rawLine.substring(colonIdx + 2)
        } else {
            rawLine
        }

        val bodyStart = b.append(content)

        LEADING_NOTATION.find(content)?.let { m ->
            b.mark(bodyStart + m.range.first, bodyStart + m.range.last + 1, SpanTone.MUTED)
        }

        markAll(b, content, bodyStart, LINE_SLOT_1, SpanTone.SLOT_1, bold = true)
        markAll(b, content, bodyStart, LINE_SLOT_2, SpanTone.SLOT_2, bold = true)
        markAll(b, content, bodyStart, LINE_SLOT_3, SpanTone.SLOT_3, bold = true)
        markBracketedDice(b, content, bodyStart)
        markAll(b, content, bodyStart, CARD_RED, SpanTone.CARD_RED, bold = true)

        // Desfecho (depois de " — "), ate onde comeca o parametro testado.
        val outcomeIdx = content.indexOf(" — ")
        if (outcomeIdx != -1) {
            var outcomeEndIdx = content.indexOf(" (Dificuldade:", outcomeIdx)
            if (outcomeEndIdx == -1) outcomeEndIdx = content.indexOf(" (Limiar:", outcomeIdx)
            if (outcomeEndIdx == -1) outcomeEndIdx = content.length
            val outcomeText = content.substring(outcomeIdx + 3, outcomeEndIdx)
            val tone = when {
                FAILURE_WORDS.any { outcomeText.contains(it, ignoreCase = true) } -> SpanTone.FAILURE
                PARTIAL_WORDS.any { outcomeText.contains(it, ignoreCase = true) } -> SpanTone.PARTIAL
                else -> SpanTone.SUCCESS
            }
            b.mark(bodyStart + outcomeIdx + 3, bodyStart + outcomeEndIdx, tone, bold = true)
        }

        markAll(b, content, bodyStart, PARENTHESIZED, SpanTone.MUTED)

        return b.build()
    }

    private fun markDetail(b: RichTextBuilder, text: String, start: Int) {
        markAll(b, text, start, DETAIL_SLOT_1, SpanTone.SLOT_1, bold = true)
        markAll(b, text, start, DETAIL_SLOT_2, SpanTone.SLOT_2, bold = true)
        markAll(b, text, start, DETAIL_SLOT_3, SpanTone.SLOT_3, bold = true)
        markBracketedDice(b, text, start)
        markAll(b, text, start, CARD_RED, SpanTone.CARD_RED, bold = true)
        markAll(b, text, start, SEPARATOR, SpanTone.MUTED)
    }

    /**
     * `[6, 2, 10]` — o bloco todo em negrito, e cada dado colorido pelo que
     * ele vale num pool de d6/d10: 10 e o critico, 6+ e acerto.
     */
    private fun markBracketedDice(b: RichTextBuilder, text: String, offset: Int) {
        for (m in BRACKETS.findAll(text)) {
            b.mark(offset + m.range.first, offset + m.range.last + 1, bold = true)
            val inner = m.groupValues[1]
            val innerStart = offset + m.range.first + 1
            for (nm in NUMBER.findAll(inner)) {
                val value = nm.value.toIntOrNull() ?: continue
                val tone = when {
                    value == 10 -> SpanTone.PARTIAL
                    value >= 6 -> SpanTone.SUCCESS
                    else -> continue
                }
                b.mark(innerStart + nm.range.first, innerStart + nm.range.last + 1, tone)
            }
        }
    }

    private fun markAll(
        b: RichTextBuilder,
        text: String,
        offset: Int,
        regex: Regex,
        tone: SpanTone,
        bold: Boolean = false,
    ) {
        for (m in regex.findAll(text)) {
            b.mark(offset + m.range.first, offset + m.range.last + 1, tone, bold = bold)
        }
    }
}
