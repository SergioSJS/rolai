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

    /** Mini-bolha de rolagem do fan: ultima rolagem, ou a configurada. */
    var onQuickRoll: (() -> Unit)? = null

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
    // Sub-secao DENTRO do panel (nao um card separado): os campos do
    // sistema ativo (CD, modificador...) ficam visiveis JUNTO dos chips de
    // dado normais, nao escondem um ao outro. Antes eram dois cards
    // mutuamente exclusivos (Mode.SYSTEM vs Mode.PANEL) — trocar de sistema
    // fazia o compositor normal desaparecer por completo.
    private lateinit var systemSection: LinearLayout
    // Abas de modo (Infaernum: Acao/Sim ou Nao/Ideias) — so tem conteudo
    // quando o sistema ativo pertence a uma ProfileFamily.
    private lateinit var familyTabsRow: LinearLayout
    private lateinit var systemTitle: TextView
    private lateinit var systemFields: LinearLayout
    // Botao de rolar do PROFILE — so aparece pra sistema de receita fixa
    // (rola dado proprio). Sistema "overlay" (roll_under) nao tem: quem
    // rola e o botao do compositor mesmo, aplicando a regra do profile em
    // cima do que os chips montarem (ver rollCurrent/onRollOverlay).
    private lateinit var profileRollButton: TextView
    // Sistema "overlay" ativo no momento (null = nenhum, ou sistema de
    // receita fixa) — decide o que rollCurrent() faz com o botao ROLAR.
    private var activeOverlayInfo: SystemInfo? = null
    // Views do formulario aberto, por id de input, com o spec ao lado — sem
    // ele nao da pra saber se um valor vazio e "Normal" (select) ou campo em
    // branco (numero).
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

        // Campos do sistema ativo (CD, modificador, vantagem...), JUNTO do
        // compositor abaixo — nao mais um cartao separado que escondia os
        // chips de dado normais. Comeca escondida: so aparece quando um
        // sistema com input esta configurado (ver openComposer).
        systemTitle = TextView(context).apply {
            setTextColor(MUTED)
            textSize = 11f
            isAllCaps = true
            letterSpacing = 0.06f
            setTypeface(typeface, Typeface.BOLD)
        }
        systemFields = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
        // Mesmo estilo do botao ROLAR do compositor (nao a pilula pequena de
        // "limpar/config"): os dois eram visualmente iguais, so este ficava
        // com contorno fraco — o jogador tocava sempre no botao errado (o
        // generico, que rola so o composer) e achava que o sistema "nao
        // funcionava".
        profileRollButton = TextView(context).apply {
            setText(R.string.roll_button)
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
            setOnClickListener { onRollWithInputs?.invoke(currentInputsJson()) }
        }
        val systemDivider = View(context).apply {
            setBackgroundColor(BORDER)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                1,
            ).apply { topMargin = 10.dp() }
        }
        familyTabsRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            visibility = View.GONE
        }
        systemSection = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            addView(familyTabsRow)
            addView(systemTitle, vParams(topMargin = 2))
            addView(systemFields, vParams(topMargin = 4))
            addView(profileRollButton, vParams(topMargin = 8))
            // SEM vParams aqui: addView(view, params) SUBSTITUI o
            // layoutParams que systemDivider ja tem (altura 1px). Um
            // View puro (nao ViewGroup) com WRAP_CONTENT e sem conteudo
            // nao encolhe pra 0 — ecoa de volta o teto AT_MOST do pai, e
            // "1px" virava a tela quase inteira (caixa vazia gigante,
            // empurrando chips/notacao/botao pra fora da area visivel).
            addView(systemDivider)
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
            addView(systemSection, vParams(topMargin = 10))
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

        // Linha propria, largura cheia: junto das outras tres (peso 1/4 num
        // painel de 300dp) o rotulo "copiar link" quebrava/cortava.
        val copiarLink = actionButton(context, R.string.overlay_room_copy_link) {
            onCopyRoomLink?.invoke()
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
            addView(copiarLink, vParams(topMargin = 6))
        }
    }

    // ---------- campos do sistema ativo (dentro do PANEL) ----------

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
        val family = info?.let { ProfileFamilies.familyFor(it.system) }
        // Membro de familia mostra a secao mesmo sem input proprio (ex.
        // Infaernum "Acao"/"Ideias" nao pedem nada) — e onde moram as abas
        // de modo, senao Sim ou Nao/Ideias ficam inalcancaveis do overlay.
        if (info == null || (!info.needsForm && family == null)) {
            systemSection.visibility = View.GONE
            systemInputViews.clear()
        } else {
            val context = systemFields.context
            familyTabsRow.removeAllViews()
            if (family != null) {
                familyTabsRow.visibility = View.VISIBLE
                for ((i, member) in family.members.withIndex()) {
                    val isActive = member.system == info.system
                    familyTabsRow.addView(
                        familyTabButton(context, member.subLabel, isActive) {
                            onSelectFamilyMember?.invoke(member.system)
                        },
                        LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                            marginStart = if (i == 0) 0 else 4.dp()
                        },
                    )
                }
            } else {
                familyTabsRow.visibility = View.GONE
            }
            systemTitle.text = info.label
            systemFields.removeAllViews()
            systemInputViews.clear()
            for (input in info.inputs) {
                systemFields.addView(
                    TextView(context).apply {
                        text = input.label
                        setTextColor(MUTED)
                        textSize = 11f
                    },
                    vParams(topMargin = 8),
                )
                if (input.isSelect) {
                    val view = Spinner(context).apply {
                        // O adapter padrao (simple_spinner_dropdown_item) pega
                        // cor de texto do tema AMBIENTE — aqui o contexto e o
                        // do WindowManager do overlay, nao uma Activity com
                        // Theme.Rolai, entao o popup saia com texto escuro (as
                        // vezes ilegivel) por padrao do sistema. Cor e fundo
                        // do dropdown fixados na mao, nao emprestados de tema
                        // nenhum.
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
                                .apply { setTextColor(TEXT) }

                            override fun getDropDownView(
                                position: Int,
                                convertView: View?,
                                parent: ViewGroup,
                            ): View = (super.getDropDownView(position, convertView, parent) as TextView)
                                .apply {
                                    setTextColor(TEXT)
                                    setBackgroundColor(PANEL)
                                    setPadding(16.dp(), 12.dp(), 16.dp(), 12.dp())
                                }
                        }.apply {
                            setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                        }
                        setSelection(
                            input.options.indexOfFirst { it.value == saved[input.id] }
                                .coerceAtLeast(0),
                        )
                    }
                    systemInputViews[input.id] = input to view
                    systemFields.addView(view, vParams(topMargin = 2))
                } else {
                    val editText = EditText(context).apply {
                        // numberSigned: modificador negativo e comum, e o
                        // teclado numerico puro nao tem sinal.
                        inputType = android.text.InputType.TYPE_CLASS_NUMBER or
                            android.text.InputType.TYPE_NUMBER_FLAG_SIGNED
                        setTextColor(TEXT)
                        textSize = 15f
                        gravity = Gravity.CENTER
                        // Hint de UI do profile (ex. modificador "0") so
                        // quando nao ha valor salvo ainda — nao sobrescreve
                        // o que o jogador digitou numa rolagem anterior.
                        setText(saved[input.id] ?: input.default.orEmpty())
                    }
                    systemInputViews[input.id] = input to editText
                    systemFields.addView(numberFieldRow(context, editText, input.required), vParams(topMargin = 2))
                }
            }
            // Overlay (roll_under): quem rola e o botao do compositor,
            // aplicando a regra sobre a notacao dos chips — nao ha dado
            // proprio pra um botao separado rolar.
            profileRollButton.visibility = if (info.isOverlay) View.GONE else View.VISIBLE
            systemSection.visibility = View.VISIBLE
        }
        setMode(Mode.PANEL)
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
     * Campo numerico de sistema com +/- (espelha StepperInput da web) e,
     * quando o input e OPCIONAL, um botao "limpar" depois do "+" (roll_under
     * "valor testado", fate "dificuldade"...) — sem isto o unico jeito de
     * esvaziar era apagar dígito por dígito, e no apk nao existia NEM o
     * +/- nem o limpar: so um EditText cru, diferente da web.
     */
    private fun numberFieldRow(context: Context, editText: EditText, required: Boolean): LinearLayout {
        fun step(delta: Int) {
            val current = editText.text.toString().toIntOrNull() ?: 0
            editText.setText((current + delta).toString())
        }
        val minus = stepperGlyphButton(context, "−", "diminuir") { step(-1) }
        val plus = stepperGlyphButton(context, "+", "aumentar") { step(1) }
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(minus, LinearLayout.LayoutParams(34.dp(), 34.dp()))
            addView(
                editText,
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginStart = 6.dp()
                    marginEnd = 6.dp()
                },
            )
            addView(plus, LinearLayout.LayoutParams(34.dp(), 34.dp()))
        }
        if (!required) {
            val clear = stepperGlyphButton(context, "×", "limpar") { editText.setText("") }
            fun refreshClearState() {
                clear.isEnabled = editText.text.isNotEmpty()
                clear.alpha = if (clear.isEnabled) 1f else 0.4f
            }
            editText.addTextChangedListener(
                object : TextWatcher {
                    override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                    override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
                    override fun afterTextChanged(s: Editable?) = refreshClearState()
                },
            )
            refreshClearState()
            row.addView(
                clear,
                LinearLayout.LayoutParams(34.dp(), 34.dp()).apply { marginStart = 6.dp() },
            )
        }
        return row
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
            textSize = 10f
            isAllCaps = true
            letterSpacing = 0.03f
            setTypeface(typeface, Typeface.BOLD)
            gravity = Gravity.CENTER
            background = rippled(
                GradientDrawable().apply {
                    cornerRadius = 8.dp().toFloat()
                    setColor(if (active) ACCENT else Color.TRANSPARENT)
                    setStroke(1.dp(), if (active) ACCENT else BORDER)
                },
            )
            setPadding(4.dp(), 8.dp(), 4.dp(), 8.dp())
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

    /**
     * Rola o que esta no campo; vazio = rolagem rapida das configuracoes.
     *
     * Sistema "overlay" ativo (roll_under): nao ha rolagem rapida
     * alternativa — sem notacao no campo nao ha o que aplicar a regra
     * "<= valor testado" em cima, entao so ignora o toque (mesma guarda do
     * botao desabilitado no apps/web, RollPanel.tsx).
     */
    private fun rollCurrent() {
        hideKeyboard()
        val notation = notationInput.text.toString().trim()
        val overlay = activeOverlayInfo
        if (overlay != null) {
            if (notation.isNotEmpty()) onRollOverlay?.invoke(notation, currentInputsJson())
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
            if (systemSection.visibility == View.VISIBLE) {
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

    fun showResult(text: String, tone: OutcomeTone = OutcomeTone.NEUTRAL) {
        // Falha em vermelho: rolando por cima de outro app, a linha some no
        // meio do que estiver embaixo se sucesso e falha tiverem a mesma cor.
        val cor = when (tone) {
            OutcomeTone.FAILURE -> FAILURE_TEXT
            OutcomeTone.PARTIAL -> PARTIAL_TEXT
            else -> TEXT
        }
        panelResultView.setTextColor(cor)
        historyResultView.setTextColor(cor)
        resultFlash.setTextColor(cor)
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
