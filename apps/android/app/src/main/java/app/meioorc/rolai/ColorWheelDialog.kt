package app.meioorc.rolai

import android.content.Context
import android.view.ContextThemeWrapper
import com.skydoves.colorpickerview.ColorPickerDialog
import com.skydoves.colorpickerview.listeners.ColorEnvelopeListener

/**
 * Roda de cores HSV (matiz no angulo, saturacao no raio) + barra de brilho,
 * pra quando a paleta fixa nao tem a cor que a pessoa quer.
 *
 * Usa o ColorPickerDialog pronto da colorpickerview (Maven Central) em vez
 * de montar a view na mao: criada em codigo, a ColorPickerView tenta gerar o
 * bitmap da paleta antes do layout e estoura ("width and height must be > 0").
 * O dialog da lib infla o layout dela e cuida disso.
 *
 * A SettingsActivity e uma Activity comum (tema Material), mas o builder
 * herda de AppCompat — dai o ContextThemeWrapper com tema AppCompat de
 * dialog, senao quebra com "You need to use a Theme.AppCompat theme".
 *
 * Devolve sempre "#rrggbb": o dado e opaco, e o schema do backend
 * (DiceStyle) so aceita 6 digitos.
 */
object ColorWheelDialog {

    fun show(context: Context, title: String, initial: String, onPicked: (String) -> Unit) {
        val themed = ContextThemeWrapper(context, R.style.Theme_RolaiDialog)
        val builder = ColorPickerDialog.Builder(themed)
            .setTitle(title)
            .setPositiveButton(
                context.getString(android.R.string.ok),
                ColorEnvelopeListener { envelope, _ ->
                    onPicked("#" + envelope.hexCode.takeLast(6).lowercase())
                },
            )
            .setNegativeButton(context.getString(android.R.string.cancel)) { dialog, _ ->
                dialog.dismiss()
            }
            .attachAlphaSlideBar(false)
            .attachBrightnessSlideBar(true)
            .setBottomSpace(12)
        builder.colorPickerView.setInitialColor(parseOrDefault(initial))
        builder.show()
    }

    private fun parseOrDefault(hex: String): Int =
        runCatching { android.graphics.Color.parseColor(hex) }
            .getOrDefault(android.graphics.Color.WHITE)
}
