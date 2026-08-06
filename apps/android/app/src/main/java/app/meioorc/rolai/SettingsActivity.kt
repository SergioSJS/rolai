package app.meioorc.rolai

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView
import androidx.core.content.ContextCompat

/**
 * Tela de configuracoes nativa e launcher do app. E aqui — e SO aqui —
 * que a permissao SYSTEM_ALERT_WINDOW e solicitada, quando o usuario liga
 * o toggle do overlay explicitamente (docs/security.md).
 *
 * Launcher nativo (e nao a TWA) de proposito: a TWA renderiza conteudo
 * web e nao teria como expor o fluxo de permissao do overlay.
 */
class SettingsActivity : Activity() {

    private lateinit var switchOverlay: Switch
    private lateinit var editRoomCode: EditText
    private lateinit var editName: EditText
    private lateinit var editNotation: EditText
    private lateinit var spinnerSystem: Spinner
    private lateinit var spinnerDice: Spinner
    private lateinit var txtInputsHint: TextView
    private lateinit var editInputs: EditText
    private lateinit var editServer: EditText
    private lateinit var seekScale: android.widget.SeekBar
    private lateinit var txtScaleLabel: TextView
    private lateinit var spinnerQuality: Spinner
    private lateinit var spinnerTexture: Spinner
    private lateinit var spinnerMaterial: Spinner
    private lateinit var switchHarmony: Switch
    private lateinit var previewFrame: android.widget.FrameLayout
    private lateinit var txtPreview: TextView

    // Cores escolhidas nas paletas (hex "#rrggbb").
    private var colorBody = RolaiSettings.DEFAULT_BODY
    private var colorNumber = RolaiSettings.DEFAULT_NUMBER
    private var colorOutline = RolaiSettings.DEFAULT_OUTLINE

    // Ids de sistema na ordem do spinner; indice 0 = notacao livre ("").
    private var systemIds = mutableListOf("")
    private var systemInputs = mutableListOf("")

