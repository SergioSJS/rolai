package app.meioorc.rolai

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.webkit.WebViewAssetLoader
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * O app tem que rolar dado 3D SEM REDE — instalado, modo aviao, tudo menos
 * sala.
 *
 * Este teste roda no aparelho e nao toca a internet: le os assets do proprio
 * APK pelo mesmo WebViewAssetLoader que o palco usa. Se o build parar de
 * embarcar o palco (ou o script de instalacao quebrar), ele falha aqui em
 * vez de o usuario descobrir num voo.
 */
@RunWith(AndroidJUnit4::class)
class OfflineStageTest {

    private val context: Context get() = ApplicationProvider.getApplicationContext()

    private fun loader() = WebViewAssetLoader.Builder()
        .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
        .build()

    private fun buscar(caminho: String) =
        loader().shouldInterceptRequest(
            android.net.Uri.parse("${DiceStageWindow.LOCAL_STAGE_BASE}/$caminho"),
        )

    @Test
    fun paginaDoPalcoEstaNoApk() {
        val resposta = buscar("index.html")
        // Resposta nao-nula = o loader ACHOU o arquivo (fora do APK ele
        // devolve null). O statusCode so e preenchido no fluxo real da
        // WebView, entao o que vale aqui e o stream de dados.
        assertNotNull("assets/stage/index.html nao foi embarcado", resposta)
        val html = resposta!!.data!!.bufferedReader().readText()
        assertTrue("index.html vazio ou errado", html.contains("<div id=\"root\""))
        assertTrue("bundle nao referenciado", html.contains("/assets/"))
    }

    @Test
    fun bundleTexturasEeSonsEstaoNoApk() {
        // Uma amostra de cada familia: se o script de copia falhar, alguma
        // delas some.
        val assets = context.assets
        val raiz = assets.list("stage")?.toList().orEmpty()
        assertTrue("sem pasta assets/stage", raiz.isNotEmpty())
        assertTrue("sem bundle JS/CSS", raiz.contains("assets"))
        assertTrue("sem texturas", raiz.contains("textures"))
        assertTrue("sem sons", raiz.contains("sounds"))

        val texturas = assets.list("stage/textures")?.size ?: 0
        assertTrue("poucas texturas: $texturas", texturas > 20)
        val sons = assets.list("stage/sounds/dicehit")?.size ?: 0
        assertTrue("poucos sons: $sons", sons > 20)
    }

    @Test
    fun servicoDeAssetsNaoEscapaDaPastaDoPalco() {
        // Path traversal: o loader nao pode servir nada fora de assets/.
        val fora = loader().shouldInterceptRequest(
            android.net.Uri.parse("https://appassets.androidplatform.net/nao-existe/x"),
        )
        assertEquals(null, fora)
    }

    @Test
    fun enderecoPadraoApontaProApk() {
        val url = DiceStageWindow.streamUrl(
            RolaiSettings.DEFAULT_WEB_BASE_URL,
            roomCode = "",
            dicePreset = "",
        )
        assertTrue(url, url.startsWith(DiceStageWindow.LOCAL_STAGE_BASE))
    }
}
