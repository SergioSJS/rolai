package app.meioorc.rolai

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.abs

/**
 * View flutuante do overlay (desenhada via WindowManager pelo
 * OverlayService). Tier "texto puro" da escada de qualidade
 * (docs/architecture.md) — NUNCA 3D aqui (o 3D e o palco, DiceStageWindow).
 *
 * Quatro estados:
 *  - COLLAPSED: so a bolha redonda, ancorada na borda, arrastavel;
 *  - FAN: a bolha abre 3 mini-bolhas — rolar (a ULTima rolagem, ou a
 *    configurada se ainda nao rolou nada), historico e compor;
 *  - PANEL: o compositor (chips de dado + notacao digitavel + ROLAR),
 *    aberto pela engrenagem do fan;
 *  - HISTORY: cartao compacto com o ultimo resultado em destaque e as
 *    ultimas rolagens da sala — abre SO pela mini-bolha do relogio;
 *  - RESULT: flash compacto com o resultado de uma rolagem pelo atalho —
 *    some sozinho em RESULT_FLASH_MS ou ao toque.
 *
 * O campo de notacao digitavel exige janela focavel — e o FLAG_NOT_FOCUSABLE
 * e o que impede o overlay de roubar o teclado do app em primeiro plano (o
 * leitor de PDF). Por isso o flag so sai enquanto o PANEL esta aberto:
 * quem troca e o OverlayService, via onWindowFocusMode.
 *
 * Visual segue os tokens do apps/web (styles.css): fundo #14181C,
 * borda 1dp branca 10%, accent #1D9E75, texto #E8ECF0, muted #8B95A1.
 */
class OverlayView(context: Context) {

    val root: FrameLayout = FrameLayout(context)

    /** ROLAR do painel com o campo vazio: rolagem rapida das configuracoes. */
    var onRollClicked: (() -> Unit)? = null

    /** ROLAR com notacao montada nos chips ou digitada no campo. */
    var onRollNotation: ((String) -> Unit)? = null

    /**
     * Composicao adotada como rolagem do botao.
     *
     * Montar o pool e minimizar SEM rolar nao mudava nada: o botao recolhido
     * dispara a notacao das configuracoes, e a composicao vivia so no campo
     * do painel. Quem compoe espera que aquilo passe a ser "a rolagem" —
     * entao ao recolher, o que estiver escrito vira a rolagem rapida.
     */
    var onComposedNotation: ((String) -> Unit)? = null

    /** Desligar o botao flutuante sem passar pela tela de configuracoes. */
    var onCloseOverlay: (() -> Unit)? = null

    /** Acoes de sala do painel do overlay (espelham a tela de config). */
    var onJoinRoom: (() -> Unit)? = null
    var onCreateRoom: (() -> Unit)? = null
    var onLeaveRoom: (() -> Unit)? = null

    /** Ultimo roster recebido — exibido no painel de sala. */
    private var roster: List<String> = emptyList()

    /** Mini-bolha de rolagem do fan: ultima rolagem, ou a configurada. */
    var onQuickRoll: (() -> Unit)? = null
    var onOpenApp: (() -> Unit)? = null
    var onOpenSettings: (() -> Unit)? = null

    /** PANEL aberto = a janela precisa de foco (teclado); saiu dele = repor
     *  o FLAG_NOT_FOCUSABLE. Quem troca o flag e o OverlayService. */
    var onWindowFocusMode: ((Boolean) -> Unit)? = null

    private enum class Mode { COLLAPSED, FAN, PANEL, HISTORY, ROOM, RESULT }
    private var mode = Mode.COLLAPSED

    private val bubble: ImageView
    private val fan: LinearLayout
    private val panel: LinearLayout
    private val historyPanel: LinearLayout
    private val roomPanel: LinearLayout
    private val resultFlash: TextView
    private lateinit var dragHandle: TextView
    private lateinit var historyDragHandle: TextView
    private lateinit var roomStatusView: TextView
    private lateinit var roomRosterView: TextView
    private lateinit var statusDot: TextView
    private lateinit var statusView: TextView
    private lateinit var panelResultView: TextView
    private lateinit var historyResultView: TextView
    private lateinit var historyLinesView: TextView
    private lateinit var activityView: TextView
    private lateinit var notationInput: EditText
    private lateinit var rollButton: TextView
    private val chips = LinkedHashMap<String, TextView>()

