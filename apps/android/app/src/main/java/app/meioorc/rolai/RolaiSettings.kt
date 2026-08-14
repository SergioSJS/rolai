package app.meioorc.rolai

import android.content.Context

/**
 * Preferencias da tela de configuracoes, consumidas pelo OverlayService.
 * As funcoes de validacao do companion sao puras (sem Context) justamente
 * pra serem cobertas por teste JVM local.
 */
data class RolaiSettings(
    val roomCode: String,
    val playerName: String,
    val notation: String,
    // Id do profile de sistema ("pbta", "d20", ...); vazio = notacao livre.
    val system: String,
    // Inputs do profile como JSON cru ("{\"mod\": 1}") — quem valida de
    // verdade e o rules-engine na WebView headless; aqui so repassa.
    val inputsJson: String,
    val wsBaseUrl: String,
    // Origem do apps/web — o palco de dados do overlay carrega
    // `<webBaseUrl>/?room=...&stream=1` (ver DiceStageWindow).
    val webBaseUrl: String,
    // Id do preset de dado (mesmos ids de DICE_PRESETS no apps/web) — vai na
    // URL do palco (`&style=`), ja que a WebView do overlay tem localStorage
    // proprio e nunca veria a escolha feita no navegador.
    val dicePreset: String,
    // Tamanho do dado em % (70..160) e tier de qualidade do palco — tambem
    // viajam pela URL do modo stream (`&scale=`, `&quality=`).
    val diceScalePercent: Int,
    val quality: String,
    // Aparencia custom do dado (hex "#rrggbb" + ids de textura/material,
    // os mesmos do apps/web). Vao na URL do palco (&body=&number=...).
    val diceBody: String,
    val diceNumber: String,
    val diceOutline: String,
    val diceTexture: String,
    val diceMaterial: String,
) {
    companion object {
        const val PREFS_NAME = "rolai_settings"

        // Debug aponta pro backend local (ws://localhost:8420 via adb
        // reverse); release, pro dominio de producao — ver app/build.gradle.kts.
        val DEFAULT_WS_BASE_URL: String = BuildConfig.DEFAULT_WS_BASE_URL
        val DEFAULT_WEB_BASE_URL: String = BuildConfig.DEFAULT_WEB_BASE_URL
        const val DEFAULT_NOTATION = "2d6"

        /** Ids e rotulos espelham DICE_PRESETS de apps/web/src/settings.ts. */
        val DICE_PRESET_IDS = listOf(
            "esmeralda", "osso", "obsidiana", "sangue", "abissal", "gelo", "escamas", "madeira",
        )
        val DICE_PRESET_LABELS = listOf(
            "Esmeralda", "Osso", "Obsidiana", "Sangue", "Abissal", "Gelo", "Escamas", "Taverna",
        )
        const val DEFAULT_DICE_PRESET = "esmeralda"

        // Mesma faixa do apps/web (MIN/MAX_DICE_SCALE em settings.ts).
        const val MIN_SCALE_PERCENT = 70
        const val MAX_SCALE_PERCENT = 160
        const val DEFAULT_SCALE_PERCENT = 100

        /** Ids/labels dos tiers — espelham QUALITY_TIERS do apps/web. */
        val QUALITY_IDS = listOf("3d-full", "3d-light", "2d", "text")
        val QUALITY_LABELS = listOf("3D completo", "3D leve", "2D", "Texto")
        const val DEFAULT_QUALITY = "3d-light"

        fun clampScalePercent(value: Int): Int =
            value.coerceIn(MIN_SCALE_PERCENT, MAX_SCALE_PERCENT)

        /** Texturas e materiais — espelham settings.ts do apps/web. */
        val TEXTURE_IDS = listOf(
            "none", "marble", "speckles", "glitter", "stars", "astral", "cloudy",
            "fire", "water", "ice", "paper", "wood", "metal", "stainedglass",
            "skulls", "dragon", "leopard", "tiger", "lizard", "bird",
        )
        val TEXTURE_LABELS = listOf(
            "Lisa", "Mármore", "Pintas", "Glitter", "Estrelas", "Céu astral", "Nuvens",
            "Fogo", "Água", "Gelo", "Papel", "Madeira", "Aço", "Vitral",
            "Caveiras", "Dragão", "Leopardo", "Tigre", "Lagarto", "Pena",
        )
        val MATERIAL_IDS = listOf("auto", "plastic", "metal", "wood", "glass", "none")
        val MATERIAL_LABELS = listOf("Automático", "Plástico", "Metal", "Madeira", "Vidro", "Fosco")

        /**
         * Paleta dos seletores de cor, com ordem proposital (a lista
         * anterior era um apanhado das cores dos presets, sem logica):
         *
         *  1. NEUTROS, do claro pro escuro — sao o que se usa em numero e
         *     contorno na maioria das combinacoes legiveis;
         *  2. ESPECTRO, 12 matizes dando a volta no circulo cromatico com
         *     saturacao e luminosidade constantes, entao nenhuma cor "pula"
         *     e qualquer uma serve de corpo do dado.
         *
         * O verde da marca (#1d9e75) e o esmeralda do espectro.
         */
        val PALETTE = listOf(
            // neutros
            "#ffffff", "#e8e0cd", "#8b95a1", "#4a5560", "#14181c", "#05070a",
            // espectro (12 matizes, S/L constantes)
            "#b83227", "#c4642a", "#c9962e", "#8a9e2b", "#3f9e46", "#1d9e75",
            "#199e93", "#2a86b8", "#2b5fc4", "#4a3fb8", "#7a3fb8", "#b83a94",
        )

        // Defaults = preset "esmeralda" do apps/web.
        const val DEFAULT_BODY = "#1d9e75"
        const val DEFAULT_NUMBER = "#f4f7f5"
        const val DEFAULT_OUTLINE = "#0c3527"
        const val DEFAULT_TEXTURE = "none"
        const val DEFAULT_MATERIAL = "plastic"
        const val DEFAULT_NAME = "overlay"

        // Mesmo formato validado no backend (docs/security.md) — validar
        // aqui evita abrir WS com codigo que o servidor rejeitaria (4404).
        private val ROOM_CODE_REGEX = Regex("[A-Za-z0-9_-]{4,32}")

        // Teto do apelido no servidor (MAX_NAME_LENGTH, app/limits.py).
        const val MAX_NAME_LENGTH = 24

        fun isValidRoomCode(code: String): Boolean = ROOM_CODE_REGEX.matches(code)

        // O "Copiar link"/"Copiar link pro OBS" da web gera a URL inteira
        // (`https://rolai.app/?room=CODIGO...`), nao so o codigo — colar
        // isso direto no campo aqui tinha que funcionar tambem, senao o
        // unico jeito de levar uma sala da web pro app era digitar o codigo
        // a mao, letra por letra. `android.net.Uri` fica de fora de proposito:
        // sob `isReturnDefaultValues=true` (testOptions do modulo) ele vira
        // stub e devolve null sem parsear nada — string pura e o que da pra
        // cobrir de verdade em teste JVM local (mesmo espirito do resto do
        // arquivo).
        fun extractRoomCode(raw: String): String {
            val trimmed = raw.trim()
            if (!trimmed.startsWith("http://", ignoreCase = true) &&
                !trimmed.startsWith("https://", ignoreCase = true)
            ) {
                return trimmed
            }
            val query = trimmed.substringAfter('?', "").substringBefore('#')
            for (pair in query.split('&')) {
                val eq = pair.indexOf('=')
                if (eq < 0) continue
                if (pair.substring(0, eq) != "room") continue
                return try {
                    java.net.URLDecoder.decode(pair.substring(eq + 1), "UTF-8")
                } catch (e: java.io.UnsupportedEncodingException) {
                    trimmed
                }
            }
            return trimmed
        }

        // Mao inversa do extractRoomCode: gerar o link pra colar em outro
        // aparelho/navegador ou na Browser Source do OBS. Mesmo formato que
        // RoomPanel.tsx monta na web (`?room=CODIGO`, `&stream=1&scale=`) —
        // tem que abrir na MESMA sala dos dois lados.
        fun roomShareUrl(webBaseUrl: String, code: String): String {
            val base = webBaseUrl.trim().trimEnd('/').ifEmpty { DEFAULT_WEB_BASE_URL }
            return "$base/?room=$code"
        }

        fun roomObsShareUrl(webBaseUrl: String, code: String, scalePercent: Int): String {
            // /100.0 sempre fecha limpo (70..160 de 5 em 5): Double.toString
            // no JVM devolve a representacao mais curta que da roundtrip,
            // igual ao toString() do JS que a web usa pro mesmo numero.
            val scale = clampScalePercent(scalePercent) / 100.0
            return "${roomShareUrl(webBaseUrl, code)}&stream=1&scale=$scale"
        }

        fun sanitizeName(name: String): String =
            name.trim().take(MAX_NAME_LENGTH).ifEmpty { DEFAULT_NAME }

        fun isValidWsBaseUrl(url: String): Boolean =
            url.startsWith("wss://") || url.startsWith("ws://")

        // Sala e opcional: sem codigo valido o overlay rola so local.
        fun hasRoom(settings: RolaiSettings): Boolean = isValidRoomCode(settings.roomCode)

        // Piso de entropia do codigo escolhido a mao. ESPELHO de
        // is_valid_custom_code (services/backend/app/rooms.py) e de
        // apps/web/src/room/code.ts. Quem manda e o backend; isto existe pra
        // dizer o motivo antes de gastar conexao e levar um 4404 seco.
        const val CUSTOM_CODE_MIN_LENGTH = 16
        const val CUSTOM_CODE_MIN_DISTINCT = 8

        /** `null` = pode virar sala. Senao, o motivo pro usuario. */
        fun customCodeIssue(code: String): String? {
            val c = code.trim()
            return when {
                c.isEmpty() -> "digite um código"
                !c.all { it.isLetterOrDigit() || it == '-' || it == '_' } ->
                    "use apenas letras, números, hífen e sublinhado"
                c.length > 32 -> "no máximo 32 caracteres"
                c.length < CUSTOM_CODE_MIN_LENGTH ->
                    "mínimo de $CUSTOM_CODE_MIN_LENGTH caracteres (tem ${c.length})"
                c.toSet().size < CUSTOM_CODE_MIN_DISTINCT ->
                    "use pelo menos $CUSTOM_CODE_MIN_DISTINCT caracteres diferentes"
                else -> null
            }
        }

        /**
         * Base HTTP derivada da base WS — o REST (criar sala) e o WS moram
         * no mesmo host. Uma config so pro usuario: quem troca o servidor
         * troca um campo, nao dois.
         */
        fun httpBaseUrl(wsBaseUrl: String): String {
            val base = wsBaseUrl.trimEnd('/')
            return when {
                base.startsWith("wss://") -> "https://" + base.removePrefix("wss://")
                base.startsWith("ws://") -> "http://" + base.removePrefix("ws://")
                else -> base
            }
        }

        fun load(context: Context): RolaiSettings {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return RolaiSettings(
                roomCode = prefs.getString("room_code", "") ?: "",
                playerName = prefs.getString("player_name", "") ?: "",
                notation = prefs.getString("notation", DEFAULT_NOTATION) ?: DEFAULT_NOTATION,
                system = prefs.getString("system", "") ?: "",
                inputsJson = prefs.getString("inputs_json", "") ?: "",
                wsBaseUrl = prefs.getString("ws_base_url", DEFAULT_WS_BASE_URL)
                    ?: DEFAULT_WS_BASE_URL,
                webBaseUrl = prefs.getString("web_base_url", DEFAULT_WEB_BASE_URL)
                    ?: DEFAULT_WEB_BASE_URL,
                dicePreset = prefs.getString("dice_preset", DEFAULT_DICE_PRESET)
                    ?: DEFAULT_DICE_PRESET,
                diceScalePercent = clampScalePercent(
                    prefs.getInt("dice_scale_percent", DEFAULT_SCALE_PERCENT),
                ),
                quality = prefs.getString("quality", DEFAULT_QUALITY)
                    .let { if (it in QUALITY_IDS) it!! else DEFAULT_QUALITY },
                diceBody = prefs.getString("dice_body", DEFAULT_BODY) ?: DEFAULT_BODY,
                diceNumber = prefs.getString("dice_number", DEFAULT_NUMBER) ?: DEFAULT_NUMBER,
                diceOutline = prefs.getString("dice_outline", DEFAULT_OUTLINE) ?: DEFAULT_OUTLINE,
                diceTexture = prefs.getString("dice_texture", DEFAULT_TEXTURE)
                    .let { if (it in TEXTURE_IDS) it!! else DEFAULT_TEXTURE },
                diceMaterial = prefs.getString("dice_material", DEFAULT_MATERIAL)
                    .let { if (it in MATERIAL_IDS) it!! else DEFAULT_MATERIAL },
            )
        }

        fun save(context: Context, settings: RolaiSettings) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString("room_code", settings.roomCode.trim())
                .putString("player_name", settings.playerName)
                .putString("notation", settings.notation.trim())
                .putString("system", settings.system)
                .putString("inputs_json", settings.inputsJson.trim())
                .putString("ws_base_url", settings.wsBaseUrl.trim())
                .putString("dice_preset", settings.dicePreset)
                .putInt("dice_scale_percent", clampScalePercent(settings.diceScalePercent))
                .putString("quality", settings.quality)
                .putString("dice_body", settings.diceBody)
                .putString("dice_number", settings.diceNumber)
                .putString("dice_outline", settings.diceOutline)
                .putString("dice_texture", settings.diceTexture)
                .putString("dice_material", settings.diceMaterial)
                .apply()
        }

        fun isOverlayEnabled(context: Context): Boolean =
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean("overlay_enabled", false)

        fun setOverlayEnabled(context: Context, enabled: Boolean) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putBoolean("overlay_enabled", enabled)
                .apply()
        }
    }
}
