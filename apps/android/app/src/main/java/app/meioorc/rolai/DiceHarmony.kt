package app.meioorc.rolai

/**
 * Harmonia automatica da aparencia do dado: escolhida a cor do CORPO, deriva
 * numero e contorno em vez de deixar a pessoa acertar tres cores na mao (o
 * caminho curto pro dado ilegivel — numero escuro em corpo escuro).
 *
 *  - numero: claro ou escuro, o que tiver mais contraste com o corpo. O
 *    corte usa luminancia relativa (WCAG), nao brilho ingenuo — senao
 *    amarelo e ciano, que sao claros mas tem canais altos, ganhavam texto
 *    branco e sumiam.
 *  - contorno: o proprio corpo escurecido, pra borda "assentar" no dado em
 *    vez de virar uma terceira cor solta. Corpo ja escuro clareia — a borda
 *    precisa aparecer contra o corpo.
 *
 * Tudo em Kotlin puro (sem android.graphics.Color) de proposito: assim roda
 * em teste JVM local de verdade, sem Robolectric nem stub devolvendo zero.
 */
object DiceHarmony {

    private const val LIGHT_NUMBER = "#f4f7f5"
    private const val DARK_NUMBER = "#14181c"
    private val HEX = Regex("^#?([0-9a-fA-F]{6})$")

    /** "#rrggbb" -> (r, g, b) em 0..255; null se nao for hex valido. */
    fun parse(hex: String): Triple<Int, Int, Int>? {
        val match = HEX.find(hex.trim()) ?: return null
        val value = match.groupValues[1].toInt(16)
        return Triple(value shr 16 and 0xFF, value shr 8 and 0xFF, value and 0xFF)
    }

    /** Luminancia relativa WCAG (0 = preto, 1 = branco). */
    fun luminance(hex: String): Double {
        val (r, g, b) = parse(hex) ?: return 0.0
        fun channel(value: Int): Double {
            val c = value / 255.0
            return if (c <= 0.03928) c / 12.92 else Math.pow((c + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }

    /** Cor de numero com mais contraste sobre `body`. */
    fun numberFor(body: String): String =
        if (luminance(body) > 0.35) DARK_NUMBER else LIGHT_NUMBER

    /** Contorno: o corpo escurecido (ou clareado, se o corpo ja e escuro). */
    fun outlineFor(body: String): String {
        val (r, g, b) = parse(body) ?: return DARK_NUMBER
        val max = maxOf(r, g, b)
        val factor = if (max < 72) 2.6 else 0.35
        fun adjust(value: Int): Int = (value * factor).toInt().coerceIn(0, 255)
        // Corpo quase preto (max < 72) clareia com piso, pra borda nao
        // continuar invisivel quando todos os canais sao ~0.
        val floor = if (max < 72) 26 else 0
        return String.format(
            "#%02x%02x%02x",
            maxOf(adjust(r), floor),
            maxOf(adjust(g), floor),
            maxOf(adjust(b), floor),
        )
    }
}
