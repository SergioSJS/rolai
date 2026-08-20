package app.meioorc.rolai

import android.graphics.Color

/**
 * Cores do overlay, em ARGB. Espelha os tokens de `apps/web/src/styles.css`.
 *
 * Vivia dentro do `companion object` da OverlayView, que era tambem o unico
 * lugar de onde a formatacao rica de resultado conseguia enxergar as cores.
 * Separado pra que ResultSpans (que so pinta) nao precise arrastar junto as
 * 1400 linhas de construcao de UI da view.
 *
 * Quem usa importa membro a membro (`import app.meioorc.rolai.OverlayPalette.ACCENT`)
 * — assim o arquivo declara na entrada de que cores depende.
 */
internal object OverlayPalette {
    val ACCENT = Color.rgb(0x1D, 0x9E, 0x75)
    val ACCENT_BRIGHT = Color.rgb(0x25, 0xC4, 0x8F)

    /**
     * Opaco: overlay nao tem backdrop-blur, e translucido aqui so vira ruido
     * visual com o app de baixo.
     */
    val PANEL = Color.rgb(0x14, 0x18, 0x1C)
    val BORDER = Color.argb(0x1A, 0xFF, 0xFF, 0xFF)
    val CHIP = Color.argb(0x14, 0xFF, 0xFF, 0xFF)

    /** Ripple esverdeado: o branco puro sumia sobre o painel escuro. */
    val RIPPLE = Color.argb(0x66, 0x25, 0xC4, 0x8F)

    /** Superficie de botao dentro do painel e fundo das mini-bolhas. */
    val SURFACE = Color.argb(0x1F, 0x25, 0xC4, 0x8F)
    val FAN_BG = Color.rgb(0x10, 0x2A, 0x22)
    val DANGER = Color.rgb(0xE0, 0x6C, 0x75)

    /**
     * Aro dos cartoes: verde da marca a meia opacidade — visivel sobre
     * qualquer wallpaper sem virar moldura berrante.
     */
    val CARD_STROKE = Color.argb(0x66, 0x1D, 0x9E, 0x75)
    val TEXT = Color.rgb(0xE8, 0xEC, 0xF0)
    val MUTED = Color.rgb(0x8B, 0x95, 0xA1)

    /**
     * Mesmas cores do modo stream (apps/web/src/styles.css): claras de
     * proposito, porque a janela do overlay fica sobre outro app e um
     * vermelho escuro sumiria sobre fundo escuro.
     */
    val FAILURE_TEXT = Color.rgb(0xFF, 0x6B, 0x6B)
    val PARTIAL_TEXT = Color.rgb(0xFF, 0xC6, 0x5C)

    // Cores dos slots de dados na formatacao rica de resultados e logs.
    val SLOT_1_COLOR = Color.rgb(0x25, 0xC4, 0x8F) // Esmeralda (#25c48f)
    val SLOT_2_COLOR = Color.rgb(0xF8, 0x71, 0x71) // Sangue (#f87171)
    val SLOT_3_COLOR = Color.rgb(0x38, 0xBD, 0xF8) // Gelo (#38bdf8)
    val CARD_RED_COLOR = Color.rgb(0xFF, 0x6B, 0x6B)
}
