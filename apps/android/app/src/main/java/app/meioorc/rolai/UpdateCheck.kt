package app.meioorc.rolai

import android.os.Handler
import android.os.Looper
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException

/**
 * Aviso de versao nova do APK.
 *
 * O app nao esta na Play Store (distribuicao e pelas Releases do GitHub —
 * ver .github/workflows/release.yml), entao nao existe atualizacao
 * automatica: quem instalou uma vez fica naquela versao pra sempre sem saber
 * que saiu outra. Isto pergunta a API publica de Releases qual e a mais nova
 * e compara com a instalada.
 *
 * Regras que valem a pena manter:
 *
 * - **Falha e silencio.** Sem rede, com a API fora do ar ou no limite de
 *   requisicoes anonimas do GitHub, a tela simplesmente nao mostra aviso. O
 *   app funciona 100% offline menos sala (AGENTS.md) e um aviso de update nao
 *   pode ser o que quebra isso.
 * - **Nada e baixado nem instalado aqui.** O aviso abre a pagina da Release
 *   no navegador; quem instala e a pessoa. Baixar APK sozinho pediria
 *   REQUEST_INSTALL_PACKAGES, e o projeto so pede permissao estritamente
 *   necessaria.
 * - **Sem identificacao.** E um GET anonimo, sem token e sem nada do
 *   aparelho junto.
 */
object UpdateCheck {

    const val RELEASES_API = "https://api.github.com/repos/SergioSJS/rolai/releases/latest"

    /** Intervalo minimo entre consultas — abrir a tela dez vezes nao vira dez GETs. */
    const val MIN_INTERVAL_MS = 6 * 60 * 60 * 1000L

    data class Release(val version: String, val pageUrl: String)

    private val client = OkHttpClient()
    private val handler = Handler(Looper.getMainLooper())

    private var lastCheckAt = 0L
    private var cached: Release? = null

    /**
     * Tira o "v" da tag e fica so com o numero: `v0.12.4` -> `0.12.4`.
     * Qualquer sufixo (`-beta1`) e cortado — comparacao e so pelos numeros.
     */
    fun normalize(tag: String): String = tag.trim().removePrefix("v").substringBefore('-')

    /**
     * `true` quando `latest` e maior que `current`, comparando campo a campo
     * como NUMERO.
     *
     * Comparar string nao serve: "0.9.0" > "0.12.0" em ordem alfabetica, e o
     * projeto ja passou da 0.9 — o bug apareceria justamente ao chegar na
     * 0.10 e o app avisaria pra "atualizar" pra uma versao mais velha.
     *
     * Campo que nao for numero conta como 0, e versao com menos campos e
     * completada com 0 (`0.13` == `0.13.0`).
     */
    fun isNewer(current: String, latest: String): Boolean {
        val a = normalize(current).split('.')
        val b = normalize(latest).split('.')
        for (i in 0 until maxOf(a.size, b.size)) {
            val atual = a.getOrNull(i)?.toIntOrNull() ?: 0
            val nova = b.getOrNull(i)?.toIntOrNull() ?: 0
            if (nova != atual) return nova > atual
        }
        return false
    }

    /**
     * Le a Release da resposta da API. `null` quando o corpo nao tem tag —
     * repo sem release nenhuma, erro do GitHub em JSON, ou body vazio.
     */
    fun parseLatest(body: String): Release? {
        val json = runCatching { JSONObject(body) }.getOrNull() ?: return null
        val tag = json.optString("tag_name").orEmpty()
        if (tag.isEmpty()) return null
        val page = json.optString("html_url").orEmpty()
        return Release(normalize(tag), page.ifEmpty { "https://github.com/SergioSJS/rolai/releases" })
    }

    /**
     * Consulta em background e chama `onNewer` na main thread SO se houver
     * versao mais nova que a instalada. Silencioso em qualquer outro caso.
     */
    fun check(
        currentVersion: String = BuildConfig.VERSION_NAME,
        now: Long = System.currentTimeMillis(),
        onNewer: (Release) -> Unit,
    ) {
        cached?.let { if (isNewer(currentVersion, it.version)) handler.post { onNewer(it) } }
        if (now - lastCheckAt < MIN_INTERVAL_MS) return
        lastCheckAt = now
        val request = Request.Builder()
            .url(RELEASES_API)
            .header("Accept", "application/vnd.github+json")
            .build()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                // Offline e o caso NORMAL deste app. Nao logar como erro.
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.use { if (it.isSuccessful) it.body?.string().orEmpty() else "" }
                val release = parseLatest(body) ?: return
                cached = release
                if (!isNewer(currentVersion, release.version)) return
                handler.post { onNewer(release) }
            }
        })
    }
}
