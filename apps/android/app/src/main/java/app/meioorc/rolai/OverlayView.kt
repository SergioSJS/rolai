package app.meioorc.rolai

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.abs

/**
 * View flutuante do overlay (desenhada via WindowManager pelo
 * OverlayService). Tier "texto puro" da escada de qualidade
 * (docs/architecture.md) — NUNCA 3D aqui (o 3D e o palco, DiceStageWindow).
 *
 * Dois estados:
 *  - recolhido: bolha redonda ancorada na borda, arrastavel;
 *  - expandido: cartao com status da sala, compositor de pool (chips de
 *    dado), ROLAR, ultimo resultado e atividade recente.
 *
 * Sem campo de texto no overlay de proposito: manter FLAG_NOT_FOCUSABLE
 * evita disputar teclado/foco com o app em primeiro plano (o leitor de
 * PDF). A rolagem rapida (notacao/sistema) se configura na SettingsActivity.
 *
 * Visual segue os tokens do apps/web (styles.css): fundo #14181C ~95%,
 * borda 1dp branca 10%, accent #1D9E75, texto #E8ECF0, muted #8B95A1.
 */
class OverlayView(context: Context) {

    val root: FrameLayout = FrameLayout(context)

    var onRollClicked: (() -> Unit)? = null

    /** Rola uma notacao montada na hora pelos chips de dado do overlay. */
    var onRollNotation: ((String) -> Unit)? = null
    var onOpenApp: (() -> Unit)? = null
    var onOpenSettings: (() -> Unit)? = null

    private val bubble: android.widget.ImageView
    private val panel: LinearLayout
    private lateinit var dragHandle: TextView
    private lateinit var statusDot: TextView
    private lateinit var statusView: TextView
    private lateinit var resultView: TextView
    private lateinit var activityView: TextView
    private lateinit var poolView: TextView
    private lateinit var rollButton: TextView
    private val chips = LinkedHashMap<Int, TextView>()

    // tipo de dado -> quantidade, na ordem de toque (LinkedHashMap)
    private val pool = LinkedHashMap<Int, Int>()

    // Notacao da rolagem rapida (das configuracoes) — vira o rotulo do
    // ROLAR quando o pool esta vazio, pra ficar obvio o que vai rolar.
    private var quickNotation: String = ""

    private val dp = context.resources.displayMetrics.density

    private fun Int.dp(): Int = (this * dp).toInt()

    init {
        // d20 vetorial (mesma marca do apps/web) — emoji renderiza diferente
        // em cada fabricante e desalinha dentro do circulo.
        bubble = android.widget.ImageView(context).apply {
            setImageResource(R.drawable.ic_d20)
            imageTintList = ColorStateList.valueOf(Color.WHITE)
            val pad = 14.dp()
            setPadding(pad, pad, pad, pad)
            background = rippled(
                GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(ACCENT)
                    setStroke(1.dp(), Color.argb(0x33, 0xFF, 0xFF, 0xFF))
                },
            )
            elevation = 6.dp().toFloat()
            contentDescription = "rolai — abrir painel de rolagem"
            layoutParams = FrameLayout.LayoutParams(56.dp(), 56.dp())
            setOnClickListener { setExpanded(true) }
        }

        panel = buildPanel(context)
        panel.visibility = View.GONE