    // rotulo do dado ("6", "F") -> quantidade, na ordem de toque
    // (LinkedHashMap). "F" = dado Fate/Fudge: o termo vira "NdF", que o
    // rules-engine entende (4dF e a rolagem classica do Fate).
    private val pool = LinkedHashMap<String, Int>()

    // Notacao da rolagem rapida (das configuracoes) — rotulo do ROLAR com
    // o campo vazio.
    private var quickNotation: String = ""

    // Ultimas rolagens da sala (as nossas inclusas) — alimenta o
    // activityView do painel (3 linhas) e o cartao de historico (10).
    private val history = ArrayDeque<String>()

    private val dp = context.resources.displayMetrics.density

    private fun Int.dp(): Int = (this * dp).toInt()

    init {
        // d20 vetorial (mesma marca do apps/web) — emoji renderiza diferente
        // em cada fabricante e desalinha dentro do circulo.
        bubble = ImageView(context).apply {
            setImageResource(R.drawable.ic_d20)
            imageTintList = ColorStateList.valueOf(Color.WHITE)
            val pad = 14.dp()
            setPadding(pad, pad, pad, pad)
            background = rippled(
                circle(ACCENT).apply { setStroke(2.dp(), ACCENT_BRIGHT) },
            )
            elevation = 6.dp().toFloat()
            contentDescription = "rolai — abrir acoes de rolagem"
            layoutParams = FrameLayout.LayoutParams(56.dp(), 56.dp())
            setOnClickListener {
                setMode(if (mode == Mode.FAN) Mode.COLLAPSED else Mode.FAN)
            }
        }

        fan = buildFan(context)
        fan.visibility = View.GONE
        panel = buildPanel(context)
        panel.visibility = View.GONE
        historyPanel = buildHistoryPanel(context)
        historyPanel.visibility = View.GONE
        roomPanel = buildRoomPanel(context)
        roomPanel.visibility = View.GONE

        // Flash de resultado da rolagem pelo atalho: compacto, some sozinho
        // (RESULT_FLASH_MS) ou ao toque. NAO abre o cartao de historico.
        resultFlash = TextView(context).apply {
            setTextColor(TEXT)
            textSize = 16f
            setTypeface(Typeface.MONOSPACE, Typeface.BOLD)
            gravity = Gravity.CENTER
            background = cardBackground()
            elevation = 10.dp().toFloat()
            setPadding(14.dp(), 10.dp(), 14.dp(), 10.dp())
            visibility = View.GONE
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = 62.dp() }
            setOnClickListener { setMode(Mode.COLLAPSED) }
        }

