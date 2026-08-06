package app.meioorc.rolai

import android.os.Handler
import android.os.Looper
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException

/**
 * `POST {base}/rooms` — cria uma sala e devolve o codigo.
 *
 * Antes o app so aceitava COLAR um codigo criado na web, o que obrigava a
 * ter o navegador aberto pra comecar uma mesa pelo celular.
 *
 * Nao ha autenticacao (AGENTS.md: sala anonima com codigo compartilhavel), e
 * o backend limita criacao por IP (docs/security.md) — o erro do limite
 * chega aqui como HTTP 429 e vira mensagem na tela, nao crash.
 */
object RoomCreator {

    private val client = OkHttpClient()
    private val handler = Handler(Looper.getMainLooper())
    private val jsonType = "application/json".toMediaType()

    /** Callbacks sempre na main thread — quem chama mexe em View. */
    fun create(
        wsBaseUrl: String,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) {
        val url = RolaiSettings.httpBaseUrl(wsBaseUrl) + "/rooms"
        val request = Request.Builder()
            .url(url)
            .post("{}".toRequestBody(jsonType))
            .build()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                handler.post { onError(e.message ?: "falha de rede") }
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.use { it.body?.string().orEmpty() }
                val code = runCatching { JSONObject(body).optString("code") }.getOrNull()
                handler.post {
                    when {
                        !response.isSuccessful && response.code == 429 ->
                            onError("muitas salas criadas — espere um pouco")
                        !response.isSuccessful -> onError("HTTP ${response.code}")
                        code.isNullOrEmpty() -> onError("resposta sem codigo")
                        else -> onSuccess(code)
                    }
                }
            }
        })
    }
}
