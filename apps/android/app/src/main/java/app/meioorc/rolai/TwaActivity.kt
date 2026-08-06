package app.meioorc.rolai

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
class TwaActivity : LauncherActivity()
