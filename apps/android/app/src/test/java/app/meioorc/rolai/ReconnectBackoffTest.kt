package app.meioorc.rolai

import org.junit.Assert.assertEquals
import org.junit.Test

class ReconnectBackoffTest {

    @Test
    fun `sequencia dobra ate o teto e estaciona nele`() {
        val backoff = ReconnectBackoff(initialMs = 1_000, maxMs = 30_000)
        assertEquals(1_000L, backoff.next())
        assertEquals(2_000L, backoff.next())
        assertEquals(4_000L, backoff.next())
        assertEquals(8_000L, backoff.next())
        assertEquals(16_000L, backoff.next())
        assertEquals(30_000L, backoff.next())
        assertEquals(30_000L, backoff.next())
    }

    @Test
    fun `reset volta pro inicial`() {
        val backoff = ReconnectBackoff(initialMs = 500, maxMs = 10_000)
        backoff.next()
        backoff.next()
        backoff.reset()
        assertEquals(500L, backoff.next())
    }

    @Test
    fun `teto menor que o dobro nao estoura`() {
        val backoff = ReconnectBackoff(initialMs = 1_000, maxMs = 1_500)
        assertEquals(1_000L, backoff.next())
        assertEquals(1_500L, backoff.next())
    }
}
