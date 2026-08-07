package app.meioorc.rolai

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.google.androidbrowserhelper.trusted.LauncherActivity

/**
 * TWA envelopando https://rolai.app (apps/web em producao).
 *
 * A associacao app <-> dominio e feita pelo Digital Asset Links servido em
 * https://rolai.app/.well-known/assetlinks.json (o arquivo-fonte mora em
 * apps/web/public/.well-known/assetlinks.json). Sem ele valido, a TWA cai
 * pra barra de URL visivel — ver apps/android/README.md pra gerar o
 * fingerprint SHA-256 do keystore de release.
 */
class TwaActivity : LauncherActivity() {

    companion object {
        /**
         * Intent que abre a TWA no endereco CONFIGURADO, e nao no
         * DEFAULT_URL do manifest.
         *
         * O manifest fixa a URL por buildType — no debug e o Vite local
         * (http://localhost:5273), que so existe com `adb reverse`. Num
         * aparelho comum isso faz o botao "abrir" nao mostrar nada: a
         * LauncherActivity sobe, nao acha o endereco e se encerra, sem erro
         * visivel. Passar a URL como data do intent faz a helper usar ELA,
         * entao o botao passa a respeitar o campo Servidor da tela.
         *
         * CLEAR_TOP: a aba do Custom Tab vive na MESMA task do app; sem ela
         * o Android considera a task ja no topo e ignora o clique.
         * NEW_TASK: obrigatorio quando quem chama e o Service do overlay.
         */
        fun intentFor(context: Context): Intent {
            val settings = RolaiSettings.load(context)
            val url = settings.webBaseUrl.trimEnd('/').ifEmpty {
                RolaiSettings.DEFAULT_WEB_BASE_URL
            }
            return Intent(context, TwaActivity::class.java)
                .setData(Uri.parse(url))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
    }
}
