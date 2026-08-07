package app.meioorc.rolai

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * O APK calcula rolagem na WebView headless, com o bundle EMBARCADO em
 * assets/. Esse bundle e um artefato de build: se alguem mexer no
 * rules-engine e nao rodar `npm run build:headless`, o app segue rodando o
 * motor ANTIGO — foi o que aconteceu com o keep/drop (a web mostrava os
 * dados descartados, o app nao).
 *
 * Este teste roda no aparelho e falha se o bundle estiver defasado.
 */
@RunWith(AndroidJUnit4::class)
class KeepDropHeadlessTest {

    private fun rolar(notacao: String): JSONObject {
        val latch = CountDownLatch(1)
        var saida: String? = null
        var erro: String? = null
        androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
            .runOnMainSync {
                val roller = HeadlessRoller(
                    ApplicationProvider.getApplicationContext(),
                    onResult = { saida = it; latch.countDown() },
                    onError = { erro = it; latch.countDown() },
                )
                roller.roll(notacao)
            }
        assertTrue("timeout rolando $notacao", latch.await(20, TimeUnit.SECONDS))
        assertEquals(null, erro)
        return JSONObject(saida!!).getJSONObject("groups").getJSONObject("roll")
    }

    @Test
    fun desvantagemGuardaOdadoPerdedor() {
        val grupo = rolar("1d20dis")
        assertEquals(1, grupo.getJSONArray("rolls").length())
        assertEquals(
            "bundle headless defasado: rode npm run build:headless",
            1,
            grupo.optJSONArray("dropped")?.length() ?: 0,
        )
    }

    @Test
    fun poolGrandeComKeepDropDevolveTudo() {
        val grupo = rolar("10d6kh1")
        val mantidos = grupo.getJSONArray("rolls").length()
        val descartados = grupo.optJSONArray("dropped")?.length() ?: 0
        assertEquals(10, mantidos + descartados)
    }
}
