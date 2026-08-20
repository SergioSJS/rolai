package app.meioorc.rolai

import android.content.Context
import android.view.WindowManager
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * O palco não só está no APK: ele SOBE.
 *
 * `OfflineStageTest` prova que os arquivos foram embarcados e que o
 * WebViewAssetLoader os serve. Isso não é a mesma coisa que a página rodar —
 * e a diferença apareceu na sessão de 2026-08-20 como um retângulo BRANCO
 * com ícone de imagem quebrada, com todos os assets presentes e íntegros. A
 * WebView tinha carregado o index.html do APK ANTERIOR (o `adb install -r`
 * troca os arquivos embaixo de um Service vivo), e nenhum teste percebia.
 *
 * O que faz o dado aparecer é a ponte `window.rolaiStream`, publicada pelo
 * StreamApp quando o bundle roda. Se ela existe, a página rodou de verdade.
 *
 * Pré-requisito: permissão de overlay (o script run-instrumented.sh concede).
 */
@RunWith(AndroidJUnit4::class)
class StageRendersTest {

    private val context: Context get() = ApplicationProvider.getApplicationContext()
    private var stage: DiceStageWindow? = null

    @After
    fun desmonta() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            stage?.detach()
            stage = null
        }
    }

    @Test
    fun palcoLocalSobeEPublicaAPonte() {
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            stage = DiceStageWindow(context).also {
                // Base padrão = palco do próprio APK (usaPalcoLocal), sem rede.
                it.attach(
                    wm = wm,
                    webBaseUrl = RolaiSettings.DEFAULT_WEB_BASE_URL,
                    roomCode = "",
                    dicePreset = "",
                )
            }
        }

        assertTrue(
            "window.rolaiStream nao apareceu: a pagina do palco nao rodou",
            esperarPonte(segundos = 20),
        )
    }

    /**
     * Pergunta à página, de tempos em tempos, se a ponte já existe. WebView
     * carrega assíncrono e não avisa quando o JS terminou — por isso enquete
     * com prazo, e não uma espera fixa.
     */
    private fun esperarPonte(segundos: Long): Boolean {
        val limite = System.nanoTime() + TimeUnit.SECONDS.toNanos(segundos)
        while (System.nanoTime() < limite) {
            if (perguntaSeTemPonte()) return true
            Thread.sleep(500)
        }
        return false
    }

    private fun perguntaSeTemPonte(): Boolean {
        val latch = CountDownLatch(1)
        var resposta = "null"
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            val view = stage?.webViewParaTeste()
            if (view == null) {
                latch.countDown()
            } else {
                view.evaluateJavascript(
                    "(typeof window.rolaiStream === 'object' && window.rolaiStream !== null)",
                ) { valor ->
                    resposta = valor
                    latch.countDown()
                }
            }
        }
        latch.await(3, TimeUnit.SECONDS)
        return resposta == "true"
    }
}
