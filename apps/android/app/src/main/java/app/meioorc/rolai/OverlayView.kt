package app.meioorc.rolai

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.text.Editable
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.TextWatcher
import android.text.style.ForegroundColorSpan
import android.text.style.RelativeSizeSpan
import android.text.style.StyleSpan
import org.json.JSONArray
import org.json.JSONObject
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ArrayAdapter
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.TextView
import kotlin.math.abs

/**
 * View flutuante do overlay (desenhada via WindowManager pelo
 * OverlayService). Tier "texto puro" da escada de qualidade
 * (docs/architecture.md) — NUNCA 3D aqui (o 3D e o palco, DiceStageWindow).
 *
 * Quatro estados:
 *  - COLLAPSED: so a bolha redonda, ancorada na borda, arrastavel;
 *  - FAN: a bolha abre as mini-bolhas — rolar (a ULTima rolagem OU puxada,
 *    o que tiver sido feito por ultimo; ou a configurada se ainda nao rolou
 *    nada), historico, sala e compor (onde mora a secao Baralho tambem);
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

    /**
     * Raiz do overlay.
     *
     * `clipChildren/clipToPadding = false` + padding: a janela e
     * WRAP_CONTENT, entao terminava exatamente na borda da bolha e a SOMBRA
     * (elevation) era cortada reto embaixo — uma linha horizontal estranha
     * atras do botao. O padding da a folga que a sombra precisa pra
     * desvanecer; como a area extra e transparente e a janela nao e
     * tocavel fora dos filhos, nao muda o alvo do toque.
     */
    /**
     * Raiz do overlay.
     *
     * O padding e o espaco onde a SOMBRA do elevation desenha: sem ele a
     * janela (WRAP_CONTENT) termina na borda da bolha e a sombra sai cortada
     * reto. Mas ele tambem empurra a bolha pra dentro — e essa era a folga
     * que deixava o botao longe da borda.
     *
     * Solucao: padding pequeno aqui + x negativo na janela
     * (OverlayService.EDGE_INSET_DP) compensando quase todo ele. Sobra uma
     * bordinha fina, e a sombra continua inteira.
     *
     * clipChildren/clipToPadding = false: sem isso o padding nao adianta,
     * o desenho e recortado nos limites mesmo assim.
     */
    val root: FrameLayout = FrameLayout(context).apply {
        clipChildren = false
        clipToPadding = false
        val folga = (SHADOW_PAD_DP * context.resources.displayMetrics.density).toInt()
        setPadding(folga, folga, folga, folga)
    }

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

    /**
     * Copiar o link da sala atual — toque unico, igual "Sair": nao precisa
     * de teclado, entao nao precisa abrir a tela de config (ao contrario de
     * Entrar/Criar, que digitam codigo).
     */
    var onCopyRoomLink: (() -> Unit)? = null

    /** Ultimo roster recebido — exibido no painel de sala. */
    private var roster: List<String> = emptyList()

    /** Mini-bolha de rolagem do fan: ultima rolagem, ou a configurada — vale
     *  pra dado OU carta, o que tiver sido feito por ultimo (ver
     *  OverlayService.lastRollAction). */
    var onQuickRoll: (() -> Unit)? = null

    /** Botao "puxar" da secao Baralho do painel (specs/08-baralho.md).
     *  Recebe a quantidade escolhida no stepper. */
    var onDrawCard: ((count: Int) -> Unit)? = null

    /** Botao "reembaralhar" da secao Baralho. */
    var onReshuffleDeck: (() -> Unit)? = null

    /**
     * Rolagem de sistema com os inputs preenchidos no painel (JSON pronto
     * pro motor). Existe pra CD e bonus deixarem de morar so na tela de
     * configuracoes: perguntar aqui e o que evita sair do jogo pra mudar
     * uma CD.
     */
    var onRollWithInputs: ((String) -> Unit)? = null

    /**
     * Sistema "overlay" (roll_under): a notacao e o que o compositor de
     * chips montou, e os inputs (ex. "valor testado") vao junto — o
     * profile so avalia outcome_rules sobre o resultado, nao tem dado
     * proprio (ver rollOverlay em rules-engine/profile.ts).
     */
    var onRollOverlay: ((notation: String, inputsJson: String) -> Unit)? = null

    /**
     * Botao "compor" do fan (engrenagem): abre o compositor COM os campos
     * do sistema ativo, se houver — quem resolve qual sistema esta ativo e
     * o OverlayService (esta view nao sabe de systems.json).
     */
    var onOpenComposer: (() -> Unit)? = null
    var onOpenApp: (() -> Unit)? = null
    var onOpenSettings: (() -> Unit)? = null

    /** Aba de modo tocada dentro da caixa (ex.: Infaernum "Ideias") — troca
     *  o sistema ativo sem sair pras configuracoes. Espelha as
     *  `family-tabs` do RollPanel da web. */
    var onSelectFamilyMember: ((String) -> Unit)? = null

    /**
     * Forçar (o push do Year Zero): recalcula o pool a partir da rolagem
     * anterior e rola de novo — um toque, como na mesa. A conta nao mora
     * aqui nem em Kotlin nenhum: quem calcula e `yzePush.ts`, chamado pela
     * WebView headless (AGENTS.md).
     */
    var onForcePush: ((String) -> Unit)? = null

    /** Painel do sistema fechado sem rolar — salva os campos digitados (e a
     *  notacao do composer, se o sistema ativo for "overlay") como novo
     *  padrao (ver setMode). */
    var onPersistSystemInputs: ((inputsJson: String, notation: String?) -> Unit)? = null

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
    private lateinit var panelScroll: MaxHeightScrollView
    private lateinit var historyScroll: MaxHeightScrollView
    private lateinit var roomScroll: MaxHeightScrollView

    enum class PanelTab { SYSTEM, DICE, DECK }
    private var currentPanelTab = PanelTab.DICE
    private lateinit var tabSystemButton: TextView
    private lateinit var tabDiceButton: TextView
    private lateinit var tabDeckButton: TextView
    private lateinit var familyTabsRow: LinearLayout
    private lateinit var systemContainer: LinearLayout
    private lateinit var diceContainer: LinearLayout
    private lateinit var deckContainer: LinearLayout
    private lateinit var deckRemainingView: TextView
    private lateinit var systemTitle: TextView
    private lateinit var systemFields: LinearLayout
    private lateinit var profileRollButton: TextView
    private lateinit var pushButton: TextView
    private lateinit var overlaySystemSection: LinearLayout
    private lateinit var overlaySystemTitle: TextView
    private lateinit var overlaySystemFields: LinearLayout
    private var activeOverlayInfo: SystemInfo? = null
    private val systemInputViews = LinkedHashMap<String, Pair<ProfileInput, View>>()
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
    private var deckCount = 1
    private lateinit var deckCountView: TextView
    private var quickNotation: String = ""
    private val history = ArrayDeque<String>()

    private val dp = context.resources.displayMetrics.density

    private fun Int.dp(): Int = (this * dp).toInt()

    init {
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
        panel = buildPanelCard(context)
        panel.visibility = View.GONE
        historyPanel = buildHistoryPanel(context)
        historyPanel.visibility = View.GONE
        roomPanel = buildRoomPanel(context)
        roomPanel.visibility = View.GONE

        // Flash de resultado da rolagem pelo atalho: compacto, some sozinho
        // (RESULT_FLASH_MS) ou ao toque. NAO abre o cartao de historico.
        resultFlash = TextView(context).apply {
            setTextColor(TEXT)
            textSize = 15f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            gravity = Gravity.CENTER
            background = cardBackground()
            elevation = 10.dp().toFloat()
            setPadding(14.dp(), 10.dp(), 14.dp(), 10.dp())
            setLineSpacing(3.dp().toFloat(), 1f)
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
                    onOpenComposer?.invoke()
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

    /**
     * Monta o cartao do compositor (painel completo).
     */
    private fun buildPanelCard(context: Context): LinearLayout {
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

        // Abas: Sistema (quando ativo) | Dados | Baralho
        val modeTabsRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
        }
        tabSystemButton = familyTabButton(context, "Sistema", currentPanelTab == PanelTab.SYSTEM) {
            setPanelTab(PanelTab.SYSTEM)
        }.apply { visibility = View.GONE }
        tabDiceButton = familyTabButton(context, context.getString(R.string.overlay_tab_dice), currentPanelTab == PanelTab.DICE) {
            setPanelTab(PanelTab.DICE)
        }
        tabDeckButton = familyTabButton(context, context.getString(R.string.overlay_tab_deck), currentPanelTab == PanelTab.DECK) {
            setPanelTab(PanelTab.DECK)
        }
        modeTabsRow.addView(
            tabSystemButton,
            LinearLayout.LayoutParams(0, 32.dp(), 1f),
        )
        modeTabsRow.addView(
            tabDiceButton,
            LinearLayout.LayoutParams(0, 32.dp(), 1f).apply {
                marginStart = 4.dp()
            },
        )
        modeTabsRow.addView(
            tabDeckButton,
            LinearLayout.LayoutParams(0, 32.dp(), 1f).apply {
                marginStart = 4.dp()
            },
        )

        // ---------- ABA 1: SISTEMA ----------
        familyTabsRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            visibility = View.GONE
        }
        systemTitle = TextView(context).apply {
            setTextColor(MUTED)
            textSize = 11f
            isAllCaps = true
            letterSpacing = 0.06f
            setTypeface(typeface, Typeface.BOLD)
        }
        systemFields = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
        profileRollButton = TextView(context).apply {
            setText(R.string.roll_button)
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            textSize = 14f
            setTypeface(typeface, Typeface.BOLD)
            letterSpacing = 0.04f
            isAllCaps = true
            background = rippled(
                GradientDrawable().apply {
                    cornerRadius = 10.dp().toFloat()
                    setColor(ACCENT)
                },
            )
            setPadding(0, 10.dp(), 0, 10.dp())
            setOnClickListener {
                val overlay = activeOverlayInfo
                if (overlay != null) {
                    val not = notationInput.text.toString().trim().ifEmpty {
                        quickNotation.ifEmpty { "1d20" }
                    }
                    onRollOverlay?.invoke(not, currentInputsJson())
                } else {
                    onRollWithInputs?.invoke(currentInputsJson())
                }
            }
        }
        // Botao secundario de proposito (contorno, nao preenchido): quem
        // rola do zero continua sendo o ROLAR acima. So aparece quando ha
        // uma rolagem propria pra forcar — ver setPushAvailable.
        pushButton = TextView(context).apply {
            text = "FORÇAR"
            gravity = Gravity.CENTER
            setTextColor(ACCENT)
            textSize = 13f
            setTypeface(typeface, Typeface.BOLD)
            letterSpacing = 0.04f
            isAllCaps = true
            visibility = View.GONE
            background = rippled(
                GradientDrawable().apply {
                    cornerRadius = 10.dp().toFloat()
                    setColor(Color.TRANSPARENT)
                    setStroke(1.dp(), ACCENT)
                },
            )
            setPadding(0, 8.dp(), 0, 8.dp())
            setOnClickListener { onForcePush?.invoke(currentInputsJson()) }
        }
        systemContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            visibility = if (currentPanelTab == PanelTab.SYSTEM) View.VISIBLE else View.GONE
            addView(familyTabsRow, vParams(topMargin = 2))
            addView(systemTitle, vParams(topMargin = 4))
            addView(systemFields, vParams(topMargin = 4))
            addView(profileRollButton, vParams(topMargin = 8))
            addView(pushButton, vParams(topMargin = 6))
        }

        // ---------- ABA 2: DADOS LIVRES & SISTEMA OVERLAY ----------
        overlaySystemTitle = TextView(context).apply {
            setTextColor(MUTED)
            textSize = 11f
            isAllCaps = true
            letterSpacing = 0.06f
            setTypeface(typeface, Typeface.BOLD)
        }
        overlaySystemFields = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
        overlaySystemSection = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            addView(overlaySystemTitle, vParams(topMargin = 2))
            addView(overlaySystemFields, vParams(topMargin = 4))
        }

        val rowTop = chipRow(context, DICE_KEYS.take(6))
        val rowBottom = chipRow(context, DICE_KEYS.drop(6))

        notationInput = EditText(context).apply {
            setHint(R.string.overlay_notation_hint)
            setHintTextColor(MUTED)
            setTextColor(TEXT)
            textSize = 13f
            setSingleLine()
            typeface = Typeface.MONOSPACE
            gravity = Gravity.CENTER
            background = GradientDrawable().apply {
                cornerRadius = 8.dp().toFloat()
                setColor(CHIP)
                setStroke(1.dp(), BORDER)
            }
            setPadding(8.dp(), 6.dp(), 8.dp(), 6.dp())
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
                override fun afterTextChanged(s: Editable?) {
                    updateRollButton()
                    syncChipsWithNotation(s?.toString().orEmpty())
                }
            })
        }

        val clearComposerButton = stepperGlyphButton(context, "✕", "limpar pool") { clearPool() }

        val notationRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(
                notationInput,
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
            )
            addView(
                clearComposerButton,
                LinearLayout.LayoutParams(32.dp(), 32.dp()).apply { marginStart = 6.dp() },
            )
        }

        rollButton = TextView(context).apply {
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            textSize = 14f
            setTypeface(typeface, Typeface.BOLD)
            letterSpacing = 0.04f
            isAllCaps = true
            background = rippled(
                GradientDrawable().apply {
                    cornerRadius = 10.dp().toFloat()
                    setColor(ACCENT)
                },
            )
            setPadding(0, 10.dp(), 0, 10.dp())
            setOnClickListener { rollCurrent() }
        }

        diceContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            visibility = if (currentPanelTab == PanelTab.DICE) View.VISIBLE else View.GONE
            addView(overlaySystemSection)
            addView(rowTop, vParams(topMargin = 4))
            addView(rowBottom, vParams(topMargin = 4))
            addView(notationRow, vParams(topMargin = 6))
            addView(rollButton, vParams(topMargin = 8))
        }

        // ---------- ABA 3: BARALHO ----------
        deckCountView = TextView(context).apply {
            text = deckCount.toString()
            setTextColor(TEXT)
            textSize = 15f
            gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
        }
        fun stepDeckCount(delta: Int) {
            deckCount = (deckCount + delta).coerceIn(1, DECK_MAX_COUNT)
            deckCountView.text = deckCount.toString()
        }
        val drawButton = TextView(context).apply {
            setText(R.string.overlay_deck_draw)
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            textSize = 14f
            setTypeface(typeface, Typeface.BOLD)
            letterSpacing = 0.04f
            isAllCaps = true
            background = rippled(
                GradientDrawable().apply {
                    cornerRadius = 10.dp().toFloat()
                    setColor(ACCENT)
                },
            )
            setPadding(12.dp(), 8.dp(), 12.dp(), 8.dp())
            setOnClickListener { onDrawCard?.invoke(deckCount) }
        }
        val deckStepperRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(
                stepperGlyphButton(context, "−", "menos cartas") { stepDeckCount(-1) },
                LinearLayout.LayoutParams(32.dp(), 32.dp()),
            )
            addView(
                deckCountView,
                LinearLayout.LayoutParams(32.dp(), LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    marginStart = 4.dp()
                    marginEnd = 4.dp()
                },
            )
            addView(
                stepperGlyphButton(context, "+", "mais cartas") { stepDeckCount(1) },
                LinearLayout.LayoutParams(32.dp(), 32.dp()),
            )
            addView(
                drawButton,
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginStart = 8.dp()
                },
            )
        }

        val reshuffleButton = actionButton(context, R.string.overlay_deck_reshuffle) {
            onReshuffleDeck?.invoke()
        }
        deckRemainingView = TextView(context).apply {
            setTextColor(MUTED)
            textSize = 11f
            gravity = Gravity.CENTER
            visibility = View.GONE
        }
        val deckActionRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(
                reshuffleButton,
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
            )
            addView(
                deckRemainingView,
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginStart = 6.dp()
                },
            )
        }

        deckContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            visibility = if (currentPanelTab == PanelTab.DECK) View.VISIBLE else View.GONE
            addView(deckStepperRow, vParams(topMargin = 6))
            addView(deckActionRow, vParams(topMargin = 6))
        }

        // ---------- RESULTADO & LOG COMUM ----------
        panelResultView = TextView(context).apply {
            setTextColor(TEXT)
            textSize = 18f
            gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
            setLineSpacing(3.dp().toFloat(), 1f)
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
            ).apply { topMargin = 8.dp() }
        }

        val actionRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
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
            addView(
                actionButton(context, R.string.overlay_action_close) {
                    onCloseOverlay?.invoke()
                }.apply { setTextColor(DANGER) },
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
            )
        }

        syncChipsWithNotation(notationInput.text.toString())

        val body = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            addView(header)
            addView(statusView, vParams(topMargin = 2))
            addView(modeTabsRow, vParams(topMargin = 6))
            addView(systemContainer, vParams(topMargin = 4))
            addView(diceContainer, vParams(topMargin = 4))
            addView(deckContainer, vParams(topMargin = 4))
            addView(panelResultView, vParams(topMargin = 6))
            addView(activityView, vParams(topMargin = 4))
            addView(divider)
            addView(actionRow, vParams(topMargin = 4))
        }
        panelScroll = scrollWrapper(context, body)

        return LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = cardBackground()
            elevation = 12.dp().toFloat()
            setPadding(14.dp(), 12.dp(), 14.dp(), 10.dp())
            layoutParams = FrameLayout.LayoutParams(300.dp(), FrameLayout.LayoutParams.WRAP_CONTENT)
            addView(panelScroll)
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
            visibility = View.GONE
        }

        historyLinesView = TextView(context).apply {
            setTextColor(TEXT)
            textSize = 12.5f
            setLineSpacing(4.dp().toFloat(), 1.0f)
            setText(R.string.overlay_history_empty)
        }

        val body = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            addView(header)
            addView(historyLinesView, vParams(topMargin = 12))
        }
        historyScroll = scrollWrapper(context, body)

        return LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = cardBackground()
            elevation = 12.dp().toFloat()
            setPadding(16.dp(), 14.dp(), 16.dp(), 14.dp())
            layoutParams = FrameLayout.LayoutParams(310.dp(), FrameLayout.LayoutParams.WRAP_CONTENT)
            addView(historyScroll)
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

        // Linha propria, largura cheia: junto das outras tres (peso 1/4 num
        // painel de 300dp) o rotulo "copiar link" quebrava/cortava.
        val copiarLink = actionButton(context, R.string.overlay_room_copy_link) {
            onCopyRoomLink?.invoke()
        }

        val body = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            addView(header)
            addView(roomStatusView, vParams(topMargin = 6))
            addView(roomRosterView, vParams(topMargin = 10))
            addView(acoes, vParams(topMargin = 12))
            addView(copiarLink, vParams(topMargin = 6))
        }
        roomScroll = scrollWrapper(context, body)

        return LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = cardBackground()
            elevation = 12.dp().toFloat()
            setPadding(16.dp(), 14.dp(), 16.dp(), 12.dp())
            layoutParams = FrameLayout.LayoutParams(300.dp(), FrameLayout.LayoutParams.WRAP_CONTENT)
            addView(roomScroll)
        }
    }

    // ---------- campos do sistema ativo (dentro do PANEL) ----------

    private fun systemShortLabel(info: SystemInfo?): String {
        if (info == null) return "Sistema"
        val family = ProfileFamilies.familyFor(info.system)
        if (family != null) return family.shortLabel
        return when (info.system) {
            "roll_under" -> "Roll Under"
            "wod5" -> "WoD v5"
            "pbta", "pbta2d10" -> "PbtA"
            "pool_d6" -> "Pool d6"
            "fate" -> "Fate / Fudge"
            else -> {
                val raw = info.label
                when {
                    raw.contains(" — ") -> raw.substringBefore(" — ").trim()
                    raw.contains(" - ") -> raw.substringBefore(" - ").trim()
                    raw.contains(" (") -> raw.substringBefore(" (").trim()
                    else -> raw
                }
            }
        }
    }

    /**
     * Abre o compositor (chips + notacao) com os campos do sistema ativo
     * visiveis JUNTO, se houver — `info` null (ou sem input) esconde a
     * sub-secao e deixa so os chips normais, como antes de ter sistema
     * nenhum configurado.
     *
     * Antes, CD/modificador so existiam na tela de configuracoes, escritos
     * como JSON cru: mudar a CD de um teste exigia sair do jogo, abrir o
     * app, achar "Rolagem rapida" e digitar. E antes DESTA mudanca, o
     * formulario ocupava um cartao SEPARADO dos chips normais — trocar de
     * sistema fazia o compositor desaparecer por completo, sem jeito de
     * rolar um d6 solto sem sair do sistema configurado.
     */
    fun openComposer(info: SystemInfo?, saved: Map<String, String>) {
        activeOverlayInfo = info?.takeIf { it.isOverlay }
        val isOverlay = info?.isOverlay == true
        val isInfaernum = info?.system?.startsWith("infaernum") == true
        val hasSystem = info != null && (info.needsForm || isInfaernum || isOverlay)

        systemInputViews.clear()

        if (!hasSystem) {
            tabSystemButton.visibility = View.GONE
            systemContainer.visibility = View.GONE
            overlaySystemSection.visibility = View.GONE
            familyTabsRow.visibility = View.GONE
            tabDiceButton.text = tabDiceButton.context.getString(R.string.overlay_tab_dice)
            if (currentPanelTab == PanelTab.SYSTEM) {
                setPanelTab(PanelTab.DICE)
            }
            updateRollButton()
        } else if (isOverlay) {
            // Sistema tipo "overlay" (ex.: Roll Under): os dados e a configuracao
            // ficam JUNTOS na mesma aba de Dados, sem necessidade de alternar abas!
            tabSystemButton.visibility = View.GONE
            systemContainer.visibility = View.GONE
            familyTabsRow.visibility = View.GONE
            tabDiceButton.visibility = View.VISIBLE
            tabDiceButton.text = systemShortLabel(info)

            val context = overlaySystemFields.context
            overlaySystemSection.visibility = View.VISIBLE
            overlaySystemTitle.text = info?.label
            overlaySystemFields.removeAllViews()

            val inputs = info?.formInputs.orEmpty()
            var i = 0
            while (i < inputs.size) {
                val input1 = inputs[i]
                val input2 = if (i + 1 < inputs.size) inputs[i + 1] else null

                if (input2 != null) {
                    val row = LinearLayout(context).apply {
                        orientation = LinearLayout.HORIZONTAL
                        gravity = Gravity.CENTER_VERTICAL
                    }
                    val col1 = buildInputFieldColumn(context, input1, saved)
                    val col2 = buildInputFieldColumn(context, input2, saved)
                    row.addView(col1, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                    row.addView(col2, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                        marginStart = 8.dp()
                    })
                    overlaySystemFields.addView(row, vParams(topMargin = if (i == 0) 2 else 6))
                    i += 2
                } else {
                    val col = buildInputFieldColumn(context, input1, saved)
                    overlaySystemFields.addView(col, vParams(topMargin = if (i == 0) 2 else 6))
                    i += 1
                }
            }

            if (notationInput.text.isEmpty()) {
                notationInput.setText(quickNotation.ifEmpty { "1d20" })
            }
            setPanelTab(PanelTab.DICE)
            updateRollButton()
        } else {
            // Sistema padrao com rolagem propria (Infaernum, Year Zero, Trophy, PbtA, etc.)
            overlaySystemSection.visibility = View.GONE
            tabSystemButton.visibility = View.VISIBLE
            tabSystemButton.text = if (isInfaernum) "Infaernum" else systemShortLabel(info)
            tabDiceButton.text = tabDiceButton.context.getString(R.string.overlay_tab_dice)
            val context = systemFields.context

            familyTabsRow.removeAllViews()
            if (isInfaernum) {
                familyTabsRow.visibility = View.VISIBLE
                val actions = listOf(
                    Pair("infaernum", "Ação"),
                    Pair("infaernum_sim_ou_nao", "Sim ou Não"),
                    Pair("infaernum_ideias", "Ideias"),
                )
                for ((i, action) in actions.withIndex()) {
                    val (actionSystem, actionLabel) = action
                    val isActive = actionSystem == info?.system
                    familyTabsRow.addView(
                        familyTabButton(context, actionLabel, isActive) {
                            onSelectFamilyMember?.invoke(actionSystem)
                        },
                        LinearLayout.LayoutParams(0, 32.dp(), 1f).apply {
                            marginStart = if (i == 0) 0 else 4.dp()
                        },
                    )
                }
            } else {
                familyTabsRow.visibility = View.GONE
            }

            systemTitle.visibility = View.VISIBLE
            systemTitle.text = info?.label
            systemFields.removeAllViews()

            val inputs = info?.formInputs.orEmpty()
            var i = 0
            while (i < inputs.size) {
                val input1 = inputs[i]
                val input2 = if (i + 1 < inputs.size) inputs[i + 1] else null

                if (input2 != null) {
                    val row = LinearLayout(context).apply {
                        orientation = LinearLayout.HORIZONTAL
                        gravity = Gravity.CENTER_VERTICAL
                    }
                    val col1 = buildInputFieldColumn(context, input1, saved)
                    val col2 = buildInputFieldColumn(context, input2, saved)
                    row.addView(col1, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                    row.addView(col2, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                        marginStart = 8.dp()
                    })
                    systemFields.addView(row, vParams(topMargin = if (i == 0) 2 else 6))
                    i += 2
                } else {
                    val col = buildInputFieldColumn(context, input1, saved)
                    systemFields.addView(col, vParams(topMargin = if (i == 0) 2 else 6))
                    i += 1
                }
            }

            profileRollButton.visibility = View.VISIBLE
            profileRollButton.text = "ROLAR ${if (isInfaernum) "INFAERNUM" else systemShortLabel(info).uppercase()}"
            pushButton.visibility = View.GONE
            setPanelTab(PanelTab.SYSTEM)
        }
        setMode(Mode.PANEL)
    }

    private fun buildInputFieldColumn(
        context: Context,
        input: ProfileInput,
        saved: Map<String, String>,
    ): LinearLayout {
        val col = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
        }
        val labelRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val labelView = TextView(context).apply {
            text = input.label
            setTextColor(MUTED)
            textSize = 11f
            setTypeface(typeface, Typeface.BOLD)
        }
        labelRow.addView(
            labelView,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
        )

        if (input.isSelect) {
            col.addView(labelRow)
            val spinner = Spinner(context).apply {
                adapter = object : ArrayAdapter<String>(
                    context,
                    android.R.layout.simple_spinner_item,
                    input.options.map { it.label },
                ) {
                    override fun getView(
                        position: Int,
                        convertView: View?,
                        parent: ViewGroup,
                    ): View = (super.getView(position, convertView, parent) as TextView)
                        .apply {
                            setTextColor(TEXT)
                            textSize = 13f
                        }

                    override fun getDropDownView(
                        position: Int,
                        convertView: View?,
                        parent: ViewGroup,
                    ): View = (super.getDropDownView(position, convertView, parent) as TextView)
                        .apply {
                            setTextColor(TEXT)
                            setBackgroundColor(PANEL)
                            setPadding(14.dp(), 10.dp(), 14.dp(), 10.dp())
                        }
                }.apply {
                    setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                }
                background = GradientDrawable().apply {
                    cornerRadius = 8.dp().toFloat()
                    setColor(CHIP)
                    setStroke(1.dp(), BORDER)
                }
                setPadding(6.dp(), 6.dp(), 6.dp(), 6.dp())
                setSelection(
                    input.options.indexOfFirst { it.value == saved[input.id] }.coerceAtLeast(0),
                )
            }
            systemInputViews[input.id] = input to spinner
            col.addView(spinner, vParams(topMargin = 3))
        } else {
            val editText = EditText(context).apply {
                inputType = android.text.InputType.TYPE_CLASS_NUMBER or
                    android.text.InputType.TYPE_NUMBER_FLAG_SIGNED
                setTextColor(TEXT)
                textSize = 14f
                gravity = Gravity.CENTER
                setSingleLine()
                background = GradientDrawable().apply {
                    cornerRadius = 8.dp().toFloat()
                    setColor(CHIP)
                    setStroke(1.dp(), BORDER)
                }
                setPadding(2.dp(), 2.dp(), 2.dp(), 2.dp())
                setText(saved[input.id] ?: input.default.orEmpty())
            }
            systemInputViews[input.id] = input to editText

            if (!input.required) {
                val clearBtn = TextView(context).apply {
                    text = "×"
                    contentDescription = "limpar"
                    setTextColor(MUTED)
                    textSize = 13f
                    setTypeface(typeface, Typeface.BOLD)
                    gravity = Gravity.CENTER
                    setPadding(4.dp(), 0, 4.dp(), 0)
                    isClickable = true
                    setOnClickListener { editText.setText("") }
                }
                fun refreshClearState() {
                    clearBtn.visibility = if (editText.text.isNotEmpty()) View.VISIBLE else View.INVISIBLE
                }
                editText.addTextChangedListener(
                    object : TextWatcher {
                        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
                        override fun afterTextChanged(s: Editable?) = refreshClearState()
                    },
                )
                refreshClearState()
                labelRow.addView(clearBtn)
            }
            col.addView(labelRow)

            val stepper = numberFieldRow(context, editText)
            col.addView(stepper, vParams(topMargin = 3))
        }
        return col
    }

    /**
     * Mostra ou esconde o FORÇAR. Quem decide e o Service: so faz sentido
     * com uma rolagem PROPRIA e do sistema atual na memoria — "existe
     * sistema Year Zero configurado" nao e a mesma coisa que "tem rolagem
     * pra forcar" (AGENTS.md, a armadilha de sempre).
     */
    fun setPushAvailable(available: Boolean) {
        if (!::pushButton.isInitialized) return
        pushButton.visibility = if (available) View.VISIBLE else View.GONE
    }

    /**
     * Repõe os campos com os valores que o Forçar acabou de usar (pool
     * recalculado, sucesso garantido). Sem isto o formulario continuaria
     * mostrando o pool ANTES do push — o jogador rolaria de novo com o
     * numero velho achando que era o novo.
     */
    fun updateSystemInputs(values: Map<String, String>) {
        for ((id, par) in systemInputViews) {
            val (input, view) = par
            val value = values[id] ?: continue
            when (view) {
                is EditText -> if (view.text.toString() != value) view.setText(value)
                is Spinner -> {
                    val index = input.options.indexOfFirst { it.value == value }
                    if (index >= 0) view.setSelection(index)
                }
            }
        }
    }

    private fun currentInputsJson(): String {
        val valores = systemInputViews.mapValues { (_, par) ->
            val (input, view) = par
            when (view) {
                is EditText -> view.text.toString()
                is Spinner -> input.options.getOrNull(view.selectedItemPosition)?.value.orEmpty()
                else -> ""
            }
        }
        return ProfileForm.toJson(valores, systemInputViews.values.map { it.first })
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
        val lines = history.toList().reversed().take(HISTORY_CARD_LINES)
        if (lines.isEmpty()) {
            historyLinesView.text = historyLinesView.context.getString(R.string.overlay_history_empty)
            return
        }
        val ssb = SpannableStringBuilder()
        for (i in lines.indices) {
            ssb.append(formatRichLine(lines[i]))
            if (i < lines.size - 1) {
                ssb.append("\n\n")
            }
        }
        historyLinesView.text = ssb
    }

    // ---------- pecas compartilhadas ----------

    private fun vParams(topMargin: Int): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { this.topMargin = topMargin.dp() }

    /**
     * Fundo dos tres cartoes do overlay (compor, historico, sala).
     *
     * Mesmo verde escuro das mini-bolhas, com aro verde: em cinza neutro os
     * cartoes nao pareciam do mesmo app que a bolha, e sobre wallpaper
     * escuro a borda sumia. Um ponto so — os tres painies chamam daqui.
     */
    private fun cardBackground(): GradientDrawable =
        GradientDrawable().apply {
            cornerRadius = 20.dp().toFloat()
            setColor(FAN_BG)
            setStroke(1.dp(), CARD_STROKE)
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
        val density = context.resources.displayMetrics.density
        for (key in keys) {
            val label = if (key == "C") "carta" else if (key == "F") "dF" else "d$key"
            val chip = TextView(context).apply {
                text = label
                setTextColor(TEXT)
                textSize = if (key == "C" || key == "100") 13.5f else 15f
                maxLines = 1
                setTypeface(Typeface.DEFAULT_BOLD)
                gravity = Gravity.CENTER
                background = chipBackground(active = false)
                setPadding(0, 7.dp(), 0, 7.dp())
                val iconDrawable = DieIconDrawable(key, MUTED, density)
                setCompoundDrawablesWithIntrinsicBounds(null, iconDrawable, null, null)
                compoundDrawablePadding = 4.dp()
                setOnClickListener { addDie(key) }
                setOnLongClickListener { removeDie(key); true }
            }
            chips[key] = chip
            row.addView(
                chip,
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginStart = if (key == keys.first()) 0 else 4.dp()
                },
            )
        }
        return row
    }

    private fun chipBackground(active: Boolean): RippleDrawable =
        rippled(
            GradientDrawable().apply {
                cornerRadius = 8.dp().toFloat()
                setColor(CHIP)
                setStroke(1.dp(), if (active) ACCENT else BORDER)
            },
        )

    /** Campo numerico de sistema com +/- compacto (espelha StepperInput da web). */
    private fun numberFieldRow(context: Context, editText: EditText): LinearLayout {
        fun step(delta: Int) {
            val current = editText.text.toString().toIntOrNull() ?: 0
            editText.setText((current + delta).toString())
        }
        val minus = stepperGlyphButton(context, "−", "diminuir") { step(-1) }
        val plus = stepperGlyphButton(context, "+", "aumentar") { step(1) }
        return LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(minus, LinearLayout.LayoutParams(28.dp(), 30.dp()))
            addView(
                editText,
                LinearLayout.LayoutParams(0, 30.dp(), 1f).apply {
                    marginStart = 4.dp()
                    marginEnd = 4.dp()
                },
            )
            addView(plus, LinearLayout.LayoutParams(28.dp(), 30.dp()))
        }
    }

    private fun stepperGlyphButton(context: Context, glyph: String, label: String, onClick: () -> Unit): TextView =
        TextView(context).apply {
            text = glyph
            contentDescription = label
            setTextColor(TEXT)
            textSize = 15f
            setTypeface(typeface, Typeface.BOLD)
            gravity = Gravity.CENTER
            background = rippled(
                GradientDrawable().apply {
                    cornerRadius = 8.dp().toFloat()
                    setColor(CHIP)
                    setStroke(1.dp(), BORDER)
                },
            )
            isClickable = true
            setOnClickListener { onClick() }
        }

    /**
     * Ripple COM mascara. Sem o terceiro argumento o efeito e ilimitado e,
     * sobre fundo transparente, some — os botoes "limpar/config/abrir app"
     * pareciam texto morto: o toque nao dava sinal nenhum.
     */
    private fun rippled(content: GradientDrawable, mask: GradientDrawable? = null): RippleDrawable =
        RippleDrawable(ColorStateList.valueOf(RIPPLE), content, mask ?: content)

    /** Aba de modo dentro da caixa (espelha `.family-tab`/`.is-active` da
     *  web) — ativa vem preenchida de ACCENT, inativa so com contorno. */
    private fun familyTabButton(context: Context, label: String, active: Boolean, onClick: () -> Unit): TextView =
        TextView(context).apply {
            text = label
            setTextColor(if (active) Color.WHITE else MUTED)
            isAllCaps = true
            letterSpacing = 0.03f
            setTypeface(typeface, Typeface.BOLD)
            gravity = Gravity.CENTER
            setSingleLine()
            maxLines = 1
            setAutoSizeTextTypeUniformWithConfiguration(7, 11, 1, TypedValue.COMPLEX_UNIT_SP)
            background = rippled(
                GradientDrawable().apply {
                    cornerRadius = 8.dp().toFloat()
                    setColor(if (active) ACCENT else Color.TRANSPARENT)
                    setStroke(1.dp(), if (active) ACCENT else BORDER)
                },
            )
            setPadding(4.dp(), 0, 4.dp(), 0)
            isClickable = true
            setOnClickListener { onClick() }
        }

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

    /** Envolve o conteudo de um cartao num MaxHeightScrollView — ver
     *  fitToScreen pra quem ajusta o teto de altura em runtime. */
    private fun scrollWrapper(context: Context, body: View): MaxHeightScrollView =
        MaxHeightScrollView(context).apply {
            isVerticalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER
            addView(body)
        }

    private fun pill(color: Int): GradientDrawable =
        GradientDrawable().apply {
            cornerRadius = 999f
            setColor(color)
        }

    // ---------- compositor de pool ----------

    private fun addDie(key: String) {
        val current = notationInput.text.toString()
        val next = addDieToNotation(current, key)
        notationInput.setText(next)
        notationInput.setSelection(next.length)
        syncChipsWithNotation(next)
    }

    /** Tira um dado do tipo; o termo some do pool ao zerar. Ligado ao long-press do chip. */
    private fun removeDie(key: String) {
        val current = notationInput.text.toString()
        val next = removeDieFromNotation(current, key)
        notationInput.setText(next)
        notationInput.setSelection(next.length)
        syncChipsWithNotation(next)
    }

    private fun clearPool() {
        notationInput.setText("")
        notationInput.setSelection(0)
        syncChipsWithNotation("")
    }

    private fun addDieToNotation(notation: String, key: String): String {
        val trimmed = notation.trim()
        val label = if (key == "C") "1c" else if (key == "F") "1dF" else "1d$key"

        if (trimmed.isEmpty()) return label

        // 1. Slot aberto no fim: ex: "1[", "2[", "3[", "... + 1[", "{2d6} vs {"
        val openBracketRegex = Regex("""^(.*(?:\b[123]\[|\{))\s*$""")
        val openMatch = openBracketRegex.find(trimmed)
        if (openMatch != null) {
            val prefix = openMatch.groupValues[1]
            val closing = if (prefix.endsWith("{")) "}" else "]"
            return "$prefix$label$closing"
        }

        // 2. Bloco de slot fechado no fim: ex: "1[2d6]" ou "1[2d6+1d4]"
        val slotBlockRegex = Regex("""^(.*?\b[123]\[)([^\]]*?)(\])\s*$""")
        val slotMatch = slotBlockRegex.find(trimmed)
        if (slotMatch != null) {
            val prefix = slotMatch.groupValues[1]
            val inner = slotMatch.groupValues[2].trim()
            val suffix = slotMatch.groupValues[3]
            val innerUpdated = addDieToSimpleExpression(inner, key)
            return "$prefix$innerUpdated$suffix"
        }

        // 3. Operador ou separador pendente no fim: ex: "2d6 +", "2d6+", "vs"
        if (Regex("""[\+\-\*\/]\s*$""").containsMatchIn(trimmed) || Regex("""\bvs\s*$""", RegexOption.IGNORE_CASE).containsMatchIn(trimmed)) {
            val sep = if (trimmed.endsWith(" ")) "" else " "
            return "$trimmed$sep$label"
        }

        // 4. Estado normal do compositor
        return addDieToSimpleExpression(trimmed, key)
    }

    private fun addDieToSimpleExpression(expr: String, key: String): String {
        val label = if (key == "C") "1c" else if (key == "F") "1dF" else "1d$key"
        val diePattern = if (key == "C") Regex("""(\d+)c\b""", RegexOption.IGNORE_CASE)
            else if (key == "F") Regex("""(\d+)dF\b""", RegexOption.IGNORE_CASE)
            else Regex("""(\d+)d$key\b""", RegexOption.IGNORE_CASE)

        val match = diePattern.find(expr)
        if (match != null) {
            val count = match.groupValues[1].toIntOrNull() ?: 1
            val newCount = count + 1
            val replacement = if (key == "C") "${newCount}c"
                else if (key == "F") "${newCount}dF"
                else "${newCount}d$key"
            return expr.replaceFirst(diePattern, replacement)
        }

        if (expr.isEmpty()) return label
        return "$expr+$label"
    }

    private fun removeDieFromNotation(notation: String, key: String): String {
        val trimmed = notation.trim()
        if (trimmed.isEmpty()) return ""

        val slotBlockRegex = Regex("""^(.*?\b[123]\[)([^\]]*?)(\])\s*$""")
        val slotMatch = slotBlockRegex.find(trimmed)
        if (slotMatch != null) {
            val prefix = slotMatch.groupValues[1]
            val inner = slotMatch.groupValues[2].trim()
            val suffix = slotMatch.groupValues[3]
            val innerUpdated = removeDieFromSimpleExpression(inner, key)
            if (innerUpdated.isEmpty()) {
                return prefix.replace(Regex("""\b[123]\[$"""), "").trim().removeSuffix("+").trim()
            }
            return "$prefix$innerUpdated$suffix"
        }

        return removeDieFromSimpleExpression(trimmed, key)
    }

    private fun removeDieFromSimpleExpression(expr: String, key: String): String {
        val diePattern = if (key == "C") Regex("""(\d+)c\b""", RegexOption.IGNORE_CASE)
            else if (key == "F") Regex("""(\d+)dF\b""", RegexOption.IGNORE_CASE)
            else Regex("""(\d+)d$key\b""", RegexOption.IGNORE_CASE)

        val match = diePattern.find(expr) ?: return expr
        val count = match.groupValues[1].toIntOrNull() ?: 1
        if (count > 1) {
            val newCount = count - 1
            val replacement = if (key == "C") "${newCount}c"
                else if (key == "F") "${newCount}dF"
                else "${newCount}d$key"
            return expr.replaceFirst(diePattern, replacement)
        } else {
            var updated = expr.replaceFirst(diePattern, "")
            updated = updated.replace("++", "+")
            return updated.trim().removePrefix("+").removeSuffix("+").trim()
        }
    }

    private fun syncChipsWithNotation(notation: String) {
        val density = root.context.resources.displayMetrics.density
        for ((key, chip) in chips) {
            val pattern = if (key == "C") Regex("""(\d+)c\b""", RegexOption.IGNORE_CASE)
                else if (key == "F") Regex("""(\d+)dF\b""", RegexOption.IGNORE_CASE)
                else Regex("""(\d+)d$key\b""", RegexOption.IGNORE_CASE)

            var count = 0
            for (match in pattern.findAll(notation)) {
                count += match.groupValues[1].toIntOrNull() ?: 1
            }

            val label = if (key == "C") "carta" else if (key == "F") "dF" else "d$key"
            chip.text = if (count > 0) {
                if (key == "C") "${count}c" else "${count}$label"
            } else {
                label
            }
            val active = count > 0
            chip.setTextColor(if (active) ACCENT_BRIGHT else TEXT)
            val iconColor = if (active) ACCENT_BRIGHT else MUTED
            val iconDrawable = DieIconDrawable(key, iconColor, density)
            chip.setCompoundDrawablesWithIntrinsicBounds(null, iconDrawable, null, null)
            chip.background = chipBackground(active = active)
        }
    }

    private fun updateRollButton() {
        val typed = notationInput.text.toString().trim()
        val overlay = activeOverlayInfo
        rollButton.text = when {
            overlay != null && typed.isNotEmpty() -> "ROLAR $typed"
            overlay != null -> "ROLAR ${systemShortLabel(overlay).uppercase()}"
            typed.isNotEmpty() -> "ROLAR $typed"
            quickNotation.isNotEmpty() -> "ROLAR $quickNotation"
            else -> rollButton.context.getString(R.string.roll_button)
        }
    }

    /**
     * Rola o que esta no campo; vazio = rolagem rapida das configuracoes.
     *
     * Sistema "overlay" ativo (roll_under): usa a notacao do campo ou
     * o fallback (quickNotation / 1d20) aplicando a regra do profile
     * com o valor testado.
     */
    private fun rollCurrent() {
        hideKeyboard()
        val notation = notationInput.text.toString().trim()
        val overlay = activeOverlayInfo
        if (overlay != null) {
            val not = notation.ifEmpty { quickNotation.ifEmpty { "1d20" } }
            onRollOverlay?.invoke(not, currentInputsJson())
            return
        }
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

    /** Alterna entre as abas Sistema, Dados e Baralho no painel do overlay. */
    fun setPanelTab(tab: PanelTab) {
        currentPanelTab = tab
        if (!::systemContainer.isInitialized || !::diceContainer.isInitialized || !::deckContainer.isInitialized) return
        systemContainer.visibility = if (tab == PanelTab.SYSTEM) View.VISIBLE else View.GONE
        diceContainer.visibility = if (tab == PanelTab.DICE) View.VISIBLE else View.GONE
        deckContainer.visibility = if (tab == PanelTab.DECK) View.VISIBLE else View.GONE
        if (::tabSystemButton.isInitialized) styleTabChip(tabSystemButton, tab == PanelTab.SYSTEM)
        if (::tabDiceButton.isInitialized) styleTabChip(tabDiceButton, tab == PanelTab.DICE)
        if (::tabDeckButton.isInitialized) styleTabChip(tabDeckButton, tab == PanelTab.DECK)
    }

    /** Atualiza o contador de cartas restantes no monte do baralho. */
    fun setDeckRemaining(remaining: Int) {
        if (!::deckRemainingView.isInitialized) return
        deckRemainingView.text = root.context.getString(R.string.overlay_deck_remaining, remaining)
        deckRemainingView.visibility = View.VISIBLE
    }

    /** Mesmo visual de familyTabButton (ativo preenchido, inativo so
     *  contorno), reaplicavel depois de criado — familyTabButton so pinta
     *  uma vez, na criacao. */
    private fun styleTabChip(chip: TextView, active: Boolean) {
        chip.setTextColor(if (active) Color.WHITE else MUTED)
        chip.background = rippled(
            GradientDrawable().apply {
                cornerRadius = 8.dp().toFloat()
                setColor(if (active) ACCENT else Color.TRANSPARENT)
                setStroke(1.dp(), if (active) ACCENT else BORDER)
            },
        )
    }

    private val hideResultRunnable = Runnable {
        if (mode == Mode.RESULT) setMode(Mode.COLLAPSED)
    }

    private fun setMode(newMode: Mode) {
        // Fechando o painel (nao rolando): adota o que foi composto (ver
        // onComposedNotation). SO em COLLAPSED — nao em RESULT: toda rolagem
        // (profile ou composer) passa por PANEL->RESULT, e cada uma ja seta
        // seu proprio lastRollAction no caminho certo (rollWithInputs,
        // rollOverlayNow, rollNotation). Adotar aqui TAMBEM sobrescrevia esse
        // valor certo com o texto que sobrou no campo de notacao — a
        // rolagem do SISTEMA acontecia, mas a mini-bolha "repetir" virava
        // sempre a notacao solta, ignorando o profile.
        if (mode == Mode.PANEL && newMode == Mode.COLLAPSED) {
            val composto = notationInput.text.toString().trim()
            if (composto.isNotEmpty() && composto != quickNotation) {
                onComposedNotation?.invoke(composto)
            }
            // Digitar um valor novo (CD, dificuldade, modificador...) e so
            // minimizar SEM apertar Rolar nao salvava nada — o campo ficava
            // certo na TELA, mas o proximo toque em "rolar" de fora repetia
            // o `lastRollAction` de uma rolagem anterior, com o valor ANTIGO.
            // Fechar o painel com o sistema aberto agora conta como "eu
            // configurei isto", igual a tela de configuracoes ja faz a cada
            // toque.
            if (activeOverlayInfo != null || (::systemContainer.isInitialized && systemContainer.visibility == View.VISIBLE)) {
                val overlayNotation = if (activeOverlayInfo != null) composto else null
                onPersistSystemInputs?.invoke(currentInputsJson(), overlayNotation)
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
        when (newMode) {
            Mode.PANEL -> fitToScreen(panelScroll)
            Mode.HISTORY -> fitToScreen(historyScroll)
            Mode.ROOM -> fitToScreen(roomScroll)
            else -> {}
        }
        root.removeCallbacks(hideResultRunnable)
        if (newMode == Mode.RESULT) root.postDelayed(hideResultRunnable, RESULT_FLASH_MS)
        // Campo de texto = janela focavel. PANEL agora cobre tanto o
        // compositor quanto os campos do sistema (CD, modificador...),
        // mesclados na mesma janela — nao ha mais Mode.SYSTEM separado.
        val comTeclado = newMode == Mode.PANEL
        onWindowFocusMode?.invoke(comTeclado)
        if (!comTeclado) hideKeyboard()
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

    fun showResult(text: CharSequence, tone: OutcomeTone = OutcomeTone.NEUTRAL) {
        val formatted = if (text is String && text.startsWith("{") && text.contains("\"groups\"")) {
            formatRichResult(text)
        } else if (text is String) {
            val cor = when (tone) {
                OutcomeTone.FAILURE -> FAILURE_TEXT
                OutcomeTone.PARTIAL -> PARTIAL_TEXT
                else -> TEXT
            }
            panelResultView.setTextColor(cor)
            historyResultView.setTextColor(cor)
            resultFlash.setTextColor(cor)
            formatRichLine(text)
        } else {
            text
        }
        panelResultView.text = formatted
        historyResultView.text = formatted
        resultFlash.text = formatted
        // Com o painel aberto (rolagem por chips/digitada), o resultado
        // aparece nele mesmo. Pelo atalho do fan: flash compacto que some
        // sozinho — NAO abre cartao nenhum.
        if (mode != Mode.PANEL) setMode(Mode.RESULT)
    }

    /** Anexa uma linha de atividade da sala (rolagens, nossas e dos outros). */
    fun addActivityLine(line: String) {
        history.addLast(line)
        while (history.size > MAX_HISTORY) history.removeFirst()
        val recent = history.toList().takeLast(MAX_ACTIVITY_LINES)
        val ssb = SpannableStringBuilder()
        for (i in recent.indices) {
            ssb.append(formatRichLine(recent[i]))
            if (i < recent.size - 1) ssb.append("\n")
        }
        activityView.text = ssb
        if (mode == Mode.HISTORY) renderHistory()
    }

    // Guardados aqui pra fitToScreen poder reposicionar a janela ao abrir um
    // cartao alto — a mesma referencia que bindDrag recebe do OverlayService.
    private var windowManager: WindowManager? = null
    private var windowParams: WindowManager.LayoutParams? = null

    /** Arrasto da bolha e dos cabecalhos, com snap na borda ao soltar. */
    @SuppressLint("ClickableViewAccessibility")
    fun bindDrag(windowManager: WindowManager, params: WindowManager.LayoutParams) {
        this.windowManager = windowManager
        this.windowParams = params
        val listener = DragTouchListener(windowManager, params)
        bubble.setOnTouchListener(listener)
        dragHandle.setOnTouchListener(listener)
        historyDragHandle.setOnTouchListener(listener)
    }

    /**
     * Teto de altura do cartao (deixando uma margem) + reposiciona a
     * janela pra caber inteira na tela ATUAL.
     *
     * Sem isto, um cartao WRAP_CONTENT que cabia sobrando em retrato passa
     * da borda em paisagem (tela bem mais baixa) — e como a janela e
     * ancorada TOP|START num x/y que nao muda sozinho, o que passasse da
     * borda ficava cortado, sem rolar e sem reposicionar.
     *
     * `root.post`: a nova visibilidade/maxHeightPx so refletem em
     * `root.height` depois do proximo layout, que ainda nao rodou no
     * ponto em que setMode chama isto.
     */
    private fun fitToScreen(scroll: MaxHeightScrollView) {
        val metrics = root.resources.displayMetrics
        val margin = 32.dp()
        scroll.maxHeightPx = (metrics.heightPixels - margin).coerceAtLeast(120.dp())
        val wm = windowManager ?: return
        val params = windowParams ?: return
        root.post {
            val width = root.width
            val height = root.height
            if (width <= 0 || height <= 0) return@post
            val maxX = (metrics.widthPixels - width).coerceAtLeast(0)
            val maxY = (metrics.heightPixels - height).coerceAtLeast(0)
            val clampedX = params.x.coerceIn(0, maxX)
            val clampedY = params.y.coerceIn(0, maxY)
            if (clampedX != params.x || clampedY != params.y) {
                params.x = clampedX
                params.y = clampedY
                wm.updateViewLayout(root, params)
            }
        }
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

        /** Espaco pra sombra do elevation desenhar sem ser cortada. */
        const val SHADOW_PAD_DP = 12
        // Aro dos cartoes: verde da marca a meia opacidade — visivel sobre
        // qualquer wallpaper sem virar moldura berrante.
        private val CARD_STROKE = Color.argb(0x66, 0x1D, 0x9E, 0x75)
        private val TEXT = Color.rgb(0xE8, 0xEC, 0xF0)
        private val MUTED = Color.rgb(0x8B, 0x95, 0xA1)

        // Mesmas cores do modo stream (apps/web/src/styles.css): claras de
        // proposito, porque a janela do overlay fica sobre outro app e um
        // vermelho escuro sumiria sobre fundo escuro.
        private val FAILURE_TEXT = Color.rgb(0xFF, 0x6B, 0x6B)
        private val PARTIAL_TEXT = Color.rgb(0xFF, 0xC6, 0x5C)

        // Cores dos slots de dados para formatação rica de resultados e logs
        private val SLOT_1_COLOR = Color.rgb(0x25, 0xC4, 0x8F) // Esmeralda (#25c48f)
        private val SLOT_2_COLOR = Color.rgb(0xF8, 0x71, 0x71) // Sangue (#f87171)
        private val SLOT_3_COLOR = Color.rgb(0x38, 0xBD, 0xF8) // Gelo (#38bdf8)
        private val CARD_RED_COLOR = Color.rgb(0xFF, 0x6B, 0x6B)

        /**
         * Formata o resultado completo de uma rolagem com hierarquia visual e quebra
         * de linhas limpa:
         *  - Linha 1: Desfecho(s) / Total em destaque grande e colorido + Parâmetro testado em cinza discreto e fonte menor
         *  - Linha 2: Detalhamento de dados / pools em fonte menor, com rótulos de slots coloridos e dados em negrito
         */
        fun formatRichResult(resultJson: String): SpannableStringBuilder {
            return try {
                val lines = OverlayService.formatDisplayLines(resultJson)
                val ssb = SpannableStringBuilder()

                // 1. LINHA 1 (Headline)
                if (lines.flags.isNotEmpty()) {
                    for (i in lines.flags.indices) {
                        val (label, rawFlag) = lines.flags[i]
                        if (i > 0) {
                            val commaStart = ssb.length
                            ssb.append(", ")
                            ssb.setSpan(ForegroundColorSpan(MUTED), commaStart, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                        }
                        val flagStart = ssb.length
                        ssb.append(label)
                        val tone = outcomeTone(rawFlag)
                        val flagColor = when (tone) {
                            OutcomeTone.FAILURE -> FAILURE_TEXT
                            OutcomeTone.PARTIAL -> PARTIAL_TEXT
                            else -> ACCENT_BRIGHT
                        }
                        ssb.setSpan(ForegroundColorSpan(flagColor), flagStart, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                        ssb.setSpan(StyleSpan(Typeface.BOLD), flagStart, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                        ssb.setSpan(RelativeSizeSpan(1.1f), flagStart, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    }
                } else {
                    val headlineStart = ssb.length
                    ssb.append(lines.headline)
                    val tone = OverlayService.toneOf(resultJson)
                    val headlineColor = when (tone) {
                        OutcomeTone.FAILURE -> FAILURE_TEXT
                        OutcomeTone.PARTIAL -> PARTIAL_TEXT
                        OutcomeTone.SUCCESS -> ACCENT_BRIGHT
                        else -> TEXT
                    }
                    ssb.setSpan(ForegroundColorSpan(headlineColor), headlineStart, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    ssb.setSpan(StyleSpan(Typeface.BOLD), headlineStart, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    ssb.setSpan(RelativeSizeSpan(1.25f), headlineStart, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                }

                // Parâmetros testados ao lado do headline em cinza discreto e fonte menor
                if (!lines.tested.isNullOrEmpty()) {
                    val testedStart = ssb.length
                    ssb.append("  (${lines.tested})")
                    ssb.setSpan(ForegroundColorSpan(MUTED), testedStart, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    ssb.setSpan(RelativeSizeSpan(0.75f), testedStart, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                }

                // 2. LINHA 2 (Detail)
                if (!lines.detail.isNullOrEmpty()) {
                    ssb.append("\n")
                    val detailStart = ssb.length
                    ssb.append(lines.detail)
                    ssb.setSpan(RelativeSizeSpan(0.75f), detailStart, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    applyDetailSpans(ssb, detailStart)
                }

                ssb
            } catch (e: Exception) {
                SpannableStringBuilder(formatRichLine(resultJson.take(80)))
            }
        }

        private fun applyDetailSpans(ssb: SpannableStringBuilder, start: Int) {
            val text = ssb.substring(start)

            // 1. Slot 1 (Esmeralda / Cyan): base, ação, acao, claros, grupo 1, regulares, verbo
            val slot1Regex = Regex("""\b(base|ação|acao|claros|grupo 1|regulares|verbo)\b""", RegexOption.IGNORE_CASE)
            for (m in slot1Regex.findAll(text)) {
                val s = start + m.range.first
                val e = start + m.range.last + 1
                ssb.setSpan(ForegroundColorSpan(SLOT_1_COLOR), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                ssb.setSpan(StyleSpan(Typeface.BOLD), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }

            // 2. Slot 2 (Sangue / Vermelho): perícia, pericia, desafio, escuros, fome/ira, fome, ira, grupo 2, substantivo
            val slot2Regex = Regex("""\b(perícia|pericia|desafio|escuros|fome/ira|fome|ira|grupo 2|substantivo)\b""", RegexOption.IGNORE_CASE)
            for (m in slot2Regex.findAll(text)) {
                val s = start + m.range.first
                val e = start + m.range.last + 1
                ssb.setSpan(ForegroundColorSpan(SLOT_2_COLOR), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                ssb.setSpan(StyleSpan(Typeface.BOLD), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }

            // 3. Slot 3 (Gelo / Azul): equipamento, ruína, ruina, estresse, grupo 3
            val slot3Regex = Regex("""\b(equipamento|ruína|ruina|estresse|grupo 3)\b""", RegexOption.IGNORE_CASE)
            for (m in slot3Regex.findAll(text)) {
                val s = start + m.range.first
                val e = start + m.range.last + 1
                ssb.setSpan(ForegroundColorSpan(SLOT_3_COLOR), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                ssb.setSpan(StyleSpan(Typeface.BOLD), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }

            // 4. Bracketed dice numbers [x, y, z] -> números em negrito com destaque para acertos (>= 6) e 10 (crítico)
            val bracketRegex = Regex("""\[([^\]]+)\]""")
            for (m in bracketRegex.findAll(text)) {
                val s = start + m.range.first
                val e = start + m.range.last + 1
                ssb.setSpan(StyleSpan(Typeface.BOLD), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)

                val inner = m.groupValues[1]
                val innerStart = start + m.range.first + 1
                val numRegex = Regex("""\b(\d+)\b""")
                for (nm in numRegex.findAll(inner)) {
                    val nVal = nm.value.toIntOrNull() ?: continue
                    val ns = innerStart + nm.range.first
                    val ne = innerStart + nm.range.last + 1
                    if (nVal == 10) {
                        ssb.setSpan(ForegroundColorSpan(PARTIAL_TEXT), ns, ne, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    } else if (nVal >= 6) {
                        ssb.setSpan(ForegroundColorSpan(ACCENT_BRIGHT), ns, ne, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    }
                }
            }

            // 5. Cartas vermelhas (♥ e ♦)
            val cardRedRegex = Regex("""(10|[A2-9JQK])([♥♦])""")
            for (m in cardRedRegex.findAll(text)) {
                val s = start + m.range.first
                val e = start + m.range.last + 1
                ssb.setSpan(ForegroundColorSpan(CARD_RED_COLOR), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                ssb.setSpan(StyleSpan(Typeface.BOLD), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }

            // 6. Muted separators: "•", "vs"
            val sepRegex = Regex("""(•|\bvs\b)""")
            for (m in sepRegex.findAll(text)) {
                val s = start + m.range.first
                val e = start + m.range.last + 1
                ssb.setSpan(ForegroundColorSpan(MUTED), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
        }

        /**
         * Formata uma linha de histórico / atividade com destaque de cores nos
         * nomes de jogadores, rótulos de slots (Base, Perícia, Equipamento),
         * valores de cartas, dados e desfechos (sucesso / falha / dano).
         */
        fun formatRichLine(rawLine: String): SpannableStringBuilder {
            val ssb = SpannableStringBuilder()
            val colonIdx = rawLine.indexOf(": ")

            val content = if (colonIdx != -1) {
                val playerName = rawLine.substring(0, colonIdx)
                val nameStart = ssb.length
                ssb.append(playerName)
                ssb.setSpan(
                    ForegroundColorSpan(ACCENT_BRIGHT),
                    nameStart,
                    ssb.length,
                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                )
                ssb.setSpan(
                    StyleSpan(Typeface.BOLD),
                    nameStart,
                    ssb.length,
                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                )
                val colonStart = ssb.length
                ssb.append(": ")
                ssb.setSpan(
                    ForegroundColorSpan(MUTED),
                    colonStart,
                    ssb.length,
                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                )
                rawLine.substring(colonIdx + 2)
            } else {
                rawLine
            }

            val bodyStart = ssb.length
            ssb.append(content)

            // 1. Notação inicial (ex: "{2d6+1} + {0d6} + {1d6}" ou "1[1d6] + 2[2d6]" ou "2d6+1"):
            // Se houver grupos ou outcome na linha, a notação que precede fica em MUTED
            val notationRegex = Regex("""^(\{[^}]+\}(\s*(\+|\bvs\b)\s*\{[^}]+\})*|\d*\[[^\]]+\](\s*(\+|\bvs\b)\s*\d*\[[^\]]+\])*|\b\d+d\w+[^\s]*)\s+""")
            val notationMatch = notationRegex.find(content)
            if (notationMatch != null) {
                val notStart = bodyStart + notationMatch.range.first
                val notEnd = bodyStart + notationMatch.range.last + 1
                ssb.setSpan(
                    ForegroundColorSpan(MUTED),
                    notStart,
                    notEnd,
                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                )
            }

            // 2. Destaca grupos de dados com cores de slots:
            // Slot 1: base, ação, claros, grupo 1, regulares
            val slot1Regex = Regex("""\b(base|ação|acao|claros|grupo 1|regulares)\b""", RegexOption.IGNORE_CASE)
            for (m in slot1Regex.findAll(content)) {
                val ms = bodyStart + m.range.first
                val me = bodyStart + m.range.last + 1
                ssb.setSpan(ForegroundColorSpan(SLOT_1_COLOR), ms, me, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                ssb.setSpan(StyleSpan(Typeface.BOLD), ms, me, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }

            // Slot 2: perícia, desafio, escuros, fome/ira, grupo 2
            val slot2Regex = Regex("""\b(perícia|pericia|desafio|escuros|fome/ira|grupo 2)\b""", RegexOption.IGNORE_CASE)
            for (m in slot2Regex.findAll(content)) {
                val ms = bodyStart + m.range.first
                val me = bodyStart + m.range.last + 1
                ssb.setSpan(ForegroundColorSpan(SLOT_2_COLOR), ms, me, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                ssb.setSpan(StyleSpan(Typeface.BOLD), ms, me, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }

            // Slot 3: equipamento, ruína, grupo 3
            val slot3Regex = Regex("""\b(equipamento|ruína|ruina|grupo 3)\b""", RegexOption.IGNORE_CASE)
            for (m in slot3Regex.findAll(content)) {
                val ms = bodyStart + m.range.first
                val me = bodyStart + m.range.last + 1
                ssb.setSpan(ForegroundColorSpan(SLOT_3_COLOR), ms, me, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                ssb.setSpan(StyleSpan(Typeface.BOLD), ms, me, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }

            // 3. Destaca números nos colchetes [x, y, z]:
            val bracketRegex = Regex("""\[([^\]]+)\]""")
            for (m in bracketRegex.findAll(content)) {
                val ms = bodyStart + m.range.first
                val me = bodyStart + m.range.last + 1
                ssb.setSpan(StyleSpan(Typeface.BOLD), ms, me, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)

                val inner = m.groupValues[1]
                val innerStart = bodyStart + m.range.first + 1
                val numRegex = Regex("""\b(\d+)\b""")
                for (nm in numRegex.findAll(inner)) {
                    val nVal = nm.value.toIntOrNull() ?: continue
                    val ns = innerStart + nm.range.first
                    val ne = innerStart + nm.range.last + 1
                    if (nVal == 10) {
                        ssb.setSpan(ForegroundColorSpan(PARTIAL_TEXT), ns, ne, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    } else if (nVal >= 6) {
                        ssb.setSpan(ForegroundColorSpan(ACCENT_BRIGHT), ns, ne, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    }
                }
            }

            // 4. Destaca cartas vermelhas (♥ e ♦)
            val cardRedRegex = Regex("""(10|[A2-9JQK])([♥♦])""")
            for (m in cardRedRegex.findAll(content)) {
                val ms = bodyStart + m.range.first
                val me = bodyStart + m.range.last + 1
                ssb.setSpan(ForegroundColorSpan(CARD_RED_COLOR), ms, me, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                ssb.setSpan(StyleSpan(Typeface.BOLD), ms, me, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }

            // 5. Destaca outcome / resultado (após " — "):
            val outcomeIdx = content.indexOf(" — ")
            if (outcomeIdx != -1) {
                var outcomeEndIdx = content.indexOf(" (Dificuldade:", outcomeIdx)
                if (outcomeEndIdx == -1) outcomeEndIdx = content.indexOf(" (Limiar:", outcomeIdx)
                if (outcomeEndIdx == -1) outcomeEndIdx = content.length
                val outcomeText = content.substring(outcomeIdx + 3, outcomeEndIdx)
                val outStart = bodyStart + outcomeIdx + 3
                val outEnd = bodyStart + outcomeEndIdx

                val isFailure = outcomeText.contains("falha", ignoreCase = true) ||
                    outcomeText.contains("fracasso", ignoreCase = true) ||
                    outcomeText.contains("bestial", ignoreCase = true) ||
                    outcomeText.contains("dano", ignoreCase = true) ||
                    outcomeText.contains("desgraça", ignoreCase = true) ||
                    outcomeText.contains("desgraca", ignoreCase = true) ||
                    outcomeText.contains("pânico", ignoreCase = true) ||
                    outcomeText.contains("panico", ignoreCase = true) ||
                    outcomeText.contains("descontrole", ignoreCase = true)

                val isPartial = outcomeText.contains("parcial", ignoreCase = true) ||
                    outcomeText.contains("manchado", ignoreCase = true) ||
                    outcomeText.contains("vislumbre", ignoreCase = true) ||
                    outcomeText.contains("complicada", ignoreCase = true)

                val outColor = when {
                    isFailure -> FAILURE_TEXT
                    isPartial -> PARTIAL_TEXT
                    else -> ACCENT_BRIGHT
                }
                ssb.setSpan(ForegroundColorSpan(outColor), outStart, outEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                ssb.setSpan(StyleSpan(Typeface.BOLD), outStart, outEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }

            // 6. Destaca parâmetros testados (ex: "(Dificuldade: 1)"):
            val testedRegex = Regex("""\(([^)]+)\)""")
            for (m in testedRegex.findAll(content)) {
                val ms = bodyStart + m.range.first
                val me = bodyStart + m.range.last + 1
                ssb.setSpan(ForegroundColorSpan(MUTED), ms, me, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }

            return ssb
        }

        private const val MAX_ACTIVITY_LINES = 3
        private const val HISTORY_CARD_LINES = 20
        private const val MAX_HISTORY = 40

        /** Tempo do flash de resultado na tela antes de sumir sozinho. */
        private const val RESULT_FLASH_MS = 6_000L

        // Rotulos de dado dos chips ("F" = dado Fate/Fudge, "C" = Carta de baralho).
        private val DICE_KEYS = listOf("2", "3", "4", "6", "8", "10", "12", "20", "66", "100", "F", "C")
        private const val TOUCH_SLOP_DP = 8

        // Teto do stepper de cartas — o baralho padrao tem 52 (+2 curinga).
        private const val DECK_MAX_COUNT = 20
    }
}

/**
 * Desenha os icones geometricos dos dados (e carta de baralho) em Canvas/Vector.
 * Espelha as silhuetas SVG de DiceIcon.tsx da web.
 */
class DieIconDrawable(
    private val key: String,
    private val strokeColor: Int,
    private val density: Float,
) : Drawable() {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = strokeColor
        style = Paint.Style.STROKE
        strokeWidth = 1.4f * density
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = strokeColor
        style = Paint.Style.FILL
    }
    private val path = Path()

    override fun draw(canvas: Canvas) {
        val b = bounds
        val w = b.width().toFloat()
        val h = b.height().toFloat()
        if (w <= 0 || h <= 0) return

        val cx = b.left + w / 2f
        val cy = b.top + h / 2f
        val s = minOf(w, h) * 0.76f

        path.reset()
        when (key) {
            "2" -> {
                // Moeda: circulo com divisoria vertical
                canvas.drawCircle(cx, cy, s * 0.44f, paint)
                canvas.drawLine(cx, cy - s * 0.32f, cx, cy + s * 0.32f, paint)
            }
            "3" -> {
                // Prisma: triangulo com aresta central
                path.moveTo(cx, cy - s * 0.44f)
                path.lineTo(cx + s * 0.44f, cy + s * 0.4f)
                path.lineTo(cx - s * 0.44f, cy + s * 0.4f)
                path.close()
                canvas.drawPath(path, paint)
                canvas.drawLine(cx, cy - s * 0.44f, cx, cy + s * 0.4f, paint)
            }
            "4" -> {
                // Triangulo (d4)
                path.moveTo(cx, cy - s * 0.44f)
                path.lineTo(cx + s * 0.44f, cy + s * 0.4f)
                path.lineTo(cx - s * 0.44f, cy + s * 0.4f)
                path.close()
                canvas.drawPath(path, paint)
            }
            "6" -> {
                // Quadrado / Cubo (d6)
                val r = s * 0.40f
                val rect = RectF(cx - r, cy - r, cx + r, cy + r)
                canvas.drawRoundRect(rect, 2.5f * density, 2.5f * density, paint)
            }
            "8" -> {
                // Losango / Octaedro (d8)
                path.moveTo(cx, cy - s * 0.46f)
                path.lineTo(cx + s * 0.44f, cy)
                path.lineTo(cx, cy + s * 0.46f)
                path.lineTo(cx - s * 0.44f, cy)
                path.close()
                canvas.drawPath(path, paint)
            }
            "10" -> {
                // Pipa / Kite (d10)
                path.moveTo(cx, cy - s * 0.46f)
                path.lineTo(cx + s * 0.42f, cy - s * 0.12f)
                path.lineTo(cx, cy + s * 0.46f)
                path.lineTo(cx - s * 0.42f, cy - s * 0.12f)
                path.close()
                canvas.drawPath(path, paint)
            }
            "12" -> {
                // Pentagono / Dodecaedro (d12)
                for (i in 0 until 5) {
                    val angle = Math.toRadians((i * 72 - 90).toDouble())
                    val px = cx + (s * 0.44f * Math.cos(angle)).toFloat()
                    val py = cy + (s * 0.44f * Math.sin(angle)).toFloat()
                    if (i == 0) path.moveTo(px, py) else path.lineTo(px, py)
                }
                path.close()
                canvas.drawPath(path, paint)
            }
            "20" -> {
                // Hexagono / Icosaedro (d20)
                for (i in 0 until 6) {
                    val angle = Math.toRadians((i * 60 - 30).toDouble())
                    val px = cx + (s * 0.44f * Math.cos(angle)).toFloat()
                    val py = cy + (s * 0.44f * Math.sin(angle)).toFloat()
                    if (i == 0) path.moveTo(px, py) else path.lineTo(px, py)
                }
                path.close()
                canvas.drawPath(path, paint)
            }
            "66" -> {
                // Par de d6 (d66: dezena e unidade)
                val rect1 = RectF(cx - s * 0.44f, cy - s * 0.42f, cx + s * 0.04f, cy + s * 0.06f)
                val rect2 = RectF(cx - s * 0.04f, cy - s * 0.06f, cx + s * 0.44f, cy + s * 0.42f)
                canvas.drawRoundRect(rect1, 2f * density, 2f * density, paint)
                canvas.drawRoundRect(rect2, 2f * density, 2f * density, paint)
            }
            "100" -> {
                // Par de percentis (d100)
                val r1 = s * 0.26f
                val ox1 = cx - s * 0.22f
                val oy1 = cy - s * 0.10f
                path.moveTo(ox1, oy1 - r1)
                path.lineTo(ox1 + r1 * 0.8f, oy1)
                path.lineTo(ox1, oy1 + r1)
                path.lineTo(ox1 - r1 * 0.8f, oy1)
                path.close()
                val ox2 = cx + s * 0.22f
                val oy2 = cy + s * 0.10f
                path.moveTo(ox2, oy2 - r1)
                path.lineTo(ox2 + r1 * 0.8f, oy2)
                path.lineTo(ox2, oy2 + r1)
                path.lineTo(ox2 - r1 * 0.8f, oy2)
                path.close()
                canvas.drawPath(path, paint)
            }
            "F" -> {
                // Cubo com + e - (dF)
                val r = s * 0.40f
                val rect = RectF(cx - r, cy - r, cx + r, cy + r)
                canvas.drawRoundRect(rect, 2.5f * density, 2.5f * density, paint)
                canvas.drawLine(cx - s * 0.20f, cy - s * 0.12f, cx - s * 0.08f, cy - s * 0.12f, paint)
                canvas.drawLine(cx - s * 0.14f, cy - s * 0.18f, cx - s * 0.14f, cy - s * 0.06f, paint)
                canvas.drawLine(cx + s * 0.08f, cy + s * 0.12f, cx + s * 0.20f, cy + s * 0.12f, paint)
            }
            "C" -> {
                // Carta de baralho
                val rw = s * 0.36f
                val rh = s * 0.46f
                val rect = RectF(cx - rw, cy - rh, cx + rw, cy + rh)
                canvas.drawRoundRect(rect, 2.5f * density, 2.5f * density, paint)
                val cr = s * 0.13f
                path.moveTo(cx, cy - cr)
                path.lineTo(cx + cr * 0.8f, cy)
                path.lineTo(cx, cy + cr)
                path.lineTo(cx - cr * 0.8f, cy)
                path.close()
                canvas.drawPath(path, fillPaint)
            }
        }
    }

    override fun setAlpha(alpha: Int) {
        paint.alpha = alpha
        fillPaint.alpha = alpha
    }

    override fun setColorFilter(colorFilter: ColorFilter?) {
        paint.colorFilter = colorFilter
        fillPaint.colorFilter = colorFilter
    }

    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
    override fun getIntrinsicWidth(): Int = (22 * density).toInt()
    override fun getIntrinsicHeight(): Int = (22 * density).toInt()
}
