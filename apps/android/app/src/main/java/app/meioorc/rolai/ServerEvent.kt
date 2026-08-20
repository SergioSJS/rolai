package app.meioorc.rolai

import org.json.JSONObject

/**
 * Um evento do backend, já lido. O contrato está em
 * `services/backend/app/schemas.py` e em `docs/roll-notation.md`.
 *
 * Estava inline no `onMessage` do RoomClient — 62 linhas de `when` sobre
 * `optString`/`optBoolean`, a 0% de cobertura. É exatamente o tipo de código
 * que apodrece calado quando o backend muda de formato: foi assim que o
 * `smoke_ws.py` ficou meses quebrado sem ninguém notar, quando o roster
 * deixou de ser lista de strings e virou lista de objetos.
 *
 * Aqui é só leitura: quem entrega ao Listener (e em qual thread) continua
 * sendo o RoomClient.
 */
sealed interface ServerEvent {

    /** Estado inicial da sala. O histórico não é lido aqui — o app nativo
     *  monta o dele a partir dos eventos que chegam depois. */
    data class Snapshot(val memberNames: List<String>) : ServerEvent

    /** Entrada ou saída de alguém. */
    data class Roster(val memberNames: List<String>) : ServerEvent

    data class Roll(
        val player: String,
        val resultJson: String,
        val styleJson: String?,
        val stylesJson: String?,
    ) : ServerEvent

    data class DeckDraw(val player: String, val cardsJson: String, val remaining: Int) : ServerEvent

    data class DeckShuffle(val player: String) : ServerEvent

    /** Só os campos que mudaram vêm preenchidos — igual ao envelope de saída. */
    data class DeckConfig(
        val player: String,
        val includeJokers: Boolean?,
        val removalMode: String?,
        val autoReshuffleOnEmpty: Boolean?,
    ) : ServerEvent

    data class Error(val message: String) : ServerEvent

    /** Heartbeat: exige `{"type":"pong"}` de volta, senão proxies com
     *  timeout ocioso (Cloudflare ~100s, NAT de rede móvel) derrubam a
     *  conexão parada. */
    data object Ping : ServerEvent

    companion object {
        /**
         * @return o evento, ou null quando não é JSON, não tem `type`, ou o
         *   tipo é desconhecido. Nos três casos o RoomClient ignora em
         *   silêncio: derrubar a conexão porque o servidor mandou um evento
         *   novo que este APK ainda não conhece seria pior.
         */
        fun parse(raw: String): ServerEvent? {
            val json = runCatching { JSONObject(raw) }.getOrNull() ?: return null
            return when (json.optString("type")) {
                "snapshot" -> Snapshot(memberNames(json))
                "roster" -> Roster(memberNames(json))
                "roll" -> Roll(
                    player = json.optString("player", "?"),
                    resultJson = json.optJSONObject("result")?.toString() ?: return null,
                    styleJson = json.optJSONObject("style")?.toString(),
                    stylesJson = json.optJSONObject("styles")?.toString(),
                )
                "deck_draw" -> DeckDraw(
                    player = json.optString("player", "?"),
                    cardsJson = json.optJSONArray("cards")?.toString() ?: return null,
                    remaining = json.optInt("remaining", 0),
                )
                "deck_shuffle" -> DeckShuffle(json.optString("player", "?"))
                "deck_config" -> DeckConfig(
                    player = json.optString("player", "?"),
                    // `has` e não `optBoolean` direto: ausente e `false` são
                    // coisas diferentes aqui — só o que mudou vem no evento.
                    includeJokers = if (json.has("include_jokers")) {
                        json.optBoolean("include_jokers")
                    } else {
                        null
                    },
                    removalMode = json.optString("removal_mode", "").ifEmpty { null },
                    autoReshuffleOnEmpty = if (json.has("auto_reshuffle_on_empty")) {
                        json.optBoolean("auto_reshuffle_on_empty")
                    } else {
                        null
                    },
                )
                "error" -> Error(json.optString("message", "erro do servidor"))
                "ping" -> Ping
                else -> null
            }
        }

        /**
         * Nomes do roster. Cada membro é um OBJETO (`{name, style}`) desde
         * que o dado ganhou cor — tratar como lista de strings é o bug que
         * deixou o smoke de sala quebrado por meses.
         */
        private fun memberNames(json: JSONObject): List<String> {
            val roster = json.optJSONArray("roster") ?: return emptyList()
            return buildList {
                for (i in 0 until roster.length()) {
                    val membro = roster.optJSONObject(i) ?: continue
                    add(membro.optString("name", "?"))
                }
            }
        }
    }
}
