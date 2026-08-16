package app.meioorc.rolai

import android.os.Handler
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/**
 * Cliente WebSocket da sala, vivendo no OverlayService (NUNCA na WebView —
 * WebView em background sofre throttling de Doze/App Standby, ver
 * docs/architecture.md). Protocolo: docstring de services/backend/app/rooms.py.
 *
 * Relay burro: este cliente so envia o resultado JA calculado pela WebView
 * headless e retransmite o que chega — nenhuma regra de rolagem aqui.
 *
 * Todos os callbacks do Listener sao entregues na main thread.
 */
class RoomClient(private val listener: Listener) {

    interface Listener {
        fun onConnected()
        /**
         * Broadcast de rolagem (de qualquer jogador, inclusive eco do nosso).
         * `styleJson` e a aparencia de dado de QUEM ROLOU (null = sem estilo):
         * o palco anima com a cor de quem rolou, nao com a nossa.
         */
        fun onRoll(player: String, resultJson: String, styleJson: String?)
        /**
         * Broadcast de puxada de baralho (specs/08-baralho.md), inclusive
         * eco da nossa: `cardsJson` e um array JSON de Card.
         */
        fun onDeckDraw(player: String, cardsJson: String, remaining: Int)
        /** Broadcast de reembaralhada (specs/08-baralho.md — log de quem
         *  operou o baralho), inclusive eco da nossa. */
        fun onDeckShuffle(player: String)
        /** Broadcast de mudanca de config do baralho — so os campos que
         *  mudaram vem preenchidos, igual o envelope de saida. */
        fun onDeckConfig(
            player: String,
            includeJokers: Boolean?,
            removalMode: String?,
            autoReshuffleOnEmpty: Boolean?,
        )
        /** Roster atual (snapshot inicial ou evento de entrada/saida). */
        fun onRoster(memberNames: List<String>)
        /** Erro de protocolo vindo do servidor, ou "room_not_found" local. */
        fun onError(message: String)
        /** Conexao caiu; `reconnecting` indica se ha reconexao agendada. */
        fun onDisconnected(reconnecting: Boolean)
    }

    private val client = OkHttpClient.Builder()
        // Ping de protocolo WS: mantem NAT/conexao viva em background.
        .pingInterval(20, TimeUnit.SECONDS)
        .build()
    private val handler = Handler(Looper.getMainLooper())
    private val backoff = ReconnectBackoff()
    private val reconnectRunnable = Runnable { open() }

    private var webSocket: WebSocket? = null
    private var url: String? = null

    @Volatile
    private var stopped = true

    @Synchronized
    fun connect(url: String) {
        this.url = url
        stopped = false
        backoff.reset()
        open()
    }

    /** Desconexao deliberada (service morrendo) — sem reconexao. */
    @Synchronized
    fun disconnect() {
        stopped = true
        handler.removeCallbacks(reconnectRunnable)
        webSocket?.close(1000, null)
        webSocket = null
    }

    /** Envia o envelope {"type":"roll","result":...}. False se desconectado. */
    fun sendRoll(resultJson: String): Boolean {
        val envelope = try {
            JSONObject()
                .put("type", "roll")
                .put("result", JSONObject(resultJson))
                .toString()
        } catch (e: JSONException) {
            return false
        }
        return webSocket?.send(envelope) ?: false
    }

    /**
     * Envia o envelope {"type":"deck_draw","cards":[...],"remaining":N,
     * "timestamp":...} — mesmo esquema de confianca do sendRoll: o cliente
     * ja puxou local (HeadlessRoller.deckDraw), isto so avisa a sala pro
     * log e historico (specs/08-baralho.md). `cardsJson` e um array JSON
     * de Card pronto (vem do "cards" do deliver de headless.ts).
     */
    fun sendDeckDraw(cardsJson: String, remaining: Int, timestamp: String): Boolean {
        val envelope = try {
            JSONObject()
                .put("type", "deck_draw")
                .put("cards", JSONArray(cardsJson))
                .put("remaining", remaining)
                .put("timestamp", timestamp)
                .toString()
        } catch (e: JSONException) {
            return false
        }
        return webSocket?.send(envelope) ?: false
    }

    /** Envia o envelope {"type":"deck_shuffle","timestamp":...}. */
    fun sendDeckShuffle(timestamp: String): Boolean {
        val envelope = try {
            JSONObject()
                .put("type", "deck_shuffle")
                .put("timestamp", timestamp)
                .toString()
        } catch (e: JSONException) {
            return false
        }
        return webSocket?.send(envelope) ?: false
    }

    /**
     * Envia {"type":"deck_config", [campo mudado], "timestamp":...} — so o
     * campo que de fato mudou entra, igual RoomClient.ts (sendDeckConfig).
     * Passe null pros dois nao mudados.
     */
    fun sendDeckConfig(
        includeJokers: Boolean?,
        removalMode: String?,
        autoReshuffleOnEmpty: Boolean?,
        timestamp: String,
    ): Boolean {
        val envelope = try {
            JSONObject().apply {
                put("type", "deck_config")
                if (includeJokers != null) put("include_jokers", includeJokers)
                if (removalMode != null) put("removal_mode", removalMode)
                if (autoReshuffleOnEmpty != null) put("auto_reshuffle_on_empty", autoReshuffleOnEmpty)
                put("timestamp", timestamp)
            }.toString()
        } catch (e: JSONException) {
            return false
        }
        return webSocket?.send(envelope) ?: false
    }

    private fun open() {
        if (stopped) return
        val target = url ?: return
        webSocket = client.newWebSocket(Request.Builder().url(target).build(), socketListener)
    }

