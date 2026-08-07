package app.meioorc.rolai

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.view.Gravity
import android.view.MotionEvent
import android.view.WindowManager
import android.webkit.WebView
import android.widget.FrameLayout

/**
 * Palco de dados por cima de QUALQUER app: janela de overlay, tela inteira e
 * transparente. Dentro dela roda uma WebView no modo stream do apps/web
 * (`?stream=1[&room=...][&style=...]`) — o mesmo caminho da Browser Source
 * do OBS. Nenhuma logica de render duplicada aqui (AGENTS.md: o rules-engine
 * e o palco vivem na web; o Android so hospeda).
 *
 * SEM sala o palco tambem funciona: fica esperando rolagem local empurrada
 * pela ponte `window.rolaiStream.play(...)` (offline).
 *
 * ## Por que a janela alterna touchable/not-touchable
 *
 * O Android 12+ CLAMPA em 0.8 o alpha de janelas de overlay que deixam o
 * toque atravessar (`FLAG_NOT_TOUCHABLE` — regra anti-tapjacking,
 * maximumObscuringOpacityForTouch). Resultado: TUDO nesta janela saia 20%
 * transparente — o "dado fantasma". Confirmado em aparelho por dois lados:
 * `dumpsys window` mostrando `mAttrs alpha=0.8` que nunca setamos, e o dado
 * ficando solido ao subir o teto do sistema pra 1.0. Material opaco,
 * filtro CSS, preserveDrawingBuffer e LAYER_TYPE_HARDWARE nao mudavam nada
 * porque o desconto e aplicado NA JANELA, pelo compositor do sistema.
 * Janela TOCAVEL nao sofre o clamp. Entao:
 *
 *  - parada (sem dado): NOT_TOUCHABLE — todo toque atravessa pro app de
 *    baixo, e o palco (100% transparente) nem aparece;
 *  - animando (dado na tela): TOCAVEL — sem clamp, dado solido; qualquer
 *    toque no palco DISPENSA os dados e devolve o atravessamento na hora
 *    (mesma UX da web: clique tira os dados).
 */
class DiceStageWindow(private val context: Context) {

    private var container: FrameLayout? = null
    private var webView: WebView? = null
    private var windowManager: WindowManager? = null
    private var params: WindowManager.LayoutParams? = null

    /** URL do palco, pra retentativa de carga (ver play). */
    private var stageUrl: String? = null

    /** Ultima carga do palco falhou (offline sem cache, servidor fora). */
    private var stageLoadFailed = false

    /** Toque no palco enquanto ha dado na tela (janela interativa). */
    var onStageTapped: (() -> Unit)? = null

    val isAttached: Boolean get() = container != null

