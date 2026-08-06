package app.meioorc.rolai

import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.rule.ServiceTestRule
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.TimeUnit

/**
 * Instrumented test (criterio de aceite de specs/04-android-overlay.md):
 * o Service inicia em foreground e desenha a view flutuante no WindowManager.
 *
 * NAO EXECUTADO neste ambiente (sem Android SDK/emulador — ver
 * apps/android/README.md). Pre-requisito no dispositivo/emulador:
 *   adb shell appops set app.meioorc.rolai SYSTEM_ALERT_WINDOW allow
 *   adb shell appops set app.meioorc.rolai POST_NOTIFICATIONS allow  (API 33+)
 * Sem a permissao de overlay o service se encerra sozinho e o teste falha.
 */
@RunWith(AndroidJUnit4::class)
class OverlayServiceTest {

    @get:Rule
    val serviceRule = ServiceTestRule()

    @Test
    fun serviceIniciaEDesenhaAViewFlutuante() {
        val intent = Intent(
            ApplicationProvider.getApplicationContext(),
            OverlayService::class.java,
        ).setAction(OverlayService.ACTION_START)

        serviceRule.startService(intent)

        // A view e anexada no onCreate; a flag existe justamente pra este
        // teste observar sem depender de internals do WindowManager.
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
        while (!OverlayService.overlayAttached && System.nanoTime() < deadline) {
            Thread.sleep(100)
        }
        assertTrue("overlay nao foi anexado ao WindowManager", OverlayService.overlayAttached)
    }

    @Test
    fun actionStopEncerraOService() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val start = Intent(context, OverlayService::class.java)
            .setAction(OverlayService.ACTION_START)
        serviceRule.startService(start)

        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
        while (!OverlayService.overlayAttached && System.nanoTime() < deadline) {
            Thread.sleep(100)
        }
        assertTrue(OverlayService.overlayAttached)

        context.startService(
            Intent(context, OverlayService::class.java).setAction(OverlayService.ACTION_STOP),
        )
        val stopDeadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
        while (OverlayService.overlayAttached && System.nanoTime() < stopDeadline) {
            Thread.sleep(100)
        }
        assertTrue("overlay nao foi removido apos ACTION_STOP", !OverlayService.overlayAttached)
    }
}