        root.addView(bubble)
        root.addView(panel)
    }

    // ---------- construcao do cartao ----------

    private fun buildPanel(context: Context): LinearLayout {
        val header = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        statusDot = TextView(context).apply {
            text = "●"
            textSize = 10f
            setTextColor(MUTED)
            setPadding(0, 0, 6.dp(), 0)
        }
        dragHandle = TextView(context).apply {
            text = "Rolaí"
            setTextColor(TEXT)
            textSize = 15f
            letterSpacing = 0.02f
            setTypeface(typeface, Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val collapseButton = TextView(context).apply {
            text = "—"
            setTextColor(MUTED)
            textSize = 16f
            gravity = Gravity.CENTER
            background = rippled(pill(Color.TRANSPARENT))
            setPadding(10.dp(), 2.dp(), 10.dp(), 2.dp())
            contentDescription = "recolher painel"
            setOnClickListener { setExpanded(false) }
        }
        header.addView(statusDot)
        header.addView(dragHandle)
        header.addView(collapseButton)

        statusView = TextView(context).apply {
            setTextColor(MUTED)
            textSize = 11f
        }

        // Chips de dado em duas fileiras (4 + 3): toque soma ao pool e o
        // proprio chip vira o termo ("2d6"). Espelha o compositor do
        // apps/web — quem calcula continua sendo o rules-engine na WebView
        // headless, nada de regra aqui.
        val rowTop = chipRow(context, DICE_SIDES.take(4))
        val rowBottom = chipRow(context, DICE_SIDES.drop(4))

        poolView = TextView(context).apply {
            setTextColor(MUTED)
            textSize = 11f
            gravity = Gravity.CENTER
            text = context.getString(R.string.overlay_pool_empty)
        }

        rollButton = TextView(context).apply {
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            textSize = 15f
            setTypeface(typeface, Typeface.BOLD)
            letterSpacing = 0.04f
            isAllCaps = true
            background = rippled(
                GradientDrawable().apply {
                    cornerRadius = 12.dp().toFloat()
                    setColor(ACCENT)
                },
            )
            setPadding(0, 12.dp(), 0, 12.dp())
            setOnClickListener { rollCurrent() }
        }

        resultView = TextView(context).apply {
            setTextColor(TEXT)
            textSize = 22f
            gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
        }

        activityView = TextView(context).apply {
            setTextColor(MUTED)
            textSize = 11f
            maxLines = MAX_ACTIVITY_LINES
        }

        val divider = View(context).apply {
            setBackgroundColor(BORDER)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                1,
            ).apply { topMargin = 10.dp() }
        }

        val actionRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            addView(
                actionButton(context, R.string.overlay_action_clear) { clearPool() },
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
            )
            addView(
                actionButton(context, R.string.overlay_action_settings) {
                    onOpenSettings?.invoke()
                },
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
            )
            addView(
                actionButton(context, R.string.overlay_action_open_app) {
                    onOpenApp?.invoke()
                },
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
            )
        }

        renderPool()

        return LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                cornerRadius = 20.dp().toFloat()
                setColor(PANEL)
                setStroke(1.dp(), BORDER)
            }
            elevation = 12.dp().toFloat()
            setPadding(16.dp(), 14.dp(), 16.dp(), 12.dp())
            layoutParams = FrameLayout.LayoutParams(300.dp(), FrameLayout.LayoutParams.WRAP_CONTENT)
            addView(header)
            addView(statusView, vParams(topMargin = 2))
            addView(rowTop, vParams(topMargin = 12))
            addView(rowBottom, vParams(topMargin = 6))
            addView(poolView, vParams(topMargin = 8))
            addView(rollButton, vParams(topMargin = 10))
            addView(resultView, vParams(topMargin = 12))
            addView(activityView, vParams(topMargin = 6))
            addView(divider)
            addView(actionRow, vParams(topMargin = 2))
        }
    }

    private fun vParams(topMargin: Int): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { this.topMargin = topMargin.dp() }

    private fun chipRow(context: Context, sides: List<Int>): LinearLayout {
        val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
        for (side in sides) {
            val chip = TextView(context).apply {
                text = "d$side"
                setTextColor(TEXT)
                textSize = 12f
                maxLines = 1
                setTypeface(Typeface.MONOSPACE, Typeface.BOLD)
                gravity = Gravity.CENTER
                background = chipBackground(active = false)
                setPadding(0, 9.dp(), 0, 9.dp())
                setOnClickListener { addDie(side) }
            }
            chips[side] = chip
            row.addView(
                chip,
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginStart = if (side == sides.first()) 0 else 6.dp()
                },
            )
        }
        return row
    }

    private fun chipBackground(active: Boolean): RippleDrawable =
        rippled(
            GradientDrawable().apply {
                cornerRadius = 10.dp().toFloat()
                setColor(CHIP)
                setStroke(1.dp(), if (active) ACCENT else BORDER)
            },
        )

    private fun rippled(content: GradientDrawable): RippleDrawable =
        RippleDrawable(ColorStateList.valueOf(RIPPLE), content, null)

    private fun actionButton(context: Context, resId: Int, onClick: () -> Unit): TextView =
        TextView(context).apply {
            setText(resId)
            setTextColor(MUTED)
            textSize = 12f
            gravity = Gravity.CENTER
            background = rippled(pill(Color.TRANSPARENT))
            setPadding(4.dp(), 10.dp(), 4.dp(), 10.dp())
            setOnClickListener { onClick() }
        }

    private fun pill(color: Int): GradientDrawable =
        GradientDrawable().apply {
            cornerRadius = 999f
            setColor(color)
        }

    // ---------- compositor de pool ----------

    private fun addDie(sides: Int) {
        pool[sides] = (pool[sides] ?: 0) + 1
        renderPool()
    }

    private fun clearPool() {
        pool.clear()
        renderPool()
    }

    /** "2d6+1d20" — mesma gramatica multi-termo do rules-engine. */
    private fun poolNotation(): String =
        pool.entries.joinToString("+") { (sides, count) -> "${count}d$sides" }

    private fun renderPool() {
        val notation = poolNotation()
        for ((sides, chip) in chips) {
            val count = pool[sides] ?: 0
            chip.text = if (count > 0) "${count}d$sides" else "d$sides"
            chip.setTextColor(if (count > 0) ACCENT_BRIGHT else TEXT)
            chip.background = chipBackground(active = count > 0)
        }
        poolView.text = notation.ifEmpty {
            poolView.context.getString(R.string.overlay_pool_empty)
        }
        rollButton.text = when {
            notation.isNotEmpty() -> "ROLAR $notation"
            quickNotation.isNotEmpty() -> "ROLAR $quickNotation"
            else -> rollButton.context.getString(R.string.roll_button)
        }
    }

    /** Rola o pool montado aqui; vazio = rolagem rapida das configuracoes. */
    private fun rollCurrent() {
        val notation = poolNotation()
        if (notation.isEmpty()) onRollClicked?.invoke() else onRollNotation?.invoke(notation)
    }

    // ---------- API usada pelo OverlayService ----------

    /** Notacao da rolagem rapida — vira o rotulo do ROLAR com o pool vazio. */
    fun setQuickNotation(notation: String) {
        quickNotation = notation.trim()
        renderPool()
    }

    fun setExpanded(expanded: Boolean) {
        panel.visibility = if (expanded) View.VISIBLE else View.GONE
        bubble.visibility = if (expanded) View.GONE else View.VISIBLE
    }

    fun setStatus(text: String) {
        statusView.text = text
        val connected = text.contains("conectado", ignoreCase = true) &&
            !text.contains("desconectado", ignoreCase = true)
        statusDot.setTextColor(if (connected) ACCENT_BRIGHT else MUTED)
    }

    fun showResult(text: String) {
        resultView.text = text
        setExpanded(true)
    }

    /** Anexa uma linha de atividade da sala (rolagens de outros jogadores). */
    fun addActivityLine(line: String) {
        val lines = (activityView.text.toString().split("\n").filter { it.isNotBlank() } + line)
            .takeLast(MAX_ACTIVITY_LINES)
        activityView.text = lines.joinToString("\n")
    }

    /** Arrasto da bolha e do cabecalho do painel, com snap na borda ao soltar. */
    @SuppressLint("ClickableViewAccessibility")
    fun bindDrag(windowManager: WindowManager, params: WindowManager.LayoutParams) {
        val listener = DragTouchListener(windowManager, params)
        bubble.setOnTouchListener(listener)
        dragHandle.setOnTouchListener(listener)
    }

    private inner class DragTouchListener(
        private val windowManager: WindowManager,
        private val params: WindowManager.LayoutParams,
    ) : View.OnTouchListener {
        private var startX = 0
        private var startY = 0
        private var touchX = 0f
        private var touchY = 0f
        private var moved = false

        override fun onTouch(view: View, event: MotionEvent): Boolean {
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    startX = params.x
                    startY = params.y
                    touchX = event.rawX
                    touchY = event.rawY
                    moved = false
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - touchX).toInt()
                    val dy = (event.rawY - touchY).toInt()
                    if (abs(dx) > TOUCH_SLOP_DP.dp() || abs(dy) > TOUCH_SLOP_DP.dp()) moved = true
                    if (moved) {
                        params.x = startX + dx
                        params.y = startY + dy
                        windowManager.updateViewLayout(root, params)
                    }
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    if (!moved) {
                        view.performClick()
                    } else {
                        snapToEdge()
                    }
                    return true
                }
            }
            return false
        }

        // Ancora na borda mais proxima (spec: "ancoravel na borda").
        private fun snapToEdge() {
            val screenWidth = root.resources.displayMetrics.widthPixels
            val width = if (root.width > 0) root.width else 56.dp()
            params.x = if (params.x + width / 2 < screenWidth / 2) 0 else screenWidth - width
            windowManager.updateViewLayout(root, params)
        }
    }

    companion object {
        // Tokens do apps/web (styles.css), em ARGB.
        private val ACCENT = Color.rgb(0x1D, 0x9E, 0x75)
        private val ACCENT_BRIGHT = Color.rgb(0x25, 0xC4, 0x8F)
        // Opaco: overlay nao tem backdrop-blur, e translucido aqui so
        // vira ruido visual com o app de baixo.
        private val PANEL = Color.rgb(0x14, 0x18, 0x1C)
        private val BORDER = Color.argb(0x1A, 0xFF, 0xFF, 0xFF)
        private val CHIP = Color.argb(0x14, 0xFF, 0xFF, 0xFF)
        private val RIPPLE = Color.argb(0x33, 0xFF, 0xFF, 0xFF)
        private val TEXT = Color.rgb(0xE8, 0xEC, 0xF0)
        private val MUTED = Color.rgb(0x8B, 0x95, 0xA1)
        private const val MAX_ACTIVITY_LINES = 3
        private val DICE_SIDES = listOf(4, 6, 8, 10, 12, 20, 100)
        private const val TOUCH_SLOP_DP = 8
    }
}
