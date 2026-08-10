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
import androidx.webkit.WebViewAssetLoader
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

    /**
     * Colisao de dado reportada pela fisica do palco (0..1 de forca). Existe
     * porque o som do overlay toca NATIVO — a WebView vai muda pra nao pedir
     * foco de audio e abaixar a musica de quem estiver ouvindo. A fisica esta
     * na WebView, entao ela avisa e o Kotlin toca.
     */
    var onDiceImpact: ((Float) -> Unit)? = null

    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
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

    /**
     * Serve `assets/stage/` como `https://appassets.androidplatform.net/`.
     *
     * Tem que ser https e nao file://: WebGL e localStorage exigem ORIGEM
     * SEGURA, e file:// e origem opaca. Este host e reservado pelo AndroidX
     * justamente pra isso e nunca sai do aparelho.
     */
    private fun assetLoader(): WebViewAssetLoader =
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
            .build()

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
            // Mesmo nome do bridge do headless (RolaiBridge): sao WebViews
            // diferentes, cada uma com o seu, e o web so chama o metodo que
            // existir (ver renderers/diceBox.ts).
            addJavascriptInterface(StageBridge(), "RolaiBridge")
            setBackgroundColor(Color.TRANSPARENT)
            settings.javaScriptEnabled = true
            // localStorage: e de onde a pagina le a qualidade de render.
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            // Console da pagina no logcat (tag "rolai"): sem isto, falha de
            // carga do bundle e erro de JS somem — o palco fica em branco e
            // nao ha nada pra olhar.
            webChromeClient = object : android.webkit.WebChromeClient() {
                override fun onConsoleMessage(
                    m: android.webkit.ConsoleMessage,
                ): Boolean {
                    android.util.Log.d(
                        "rolai",
                        "palco[${m.messageLevel()}] ${m.message()} @${m.sourceId()}:${m.lineNumber()}",
                    )
                    return true
                }
            }
            val loader = assetLoader()
            webViewClient = object : android.webkit.WebViewClient() {
                // Intercepta o host local e devolve o arquivo do APK. Todo o
                // resto (rolai.app, quando configurado) segue pela rede.
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: android.webkit.WebResourceRequest,
                ): android.webkit.WebResourceResponse? =
                    loader.shouldInterceptRequest(request.url)

                override fun onReceivedHttpError(
                    view: WebView,
                    request: android.webkit.WebResourceRequest,
                    errorResponse: android.webkit.WebResourceResponse,
                ) {
                    android.util.Log.w(
                        "rolai",
                        "palco HTTP ${errorResponse.statusCode} em ${request.url}",
                    )
                }

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
                    android.util.Log.w("rolai", "palco falhou: ${error.description} @${request.url}")
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

    /** Injetado no JS como window.RolaiBridge (ver renderers/diceBox.ts). */
    private inner class StageBridge {
        // Roda numa thread binder do WebKit; o som e disparado na main.
        @android.webkit.JavascriptInterface
        fun onDiceImpact(strength: Float) {
            val cb = onDiceImpact ?: return
            mainHandler.post { cb(strength) }
        }
    }

    companion object {
        /**
         * `<base>/?stream=1[&room=][&style=][&scale=][&quality=][&body=...]`
         * — contrato do modo
         * stream do apps/web. SEM sala tambem vale: o palco fica esperando
         * rolagem pela ponte (play), que e o caminho offline do overlay.
         */
        /** Host reservado do WebViewAssetLoader — nunca sai do aparelho. */
        // Aponta pro ARQUIVO, nao pra pasta: o AssetsPathHandler nao faz
        // "index de diretorio" — terminar em "/stage/" devolvia 404 e o
        // palco ficava em branco (verificado no logcat).
        const val LOCAL_STAGE_BASE =
            "https://appassets.androidplatform.net/assets/stage/index.html"

        /**
         * Endereco padrao (o de producao, fixado no buildType) significa
         * "use o palco embarcado". Endereco custom significa "quero aquele
         * servidor" — inclusive pra desenvolvimento contra o Vite local.
         */
        /**
         * Percent-encoding do que entra na query.
         *
         * Nao usa `Uri.encode`: em teste JVM ele e stub e devolve null, o que
         * fazia a URL inteira sair errada SEM o teste conseguir apontar. Os
         * valores aqui sao ids e codigos de sala (alfabeto restrito), entao
         * um encode proprio cobre e fica testavel.
         */
        fun encode(valor: String): String = buildString {
            for (c in valor) {
                if (c.isLetterOrDigit() || c in "-_.~") {
                    append(c)
                } else {
                    for (b in c.toString().toByteArray(Charsets.UTF_8)) {
                        append('%').append("%02X".format(b))
                    }
                }
            }
        }

        fun usaPalcoLocal(webBaseUrl: String): Boolean {
            val base = webBaseUrl.trim().trimEnd('/')
            return base.isEmpty() || base == RolaiSettings.DEFAULT_WEB_BASE_URL.trimEnd('/')
        }

        fun streamUrl(
            webBaseUrl: String,
            roomCode: String,
            dicePreset: String,
            scalePercent: Int = 100,
            quality: String = "",
            style: RolaiSettings? = null,
        ): String {
            // Palco do PROPRIO APK por padrao: o dado 3D roda em modo aviao,
            // sem rede nenhuma (assets/stage, servido pelo WebViewAssetLoader).
            // So quando o usuario aponta o app pra OUTRO servidor e que o
            // palco vem de la — util pra testar um deploy proprio, e o unico
            // caso em que faz sentido depender da rede pra desenhar dado.
            val base = if (usaPalcoLocal(webBaseUrl)) {
                LOCAL_STAGE_BASE
            } else {
                webBaseUrl.trimEnd('/')
            }
            val room = if (roomCode.isBlank()) "" else "&room=${encode(roomCode)}"
            val preset = if (dicePreset.isBlank()) "" else "&style=${encode(dicePreset)}"
            // Locale.ROOT: escala com PONTO decimal, independente do idioma.
            val scale = "&scale=" + String.format(java.util.Locale.ROOT, "%.2f", scalePercent / 100f)
            val tier = if (quality.isBlank()) "" else "&quality=${encode(quality)}"
            // Aparencia explicita vence o preset no apps/web (stream.ts) — e
            // assim que a cor escolhida no Android chega ao palco, ja que a
            // WebView tem localStorage proprio.
            val appearance = if (style == null) "" else buildString {
                append("&body=").append(style.diceBody.removePrefix("#"))
                append("&number=").append(style.diceNumber.removePrefix("#"))
                append("&outline=").append(style.diceOutline.removePrefix("#"))
                append("&texture=").append(encode(style.diceTexture))
                append("&material=").append(encode(style.diceMaterial))
            }
            // Base local ja e um arquivo (index.html); base remota e um host.
            val prefixo = if (base.endsWith(".html")) base else "$base/"
            // Palco MUDO: o som do dado toca nativo (DiceSounds.kt). Audio de
            // WebView pede foco de audio e o Android abaixa a musica de quem
            // estiver ouvindo — som nativo sem pedir foco toca por cima, sem
            // mexer no resto. Some tambem o carregamento dos 45 mp3.
            return "$prefixo?stream=1$room$preset$scale$tier$appearance&sound=0"
        }
    }
}