    // Guarda contra o listener do switch disparar em setChecked programatico.
    private var updatingSwitch = false
    // O usuario ligou o toggle e foi mandado pra tela de permissao do
    // sistema; ao voltar (onResume) com a permissao concedida, ativa.
    private var pendingOverlayEnable = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        switchOverlay = findViewById(R.id.switch_overlay)
        editRoomCode = findViewById(R.id.edit_room_code)
        editName = findViewById(R.id.edit_name)
        editNotation = findViewById(R.id.edit_notation)
        spinnerSystem = findViewById(R.id.spinner_system)
        spinnerDice = findViewById<Spinner>(R.id.spinner_dice).apply {
            adapter = ArrayAdapter(
                this@SettingsActivity,
                android.R.layout.simple_spinner_dropdown_item,
                RolaiSettings.DICE_PRESET_LABELS,
            )
        }
        txtInputsHint = findViewById(R.id.txt_inputs_hint)
        txtScaleLabel = findViewById(R.id.txt_scale_label)
        seekScale = findViewById<android.widget.SeekBar>(R.id.seek_scale).apply {
            setOnSeekBarChangeListener(object : android.widget.SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(
                    bar: android.widget.SeekBar?,
                    value: Int,
                    fromUser: Boolean,
                ) = updateScaleLabel(value)

                override fun onStartTrackingTouch(bar: android.widget.SeekBar?) = Unit
                override fun onStopTrackingTouch(bar: android.widget.SeekBar?) = Unit
            })
        }
        previewFrame = findViewById(R.id.dice_preview)
        txtPreview = findViewById(R.id.txt_preview)
        spinnerTexture = findViewById<Spinner>(R.id.spinner_texture).apply {
            adapter = ArrayAdapter(
                this@SettingsActivity,
                android.R.layout.simple_spinner_dropdown_item,
                RolaiSettings.TEXTURE_LABELS,
            )
        }
        spinnerMaterial = findViewById<Spinner>(R.id.spinner_material).apply {
            adapter = ArrayAdapter(
                this@SettingsActivity,
                android.R.layout.simple_spinner_dropdown_item,
                RolaiSettings.MATERIAL_LABELS,
            )
        }
        buildPalette(
            findViewById(R.id.palette_body),
            getString(R.string.label_color_body),
            { colorBody },
        ) { color ->
            colorBody = color
            // Harmonia ligada: numero e contorno saem do corpo (ver
            // DiceHarmony) — evita o dado ilegivel de tres cores soltas.
            if (switchHarmony.isChecked) {
                colorNumber = DiceHarmony.numberFor(color)
                colorOutline = DiceHarmony.outlineFor(color)
            }
            renderPreview()
            saveFromViews()
        }
        buildPalette(
            findViewById(R.id.palette_number),
            getString(R.string.label_color_number),
            { colorNumber },
        ) { color ->
            colorNumber = color
            switchHarmony.isChecked = false
            renderPreview()
            saveFromViews()
        }
        buildPalette(
            findViewById(R.id.palette_outline),
            getString(R.string.label_color_outline),
            { colorOutline },
        ) { color ->
            colorOutline = color
            switchHarmony.isChecked = false
            renderPreview()
            saveFromViews()
        }
        switchHarmony = findViewById<Switch>(R.id.switch_harmony).apply {
            setOnCheckedChangeListener { _, checked ->
                if (!checked) return@setOnCheckedChangeListener
                colorNumber = DiceHarmony.numberFor(colorBody)
                colorOutline = DiceHarmony.outlineFor(colorBody)
                renderPreview()
                saveFromViews()
            }
        }
        spinnerQuality = findViewById<Spinner>(R.id.spinner_quality).apply {
            adapter = ArrayAdapter(
                this@SettingsActivity,
                android.R.layout.simple_spinner_dropdown_item,
                RolaiSettings.QUALITY_LABELS,
            )
        }
        editInputs = findViewById(R.id.edit_inputs)
        editServer = findViewById(R.id.edit_server)

        findViewById<Button>(R.id.btn_open_twa).setOnClickListener {
            startActivity(Intent(this, TwaActivity::class.java))
        }

        loadSystemsFromAssets()
        loadIntoViews(RolaiSettings.load(this))

        switchOverlay.setOnCheckedChangeListener { _, isChecked ->
            if (updatingSwitch) return@setOnCheckedChangeListener
            if (isChecked) enableOverlay() else disableOverlay()
        }
        val saveOnChange = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) =
                saveFromViews()

            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }
        spinnerTexture.onItemSelectedListener = saveOnChange
        spinnerMaterial.onItemSelectedListener = saveOnChange
        spinnerDice.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                // Trocar de preset reescreve as cores (o preset E um atalho).
                applyPreset(RolaiSettings.DICE_PRESET_IDS[pos])
                saveFromViews()
            }

            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }
        spinnerSystem.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                updateInputsHint(position)
                saveFromViews()
            }

            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }
    }

    override fun onResume() {
        super.onResume()
        if (pendingOverlayEnable && Settings.canDrawOverlays(this)) {
            pendingOverlayEnable = false
            enableOverlay()
        } else if (pendingOverlayEnable) {
            // Voltou sem conceder: desiste e reflete isso no toggle.
            pendingOverlayEnable = false
            setSwitchChecked(false)
        }
        // Permissao revogada por fora com o overlay ligado: desliga.
        if (RolaiSettings.isOverlayEnabled(this) && !Settings.canDrawOverlays(this)) {
            RolaiSettings.setOverlayEnabled(this, false)
            setSwitchChecked(false)
        }
    }

    override fun onPause() {
        super.onPause()
        saveFromViews()
    }

    // ---------- overlay ----------

    private fun enableOverlay() {
        if (!Settings.canDrawOverlays(this)) {
            // UNICO ponto do app que pede SYSTEM_ALERT_WINDOW — acao
            // explicita do usuario no toggle (docs/security.md).
            pendingOverlayEnable = true
            startActivity(
                Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName"),
                ),
            )
            return
        }
        // Notificacao persistente do foreground service precisa de
        // POST_NOTIFICATIONS em runtime na API 33+ (sem ela o service
        // sobe, mas a notificacao nao aparece na gaveta).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
        }
        saveFromViews()
        RolaiSettings.setOverlayEnabled(this, true)
        setSwitchChecked(true)
        ContextCompat.startForegroundService(
            this,
            Intent(this, OverlayService::class.java).setAction(OverlayService.ACTION_START),
        )
    }

    private fun disableOverlay() {
        RolaiSettings.setOverlayEnabled(this, false)
        stopService(Intent(this, OverlayService::class.java))
    }

    private fun setSwitchChecked(checked: Boolean) {
        updatingSwitch = true
        switchOverlay.isChecked = checked
        updatingSwitch = false
    }

    // ---------- preferencias ----------

    private fun loadIntoViews(settings: RolaiSettings) {
        editRoomCode.setText(settings.roomCode)
        editName.setText(settings.playerName)
        editNotation.setText(settings.notation)
        editInputs.setText(settings.inputsJson)
        editServer.setText(settings.wsBaseUrl)
        val systemIndex = systemIds.indexOf(settings.system).takeIf { it >= 0 } ?: 0
        spinnerSystem.setSelection(systemIndex)
        updateInputsHint(systemIndex)
        spinnerDice.setSelection(
            RolaiSettings.DICE_PRESET_IDS.indexOf(settings.dicePreset).coerceAtLeast(0)
        )
        colorBody = settings.diceBody
        colorNumber = settings.diceNumber
        colorOutline = settings.diceOutline
        spinnerTexture.setSelection(
            RolaiSettings.TEXTURE_IDS.indexOf(settings.diceTexture).coerceAtLeast(0),
        )
        spinnerMaterial.setSelection(
            RolaiSettings.MATERIAL_IDS.indexOf(settings.diceMaterial).coerceAtLeast(0),
        )
        renderPreview()
        seekScale.progress = settings.diceScalePercent
        updateScaleLabel(settings.diceScalePercent)
        spinnerQuality.setSelection(
            RolaiSettings.QUALITY_IDS.indexOf(settings.quality).coerceAtLeast(0),
        )
        setSwitchChecked(RolaiSettings.isOverlayEnabled(this))
    }

    private fun saveFromViews() {
        val position = spinnerSystem.selectedItemPosition.coerceIn(0, systemIds.size - 1)
        val server = editServer.text.toString().trim()
        RolaiSettings.save(
            this,
            RolaiSettings(
                roomCode = editRoomCode.text.toString(),
                playerName = editName.text.toString(),
                notation = editNotation.text.toString().ifEmpty { RolaiSettings.DEFAULT_NOTATION },
                system = systemIds[position],
                inputsJson = editInputs.text.toString(),
                wsBaseUrl = if (RolaiSettings.isValidWsBaseUrl(server)) server
                else RolaiSettings.DEFAULT_WS_BASE_URL,
                // Sem campo proprio na tela por ora: mantem o que ja estava
                // salvo (default vem do buildType — ver build.gradle.kts).
                webBaseUrl = RolaiSettings.load(this).webBaseUrl,
                dicePreset = RolaiSettings.DICE_PRESET_IDS[
                    spinnerDice.selectedItemPosition
                        .coerceIn(0, RolaiSettings.DICE_PRESET_IDS.size - 1)
                ],
                diceScalePercent = seekScale.progress,
                diceBody = colorBody,
                diceNumber = colorNumber,
                diceOutline = colorOutline,
                diceTexture = RolaiSettings.TEXTURE_IDS[
                    spinnerTexture.selectedItemPosition
                        .coerceIn(0, RolaiSettings.TEXTURE_IDS.size - 1)
                ],
                diceMaterial = RolaiSettings.MATERIAL_IDS[
                    spinnerMaterial.selectedItemPosition
                        .coerceIn(0, RolaiSettings.MATERIAL_IDS.size - 1)
                ],
                quality = RolaiSettings.QUALITY_IDS[
                    spinnerQuality.selectedItemPosition
                        .coerceIn(0, RolaiSettings.QUALITY_IDS.size - 1)
                ],
            ),
        )
    }

    // ---------- seletor de sistema ----------

    /**
     * Le assets/headless/systems.json — gerado pelo build do bundle
     * headless (apps/web) a partir dos YAMLs versionados do rules-engine,
     * entao o seletor nunca diverge do que a WebView sabe calcular.
     */
    private fun loadSystemsFromAssets() {
        val labels = mutableListOf(getString(R.string.system_none))
        try {
            val json = assets.open("headless/systems.json").bufferedReader().use { it.readText() }
            val systems = org.json.JSONArray(json)
            for (i in 0 until systems.length()) {
                val system = systems.getJSONObject(i)
                systemIds.add(system.getString("system"))
                labels.add(system.getString("label"))
                val inputs = system.optJSONArray("inputs")
                val inputIds = buildList {
                    if (inputs != null) {
                        for (j in 0 until inputs.length()) {
                            add(inputs.getJSONObject(j).getString("id"))
                        }
                    }
                }
                systemInputs.add(inputIds.joinToString(", "))
            }
        } catch (e: Exception) {
            // systems.json ausente/corrompido: fica so a notacao livre —
            // o overlay continua funcional pro caso mais comum.
        }
        spinnerSystem.adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_dropdown_item,
            labels,
        )
    }

    /**
     * Paleta de cores sem dependencia externa: uma fileira de circulos
     * clicaveis (RolaiSettings.PALETTE). Suficiente pro caso de uso e
     * previsivel — color picker completo seria biblioteca nova.
     */
    private fun buildPalette(
        row: android.widget.LinearLayout,
        title: String,
        currentColor: () -> String,
        onPick: (String) -> Unit,
    ) {
        val size = (36 * resources.displayMetrics.density).toInt()
        val gap = (6 * resources.displayMetrics.density).toInt()
        row.removeAllViews()

        // Ultima opcao: roda de cores, pra quando a paleta nao tem a cor.
        val wheel = View(this).apply {
            background = androidx.core.content.ContextCompat.getDrawable(
                this@SettingsActivity,
                R.drawable.ic_color_wheel,
            )
            contentDescription = title
            setOnClickListener {
                ColorWheelDialog.show(this@SettingsActivity, title, currentColor()) { picked ->
                    onPick(picked)
                }
            }
        }
        row.addView(
            wheel,
            android.widget.LinearLayout.LayoutParams(size, size).apply { marginEnd = gap },
        )

        for (hex in RolaiSettings.PALETTE) {
            val dot = View(this).apply {
                background = android.graphics.drawable.GradientDrawable().apply {
                    shape = android.graphics.drawable.GradientDrawable.OVAL
                    setColor(android.graphics.Color.parseColor(hex))
                    setStroke(
                        (1 * resources.displayMetrics.density).toInt(),
                        android.graphics.Color.argb(0x55, 0xFF, 0xFF, 0xFF),
                    )
                }
                setOnClickListener { onPick(hex) }
            }
            row.addView(
                dot,
                android.widget.LinearLayout.LayoutParams(size, size).apply { marginEnd = gap },
            )
        }
    }

    /** Previa: dado com a cor do corpo, numero e contorno escolhidos. */
    private fun renderPreview() {
        previewFrame.background = android.graphics.drawable.GradientDrawable().apply {
            cornerRadius = 18 * resources.displayMetrics.density
            setColor(android.graphics.Color.parseColor(colorBody))
        }
        txtPreview.setTextColor(android.graphics.Color.parseColor(colorNumber))
        txtPreview.setShadowLayer(3f, 0f, 0f, android.graphics.Color.parseColor(colorOutline))
    }

    private fun updateScaleLabel(percent: Int) {
        txtScaleLabel.text = getString(R.string.label_dice_scale) + " — $percent%"
    }

    private fun updateInputsHint(position: Int) {
        val hasSystem = position > 0
        editInputs.visibility = if (hasSystem) View.VISIBLE else View.GONE
        txtInputsHint.visibility = if (hasSystem) View.VISIBLE else View.GONE
        if (hasSystem) {
            txtInputsHint.text = "inputs: ${systemInputs[position]}"
        }
    }

    /**
     * Aplica um preset nas cores/textura/material. Os valores espelham
     * DICE_PRESETS de apps/web/src/settings.ts — fonte unica la; aqui e o
     * atalho pra quem nao quer escolher cor a cor.
     */
    private fun applyPreset(id: String) {
        val preset = PRESETS[id] ?: return
        colorBody = preset[0]
        colorNumber = preset[1]
        colorOutline = preset[2]
        spinnerTexture.setSelection(RolaiSettings.TEXTURE_IDS.indexOf(preset[3]).coerceAtLeast(0))
        spinnerMaterial.setSelection(RolaiSettings.MATERIAL_IDS.indexOf(preset[4]).coerceAtLeast(0))
        renderPreview()
    }

    companion object {
        private const val REQUEST_NOTIFICATIONS = 1

        // id -> [corpo, numero, contorno, textura, material]
        private val PRESETS = mapOf(
            "esmeralda" to listOf("#1d9e75", "#f4f7f5", "#0c3527", "none", "plastic"),
            "osso" to listOf("#e8e0cd", "#3a3226", "#3a3226", "marble", "auto"),
            "obsidiana" to listOf("#14171c", "#e5c07b", "#e5c07b", "speckles", "metal"),
            "sangue" to listOf("#8c1f2b", "#f7e8e2", "#2b0a0e", "marble", "plastic"),
            "abissal" to listOf("#22307a", "#9fd8ff", "#0a1030", "astral", "auto"),
            "gelo" to listOf("#bfe6f2", "#123a4a", "#0b2733", "ice", "glass"),
            "escamas" to listOf("#2f6b3a", "#eaf7d9", "#10240f", "dragon", "auto"),
            "madeira" to listOf("#7a4a22", "#f0dcb8", "#2a1608", "wood", "wood"),
        )
    }
}
