package app.meioorc.rolai

import android.content.Context

/**
 * Preferencias da tela de configuracoes, consumidas pelo OverlayService.
 * As funcoes de validacao do companion sao puras (sem Context) justamente
 * pra serem cobertas por teste JVM local.
 */
data class DiceSlotStyle(
    val body: String,
    val number: String,
    val outline: String,
    val texture: String,
    val material: String,
    val preset: String,
)

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
    // Slot 1 (Primário)
    val dicePreset: String = DEFAULT_DICE_PRESET,
    // Tamanho do dado em % (70..160) e tier de qualidade do palco — tambem
    // viajam pela URL do modo stream (`&scale=`, `&quality=`).
    val diceScalePercent: Int = DEFAULT_SCALE_PERCENT,
    val quality: String = DEFAULT_QUALITY,
    val diceBody: String = DEFAULT_BODY,
    val diceNumber: String = DEFAULT_NUMBER,
    val diceOutline: String = DEFAULT_OUTLINE,
    val diceTexture: String = DEFAULT_TEXTURE,
    val diceMaterial: String = DEFAULT_MATERIAL,
    // Slot 2 (Secundário)
    val dice2Preset: String = DEFAULT_2_DICE_PRESET,
    val dice2Body: String = DEFAULT_2_BODY,
    val dice2Number: String = DEFAULT_2_NUMBER,
    val dice2Outline: String = DEFAULT_2_OUTLINE,
    val dice2Texture: String = DEFAULT_2_TEXTURE,
    val dice2Material: String = DEFAULT_2_MATERIAL,
    // Slot 3 (Terciário)
    val dice3Preset: String = DEFAULT_3_DICE_PRESET,
    val dice3Body: String = DEFAULT_3_BODY,
    val dice3Number: String = DEFAULT_3_NUMBER,
    val dice3Outline: String = DEFAULT_3_OUTLINE,
    val dice3Texture: String = DEFAULT_3_TEXTURE,
    val dice3Material: String = DEFAULT_3_MATERIAL,
    // Config do baralho (espelha DeckConfig de @rolai/deck-engine).
    val deckIncludeJokers: Boolean = false,
    val deckRemovalMode: String = "permanent",
    val deckAutoReshuffle: Boolean = false,
) {
    fun slotStyle(slot: String): DiceSlotStyle = when (slot) {
        "2" -> DiceSlotStyle(dice2Body, dice2Number, dice2Outline, dice2Texture, dice2Material, dice2Preset)
        "3" -> DiceSlotStyle(dice3Body, dice3Number, dice3Outline, dice3Texture, dice3Material, dice3Preset)
        else -> DiceSlotStyle(diceBody, diceNumber, diceOutline, diceTexture, diceMaterial, dicePreset)
    }

    fun withSlotStyle(slot: String, style: DiceSlotStyle): RolaiSettings = when (slot) {
        "2" -> copy(
            dice2Body = style.body, dice2Number = style.number, dice2Outline = style.outline,
            dice2Texture = style.texture, dice2Material = style.material, dice2Preset = style.preset,
        )
        "3" -> copy(
            dice3Body = style.body, dice3Number = style.number, dice3Outline = style.outline,
            dice3Texture = style.texture, dice3Material = style.material, dice3Preset = style.preset,
        )
        else -> copy(
            diceBody = style.body, diceNumber = style.number, diceOutline = style.outline,
            diceTexture = style.texture, diceMaterial = style.material, dicePreset = style.preset,
        )
    }

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

        val PRESET_STYLES: Map<String, DiceSlotStyle> = mapOf(
            "esmeralda" to DiceSlotStyle("#1d9e75", "#f4f7f5", "#0c3527", "none", "plastic", "esmeralda"),
            "osso" to DiceSlotStyle("#e8e0cd", "#3a3226", "#3a3226", "marble", "auto", "osso"),
            "obsidiana" to DiceSlotStyle("#14171c", "#e5c07b", "#e5c07b", "speckles", "metal", "obsidiana"),
            "sangue" to DiceSlotStyle("#8c1f2b", "#f7e8e2", "#2b0a0e", "marble", "plastic", "sangue"),
            "abissal" to DiceSlotStyle("#0c1929", "#56b6c2", "#56b6c2", "stars", "glass", "abissal"),
            "gelo" to DiceSlotStyle("#2a86b8", "#ffffff", "#0e3852", "ice", "glass", "gelo"),
            "escamas" to DiceSlotStyle("#2d5a27", "#d19a66", "#142b11", "dragon", "metal", "escamas"),
            "madeira" to DiceSlotStyle("#5a3825", "#f4e8c1", "#2d1b11", "wood", "wood", "madeira"),
        )

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
         * Paleta dos seletores de cor, com ordem proposital:
         *  1. NEUTROS, do claro pro escuro;
         *  2. ESPECTRO, 12 matizes com S/L constantes.
         */
        val PALETTE = listOf(
            // neutros
            "#ffffff", "#e8e0cd", "#8b95a1", "#4a5560", "#14181c", "#05070a",
            // espectro (12 matizes, S/L constantes)
            "#b83227", "#c4642a", "#c9962e", "#8a9e2b", "#3f9e46", "#1d9e75",
            "#199e93", "#2a86b8", "#2b5fc4", "#4a3fb8", "#7a3fb8", "#b83a94",
        )

        // Defaults = presets dos 3 slots do apps/web.
        const val DEFAULT_BODY = "#1d9e75"
        const val DEFAULT_NUMBER = "#f4f7f5"
        const val DEFAULT_OUTLINE = "#0c3527"
        const val DEFAULT_TEXTURE = "none"
        const val DEFAULT_MATERIAL = "plastic"

        const val DEFAULT_2_BODY = "#8c1f2b"
        const val DEFAULT_2_NUMBER = "#f7e8e2"
        const val DEFAULT_2_OUTLINE = "#2b0a0e"
        const val DEFAULT_2_TEXTURE = "marble"
        const val DEFAULT_2_MATERIAL = "plastic"
        const val DEFAULT_2_DICE_PRESET = "sangue"

        const val DEFAULT_3_BODY = "#2a86b8"
        const val DEFAULT_3_NUMBER = "#ffffff"
        const val DEFAULT_3_OUTLINE = "#0e3852"
        const val DEFAULT_3_TEXTURE = "ice"
        const val DEFAULT_3_MATERIAL = "glass"
        const val DEFAULT_3_DICE_PRESET = "gelo"

        const val DEFAULT_NAME = "overlay"

        // Mesmo formato validado no backend (docs/security.md).
        private val ROOM_CODE_REGEX = Regex("[A-Za-z0-9_-]{4,32}")

        // Teto do apelido no servidor (MAX_NAME_LENGTH, app/limits.py).
        const val MAX_NAME_LENGTH = 24

        fun isValidRoomCode(code: String): Boolean = ROOM_CODE_REGEX.matches(code)

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

        fun roomShareUrl(webBaseUrl: String, code: String): String {
            val base = webBaseUrl.trim().trimEnd('/').ifEmpty { DEFAULT_WEB_BASE_URL }
            return "$base/?room=$code"
        }

        fun roomObsShareUrl(webBaseUrl: String, code: String, scalePercent: Int): String {
            val scale = clampScalePercent(scalePercent) / 100.0
            return "${roomShareUrl(webBaseUrl, code)}&stream=1&scale=$scale"
        }

        fun sanitizeName(name: String): String =
            name.trim().take(MAX_NAME_LENGTH).ifEmpty { DEFAULT_NAME }

        fun isValidWsBaseUrl(url: String): Boolean =
            url.startsWith("wss://") || url.startsWith("ws://")

        fun hasRoom(settings: RolaiSettings): Boolean = isValidRoomCode(settings.roomCode)

        const val CUSTOM_CODE_MIN_LENGTH = 16
        const val CUSTOM_CODE_MIN_DISTINCT = 8

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
                diceScalePercent = clampScalePercent(
                    prefs.getInt("dice_scale_percent", DEFAULT_SCALE_PERCENT),
                ),
                quality = prefs.getString("quality", DEFAULT_QUALITY)
                    .let { if (it in QUALITY_IDS) it!! else DEFAULT_QUALITY },
                // Slot 1
                dicePreset = prefs.getString("dice_preset", DEFAULT_DICE_PRESET)
                    ?: DEFAULT_DICE_PRESET,
                diceBody = prefs.getString("dice_body", DEFAULT_BODY) ?: DEFAULT_BODY,
                diceNumber = prefs.getString("dice_number", DEFAULT_NUMBER) ?: DEFAULT_NUMBER,
                diceOutline = prefs.getString("dice_outline", DEFAULT_OUTLINE) ?: DEFAULT_OUTLINE,
                diceTexture = prefs.getString("dice_texture", DEFAULT_TEXTURE)
                    .let { if (it in TEXTURE_IDS) it!! else DEFAULT_TEXTURE },
                diceMaterial = prefs.getString("dice_material", DEFAULT_MATERIAL)
                    .let { if (it in MATERIAL_IDS) it!! else DEFAULT_MATERIAL },
                // Slot 2
                dice2Preset = prefs.getString("dice_2_preset", DEFAULT_2_DICE_PRESET)
                    ?: DEFAULT_2_DICE_PRESET,
                dice2Body = prefs.getString("dice_2_body", DEFAULT_2_BODY) ?: DEFAULT_2_BODY,
                dice2Number = prefs.getString("dice_2_number", DEFAULT_2_NUMBER) ?: DEFAULT_2_NUMBER,
                dice2Outline = prefs.getString("dice_2_outline", DEFAULT_2_OUTLINE) ?: DEFAULT_2_OUTLINE,
                dice2Texture = prefs.getString("dice_2_texture", DEFAULT_2_TEXTURE)
                    .let { if (it in TEXTURE_IDS) it!! else DEFAULT_2_TEXTURE },
                dice2Material = prefs.getString("dice_2_material", DEFAULT_2_MATERIAL)
                    .let { if (it in MATERIAL_IDS) it!! else DEFAULT_2_MATERIAL },
                // Slot 3
                dice3Preset = prefs.getString("dice_3_preset", DEFAULT_3_DICE_PRESET)
                    ?: DEFAULT_3_DICE_PRESET,
                dice3Body = prefs.getString("dice_3_body", DEFAULT_3_BODY) ?: DEFAULT_3_BODY,
                dice3Number = prefs.getString("dice_3_number", DEFAULT_3_NUMBER) ?: DEFAULT_3_NUMBER,
                dice3Outline = prefs.getString("dice_3_outline", DEFAULT_3_OUTLINE) ?: DEFAULT_3_OUTLINE,
                dice3Texture = prefs.getString("dice_3_texture", DEFAULT_3_TEXTURE)
                    .let { if (it in TEXTURE_IDS) it!! else DEFAULT_3_TEXTURE },
                dice3Material = prefs.getString("dice_3_material", DEFAULT_3_MATERIAL)
                    .let { if (it in MATERIAL_IDS) it!! else DEFAULT_3_MATERIAL },
                // Baralho
                deckIncludeJokers = prefs.getBoolean("deck_include_jokers", false),
                deckRemovalMode = prefs.getString("deck_removal_mode", "permanent") ?: "permanent",
                deckAutoReshuffle = prefs.getBoolean("deck_auto_reshuffle", false),
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
                .putInt("dice_scale_percent", clampScalePercent(settings.diceScalePercent))
                .putString("quality", settings.quality)
                // Slot 1
                .putString("dice_preset", settings.dicePreset)
                .putString("dice_body", settings.diceBody)
                .putString("dice_number", settings.diceNumber)
                .putString("dice_outline", settings.diceOutline)
                .putString("dice_texture", settings.diceTexture)
                .putString("dice_material", settings.diceMaterial)
                // Slot 2
                .putString("dice_2_preset", settings.dice2Preset)
                .putString("dice_2_body", settings.dice2Body)
                .putString("dice_2_number", settings.dice2Number)
                .putString("dice_2_outline", settings.dice2Outline)
                .putString("dice_2_texture", settings.dice2Texture)
                .putString("dice_2_material", settings.dice2Material)
                // Slot 3
                .putString("dice_3_preset", settings.dice3Preset)
                .putString("dice_3_body", settings.dice3Body)
                .putString("dice_3_number", settings.dice3Number)
                .putString("dice_3_outline", settings.dice3Outline)
                .putString("dice_3_texture", settings.dice3Texture)
                .putString("dice_3_material", settings.dice3Material)
                // Baralho
                .putBoolean("deck_include_jokers", settings.deckIncludeJokers)
                .putString("deck_removal_mode", settings.deckRemovalMode)
                .putBoolean("deck_auto_reshuffle", settings.deckAutoReshuffle)
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
