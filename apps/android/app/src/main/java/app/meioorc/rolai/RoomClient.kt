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
        fun onRoll(player: String, resultJson: String, styleJson: String?, stylesJson: String? = null)
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
            // A LEITURA vive em ServerEvent (pura, testada); aqui fica só a
            // entrega ao Listener na thread certa.
            when (val evento = ServerEvent.parse(text)) {
                null -> return // nao e JSON, sem `type`, ou tipo que este APK nao conhece
                is ServerEvent.Ping -> webSocket.send("{\"type\":\"pong\"}")
                is ServerEvent.Snapshot -> handler.post { listener.onRoster(evento.memberNames) }
                is ServerEvent.Roster -> handler.post { listener.onRoster(evento.memberNames) }
                is ServerEvent.Roll -> handler.post {
                    listener.onRoll(evento.player, evento.resultJson, evento.styleJson, evento.stylesJson)
                }
                is ServerEvent.DeckDraw -> handler.post {
                    listener.onDeckDraw(evento.player, evento.cardsJson, evento.remaining)
                }
                is ServerEvent.DeckShuffle -> handler.post { listener.onDeckShuffle(evento.player) }
                is ServerEvent.DeckConfig -> handler.post {
                    listener.onDeckConfig(
                        evento.player,
                        evento.includeJokers,
                        evento.removalMode,
                        evento.autoReshuffleOnEmpty,
                    )
                }
                is ServerEvent.Error -> handler.post { listener.onError(evento.message) }
            }
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            android.util.Log.d("rolai", "sala fechou: code=$code reason='$reason'")
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
            //
            // O MOTIVO precisa aparecer. Sem este log, "conectando…" ->
            // "reconectando…" em loop era tudo que dava pra ver: nem quem
            // derrubou, nem por que. Custou uma sessao inteira de
            // diagnostico com o servidor ja provado inocente.
            android.util.Log.w(
                "rolai",
                "sala caiu: ${t.javaClass.simpleName}: ${t.message} (http=${response?.code})",
                t,
            )
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
                "&style=" + URLEncoder.encode(styleJson(it), "UTF-8") +
                "&styles=" + URLEncoder.encode(stylesJson(it), "UTF-8")
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
            singleSlotJson(settings.slotStyle("1")).toString()

        fun stylesJson(settings: RolaiSettings): String =
            JSONObject()
                .put("1", singleSlotJson(settings.slotStyle("1")))
                .put("2", singleSlotJson(settings.slotStyle("2")))
                .put("3", singleSlotJson(settings.slotStyle("3")))
                .toString()

        fun singleSlotJson(slot: DiceSlotStyle): JSONObject =
            JSONObject()
                .put("body", hex(slot.body))
                .put("number", hex(slot.number))
                .put("outline", hex(slot.outline))
                .put("texture", slot.texture.lowercase())
                .put("material", slot.material.lowercase())

        private fun hex(color: String): String {
            val bare = color.removePrefix("#").lowercase()
            return "#$bare"
        }

    }
}
