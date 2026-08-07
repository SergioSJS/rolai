package app.meioorc.rolai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * O palco de dados 3D tem que funcionar SEM REDE: o dado roda a partir dos
 * assets do proprio APK. Trocar o servidor nas configuracoes e a UNICA
 * coisa que devolve o palco pra rede.
 */
class StageUrlTest {

    @Test
    fun `endereco padrao usa o palco embarcado`() {
        assertTrue(DiceStageWindow.usaPalcoLocal(RolaiSettings.DEFAULT_WEB_BASE_URL))
        assertTrue(DiceStageWindow.usaPalcoLocal(""))
        // Barra final nao pode mudar a decisao.
        assertTrue(DiceStageWindow.usaPalcoLocal(RolaiSettings.DEFAULT_WEB_BASE_URL + "/"))
    }

    @Test
    fun `servidor custom volta a usar a rede`() {
        // Qualquer endereco DIFERENTE do padrao do build. Nao dava pra usar
        // "localhost" aqui: no buildType debug ele E o padrao (o Vite da
        // maquina), entao a asercao dependeria de qual variante roda.
        assertFalse(DiceStageWindow.usaPalcoLocal("https://meu-deploy.example"))
        assertFalse(DiceStageWindow.usaPalcoLocal("https://outro.rolai.app"))
    }

    @Test
    fun `url do palco padrao aponta pro APK, nao pra internet`() {
        val url = DiceStageWindow.streamUrl(
            RolaiSettings.DEFAULT_WEB_BASE_URL,
            roomCode = "",
            dicePreset = "",
        )
        assertTrue(url, url.startsWith(DiceStageWindow.LOCAL_STAGE_BASE))
        assertTrue(url, url.contains("stream=1"))
    }

    @Test
    fun `parametros de aparencia sobrevivem ao caminho local`() {
        val settings = RolaiSettings(
            roomCode = "", playerName = "x", notation = "2d6", system = "",
            inputsJson = "", wsBaseUrl = "wss://api.rolai.app",
            webBaseUrl = RolaiSettings.DEFAULT_WEB_BASE_URL,
            dicePreset = "", diceScalePercent = 130, quality = "3d-full",
            diceBody = "#B3261E", diceNumber = "#FFE082", diceOutline = "#000000",
            diceTexture = "wood", diceMaterial = "wood",
        )
        val url = DiceStageWindow.streamUrl(
            settings.webBaseUrl, "", "", settings.diceScalePercent,
            settings.quality, settings,
        )
        assertTrue(url, url.startsWith(DiceStageWindow.LOCAL_STAGE_BASE))
        assertTrue(url, url.contains("body=B3261E"))
        assertTrue(url, url.contains("texture=wood"))
        assertTrue(url, url.contains("scale=1.30"))
    }

    @Test
    fun `servidor custom mantem o endereco escolhido`() {
        val url = DiceStageWindow.streamUrl("https://meu.example/", "abcd", "")
        assertEquals(true, url.startsWith("https://meu.example/?stream=1"))
        assertTrue(url, url.contains("room=abcd"))
    }
}
