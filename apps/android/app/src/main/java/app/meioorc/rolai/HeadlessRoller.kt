package app.meioorc.rolai

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicLong

/**
 * WebView headless (sem UI visivel) rodando o bundle do rules-engine
 * (assets/headless/index.html, gerado por `npm run build:headless` em
 * apps/web). E a UNICA fonte de calculo de rolagem do app — nenhuma regra
 * e duplicada em Kotlin (regra de ouro do AGENTS.md).
 *
 * Restricoes de seguranca (docs/security.md): sem rede (blockNetworkLoads),
 * sem navegacao (shouldOverrideUrlLoading sempre true), so carrega
 * file:///android_asset. O bridge exposto pro JS tem um unico metodo que
 * RECEBE texto — o JS nao ganha nenhuma capacidade nativa alem de devolver
 * o resultado.
 *
 * Deve ser criada, usada e destruida na main thread (regra da WebView).
 */
class HeadlessRoller(
    context: Context,
    private val onResult: (resultJson: String) -> Unit,
    private val onError: (message: String) -> Unit,
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val callbackSeq = AtomicLong(0)
    private val queuedCalls = mutableListOf<String>()
    private var pageReady = false
    private var destroyed = false

    private val webView: WebView

    init {
        check(Looper.myLooper() == Looper.getMainLooper()) {
            "HeadlessRoller precisa ser criado na main thread"
        }
        webView = WebView(context.applicationContext)
        configure(webView)
        webView.loadUrl("file:///android_asset/headless/index.html")
    }

    @SuppressLint("SetJavaScriptEnabled") // JS e o proposito desta WebView; o conteudo e 100% local.
    private fun configure(view: WebView) {
        view.settings.javaScriptEnabled = true
        // file:///android_asset precisa de acesso a arquivo pra carregar o
        // <script src="rolai-headless.js"> relativo.
        view.settings.allowFileAccess = true
        view.settings.allowContentAccess = false
        // WebView de calculo nao fala com a rede (docs/security.md).
        view.settings.blockNetworkLoads = true
        view.settings.domStorageEnabled = false
        view.addJavascriptInterface(JsBridge(), "RolaiBridge")
        view.webViewClient = object : WebViewClient() {
            // Nunca navega: qualquer tentativa (redirect, link, JS trocando
            // location) e bloqueada. A carga inicial via loadUrl nao passa
            // por aqui.
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean = true

            override fun onPageFinished(view: WebView, url: String) {
                pageReady = true
                flushQueue()
            }
        }
    }

    /**
     * Rola notacao camada 1 (ex: "2d6"). Resultado chega no onResult.
     * `optionsJson` (opcional) e o RollOptions do rules-engine serializado
     * — so usado por testes (fila `deterministic`), nunca em producao.
     */
    fun roll(notation: String, optionsJson: String? = null) {
        val id = nextCallbackId()
        eval(
            "rolai.roll(${JSONObject.quote(notation)}, ${JSONObject.quote(id)}" +
                (optionsJson?.let { ", ${JSONObject.quote(it)}" } ?: "") + ")",
        )
    }

    /** Rola via profile de sistema com inputs do jogador (JSON). */
    fun rollWithProfile(system: String, inputsJson: String, optionsJson: String? = null) {
        val id = nextCallbackId()
        eval(
            "rolai.rollWithProfile(${JSONObject.quote(system)}, " +
                "${JSONObject.quote(inputsJson)}, ${JSONObject.quote(id)}" +
                (optionsJson?.let { ", ${JSONObject.quote(it)}" } ?: "") + ")",
        )
    }

    /**
     * Profile "overlay" (roll_under, `SystemInfo.isOverlay`): sem dado
     * proprio — `notation` e o que o composer normal montou na tela, e o
     * profile so avalia outcome_rules sobre o resultado (rollOverlay em
     * @rolai/rules-engine).
     */
    fun rollOverlay(
        system: String,
        notation: String,
        inputsJson: String,
        optionsJson: String? = null,
    ) {
        val id = nextCallbackId()
        eval(
            "rolai.rollOverlay(${JSONObject.quote(system)}, ${JSONObject.quote(notation)}, " +
                "${JSONObject.quote(inputsJson)}, ${JSONObject.quote(id)}" +
                (optionsJson?.let { ", ${JSONObject.quote(it)}" } ?: "") + ")",
        )
    }

    fun destroy() {
        destroyed = true
        webView.destroy()
    }

    private fun nextCallbackId(): String = "cb-${callbackSeq.incrementAndGet()}"

    private fun eval(js: String) {
        if (destroyed) return
        // evaluateJavascript antes do onPageFinished e perdido silenciosamente
        // (o contexto JS ainda nao existe) — enfileira e dispara no load.
        if (pageReady) {
            webView.evaluateJavascript(js, null)
        } else {
            queuedCalls.add(js)
        }
    }

    private fun flushQueue() {
        val calls = queuedCalls.toList()
        queuedCalls.clear()
        for (js in calls) webView.evaluateJavascript(js, null)
    }

    private fun handlePayload(payloadJson: String) {
        if (destroyed) return
        try {
            val payload = JSONObject(payloadJson)
            if (payload.optBoolean("ok")) {
                val result = payload.optJSONObject("result")?.toString()
                if (result != null) onResult(result) else onError("resposta sem resultado")
            } else {
                onError(payload.optString("error", "erro desconhecido no rules-engine"))
            }
        } catch (e: Exception) {
            onError("payload invalido da WebView: ${e.message}")
        }
    }

    /** Objeto injetado no JS como window.RolaiBridge (ver headless.ts). */
    private inner class JsBridge {
        // Roda numa thread binder do WebKit — repassa pra main thread,
        // onde a WebView e a UI do overlay vivem.
        @JavascriptInterface
        fun onResult(callbackId: String, payloadJson: String) {
            mainHandler.post { handlePayload(payloadJson) }
        }
    }
}
