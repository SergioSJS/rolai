plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.meioorc.rolai"
    // compileSdk 35 / targetSdk 35: a partir da API 34 TODA foreground
    // service exige tipo declarado + permissao especifica (ver
    // AndroidManifest.xml e docs/security.md). minSdk 26 cobre ~95%+ dos
    // aparelhos e simplifica o codigo (canal de notificacao e
    // startForegroundService existem desde a 26).
    compileSdk = 35

    defaultConfig {
        applicationId = "app.meioorc.rolai"
        minSdk = 26
        targetSdk = 35
        versionCode = 12
        versionName = "0.9.1"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildFeatures {
        buildConfig = true
    }

    // Assinatura de release: so existe quando as envs estao presentes (o CI
    // as monta a partir dos secrets). Sem elas, `assembleRelease` cai na
    // chave de debug — o build local e o CI de PR continuam verdes sem
    // precisar de chave nenhuma. A chave NUNCA entra no repositorio.
    // VAZIO conta como ausente. No GitHub Actions um secret que nao existe
    // vira string VAZIA na env (nao some), entao `?:` sozinho nao serve:
    // keyPassword virava "" e o build morria com "Get Key failed: Given
    // final block not properly padded" — que parece senha errada, mas e
    // senha vazia. Keystore PKCS12 (padrao do keytool desde o JDK 9) usa a
    // mesma senha pra store e pra chave, entao o fallback e o caminho comum.
    fun env(name: String): String? = System.getenv(name)?.takeIf { it.isNotBlank() }

    val keystoreFile = env("ANDROID_KEYSTORE_PATH")
    val hasSigning = keystoreFile != null && file(keystoreFile).exists()

    signingConfigs {
        if (hasSigning) {
            create("release") {
                storeFile = file(keystoreFile)
                storePassword = env("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = env("ANDROID_KEY_ALIAS")
                keyPassword = env("ANDROID_KEY_PASSWORD") ?: env("ANDROID_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            // Dev: a TWA abre o Vite da maquina, alcancavel do aparelho por
            // `adb reverse tcp:5273 tcp:5273` (nada exposto na rede).
            manifestPlaceholders["twaUrl"] = "http://localhost:5273"
            buildConfigField("String", "DEFAULT_WS_BASE_URL", "\"ws://localhost:8420\"")
            buildConfigField("String", "DEFAULT_WEB_BASE_URL", "\"http://localhost:5273\"")
        }
        release {
            if (hasSigning) signingConfig = signingConfigs.getByName("release")
            manifestPlaceholders["twaUrl"] = "https://rolai.app"
            buildConfigField("String", "DEFAULT_WS_BASE_URL", "\"wss://api.rolai.app\"")
            buildConfigField("String", "DEFAULT_WEB_BASE_URL", "\"https://rolai.app\"")
            // Sem minify por ora: o app ainda nao passou pela primeira
            // compilacao real; ativar R8 so depois de validado no SDK.
            isMinifyEnabled = false
        }
    }

    testOptions {
        unitTests {
            // DiceHarmony usa android.graphics.Color (aritmetica pura); sem
            // isto o stub do JUnit no Android lanca em vez de calcular.
            isIncludeAndroidResources = true
            isReturnDefaultValues = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // TWA (LauncherActivity estende AppCompatActivity — appcompat e
    // dependencia real, nao so transitiva).
    // 2.5.0, nao 2.6.0: a 2.6.0 chama TrustedWebActivityIntentBuilder
    // .setOriginalLaunchUrl(), que so existe em androidx.browser 1.9.0-alpha02
    // (exige compileSdk 36 / AGP 8.9.1). Forcar browser 1.8.0 com a 2.6.0
    // compila, mas o app morre no launch com NoSuchMethodError — verificado
    // em aparelho. Migrar as duas juntas quando formos pro Android 16.
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
    implementation("androidx.browser:browser:1.8.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    // ServiceCompat/NotificationCompat/ContextCompat (OverlayService,
    // SettingsActivity) — declarada explicitamente, nao so transitiva.
    implementation("androidx.core:core:1.13.1")

    // Roda de cores (HSV) pronta, com barra de brilho — Maven Central.
    implementation("com.github.skydoves:colorpickerview:2.3.0")

    // Cliente WebSocket do OverlayService (sala ativa).
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Testes JVM locais (logica pura: backoff, validacao, URL do WS).
    testImplementation("junit:junit:4.13.2")
    // org.json no android.jar e stub: com isReturnDefaultValues=true todo
    // metodo devolve null, e `JSONObject().put(...)` encadeado estoura NPE.
    // Esta e a implementacao de verdade, so no classpath de teste.
    testImplementation("org.json:json:20240303")

    // Testes instrumentados (specs/04-android-overlay.md). NAO rodam sem
    // SDK/emulador — ver apps/android/README.md.
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation("androidx.test:rules:1.6.1")
    // MockWebServer fala WebSocket — usado no teste de reconexao do
    // RoomClient sem depender do backend real.
    androidTestImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}

configurations.all {
    resolutionStrategy {
        force("androidx.browser:browser:1.8.0")
    }
}
