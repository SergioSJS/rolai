package app.meioorc.rolai

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * Instrumented test (criterio de aceite de specs/04-android-overlay.md):
 * o resultado calculado pela WebView headless no Android bate com o mesmo
 * input rodado em packages/rules-engine — "mesmo teste, ambiente diferente".
 *
 * Os valores esperados abaixo foram ASSADOS a partir do proprio bundle
 * (apps/web/dist-headless, mesma fonte que a WebView carrega), rodando
 * src/headless.test.ts com as mesmas filas deterministicas:
 *   rolai.roll("2d6", det [3,4])                    -> rolls [3,4], sem total
 *   rolai.rollWithProfile("pbta", {mode:"",mod:1}, [6,6]) -> "2d6+1", total 13,
 *                                                             outcome strong_hit
 * A fila `deterministic` (RollOptions do rules-engine) e o que permite
 * comparar valor exato sem depender de RNG.
 *
 * NAO EXECUTADO neste ambiente (sem Android SDK/emulador — ver
 * apps/android/README.md). Precisa de WebView funcional no dispositivo.
 */
@RunWith(AndroidJUnit4::class)
class HeadlessRollerParityTest {

    private fun rollAndAwait(call: (HeadlessRoller) -> Unit): String {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val latch = CountDownLatch(1)
        val result = AtomicReference<String>()
        val error = AtomicReference<String>()
        val holder = AtomicReference<HeadlessRoller>()

        // WebView so pode ser criada/usada na main thread.
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            holder.set(
                HeadlessRoller(
                    context,
                    onResult = { json ->
                        result.set(json)
                        latch.countDown()
                    },
                    onError = { message ->
                        error.set(message)
                        latch.countDown()
                    },
                ),
            )
        }
        try {
            InstrumentationRegistry.getInstrumentation().runOnMainSync {
                call(holder.get())
            }
            assertTrue(
                "WebView headless nao respondeu em 20s: ${error.get() ?: "timeout"}",
                latch.await(20, TimeUnit.SECONDS),
            )
            assertTrue("erro do rules-engine: ${error.get()}", error.get() == null)
            return result.get()
        } finally {
            InstrumentationRegistry.getInstrumentation().runOnMainSync {
                holder.get()?.destroy()
            }
        }
    }

    @Test
    fun rollNotacaoLivreBateComRulesEngine() {
        val json = rollAndAwait { roller ->
            roller.roll(
                "2d6",
                """{"deterministic":[3,4],"timestamp":"2026-01-01T00:00:00.000Z"}""",
            )
        }
        val result = JSONObject(json)
        assertEquals("2d6", result.getString("notation"))
        val rolls = result.getJSONObject("groups").getJSONObject("roll").getJSONArray("rolls")
        assertEquals(3, rolls.getInt(0))
        assertEquals(4, rolls.getInt(1))
        // Multi-dado sem operador: `total` ausente por contrato
        // (docs/roll-notation.md).
        assertFalse(result.getJSONObject("groups").getJSONObject("roll").has("total"))
        assertEquals("2026-01-01T00:00:00.000Z", result.getString("timestamp"))
    }

    @Test
    fun rollComProfileBateComRulesEngine() {
        val json = rollAndAwait { roller ->
            roller.rollWithProfile(
                "pbta",
                """{"mode":"","mod":1}""",
                """{"deterministic":[6,6],"timestamp":"2026-01-01T00:00:00.000Z"}""",
            )
        }
        val result = JSONObject(json)
        assertEquals("2d6+1", result.getString("notation"))
        assertEquals("pbta", result.getString("profile"))
        val group = result.getJSONObject("groups").getJSONObject("roll")
        assertEquals(13, group.getInt("total"))
        assertEquals(1, group.getInt("modifier"))
        assertEquals("strong_hit", result.getString("outcome"))
    }

    @Test
    fun notacaoInvalidaVoltaErroEstruturado() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val latch = CountDownLatch(1)
        val error = AtomicReference<String>()
        val holder = AtomicReference<HeadlessRoller>()
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            holder.set(
                HeadlessRoller(
                    context,
                    onResult = { latch.countDown() },
                    onError = { message ->
                        error.set(message)
                        latch.countDown()
                    },
                ),
            )
        }
        try {
            InstrumentationRegistry.getInstrumentation().runOnMainSync {
                holder.get().roll("isso nao e notacao")
            }
            assertTrue(latch.await(20, TimeUnit.SECONDS))
            assertTrue("esperava erro de parse, veio: ${error.get()}", !error.get().isNullOrBlank())
        } finally {
            InstrumentationRegistry.getInstrumentation().runOnMainSync {
                holder.get()?.destroy()
            }
        }
    }
}
