package app.meioorc.rolai

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Before
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.TimeUnit

/**
 * Instrumented test (criterio de aceite de specs/04-android-overlay.md):
 * o Service inicia em foreground e desenha a view flutuante no WindowManager.
 *
 * NAO usa ServiceTestRule: ela faz BIND e espera um binder, e o
 * OverlayService.onBind() devolve null de proposito (e servico INICIADO, nao
 * vinculado). Com ela, todo teste aqui morria com "Waited for 5 SECONDS, but
 * service was never connected" — e como a suite nunca tinha sido executada,
 * o erro ficou escondido por meses. Aqui iniciamos como o app inicia.
 *
 * Pre-requisito no dispositivo (conceder antes de rodar):
 *   adb shell appops set app.meioorc.rolai SYSTEM_ALERT_WINDOW allow
 *   adb shell pm grant app.meioorc.rolai android.permission.POST_NOTIFICATIONS
 * Sem a permissao de overlay o service se encerra sozinho e o teste falha.
 */
@RunWith(AndroidJUnit4::class)
class OverlayServiceTest {

    private val context: Context get() = ApplicationProvider.getApplicationContext()

    @Before
    fun ligaPreferencia() {
        // O service so sobe se o usuario tiver ligado o botao flutuante (a
        // SettingsActivity grava a flag ANTES de dar start). Sem isto o
        // onCreate faz stopSelf e nada monta — que e o comportamento certo.
        RolaiSettings.setOverlayEnabled(context, true)
    }

    @After
    fun desligaOverlay() {
        RolaiSettings.setOverlayEnabled(context, false)
        context.startService(intentDe(OverlayService.ACTION_STOP))
        esperar(esperado = false)
    }

    private fun intentDe(action: String) =
        Intent(context, OverlayService::class.java).setAction(action)

    /** Espera o overlay chegar ao estado pedido; devolve se chegou. */
    private fun esperar(esperado: Boolean, segundos: Long = 10): Boolean {
        val limite = System.nanoTime() + TimeUnit.SECONDS.toNanos(segundos)
        while (OverlayService.overlayAttached != esperado && System.nanoTime() < limite) {
            Thread.sleep(100)
        }
        return OverlayService.overlayAttached == esperado
    }

    @Test
    fun serviceIniciaEDesenhaAViewFlutuante() {
        ContextCompat.startForegroundService(context, intentDe(OverlayService.ACTION_START))
        assertTrue("overlay nao foi anexado ao WindowManager", esperar(esperado = true))
    }

    @Test
    fun actionStopEncerraOService() {
        ContextCompat.startForegroundService(context, intentDe(OverlayService.ACTION_START))
        assertTrue(esperar(esperado = true))

        context.startService(intentDe(OverlayService.ACTION_STOP))
        assertTrue("overlay nao foi removido apos ACTION_STOP", esperar(esperado = false))
    }

    /**
     * REGRESSAO: RELOAD chegando com o service fora do ar nao pode derrubar
     * o processo.
     *
     * `overlayAttached` e estatico, entao um `true` deixado por uma instancia
     * anterior ficava visivel pra proxima; um RELOAD nessa janela tocava
     * `windowManager` ainda nao inicializado e o app morria com
     * UninitializedPropertyAccessException — o "fecha com erro" ao desligar e
     * religar o botao flutuante. A correcao (isReady) foi feita por analise,
     * porque o intent nao entra por adb: o service nao e exportado. Este
     * teste roda DENTRO do app, entao prova o que o adb nao provava.
     */
    @Test
    fun reloadComServiceParadoNaoDerrubaOApp() {
        ContextCompat.startForegroundService(context, intentDe(OverlayService.ACTION_START))
        assertTrue(esperar(esperado = true))
        // Desligar de verdade e o que a tela faz: apaga a preferencia E para
        // o service. E nesse intervalo que o RELOAD atrasado chegava.
        RolaiSettings.setOverlayEnabled(context, false)
        context.startService(intentDe(OverlayService.ACTION_STOP))
        assertTrue(esperar(esperado = false))

        // O que quebrava: RELOAD depois do STOP.
        context.startService(intentDe(OverlayService.ACTION_RELOAD))
        Thread.sleep(1500)

        // Chegar vivo aqui ja e o teste: um crash derrubaria o processo do
        // app e levaria a suite inteira junto.
        assertTrue(
            "RELOAD com service parado nao pode remontar nada",
            !OverlayService.overlayAttached,
        )
    }
}
