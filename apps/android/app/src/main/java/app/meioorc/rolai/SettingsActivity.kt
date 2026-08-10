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
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
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
    private lateinit var inputsForm: LinearLayout
    private lateinit var editServer: EditText
    private lateinit var editWeb: EditText
    private lateinit var seekScale: android.widget.SeekBar
    private lateinit var txtScaleLabel: TextView
    private lateinit var txtRoomStatus: TextView
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
    // Spec dos inputs de cada sistema (indice 0 = notacao livre, sem input).
    private var systemInfos = mutableListOf<SystemInfo?>(null)
    // Views do formulario gerado, por id de input — lidas no saveFromViews.
    private val inputViews = mutableMapOf<String, View>()

    // Guarda contra o listener do switch disparar em setChecked programatico.
    private var updatingSwitch = false
    // Idem pro spinner de preset: so aplica preset quando veio de toque.
    private var presetTocado = false
    // O usuario ligou o toggle e foi mandado pra tela de permissao do
    // sistema; ao voltar (onResume) com a permissao concedida, ativa.
    private var pendingOverlayEnable = false

    @android.annotation.SuppressLint("ClickableViewAccessibility")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        // Edge-to-edge e forcado a partir do targetSdk 35: a janela nao
        // redimensiona mais sozinha pro teclado (o adjustResize do manifest
        // vira inset, nao resize). Sem isto o teclado cobre o campo sendo
        // editado. Tem que ser MARGEM (padding so cria espaco morto no fim
        // do scroll — o viewport continua atras do teclado); a margem muda
        // o tamanho de verdade, e o onSizeChanged do ScrollView rola o
        // campo focado pra cima do teclado.
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(
            findViewById(R.id.settings_scroller),
        ) { view, insets ->
            val ime = insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.ime())
            val bars = insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, bars.top, 0, 0)
            val lp = view.layoutParams as android.view.ViewGroup.MarginLayoutParams
            lp.bottomMargin = maxOf(ime.bottom, bars.bottom)
            view.layoutParams = lp
            insets
        }

        switchOverlay = findViewById(R.id.switch_overlay)
        editRoomCode = findViewById(R.id.edit_room_code)
        findViewById<Button>(R.id.button_create_room).setOnClickListener(::createRoom)
        findViewById<Button>(R.id.button_join_room).setOnClickListener { joinRoom() }
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
        txtScaleLabel = findViewById(R.id.txt_scale_label)
        txtRoomStatus = findViewById(R.id.txt_room_status)
        seekScale = findViewById<android.widget.SeekBar>(R.id.seek_scale).apply {
            setOnSeekBarChangeListener(object : android.widget.SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(
                    bar: android.widget.SeekBar?,
                    value: Int,
                    fromUser: Boolean,
                ) = updateScaleLabel(value)

                override fun onStartTrackingTouch(bar: android.widget.SeekBar?) = Unit

                // Salvar ao SOLTAR (nao a cada pixel): arrastar nao gravava
                // nada, entao mudar o tamanho so tinha efeito depois de
                // religar o botao flutuante. O servico ja tem debounce.
                override fun onStopTrackingTouch(bar: android.widget.SeekBar?) = saveFromViews()
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
        buildPalettes()
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
        inputsForm = findViewById(R.id.inputs_form)
        editServer = findViewById(R.id.edit_server)
        editWeb = findViewById(R.id.edit_web)

        findViewById<Button>(R.id.btn_open_twa).setOnClickListener {
            startActivity(TwaActivity.intentFor(this))
        }

        showVersion()

        loadSystemsFromAssets()
        loadIntoViews(RolaiSettings.load(this))
        // Depois de carregar: a paleta foi montada com as cores padrao, e o
        // aro de "selecionada" precisa refletir o que estava salvo.
        buildPalettes()

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
        // Faltava: trocar a qualidade do 3D so valia depois de sair da tela.
        spinnerQuality.onItemSelectedListener = saveOnChange

        // Campo de texto salva ao PERDER O FOCO. Antes so o onPause salvava,
        // entao digitar o codigo da sala (ou apelido, notacao, servidor) e
        // continuar na tela nao aplicava nada — a mesma classe de bug do
        // slider de tamanho. Por toque em vez de por tecla: o servico tem
        // debounce, mas nao ha motivo de gravar a cada letra.
        val saveOnBlur = View.OnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) saveFromViews()
        }
        for (campo in listOf(editRoomCode, editName, editNotation, editServer, editWeb)) {
            campo.onFocusChangeListener = saveOnBlur
        }
        // O AdapterView dispara onItemSelected sozinho depois do primeiro
        // layout, INCLUSIVE pra selecao feita em codigo — e o disparo roda
        // depois do listener ja estar instalado, entao atribuir o listener
        // "depois do setSelection" nao protege nada. Mesma familia do
        // updatingSwitch aqui em cima.
        //
        // Nos outros spinners isso so re-salvava o mesmo valor. Neste nao: o
        // listener APLICA UM PRESET, e preset sobrescreve as tres cores. O
        // efeito era a cor escolhida a mao ser apagada toda vez que a tela
        // abria, voltando pra do preset salvo — quase sempre o esmeralda,
        // dai "escolho claro e sai escuro".
        //
        // So conta como escolha o que veio de TOQUE.
        spinnerDice.setOnTouchListener { _, _ ->
            presetTocado = true
            false // nao consome: o spinner continua abrindo normalmente
        }
        spinnerDice.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                if (!presetTocado) return
                // Trocar de preset reescreve as cores (o preset E um atalho).
                applyPreset(RolaiSettings.DICE_PRESET_IDS[pos])
                saveFromViews()
            }

            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }
        spinnerSystem.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                // Trocar de sistema remonta os campos (a CD do d20 nao
                // existe no PbtA). Os valores salvos do sistema anterior
                // ficam no prefs ate a proxima gravacao.
                renderInputsForm(position, RolaiSettings.load(this@SettingsActivity).inputsJson)
                saveFromViews()
            }

            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }
    }

    private val statusHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val statusTicker = object : Runnable {
        override fun run() {
            renderRoomStatus()
            statusHandler.postDelayed(this, 1500)
        }
    }

    /**
     * Estado da conexao em texto. Quem sabe de verdade e o servico (ele tem o
     * WebSocket), entao a tela so reflete o que ele publicou. Sem overlay
     * ligado nao ha conexao nenhuma — e importante dizer isso em vez de
     * deixar em branco, que era o que fazia o "Criar sala" parecer quebrado.
     */
    private fun renderRoomStatus() {
        val codigo = editRoomCode.text.toString().trim()
        val ligado = RolaiSettings.isOverlayEnabled(this)
        val estado = OverlayService.roomState

        // A palavra vem primeiro e em CAIXA ALTA: o que importa e saber, de
        // relance, se esta ou nao na sala. Detalhe (codigo, quantos estao
        // dentro) vem depois.
        val (rotulo, cor) = when {
            !ligado && codigo.isEmpty() -> "SEM SALA" to 0xFF3A424B.toInt()
            !ligado -> "AGUARDANDO" to 0xFFE5C07B.toInt()
            estado == OverlayService.Companion.RoomState.CONNECTED ->
                "CONECTADO" to 0xFF25C48F.toInt()
            estado == OverlayService.Companion.RoomState.CONNECTING ->
                "CONECTANDO…" to 0xFFE5C07B.toInt()
            estado == OverlayService.Companion.RoomState.ERROR ->
                "SEM CONEXÃO" to 0xFFE06C75.toInt()
            codigo.isEmpty() -> "SEM SALA" to 0xFF3A424B.toInt()
            else -> "SEM CONEXÃO" to 0xFFE06C75.toInt()
        }

        val detalhe = when {
            !ligado && codigo.isNotEmpty() ->
                "$codigo — ative o botão flutuante para conectar"
            !ligado -> "o dado rola só neste aparelho"
            codigo.isEmpty() -> "o dado rola só neste aparelho"
            OverlayService.roomStatus.isNotEmpty() -> "$codigo · ${OverlayService.roomStatus}"
            else -> codigo
        }

        txtRoomStatus.text = "$rotulo · $detalhe"
        txtRoomStatus.backgroundTintList = android.content.res.ColorStateList.valueOf(cor)
        // Texto escuro sobre chip claro; sobre o cinza de "sem sala", claro.
        txtRoomStatus.setTextColor(
            if (rotulo == "SEM SALA") 0xFFE8ECF0.toInt() else 0xFF0D1013.toInt(),
        )
    }

    override fun onResume() {
        super.onResume()
        statusHandler.post(statusTicker)
        checkForUpdate()
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
        statusHandler.removeCallbacks(statusTicker)
        saveFromViews()
    }

    // ---------- overlay ----------

    /**
     * Versao instalada na tela. Nao muda enquanto o app estiver aberto, entao
     * basta uma vez, no onCreate.
     */
    private fun showVersion() {
        findViewById<TextView>(R.id.txt_version).text =
            getString(R.string.version_installed, BuildConfig.VERSION_NAME)
    }

    /**
     * Consulta se ha versao nova, a CADA vez que esta tela aparece.
     *
     * Ficava so no onCreate, e voltar pra tela com a Activity ainda viva nao
     * reconsultava nada: era preciso fechar o app e abrir de novo pra
     * descobrir que tinha versao nova. Esta tela e o launcher — e aqui que a
     * pessoa passa, entao e aqui que se pergunta.
     *
     * O UpdateCheck entrega o resultado em cache na hora e so vai a rede
     * respeitando o proprio intervalo minimo (a API publica do GitHub limita
     * por IP, e IP de celular costuma ser compartilhado com muita gente pela
     * operadora — insistir nao ajudaria ninguem).
     */
    private fun checkForUpdate() {
        val aviso = findViewById<TextView>(R.id.txt_update)
        UpdateCheck.check { release ->
            if (isFinishing || isDestroyed) return@check
            aviso.text = getString(R.string.version_update_available, release.version)
            aviso.visibility = View.VISIBLE
            aviso.setOnClickListener {
                // Abre a pagina da Release; quem baixa e instala e a pessoa.
                // Baixar o APK aqui exigiria REQUEST_INSTALL_PACKAGES.
                runCatching {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(release.pageUrl)))
                }.onFailure {
                    Toast.makeText(this, R.string.version_update_available, Toast.LENGTH_SHORT)
                        .show()
                }
            }
        }
    }

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
        editServer.setText(settings.wsBaseUrl)
        editWeb.setText(settings.webBaseUrl)
        val systemIndex = systemIds.indexOf(settings.system).takeIf { it >= 0 } ?: 0
        spinnerSystem.setSelection(systemIndex)
        renderInputsForm(systemIndex, settings.inputsJson)
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

    /**
     * Cria a sala no backend e joga o codigo no campo. Sem isto o app so
     * conseguia ENTRAR numa sala criada na web — comecar uma mesa exigia um
     * navegador aberto.
     */
    /**
     * Entra na sala digitada. Espelha o "Entrar" da web, com a diferenca que
     * aqui quem mantem a conexao e o OverlayService — sem o botao flutuante
     * ligado nao ha o que conectar, e dizer isso e melhor que fingir que
     * conectou.
     */
    private fun joinRoom() {
        val codigo = editRoomCode.text.toString().trim()
        val problema = RolaiSettings.customCodeIssue(codigo)
        // Codigo curto pode ser sala EXISTENTE criada pelo backend (8 chars
        // do CSPRNG): so barra o que nem como codigo serve.
        if (!RolaiSettings.isValidRoomCode(codigo)) {
            toast(problema ?: "código de sala inválido")
            return
        }
        saveFromViews()
        if (!RolaiSettings.isOverlayEnabled(this)) {
            toast(getString(R.string.room_needs_overlay))
            renderRoomStatus()
            return
        }
        // Codigo abaixo do piso so funciona se a sala JA existir: o backend
        // se recusa a cria-la (docs/security.md). Avisar antes evita o
        // "tentei e nao deu nada" — a pessoa entende o que esperar.
        if (problema != null) {
            toast(getString(R.string.room_joining_weak, codigo, problema))
        } else {
            toast(getString(R.string.room_joining, codigo))
        }
        // Forca a reconexao: o RELOAD normal so age quando algo mudou, entao
        // tentar de novo na MESMA sala (depois de uma falha, por exemplo) nao
        // faria nada.
        OverlayService.requestReconnect(this)
        renderRoomStatus()
    }

    private fun toast(mensagem: String) {
        Toast.makeText(this, mensagem, Toast.LENGTH_LONG).show()
    }

    private fun createRoom(button: android.view.View) {
        val escolhido = editRoomCode.text.toString().trim()
        // Campo preenchido = a sala QUE VOCE ESCOLHEU (mesmo comportamento da
        // web): o backend cria ao entrar num codigo valido inexistente, entao
        // aqui e so validar e conectar. Vazio = codigo aleatorio via REST.
        if (escolhido.isNotEmpty()) {
            val problema = RolaiSettings.customCodeIssue(escolhido)
            if (problema != null) {
                toast(problema)
                return
            }
            joinRoom()
            return
        }
        val server = editServer.text.toString().trim()
        val wsBase = if (RolaiSettings.isValidWsBaseUrl(server)) server
        else RolaiSettings.DEFAULT_WS_BASE_URL
        button.isEnabled = false
        Toast.makeText(this, R.string.create_room_working, Toast.LENGTH_SHORT).show()
        RoomCreator.create(
            wsBase,
            onSuccess = { code ->
                button.isEnabled = true
                editRoomCode.setText(code)
                saveFromViews()
                renderRoomStatus()
            },
            onError = { message ->
                button.isEnabled = true
                toast(getString(R.string.create_room_failed, message))
            },
        )
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
                inputsJson = inputsFromForm(position),
                wsBaseUrl = if (RolaiSettings.isValidWsBaseUrl(server)) server
                else RolaiSettings.DEFAULT_WS_BASE_URL,
                // Endereco do app (botao "Abrir o rolai.app"). Numa build de
                // DEBUG o default aponta pro Vite da maquina
                // (localhost:5273), entao sem campo na tela o botao ficava
                // quebrado sem conserto possivel. Vazio volta pro default do
                // buildType. O palco 3D nao passa por aqui — vem do APK.
                webBaseUrl = editWeb.text.toString().trim()
                    .ifEmpty { RolaiSettings.DEFAULT_WEB_BASE_URL },
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
        // Toda mudanca vale na hora: sem isto so tinha efeito depois de
        // desligar e religar o botao flutuante, porque a URL do palco e o
        // handshake da sala sao montados no start do servico.
        OverlayService.notifySettingsChanged(this)
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
            for (info in ProfileForm.parseSystems(json)) {
                systemIds.add(info.system)
                labels.add(info.label)
                systemInfos.add(info)
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
    /**
     * (Re)constroi as tres paletas. Reconstruir depois de cada escolha e o
     * que faz o aro de "selecionada" migrar — a paleta e desenhada uma vez
     * no onCreate, entao sem isto o indicador ficaria preso na cor inicial.
     */
    private fun buildPalettes() {
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
            buildPalettes()
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
            buildPalettes()
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
            buildPalettes()
        }
    }

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

        // Qual esta escolhida: sem isto a paleta nao dava NENHUM indicio do
        // que estava selecionado — so dava pra saber olhando a previa. Aro
        // grosso e claro no escolhido, fino e discreto nos demais.
        val escolhida = currentColor().lowercase()
        for (hex in RolaiSettings.PALETTE) {
            val selecionada = hex.equals(escolhida, ignoreCase = true)
            val dot = View(this).apply {
                background = android.graphics.drawable.GradientDrawable().apply {
                    shape = android.graphics.drawable.GradientDrawable.OVAL
                    setColor(android.graphics.Color.parseColor(hex))
                    setStroke(
                        ((if (selecionada) 3 else 1) * resources.displayMetrics.density).toInt(),
                        if (selecionada) android.graphics.Color.WHITE
                        else android.graphics.Color.argb(0x55, 0xFF, 0xFF, 0xFF),
                    )
                }
                contentDescription = if (selecionada) "cor selecionada" else hex
                // Sem isto o toque na paleta nao dava retorno nenhum.
                isClickable = true
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

    /**
     * Monta os campos do sistema escolhido (CD, modificador, vantagem...).
     *
     * Antes daqui saia um EditText onde se digitava o JSON dos inputs. Alem
     * de hostil, era facil errar em silencio: JSON invalido virava "sem
     * inputs" e a CD deixava de valer sem aviso nenhum.
     *
     * Notacao livre (posicao 0) nao tem input — o formulario some inteiro.
     */
    private fun renderInputsForm(position: Int, inputsJson: String) {
        inputsForm.removeAllViews()
        inputViews.clear()
        val info = systemInfos.getOrNull(position)
        if (info == null || !info.needsForm) {
            inputsForm.visibility = View.GONE
            return
        }
        inputsForm.visibility = View.VISIBLE
        val salvos = ProfileForm.fromJson(inputsJson)
        for (input in info.inputs) {
            inputsForm.addView(fieldLabel(input.label))
            val view = if (input.isSelect) selectField(input, salvos[input.id])
            else numberField(input, salvos[input.id])
            inputViews[input.id] = view
            inputsForm.addView(view)
        }
    }

    private fun fieldLabel(text: String): TextView = TextView(this).apply {
        this.text = text
        setTextColor(0xFF8B95A1.toInt())
        textSize = 12f
        setPadding(0, 10.dpToPx(), 0, 0)
    }

    private fun numberField(input: ProfileInput, valor: String?): EditText = EditText(this).apply {
        // numberSigned: modificador negativo (-1) e comum, e o teclado
        // numerico puro nao tem o sinal.
        inputType = android.text.InputType.TYPE_CLASS_NUMBER or
            android.text.InputType.TYPE_NUMBER_FLAG_SIGNED
        setTextColor(0xFFE8ECF0.toInt())
        setText(valor.orEmpty())
        hint = input.label
        importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO
        onFocusChangeListener = View.OnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) saveFromViews()
        }
    }

    private fun selectField(input: ProfileInput, valor: String?): Spinner = Spinner(this).apply {
        adapter = ArrayAdapter(
            this@SettingsActivity,
            android.R.layout.simple_spinner_dropdown_item,
            input.options.map { it.label },
        )
        val index = input.options.indexOfFirst { it.value == valor }.coerceAtLeast(0)
        setSelection(index)
        onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) =
                saveFromViews()

            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }
    }

    /** Le o formulario e devolve o JSON que vai pro motor. */
    private fun inputsFromForm(position: Int): String {
        val info = systemInfos.getOrNull(position) ?: return ""
        if (!info.needsForm) return ""
        val valores = mutableMapOf<String, String>()
        for (input in info.inputs) {
            valores[input.id] = when (val view = inputViews[input.id]) {
                is EditText -> view.text.toString()
                is Spinner -> input.options.getOrNull(view.selectedItemPosition)?.value.orEmpty()
                else -> ""
            }
        }
        return ProfileForm.toJson(valores, info.inputs)
    }

    private fun Int.dpToPx(): Int = (this * resources.displayMetrics.density).toInt()

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
