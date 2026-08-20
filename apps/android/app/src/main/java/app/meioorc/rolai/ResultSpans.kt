package app.meioorc.rolai

import android.graphics.Typeface
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.text.style.RelativeSizeSpan
import android.text.style.StyleSpan
import app.meioorc.rolai.OverlayPalette.ACCENT_BRIGHT
import app.meioorc.rolai.OverlayPalette.CARD_RED_COLOR
import app.meioorc.rolai.OverlayPalette.FAILURE_TEXT
import app.meioorc.rolai.OverlayPalette.MUTED
import app.meioorc.rolai.OverlayPalette.PARTIAL_TEXT
import app.meioorc.rolai.OverlayPalette.SLOT_1_COLOR
import app.meioorc.rolai.OverlayPalette.SLOT_2_COLOR
import app.meioorc.rolai.OverlayPalette.SLOT_3_COLOR
import app.meioorc.rolai.OverlayPalette.TEXT

/**
 * Aplica um RichText (RichTextPlan) num SpannableStringBuilder.
 *
 * De proposito burro: aqui nao se DECIDE nada — quem escolhe o que pintar e
 * o RichTextPlan, que e Kotlin puro e roda em teste JVM. Este arquivo so
 * traduz tom -> cor e chama setSpan.
 */
object ResultSpans {

    /** Resultado completo de uma rolagem (headline + testado + detalhe). */
    fun ofResult(resultJson: String): SpannableStringBuilder = apply(RichTextPlan.result(resultJson))

    /** Uma linha de historico / atividade. */
    fun ofLine(rawLine: String): SpannableStringBuilder = apply(RichTextPlan.line(rawLine))

    fun apply(rich: RichText): SpannableStringBuilder {
        val ssb = SpannableStringBuilder(rich.text)
        for (span in rich.spans) {
            if (span.tone != null) {
                ssb.setSpan(
                    ForegroundColorSpan(colorOf(span.tone)),
                    span.start,
                    span.end,
                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                )
            }
            if (span.bold) {
                ssb.setSpan(
                    StyleSpan(Typeface.BOLD),
                    span.start,
                    span.end,
                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                )
            }
            if (span.sizeScale != 1f) {
                ssb.setSpan(
                    RelativeSizeSpan(span.sizeScale),
                    span.start,
                    span.end,
                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                )
            }
        }
        return ssb
    }

    private fun colorOf(tone: SpanTone): Int = when (tone) {
        SpanTone.DEFAULT -> TEXT
        SpanTone.SUCCESS -> ACCENT_BRIGHT
        SpanTone.PARTIAL -> PARTIAL_TEXT
        SpanTone.FAILURE -> FAILURE_TEXT
        SpanTone.MUTED -> MUTED
        SpanTone.PLAYER -> ACCENT_BRIGHT
        SpanTone.SLOT_1 -> SLOT_1_COLOR
        SpanTone.SLOT_2 -> SLOT_2_COLOR
        SpanTone.SLOT_3 -> SLOT_3_COLOR
        SpanTone.CARD_RED -> CARD_RED_COLOR
    }
}