    @SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
    fun attach(
        wm: WindowManager,
        webBaseUrl: String,
        roomCode: String,
        dicePreset: String,
        scalePercent: Int = 100,
        quality: String = "",
        style: RolaiSettings? = null,
    ) {
        if (container != null) return
        windowManager = wm
        val url = streamUrl(webBaseUrl, roomCode, dicePreset, scalePercent, quality, style)
        stageUrl = url
        stageLoadFailed = false
        val view = WebView(context).apply {
            setBackgroundColor(Color.TRANSPARENT)
            settings.javaScriptEnabled = true
            // localStorage: e de onde a pagina le a qualidade de render.
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            webViewClient = object : android.webkit.WebViewClient() {
                override fun onReceivedError(
                    view: WebView,
                    request: android.webkit.WebResourceRequest,
                    error: android.webkit.WebResourceError,
                ) {
                    if (!request.isForMainFrame) return
                    // Sem esta protecao, a falha de carga vira uma PAGINA DE
                    // ERRO gigante por cima dos outros apps. O palco e
                    // decorativo: falhou, fica invisivel (a WebView e
                    // transparente) — a rolagem continua saindo no cartao
                    // do overlay via WebView headless, que e 100% local.
                    // O play() tenta recarregar na proxima rolagem.
                    stageLoadFailed = true
                    view.loadUrl("about:blank")
                }
            }
            loadUrl(url)
            // O listener vai NA WebView (nao no pai): filho consome o toque
            // antes do OnTouchListener do pai rodar. Retornar true engole o
            // evento — a pagina nunca precisa de toque; um tap = dispensar.
            setOnTouchListener { _, event ->
                if (event.action == MotionEvent.ACTION_DOWN) onStageTapped?.invoke()
                true
            }
        }
        webView = view
        val wrap = FrameLayout(context).apply {
            addView(
                view,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT,
                ),
            )
        }
        container = wrap
        params = layoutParams()
        wm.addView(wrap, params)
    }

    /**
     * Liga/desliga o modo interativo (ver doc da classe). Interativo =
     * janela tocavel = sem clamp de alpha = dado solido.
     */
    fun setInteractive(interactive: Boolean) {
        val wm = windowManager ?: return
        val view = container ?: return
        val p = params ?: return
        val base = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        if (interactive) {
            p.flags = base
            p.alpha = 1f
        } else {
            p.flags = base or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
            // ALPHA ZERO parado, e nao o 0.8 do clamp.
            //
            // Janela NOT_TOUCHABLE tem o alpha CLAMPADO em 0.8 pelo sistema
            // (anti-tapjacking). O toque atravessa, mas 0.8 e exatamente o
            // limiar em que o Android considera a tela "obscurecida": app que
            // liga filterTouchesWhenObscured (GitHub, telas da Play Store,
            // bancos) passa a DESCARTAR os proprios toques enquanto o palco
            // existir — o app parece travado, sem erro nenhum.
            // developer.android.com/privacy-and-security/risks/tapjacking
            //
            // Parado o palco nao desenha nada, entao alpha 0 nao muda o que
            // se ve e tira a janela do limiar. Ao animar, a janela vira
            // tocavel (sem clamp) e volta pra 1.
            p.alpha = 0f
        }
        runCatching { wm.updateViewLayout(view, p) }
    }

    /**
     * Empurra uma rolagem JA CALCULADA pro palco (window.rolaiStream.play).
     * E o que faz o dado 3D aparecer sem sala e sem rede — offline.
     */
    fun play(resultJson: String, styleJson: String? = null) {
        val view = webView ?: return
        if (stageLoadFailed) {
            // O palco falhou ao carregar (offline): tenta de novo ao rolar.
            // Se a rede voltou, ESTA rolagem ainda nao anima (a pagina esta
            // carregando), mas as proximas ja saem.
            stageLoadFailed = false
            stageUrl?.let { view.loadUrl(it) }
        }
        val escaped = org.json.JSONObject.quote(resultJson)
        // O bridge aceita (resultado, estilo): o estilo e o de QUEM ROLOU, pra
        // mesa inteira ver o dado na cor de quem jogou.
        val estilo = styleJson ?: "null"
        view.evaluateJavascript(
            "window.rolaiStream && window.rolaiStream.play($escaped, $estilo)",
            null,
        )
    }

    /** Tira os dados da tela agora (ponte window.rolaiStream.clear). */
    fun clearDice() {
        webView?.evaluateJavascript(
            "window.rolaiStream && window.rolaiStream.clear && window.rolaiStream.clear()",
            null,
        )
    }

    fun detach() {
        val view = container ?: return
        val web = webView
        container = null
        webView = null
        params = null
        windowManager?.let { runCatching { it.removeView(view) } }
        windowManager = null
        web?.destroy()
    }

    private fun layoutParams(): WindowManager.LayoutParams {
        @Suppress("DEPRECATION")
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            WindowManager.LayoutParams.TYPE_PHONE
        }
        return WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            type,
            // Estado inicial: parado -> NOT_TOUCHABLE (toque atravessa).
            // LAYOUT_IN_SCREEN | LAYOUT_NO_LIMITS: cobre as barras, senao o
            // dado "some" nas bordas.
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            // Nasce invisivel e fora do limiar de obscurecimento (ver
            // setInteractive) — o palco so aparece quando ha dado rolando.
            alpha = 0f
        }
    }

    companion object {
        /**
         * `<base>/?stream=1[&room=][&style=][&scale=][&quality=][&body=...]`
         * — contrato do modo
         * stream do apps/web. SEM sala tambem vale: o palco fica esperando
         * rolagem pela ponte (play), que e o caminho offline do overlay.
         */
        fun streamUrl(
            webBaseUrl: String,
            roomCode: String,
            dicePreset: String,
            scalePercent: Int = 100,
            quality: String = "",
            style: RolaiSettings? = null,
        ): String {
            val base = webBaseUrl.trimEnd('/')
            val room = if (roomCode.isBlank()) "" else "&room=${android.net.Uri.encode(roomCode)}"
            val preset = if (dicePreset.isBlank()) "" else "&style=${android.net.Uri.encode(dicePreset)}"
            // Locale.ROOT: escala com PONTO decimal, independente do idioma.
            val scale = "&scale=" + String.format(java.util.Locale.ROOT, "%.2f", scalePercent / 100f)
            val tier = if (quality.isBlank()) "" else "&quality=${android.net.Uri.encode(quality)}"
            // Aparencia explicita vence o preset no apps/web (stream.ts) — e
            // assim que a cor escolhida no Android chega ao palco, ja que a
            // WebView tem localStorage proprio.
            val appearance = if (style == null) "" else buildString {
                append("&body=").append(style.diceBody.removePrefix("#"))
                append("&number=").append(style.diceNumber.removePrefix("#"))
                append("&outline=").append(style.diceOutline.removePrefix("#"))
                append("&texture=").append(android.net.Uri.encode(style.diceTexture))
                append("&material=").append(android.net.Uri.encode(style.diceMaterial))
            }
            return "$base/?stream=1$room$preset$scale$tier$appearance"
        }
    }
}