    private fun scheduleReconnect() {
        if (stopped) {
            handler.post { listener.onDisconnected(reconnecting = false) }
            return
        }
        val delayMs = backoff.next()
        handler.post { listener.onDisconnected(reconnecting = true) }
        handler.postDelayed(reconnectRunnable, delayMs)
    }

    private val socketListener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            backoff.reset()
            handler.post { listener.onConnected() }
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            val message = try {
                JSONObject(text)
            } catch (e: JSONException) {
                return // payload que nao e JSON: ignora (servidor nunca manda)
            }
            when (message.optString("type")) {
                "snapshot" -> {
                    val names = parseRosterNames(message)
                    handler.post { listener.onRoster(names) }
                }
                "roster" -> {
                    val names = parseRosterNames(message)
                    handler.post { listener.onRoster(names) }
                }
                "roll" -> {
                    val player = message.optString("player", "?")
                    val result = message.optJSONObject("result")?.toString() ?: return
                    val style = message.optJSONObject("style")?.toString()
                    handler.post { listener.onRoll(player, result, style) }
                }
                "deck_draw" -> {
                    val player = message.optString("player", "?")
                    val cards = message.optJSONArray("cards")?.toString() ?: return
                    val remaining = message.optInt("remaining", 0)
                    handler.post { listener.onDeckDraw(player, cards, remaining) }
                }
                "deck_shuffle" -> {
                    val player = message.optString("player", "?")
                    handler.post { listener.onDeckShuffle(player) }
                }
                "deck_config" -> {
                    val player = message.optString("player", "?")
                    val includeJokers = if (message.has("include_jokers")) {
                        message.optBoolean("include_jokers")
                    } else {
                        null
                    }
                    val removalMode = message.optString("removal_mode", "").ifEmpty { null }
                    val autoReshuffleOnEmpty = if (message.has("auto_reshuffle_on_empty")) {
                        message.optBoolean("auto_reshuffle_on_empty")
                    } else {
                        null
                    }
                    handler.post {
                        listener.onDeckConfig(player, includeJokers, removalMode, autoReshuffleOnEmpty)
                    }
                }
                "error" -> {
                    val error = message.optString("message", "erro do servidor")
                    handler.post { listener.onError(error) }
                }
                "ping" -> {
                    // Heartbeat do backend (ws_heartbeat_seconds): responder
                    // mantem proxies com timeout ocioso (Cloudflare ~100s) e
                    // o NAT da rede movel sem derrubar a conexao parada.
                    webSocket.send("{\"type\":\"pong\"}")
                }
            }
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            webSocket.close(1000, null)
            if (code == CLOSE_ROOM_NOT_FOUND) {
                // Sala inexistente e erro permanente — reconectar seria loop.
                stopped = true
                handler.post {
                    listener.onError(ERROR_ROOM_NOT_FOUND)
                    listener.onDisconnected(reconnecting = false)
                }
            } else {
                scheduleReconnect()
            }
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            // Rede caiu, servidor fora, handshake rejeitado: reconecta com
            // backoff (o teto do backoff respeita o rate limit de conexao
            // do backend — 30/min por IP, docs/security.md).
            scheduleReconnect()
        }
    }

    companion object {
        // Close code customizado do backend pra sala inexistente
        // (services/backend/app/rooms.py — close 4404 antes do accept).
        const val CLOSE_ROOM_NOT_FOUND = 4404
        const val ERROR_ROOM_NOT_FOUND = "room_not_found"

        /**
         * Monta a URL do handshake:
         * `{base}/rooms/{code}?name={apelido}[&style={json}]`.
         *
         * O `style` e a aparencia de dado DESTE aparelho. O backend guarda
         * por conexao e manda junto de cada rolagem, pra mesa inteira ver o
         * dado de quem rolou com a cor de quem rolou. Sem ele o backend
         * registra `style: null` e os outros clientes animam a nossa rolagem
         * com a cor DELES — era o que acontecia.
         *
         * `spectator` continua de fora: o overlay e jogador, ele rola.
         */
        fun buildHandshakeUrl(
            wsBaseUrl: String,
            roomCode: String,
            playerName: String,
            style: RolaiSettings? = null,
        ): String {
            require(RolaiSettings.isValidRoomCode(roomCode)) {
                "codigo de sala invalido: $roomCode"
            }
            require(RolaiSettings.isValidWsBaseUrl(wsBaseUrl)) {
                "URL de WS invalida: $wsBaseUrl"
            }
            val name = URLEncoder.encode(RolaiSettings.sanitizeName(playerName), "UTF-8")
            val styleParam = style?.let {
                "&style=" + URLEncoder.encode(styleJson(it), "UTF-8")
            } ?: ""
            return "${wsBaseUrl.trimEnd('/')}/rooms/$roomCode?name=$name$styleParam"
        }

        /**
         * Formato do `DiceStyle` do backend (services/backend/app/schemas.py):
         * as tres cores em `#rrggbb`, textura e material em minusculo. O
         * backend valida com `extra="forbid"` — campo a mais derruba o
         * handshake, entao o formato aqui e exatamente esse.
         */
        fun styleJson(settings: RolaiSettings): String =
            JSONObject()
                .put("body", hex(settings.diceBody))
                .put("number", hex(settings.diceNumber))
                .put("outline", hex(settings.diceOutline))
                .put("texture", settings.diceTexture.lowercase())
                .put("material", settings.diceMaterial.lowercase())
                .toString()

        private fun hex(color: String): String {
            val bare = color.removePrefix("#").lowercase()
            return "#$bare"
        }

        private fun parseRosterNames(message: JSONObject): List<String> {
            val roster = message.optJSONArray("roster") ?: return emptyList()
            return buildList {
                for (i in 0 until roster.length()) {
                    val member = roster.optJSONObject(i) ?: continue
                    add(member.optString("name", "?"))
                }
            }
        }
    }
}