        root.addView(bubble)
        root.addView(fan)
        root.addView(panel)
        root.addView(historyPanel)
        root.addView(roomPanel)
        root.addView(resultFlash)
    }

    // ---------- fan (3 mini-bolhas) ----------

    private fun buildFan(context: Context): LinearLayout =
        LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            // Abaixo da bolha principal, com as mini-bolhas (44dp)
            // centralizadas no eixo dela (56dp): (56-44)/2 = 6.
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                topMargin = 62.dp()
                marginStart = 6.dp()
            }
            addView(miniBubble(context, R.drawable.ic_d20, "rolar") { onQuickRoll?.invoke() })
            addView(
                miniBubble(context, R.drawable.ic_history, "historico de rolagens") {
                    setMode(Mode.HISTORY)
                },
            )
            addView(
                miniBubble(context, R.drawable.ic_people, "sala e jogadores") {
                    setMode(Mode.ROOM)
                },
            )
            addView(
                miniBubble(context, R.drawable.ic_settings, "compor rolagem") {
                    setMode(Mode.PANEL)
                },
            )
        }

    private fun miniBubble(
        context: Context,
        iconRes: Int,
        description: String,
        onClick: () -> Unit,
    ): ImageView =
        ImageView(context).apply {
            setImageResource(iconRes)
            imageTintList = ColorStateList.valueOf(ACCENT_BRIGHT)
            val pad = 11.dp()
            setPadding(pad, pad, pad, pad)
            // Escuro, mas puxado pro verde da marca e com aro visivel: em
            // PANEL puro as mini-bolhas sumiam sobre fundo escuro e nao
            // pareciam do mesmo app que a bolha principal.
            background = rippled(circle(FAN_BG).apply { setStroke(1.dp(), ACCENT) })
            elevation = 6.dp().toFloat()
            contentDescription = description
            layoutParams = LinearLayout.LayoutParams(44.dp(), 44.dp()).apply {
                topMargin = 5.dp()
                bottomMargin = 5.dp()
            }
            setOnClickListener { onClick() }
        }

    // ---------- cartao de composicao (PANEL) ----------

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
        val collapseButton = collapseButton(context)
        header.addView(statusDot)
        header.addView(dragHandle)
        header.addView(collapseButton)

        statusView = TextView(context).apply {
            setTextColor(MUTED)
            textSize = 11f
        }

        // Chips de dado em duas fileiras (4 + 4, com o dF do Fate): toque
        // soma ao pool e o proprio chip vira o termo ("2d6"). Espelha o
        // compositor do apps/web — quem calcula continua sendo o
        // rules-engine na WebView headless, nada de regra aqui.
        val rowTop = chipRow(context, DICE_KEYS.take(4))
        val rowBottom = chipRow(context, DICE_KEYS.drop(4))

        // A notacao tambem pode ser digitada ("2d6+3", "4dF"). O campo e a
        // fonte de verdade na hora de rolar: tocar em chip REESCREVE o campo
        // com o pool (edicao manual se perde — chips e teclado sao dois
        // jeitos de montar a rolagem, nao de misturar os dois).
        notationInput = EditText(context).apply {
            setHint(R.string.overlay_notation_hint)
            setHintTextColor(MUTED)
            setTextColor(TEXT)
            textSize = 13f
            setSingleLine()
            typeface = Typeface.MONOSPACE
            gravity = Gravity.CENTER
            background = GradientDrawable().apply {
                cornerRadius = 10.dp().toFloat()
                setColor(CHIP)
                setStroke(1.dp(), BORDER)
            }
            setPadding(8.dp(), 0, 8.dp(), 0)
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
                override fun afterTextChanged(s: Editable?) { updateRollButton() }
            })
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

        panelResultView = TextView(context).apply {
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
            // Fechar aqui: desligar o botao exigia abrir as configuracoes e
            // achar o toggle — caminho longo demais pra uma acao que se quer
            // fazer no meio de outro app.
            addView(
                actionButton(context, R.string.overlay_action_close) {
                    onCloseOverlay?.invoke()
                }.apply { setTextColor(DANGER) },
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
            )
        }

        renderPool()

        return LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = cardBackground()
            elevation = 12.dp().toFloat()
            setPadding(16.dp(), 14.dp(), 16.dp(), 12.dp())
            layoutParams = FrameLayout.LayoutParams(300.dp(), FrameLayout.LayoutParams.WRAP_CONTENT)
            addView(header)
            addView(statusView, vParams(topMargin = 2))
            addView(rowTop, vParams(topMargin = 12))
            addView(rowBottom, vParams(topMargin = 6))
            addView(notationInput, vParams(topMargin = 8))
            addView(rollButton, vParams(topMargin = 10))
            addView(panelResultView, vParams(topMargin = 12))
            addView(activityView, vParams(topMargin = 6))
            addView(divider)
            addView(actionRow, vParams(topMargin = 2))
        }
    }

    // ---------- cartao de historico (HISTORY) ----------

    private fun buildHistoryPanel(context: Context): LinearLayout {
        historyDragHandle = TextView(context).apply {
            setText(R.string.overlay_history_title)
            setTextColor(TEXT)
            textSize = 15f
            letterSpacing = 0.02f
            setTypeface(typeface, Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val header = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(historyDragHandle)
            addView(collapseButton(context))
        }

        historyResultView = TextView(context).apply {
            setTextColor(TEXT)
            textSize = 22f
            gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
        }

        historyLinesView = TextView(context).apply {
            setTextColor(MUTED)
            textSize = 11f
            typeface = Typeface.MONOSPACE
            setText(R.string.overlay_history_empty)
        }

        return LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = cardBackground()
            elevation = 12.dp().toFloat()
            setPadding(16.dp(), 14.dp(), 16.dp(), 12.dp())
            layoutParams = FrameLayout.LayoutParams(300.dp(), FrameLayout.LayoutParams.WRAP_CONTENT)
            addView(header)
            addView(historyResultView, vParams(topMargin = 10))
            addView(historyLinesView, vParams(topMargin = 8))
        }
    }

    /**
     * Painel de sala do overlay: quem esta na mesa, status da conexao e as
     * mesmas acoes da tela de configuracoes.
     *
     * Existe porque saber "quem entrou" e acao de meio-de-jogo — abrir o app
     * inteiro so pra isso tira a pessoa do PDF/ficha que ela esta lendo, que
     * e justamente o que o overlay evita.
     */
    private fun buildRoomPanel(context: Context): LinearLayout {
        val titulo = TextView(context).apply {
            setText(R.string.overlay_room_title)
            setTextColor(TEXT)
            textSize = 15f
            setTypeface(typeface, Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val header = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(titulo)
            addView(collapseButton(context))
        }

        roomStatusView = TextView(context).apply {
            setTextColor(MUTED)
            textSize = 12f
            setTypeface(typeface, Typeface.BOLD)
        }
        roomRosterView = TextView(context).apply {
            setTextColor(TEXT)
            textSize = 13f
            setText(R.string.overlay_room_empty)
        }

        val acoes = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            addView(
                actionButton(context, R.string.overlay_room_join) { onJoinRoom?.invoke() },
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
            )
            addView(
                actionButton(context, R.string.overlay_room_create) { onCreateRoom?.invoke() },
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
            )
            addView(
                actionButton(context, R.string.overlay_room_leave) {
                    onLeaveRoom?.invoke()
                }.apply { setTextColor(DANGER) },
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
            )
        }

        return LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = cardBackground()
            elevation = 12.dp().toFloat()
            setPadding(16.dp(), 14.dp(), 16.dp(), 12.dp())
            layoutParams = FrameLayout.LayoutParams(300.dp(), FrameLayout.LayoutParams.WRAP_CONTENT)
            addView(header)
            addView(roomStatusView, vParams(topMargin = 6))
            addView(roomRosterView, vParams(topMargin = 10))
            addView(acoes, vParams(topMargin = 12))
        }
    }

    private fun renderRoom() {
        roomStatusView.text = statusView.text
        roomRosterView.text = if (roster.isEmpty()) {
            roomRosterView.context.getString(R.string.overlay_room_empty)
        } else {
            roster.joinToString("\n") { "• $it" }
        }
    }

    private fun renderHistory() {
        val lines = history.toList().takeLast(HISTORY_CARD_LINES)
        historyLinesView.text = if (lines.isEmpty()) {
            historyLinesView.context.getString(R.string.overlay_history_empty)
        } else {
            lines.joinToString("\n")
        }
    }

    // ---------- pecas compartilhadas ----------

    private fun vParams(topMargin: Int): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { this.topMargin = topMargin.dp() }

    private fun cardBackground(): GradientDrawable =
        GradientDrawable().apply {
            cornerRadius = 20.dp().toFloat()
            setColor(PANEL)
            setStroke(1.dp(), BORDER)
        }

    private fun circle(color: Int): GradientDrawable =
        GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(color)
            setStroke(1.dp(), Color.argb(0x33, 0xFF, 0xFF, 0xFF))
        }

    private fun collapseButton(context: Context): TextView =
        TextView(context).apply {
            text = "—"
            setTextColor(MUTED)
            textSize = 16f
            gravity = Gravity.CENTER
            background = rippled(pill(Color.TRANSPARENT))
            setPadding(10.dp(), 2.dp(), 10.dp(), 2.dp())
            contentDescription = "recolher"
            setOnClickListener { setMode(Mode.COLLAPSED) }
        }

    private fun chipRow(context: Context, keys: List<String>): LinearLayout {
        val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
        for (key in keys) {
            val chip = TextView(context).apply {
                text = "d$key"
                setTextColor(TEXT)
                textSize = 12f
                maxLines = 1
                setTypeface(Typeface.MONOSPACE, Typeface.BOLD)
                gravity = Gravity.CENTER
                background = chipBackground(active = false)
                setPadding(0, 9.dp(), 0, 9.dp())
                setOnClickListener { addDie(key) }
            }
            chips[key] = chip
            row.addView(
                chip,
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginStart = if (key == keys.first()) 0 else 6.dp()
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

    /**
     * Ripple COM mascara. Sem o terceiro argumento o efeito e ilimitado e,
     * sobre fundo transparente, some — os botoes "limpar/config/abrir app"
     * pareciam texto morto: o toque nao dava sinal nenhum.
     */
    private fun rippled(content: GradientDrawable, mask: GradientDrawable? = null): RippleDrawable =
        RippleDrawable(ColorStateList.valueOf(RIPPLE), content, mask ?: content)

    private fun actionButton(context: Context, resId: Int, onClick: () -> Unit): TextView =
        TextView(context).apply {
            setText(resId)
            // Texto claro sobre superficie propria: em MUTED e fundo
            // transparente nao parecia clicavel.
            setTextColor(TEXT)
            textSize = 12f
            gravity = Gravity.CENTER
            background = rippled(
                pill(SURFACE).apply { setStroke(1.dp(), BORDER) },
            )
            setPadding(4.dp(), 10.dp(), 4.dp(), 10.dp())
            isClickable = true
            setOnClickListener { onClick() }
        }

    private fun pill(color: Int): GradientDrawable =
        GradientDrawable().apply {
            cornerRadius = 999f
            setColor(color)
        }

    // ---------- compositor de pool ----------

    private fun addDie(key: String) {
        pool[key] = (pool[key] ?: 0) + 1
        renderPool()
    }

    private fun clearPool() {
        pool.clear()
        renderPool()
    }

    /** "2d6+1d20" / "4dF" — mesma gramatica multi-termo do rules-engine. */
    private fun poolNotation(): String =
        pool.entries.joinToString("+") { (key, count) -> "${count}d$key" }

    private fun renderPool() {
        val notation = poolNotation()
        for ((key, chip) in chips) {
            val count = pool[key] ?: 0
            chip.text = if (count > 0) "${count}d$key" else "d$key"
            chip.setTextColor(if (count > 0) ACCENT_BRIGHT else TEXT)
            chip.background = chipBackground(active = count > 0)
        }
        // Dispara o TextWatcher, que atualiza o rotulo do ROLAR.
        notationInput.setText(notation)
        notationInput.setSelection(notation.length)
    }

    private fun updateRollButton() {
        val typed = notationInput.text.toString().trim()
        rollButton.text = when {
            typed.isNotEmpty() -> "ROLAR $typed"
            quickNotation.isNotEmpty() -> "ROLAR $quickNotation"
            else -> rollButton.context.getString(R.string.roll_button)
        }
    }

    /** Rola o que esta no campo; vazio = rolagem rapida das configuracoes. */
    private fun rollCurrent() {
        hideKeyboard()
        val notation = notationInput.text.toString().trim()
        if (notation.isEmpty()) onRollClicked?.invoke() else onRollNotation?.invoke(notation)
    }

    private fun hideKeyboard() {
        val imm = root.context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(root.windowToken, 0)
    }

    // ---------- API usada pelo OverlayService ----------

    /** Notacao da rolagem rapida — rotulo do ROLAR com o campo vazio. */
    fun setQuickNotation(notation: String) {
        quickNotation = notation.trim()
        if (::rollButton.isInitialized) updateRollButton()
    }

    /** Compatibilidade com a API antiga: true = painel, false = recolhido. */
    fun setExpanded(expanded: Boolean) {
        setMode(if (expanded) Mode.PANEL else Mode.COLLAPSED)
    }

    private val hideResultRunnable = Runnable {
        if (mode == Mode.RESULT) setMode(Mode.COLLAPSED)
    }

    private fun setMode(newMode: Mode) {
        // Saindo do painel: adota o que foi composto (ver onComposedNotation).
        if (mode == Mode.PANEL && newMode != Mode.PANEL) {
            val composto = notationInput.text.toString().trim()
            if (composto.isNotEmpty() && composto != quickNotation) {
                onComposedNotation?.invoke(composto)
            }
        }
        mode = newMode
        bubble.visibility =
            if (newMode == Mode.PANEL || newMode == Mode.HISTORY || newMode == Mode.ROOM) {
                View.GONE
            } else {
                View.VISIBLE
            }
        fan.visibility = if (newMode == Mode.FAN) View.VISIBLE else View.GONE
        panel.visibility = if (newMode == Mode.PANEL) View.VISIBLE else View.GONE
        historyPanel.visibility = if (newMode == Mode.HISTORY) View.VISIBLE else View.GONE
        roomPanel.visibility = if (newMode == Mode.ROOM) View.VISIBLE else View.GONE
        resultFlash.visibility = if (newMode == Mode.RESULT) View.VISIBLE else View.GONE
        root.removeCallbacks(hideResultRunnable)
        if (newMode == Mode.RESULT) root.postDelayed(hideResultRunnable, RESULT_FLASH_MS)
        // So o PANEL tem campo de texto — so ele precisa de janela focavel.
        onWindowFocusMode?.invoke(newMode == Mode.PANEL)
        if (newMode != Mode.PANEL) hideKeyboard()
        if (newMode == Mode.HISTORY) renderHistory()
        if (newMode == Mode.ROOM) renderRoom()
    }

    /** Roster da sala, vindo do RoomClient via OverlayService. */
    fun setRoster(names: List<String>) {
        roster = names
        if (mode == Mode.ROOM) renderRoom()
    }

    fun setStatus(text: String) {
        statusView.text = text
        if (mode == Mode.ROOM) renderRoom()
        val connected = text.contains("conectado", ignoreCase = true) &&
            !text.contains("desconectado", ignoreCase = true)
        statusDot.setTextColor(if (connected) ACCENT_BRIGHT else MUTED)
    }

    fun showResult(text: String) {
        panelResultView.text = text
        historyResultView.text = text
        resultFlash.text = text
        // Com o painel aberto (rolagem por chips/digitada), o resultado
        // aparece nele mesmo. Pelo atalho do fan: flash compacto que some
        // sozinho — NAO abre cartao nenhum.
        if (mode != Mode.PANEL) setMode(Mode.RESULT)
    }

    /** Anexa uma linha de atividade da sala (rolagens, nossas e dos outros). */
    fun addActivityLine(line: String) {
        history.addLast(line)
        while (history.size > MAX_HISTORY) history.removeFirst()
        activityView.text = history.toList().takeLast(MAX_ACTIVITY_LINES).joinToString("\n")
        if (mode == Mode.HISTORY) renderHistory()
    }

    /** Arrasto da bolha e dos cabecalhos, com snap na borda ao soltar. */
    @SuppressLint("ClickableViewAccessibility")
    fun bindDrag(windowManager: WindowManager, params: WindowManager.LayoutParams) {
        val listener = DragTouchListener(windowManager, params)
        bubble.setOnTouchListener(listener)
        dragHandle.setOnTouchListener(listener)
        historyDragHandle.setOnTouchListener(listener)
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
        // Ripple esverdeado: o branco puro sumia sobre o painel escuro.
        private val RIPPLE = Color.argb(0x66, 0x25, 0xC4, 0x8F)
        // Superficie de botao dentro do painel e fundo das mini-bolhas.
        private val SURFACE = Color.argb(0x1F, 0x25, 0xC4, 0x8F)
        private val FAN_BG = Color.rgb(0x10, 0x2A, 0x22)
        private val DANGER = Color.rgb(0xE0, 0x6C, 0x75)
        private val TEXT = Color.rgb(0xE8, 0xEC, 0xF0)
        private val MUTED = Color.rgb(0x8B, 0x95, 0xA1)
        private const val MAX_ACTIVITY_LINES = 3
        private const val HISTORY_CARD_LINES = 10
        private const val MAX_HISTORY = 20

        /** Tempo do flash de resultado na tela antes de sumir sozinho. */
        private const val RESULT_FLASH_MS = 6_000L

        // Rotulos de dado dos chips ("F" = dado Fate/Fudge — "4dF").
        private val DICE_KEYS = listOf("4", "6", "8", "10", "12", "20", "100", "F")
        private const val TOUCH_SLOP_DP = 8
    }
}
