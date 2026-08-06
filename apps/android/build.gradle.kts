// TODO(spec 04-android-overlay.md): plugins/versoes do AGP e Kotlin
// conforme a API level alvo do projeto — checar exigencias atuais de
// foreground service type na documentacao oficial antes de fixar (ver
// docs/security.md, isso muda por versao do Android).
plugins {
    id("com.android.application") version "8.6.0" apply false
    id("org.jetbrains.kotlin.android") version "2.0.20" apply false
}
