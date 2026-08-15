package app.meioorc.rolai

import android.content.Context
import android.util.AttributeSet
import android.widget.ScrollView

/**
 * ScrollView com teto de altura ajustavel em runtime.
 *
 * Um ScrollView normal so limita a propria altura quando o PAI já dá um
 * teto (MeasureSpec.EXACTLY/AT_MOST) — os cartões do overlay (compor,
 * histórico, sala) vivem soltos numa janela WRAP_CONTENT do WindowManager,
 * sem pai nenhum limitando nada, então sem isto o cartão só CRESCE até
 * caber o conteúdo inteiro. Em paisagem a tela é bem mais baixa, e um
 * cartão que cabia sobrando em retrato passa da borda — sem ScrollView,
 * "passar da borda" é sumir mesmo, não vira rolável sozinho.
 */
class MaxHeightScrollView(context: Context, attrs: AttributeSet? = null) : ScrollView(context, attrs) {
    var maxHeightPx: Int = Int.MAX_VALUE
        set(value) {
            if (field == value) return
            field = value
            requestLayout()
        }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val capped = if (maxHeightPx == Int.MAX_VALUE) {
            heightMeasureSpec
        } else {
            MeasureSpec.makeMeasureSpec(maxHeightPx, MeasureSpec.AT_MOST)
        }
        super.onMeasure(widthMeasureSpec, capped)
    }
}
