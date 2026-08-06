package app.meioorc.rolai

/**
 * Backoff exponencial com teto pra reconexao do WebSocket da sala.
 * Classe pura (sem Android) pra rodar em teste JVM local.
 *
 * Sequencia default: 1s, 2s, 4s, 8s, 16s, 30s, 30s, ... — agressiva o
 * bastante pra reconectar rapido numa queda de rede momentanea, sem
 * martelar o backend (que tem WS_CONNECT_LIMIT_PER_MINUTE por IP — ver
 * docs/security.md).
 */
class ReconnectBackoff(
    private val initialMs: Long = 1_000L,
    private val maxMs: Long = 30_000L,
) {
    private var current = 0L

    fun next(): Long {
        current = if (current == 0L) initialMs else minOf(current * 2, maxMs)
        return current
    }

    fun reset() {
        current = 0L
    }
}
