package app.meioorc.rolai

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import org.json.JSONObject

/**
 * Foreground Service do overlay (specs/04-android-overlay.md):
 *  - desenha a view flutuante via WindowManager (OverlayView);
 *  - mantem o WebSocket da sala vivo (RoomClient) — nativo, nao na WebView,
 *    pra nao sofrer throttling de Doze/App Standby (docs/architecture.md);
 *  - calcula rolagens na WebView headless com o rules-engine
 *    (HeadlessRoller) — NUNCA duplicar regra em Kotlin;
 *  - mostra notificacao persistente enquanto ativo.
 *
 * Tipo `specialUse` (justificativa no AndroidManifest.xml, com a fonte
 * oficial). A permissao SYSTEM_ALERT_WINDOW ja foi dada antes do service
 * existir — quem garante e o toggle da SettingsActivity.
 */
class OverlayService : Service() {

    private lateinit var windowManager: WindowManager
    private lateinit var overlay: OverlayView
    private lateinit var overlayParams: WindowManager.LayoutParams
    private lateinit var headlessRoller: HeadlessRoller
    private val diceStage = DiceStageWindow(this)
    private var diceSounds: DiceSounds? = null
    // Impactos reportados desde a ultima rolagem — se nenhum chegar, o som
    // sai pelo caminho de seguranca (ver playDiceSound).
    private var impactsThisRoll = 0
    private val stageHandler = Handler(Looper.getMainLooper())
    private val stageHideRunnable = Runnable { diceStage.setInteractive(false) }
    private var roomClient: RoomClient? = null

    // Assinatura do que ja esta montado: se a config nova gera a mesma URL,
    // nao ha nada pra refazer (ver applySettings).
    private var lastStageUrl: String? = null
    private var lastHandshakeUrl: String? = null

    /** Acao da mini-bolha de rolagem do fan: repete a ultima rolagem por
     *  notacao; null = ainda nao rolou (ou a config mudou) = rola a
     *  rolagem rapida configurada. */
    private var lastRollAction: (() -> Unit)? = null

    /** Notacao usada na ultima rolagem "overlay" (roll_under) de fato
     *  executada — pra saber se o campo de notacao mudou desde entao (ver
     *  persistSystemInputs). Sistema "receita fixa" nao usa isto: quem
     *  decide o dado e o profile, nao o composer. */
    private var lastOverlayNotation: String? = null
    private var lastQuickKey: String = ""
    private val settingsReloadRunnable = Runnable { applySettings() }
    private var viewAttached = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        // Instancia nova comeca do zero: o flag e estatico e pode ter ficado
        // `true` de uma instancia anterior que nao chegou a limpar.
        overlayAttached = false
        startForegroundWithNotification()

        // O service so existe enquanto o usuario QUER o botao flutuante. Sem
        // isto, qualquer startService (um RELOAD atrasado, um START_STICKY
        // depois do usuario desligar) ressuscitava o overlay: o onCreate roda
        // ANTES do onStartCommand, entao a view ja subia antes de qualquer
        // checagem de acao. Flagrado pelo teste instrumentado.
        if (!RolaiSettings.isOverlayEnabled(this)) {
            stopSelf()
            return
        }

        if (!Settings.canDrawOverlays(this)) {
            // Nao deveria acontecer (a SettingsActivity so inicia o service
            // com a permissao concedida), mas a permissao pode ter sido
            // revogada nas configuracoes do sistema.
            stopSelf()
            return
        }

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        val settings = RolaiSettings.load(this)
        attachOverlay()
        // Palco DEPOIS do painel: janelas do mesmo tipo empilham na ordem de
        // adicao — o dado voa por cima de TUDO, painel incluso. Enquanto o
        // dado esta na tela (janela interativa), qualquer toque — ate no
        // painel — dispensa os dados; dispensado, o toque volta a atravessar
        // e o painel fica clicavel de novo.
        diceStage.attach(
            windowManager,
            settings.webBaseUrl,
            // SEM sala na URL: o palco nao entra mais como espectador (era uma
            // segunda conexao WS por aparelho, e a animacao morria junto com
            // ela). Tudo que precisa animar chega por play().
            "",
            settings.dicePreset,
            settings.diceScalePercent,
            settings.quality,
            settings,
        )
        lastStageUrl = DiceStageWindow.streamUrl(
            settings.webBaseUrl,
            "",
            settings.dicePreset,
            settings.diceScalePercent,
            settings.quality,
            settings,
        )
        diceStage.onStageTapped = ::dismissDice
        diceSounds = DiceSounds(this)
        // Cada colisao da fisica do palco vira um som nativo. E o que separa
        // "dado rolando" de "um clique seco": a WebView sabe a hora das
        // batidas, o nativo toca sem pedir foco de audio.
        diceStage.onDiceImpact = { forca ->
            impactsThisRoll += 1
            diceSounds?.impact(forca)
        }
        headlessRoller = HeadlessRoller(
            this,
            onResult = ::onRollCalculated,
            onError = { message -> overlay.showResult("erro: $message") },
        )
        overlay.onRollClicked = ::rollNow
        overlay.onQuickRoll = { (lastRollAction ?: ::rollNow).invoke() }
        overlay.onRollNotation = { notation -> rollNotation(notation) }
        overlay.onRollWithInputs = ::rollWithInputs
        overlay.onRollOverlay = ::rollOverlayNow
        overlay.onOpenComposer = ::openComposer
        overlay.onSelectFamilyMember = ::selectFamilyMember
        overlay.onPersistSystemInputs = ::persistSystemInputs
        overlay.onComposedNotation = { notation ->
            // Compor e minimizar SEM rolar nao mudava nada: o botao recolhido
            // dispara a rolagem rapida das configuracoes, e a composicao vivia
            // so no campo do painel. Adotar aqui faz a composicao virar "a
            // rolagem" — incluindo a mini-bolha, que repete a ultima.
            //
            // SO quando NAO ha sistema configurado. Com sistema ativo, texto
            // que sobrou no campo (um chip tocado por engano, um resto de
            // notacao antiga) ao fechar o painel sequestrava o slot de
            // "repetir" do sistema — a rolagem do profile acontecia certinho
            // uma vez, mas a mini-bolha passava a repetir so dado solto,
            // ignorando o profile pra sempre até limpar o campo. Rolar o
            // composer de propósito continua funcionando: isso passa por
            // rollNotation(), nao por aqui.
            if (RolaiSettings.load(this).system.isEmpty()) {
                lastRollAction = { headlessRoller.roll(notation) }
                getSharedPreferences(RolaiSettings.PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putString(KEY_LAST_ROLL, notation)
                    .apply()
            }
            overlay.setQuickNotation(notation)
        }
        lastQuickKey = quickKeyOf(settings)
        overlay.setQuickNotation(settings.notation)
        overlay.onWindowFocusMode = ::setOverlayFocusable
        // START_STICKY recria o service do zero quando o sistema mata o
        // processo — sem persistir, a mini-bolha "esquecia" a ultima rolagem
        // e voltava pra configurada. Sobrevive a restart.
        loadLastRoll()?.let { saved -> lastRollAction = { headlessRoller.roll(saved) } }
        overlay.onOpenApp = { launchFromOverlay(TwaActivity.intentFor(this)) }
        overlay.onOpenSettings = { launchFromOverlay(Intent(this, SettingsActivity::class.java)) }
        // Acoes de sala do painel do overlay. Entrar/criar exigem digitar
        // codigo, e o overlay nao tem campo de texto de proposito (roubaria
        // teclado do app de baixo) — entao abrem a tela de config, que ja
        // tem o fluxo inteiro. Sair, nao: e um toque so.
        overlay.onJoinRoom = {
            launchFromOverlay(Intent(this, SettingsActivity::class.java))
        }
        overlay.onCreateRoom = {
            launchFromOverlay(Intent(this, SettingsActivity::class.java))
        }
        overlay.onLeaveRoom = {
            val atual = RolaiSettings.load(this)
            if (atual.roomCode.isNotEmpty()) {
                RolaiSettings.save(this, atual.copy(roomCode = ""))
            }
            roomClient?.disconnect()
            roomClient = null
            lastHandshakeUrl = null
            overlay.setRoster(emptyList())
            publishStatus(getString(R.string.status_disconnected), RoomState.NONE)
        }
        overlay.onCopyRoomLink = {
            val atual = RolaiSettings.load(this)
            if (!RolaiSettings.isValidRoomCode(atual.roomCode)) {
                Toast.makeText(this, R.string.copy_link_needs_room, Toast.LENGTH_LONG).show()
            } else {
                val link = RolaiSettings.roomShareUrl(atual.webBaseUrl, atual.roomCode)
                val clipboard =
                    getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
                clipboard.setPrimaryClip(android.content.ClipData.newPlainText("rolai room link", link))
                Toast.makeText(this, R.string.copy_link_done, Toast.LENGTH_SHORT).show()
            }
        }
        overlay.onCloseOverlay = {
            // Mesma coisa que desligar o toggle: apaga a preferencia ANTES de
            // parar, senao o onCreate do proximo start religaria (o service so
            // vive enquanto a preferencia estiver ligada).
            RolaiSettings.setOverlayEnabled(this, false)
            stopSelf()
        }

        if (RolaiSettings.hasRoom(settings)) {
            connectRoom(settings)
        } else {
            publishStatus(getString(R.string.status_disconnected))
        }
        overlayAttached = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (intent?.action == ACTION_RECONNECT && isReady()) {
            // Pedido EXPLICITO do usuario (botao Entrar): reconecta mesmo que
            // nada tenha mudado. Sem isto, tentar de novo na mesma sala era
            // no-op — inclusive depois de uma falha, deixando a pessoa presa
            // no "desconectado" sem nenhuma forma de repetir.
            stageHandler.removeCallbacks(settingsReloadRunnable)
            applySettings(force = true)
            return START_STICKY
        }
        if (intent?.action == ACTION_RELOAD && isReady()) {
            // DEBOUNCE, nao aplicar direto: a tela de config salva a cada
            // toque (cor, spinner, slider) — sao 11 pontos chamando save.
            // Aplicar em cada um derrubava e reabria DUAS conexoes WS por
            // toque (sala + palco espectador), estourava o teto de
            // WS_CONNECT_LIMIT_PER_MINUTE do backend e o palco levava 4429:
            // o dado dos OUTROS parava de aparecer ate o minuto virar.
            stageHandler.removeCallbacks(settingsReloadRunnable)
            stageHandler.postDelayed(settingsReloadRunnable, SETTINGS_DEBOUNCE_MS)
            return START_STICKY
        }
        // START_STICKY: se o sistema matar o processo, o overlay volta
        // quando houver recurso — foi o usuario que pediu o botao.
        return START_STICKY
    }

    override fun onDestroy() {
        overlayAttached = false
        stageHandler.removeCallbacksAndMessages(null)
        roomClient?.disconnect()
        roomClient = null
        if (::headlessRoller.isInitialized) headlessRoller.destroy()
        diceSounds?.release()
        diceSounds = null
        diceStage.detach()
        if (viewAttached) {
            windowManager.removeView(overlay.root)
            viewAttached = false
        }
        super.onDestroy()
    }

    // ---------- foreground + notificacao ----------

    private fun startForegroundWithNotification() {
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel_name),
                // LOW: persistente sem som/vibracao — e so o marcador
                // obrigatorio do foreground service.
                NotificationManager.IMPORTANCE_LOW,
            ),
        )

        val openSettings = PendingIntent.getActivity(
            this,
            0,
            Intent(this, SettingsActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val stop = PendingIntent.getService(
            this,
            1,
            Intent(this, OverlayService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_d20)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.notification_text))
            .setContentIntent(openSettings)
            .addAction(0, getString(R.string.notification_stop), stop)
            .setOngoing(true)
            .build()

        // A partir da API 34 o tipo tem que ser passado tambem no
        // startForeground (alem do manifest); ServiceCompat cuida das
        // versoes abaixo. Fonte: developer.android.com/about/versions/14/
        // changes/fgs-types-required.
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            } else {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MANIFEST
            },
        )
    }

    // ---------- view flutuante ----------

    private fun attachOverlay() {
        overlay = OverlayView(this)
        overlayParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            // NOT_FOCUSABLE de nascenca: nunca rouba teclado/foco do app em
            // primeiro plano. O painel de composicao TEM campo de texto —
            // o flag sai so enquanto ele esta aberto (setOverlayFocusable).
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            // A raiz do overlay tem padding pra sombra caber
            // (OverlayView.SHADOW_PAD_DP) e isso empurra a bolha pra dentro.
            // Puxa a janela de volta quase toda a folga: sobra a bordinha
            // fina de EDGE_INSET_DP e a sombra continua inteira.
            x = -((OverlayView.SHADOW_PAD_DP - EDGE_INSET_DP) *
                resources.displayMetrics.density).toInt()
            y = 200
        }
        overlay.bindDrag(windowManager, overlayParams)
        windowManager.addView(overlay.root, overlayParams)
        viewAttached = true
    }

    /**
     * Reaplica a config sem o usuario ter que desligar e religar o botao.
     *
     * A aparencia do dado, a sala e a escala viram parametros na URL do
     * palco, montada uma unica vez no `attach` — mudar a preferencia nao
     * mexia em nada ate o servico renascer. Aqui o palco e remontado com a
     * URL nova e a sala reconecta (o `style` do handshake tambem mudou).
     */
    /**
     * Servico realmente montado NESTA instancia.
     *
     * `overlayAttached` e estatico (existe pros instrumented tests), entao um
     * `true` deixado por uma instancia anterior fica visivel pra proxima. Se
     * um RELOAD chegasse nesse intervalo, applySettings tocaria `windowManager`
     * ainda nao inicializado e o processo morria com
     * UninitializedPropertyAccessException — o "fecha com erro" ao desligar e
     * religar o botao. Checar o lateinit desta instancia e o que vale.
     */
    private fun isReady(): Boolean =
        ::windowManager.isInitialized && ::overlay.isInitialized && viewAttached

    private fun applySettings(force: Boolean = false) {
        if (!isReady()) {
            android.util.Log.w("rolai", "RELOAD ignorado: servico nao montado")
            return
        }
        val settings = RolaiSettings.load(this)
        overlay.setQuickNotation(settings.notation)
        val quickKey = quickKeyOf(settings)
        if (quickKey != lastQuickKey) {
            // Mudou a rolagem configurada: a "ultima rolagem" da mini-bolha
            // deixa de fazer sentido — ela volta a rolar a configurada.
            lastQuickKey = quickKey
            lastRollAction = null
            getSharedPreferences(RolaiSettings.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove(KEY_LAST_ROLL)
                .apply()
        }

        // So remonta o que de fato mudou. Trocar de sistema ou de notacao
        // nao tem nada a ver com o palco nem com a sala — reabrir conexao
        // por isso e desperdicio, e desperdicio aqui custa cota de conexao
        // no backend.
        val stageUrl = DiceStageWindow.streamUrl(
            settings.webBaseUrl,
            "",
            settings.dicePreset,
            settings.diceScalePercent,
            settings.quality,
            settings,
        )
        if (stageUrl != lastStageUrl) {
            lastStageUrl = stageUrl
            diceStage.detach()
            diceStage.attach(
                windowManager,
                settings.webBaseUrl,
                settings.roomCode,
                settings.dicePreset,
                settings.diceScalePercent,
                settings.quality,
                settings,
            )
        }

        val handshakeUrl = if (RolaiSettings.hasRoom(settings)) {
            runCatching {
                RoomClient.buildHandshakeUrl(
                    settings.wsBaseUrl,
                    settings.roomCode,
                    settings.playerName,
                    settings,
                )
            }.getOrNull()
        } else {
            null
        }
        if (handshakeUrl == lastHandshakeUrl && !force) {
            android.util.Log.d("rolai", "sala inalterada (${settings.roomCode}) — nao reconecta")
            return
        }
        android.util.Log.d("rolai", "reconectando na sala '${settings.roomCode}'")
        lastHandshakeUrl = handshakeUrl
        roomClient?.disconnect()
        roomClient = null
        if (handshakeUrl == null) {
            publishStatus(getString(R.string.status_disconnected), RoomState.NONE)
        } else {
            publishStatus(getString(R.string.status_connecting), RoomState.CONNECTING)
            roomClient = RoomClient(roomListener).also { it.connect(handshakeUrl) }
        }
    }

    // ---------- sala (WebSocket) ----------

    private fun connectRoom(settings: RolaiSettings) {
        val url = RoomClient.buildHandshakeUrl(
            settings.wsBaseUrl,
            settings.roomCode,
            settings.playerName,
            settings,
        )
        publishStatus(getString(R.string.status_connecting), RoomState.CONNECTING)
        roomClient = RoomClient(roomListener).also { it.connect(url) }
    }

    private val roomListener = object : RoomClient.Listener {
        override fun onConnected() {
            roomState = RoomState.CONNECTING
            // Ainda NAO e "conectado": o backend aceita o handshake antes de
            // validar a sala (services/backend/app/rooms.py), entao dizer
            // conectado aqui vira mentira de meio segundo quando o codigo nao
            // existe. Quem confirma de verdade e o snapshot, no onRoster.
            publishStatus(getString(R.string.status_connecting))
        }

        override fun onRoll(player: String, resultJson: String, styleJson: String?) {
            overlay.addActivityLine("$player: ${formatResult(resultJson)}")
            // EMPURRA em vez de esperar o eco chegar na WebView espectadora.
            // O palco era um segundo cliente WS (spectator) e dependia dessa
            // conexao pra animar qualquer coisa — quando ela falhava, o dado
            // simplesmente nao aparecia, sem erro nenhum. Agora quem ja tem a
            // rolagem (este servico) manda direto: uma conexao a menos por
            // aparelho e nada de animacao dependendo de rede extra.
            diceStage.play(resultJson, styleJson)
            playDiceSound(resultJson)
            stageShow()
        }

        override fun onRoster(memberNames: List<String>) {
            overlay.setRoster(memberNames)
            // Snapshot chegou: agora sim esta na sala.
            publishStatus("${memberNames.size} na sala", RoomState.CONNECTED)
        }

        override fun onError(message: String) {
            if (message == RoomClient.ERROR_ROOM_NOT_FOUND) {
                publishStatus(getString(R.string.status_room_not_found), RoomState.ERROR)
            } else {
                publishStatus("erro: $message", RoomState.ERROR)
            }
        }

        override fun onDisconnected(reconnecting: Boolean) {
            publishStatus(
                getString(
                    if (reconnecting) R.string.status_reconnecting
                    else R.string.status_disconnected,
                ),
                if (reconnecting) RoomState.CONNECTING else RoomState.ERROR,
            )
        }
    }

    // ---------- rolagem (WebView headless) ----------

    /** Servico nao tem task propria: sem NEW_TASK a Activity nao sobe. */
    private fun launchFromOverlay(intent: Intent) {
        overlay.setExpanded(false)
        // CLEAR_TOP: a aba do Custom Tab da TWA vive na MESMA task do app —
        // sem isso, abrir "config" so trazia a task de volta com o navegador
        // por cima.
        startActivity(
            intent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP,
            ),
        )
    }

    /** Rolagem por notacao (chips/digitada no painel): vira a "ultima
     *  rolagem" que a mini-bolha do fan repete. Persistida — ver
     *  loadLastRoll. */
    private fun rollNotation(notation: String) {
        headlessRoller.roll(notation)
        lastRollAction = { headlessRoller.roll(notation) }
        getSharedPreferences(RolaiSettings.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_ROLL, notation)
            .apply()
    }

    /** Ultima rolagem por notacao, ou null se nunca rolou / config mudou. */
    private fun loadLastRoll(): String? =
        getSharedPreferences(RolaiSettings.PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_LAST_ROLL, null)
            ?.takeIf { it.isNotBlank() }

    /** Assinatura da rolagem configurada — pra detectar mudanca no reload. */
    private fun quickKeyOf(settings: RolaiSettings): String =
        listOf(settings.system, settings.notation, settings.inputsJson).joinToString("|")

    /** O campo de notacao do painel precisa de teclado: sem NOT_FOCUSABLE a
     *  janela pode ganhar foco, e NOT_TOUCH_MODAL devolve os toques fora
     *  dela pro app em primeiro plano. Fechou o painel, volta o
     *  NOT_FOCUSABLE de sempre (a bolha nunca disputa teclado). */
    private fun setOverlayFocusable(focusable: Boolean) {
        overlayParams.flags = if (focusable) {
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
        } else {
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        }
        windowManager.updateViewLayout(overlay.root, overlayParams)
    }

    /**
     * Spec dos inputs de cada sistema, lido uma vez de
     * `assets/headless/systems.json` (gerado pelo bundle do motor).
     */
    private val systems: Map<String, SystemInfo> by lazy {
        runCatching {
            assets.open("headless/systems.json").bufferedReader().use { it.readText() }
        }.map { ProfileForm.parseSystems(it).associateBy(SystemInfo::system) }
            .getOrDefault(emptyMap())
    }

    private fun rollNow() {
        val settings = RolaiSettings.load(this)
        overlay.setQuickNotation(settings.notation)
        if (settings.system.isEmpty()) {
            headlessRoller.roll(settings.notation)
            return
        }
        // Sistema com input (CD, modificador, vantagem): pergunta ANTES de
        // rolar, ja preenchido com os ultimos valores. Antes esses valores so
        // podiam ser mudados na tela de configuracoes, escritos como JSON —
        // trocar a CD de um teste custava sair do jogo.
        // Membro de familia (Infaernum) abre a caixa mesmo sem input — e ali
        // que moram as abas de modo (Acao/Sim ou Nao/Ideias); rolar direto
        // tornava os outros dois modos inalcancaveis pelo toque na bolha.
        val info = systems[settings.system]
        if (info != null && (info.needsForm || ProfileFamilies.familyFor(info.system) != null)) {
            overlay.openComposer(info, ProfileForm.fromJson(settings.inputsJson))
            return
        }
        headlessRoller.rollWithProfile(settings.system, settings.inputsJson)
    }

    /**
     * Botao "compor" do fan: abre o compositor de chips COM os campos do
     * sistema ativo, se houver. Antes ignorava o sistema configurado por
     * completo — "compor" e o atalho pra rolagem livre virou tambem o
     * unico jeito de ver/editar CD e modificador sem rolar direto.
     */
    private fun openComposer() {
        val settings = RolaiSettings.load(this)
        overlay.setQuickNotation(settings.notation)
        val info = systems[settings.system]
        overlay.openComposer(info, ProfileForm.fromJson(settings.inputsJson))
    }

    /**
     * Aba de modo tocada dentro da caixa (Infaernum: Acao/Sim ou Nao/Ideias)
     * — troca o sistema ativo pra outro membro da MESMA familia e reabre o
     * compositor ja com os campos do novo modo. Antes, o unico jeito de
     * mudar isso era ir em configuracoes e usar o spinner "Modo", saindo do
     * jogo pra cada troca.
     */
    private fun selectFamilyMember(system: String) {
        val settings = RolaiSettings.load(this)
        RolaiSettings.save(this, settings.copy(system = system, inputsJson = "{}"))
        lastRollAction = null
        getSharedPreferences(RolaiSettings.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_LAST_ROLL)
            .apply()
        val info = systems[system]
        overlay.openComposer(info, ProfileForm.fromJson("{}"))
    }

    /**
     * Painel do sistema fechado (o "—", nao o "fechar" que desliga tudo) sem
     * apertar Rolar — os campos digitados (CD, dificuldade, modificador)
     * salvam do mesmo jeito que cada toque na tela de configuracoes salva.
     * Sem isto, digitar um valor novo e minimizar nao mudava nada: o campo
     * ficava certo na TELA, mas o proximo "rolar" de fora (mini-bolha do
     * fan) repetia o `lastRollAction` de uma rolagem anterior — com o valor
     * ANTIGO. Vale pra qualquer sistema, nao so pro roll_under.
     *
     * SO invalida o `lastRollAction` quando o campo (ou, no roll_under, a
     * notacao do composer) de fato MUDOU desde o ultimo valor REALMENTE
     * rolado. Sem essa comparacao, fechar o painel DEPOIS de rolar (o fluxo
     * normal: abre, rola, minimiza) tambem zerava o `lastRollAction` que o
     * proprio rollWithInputs/rollOverlayNow tinha acabado de setar certinho
     * — o botao de "repetir" voltava a abrir o formulario sempre, o MESMO
     * bug que ja tinha sido corrigido antes.
     */
    private fun persistSystemInputs(inputsJson: String, notation: String?) {
        val settings = RolaiSettings.load(this)
        if (settings.system.isEmpty()) return
        val inputsChanged = inputsJson != settings.inputsJson
        val notationChanged = notation != null && notation != lastOverlayNotation
        if (!inputsChanged && !notationChanged) return
        RolaiSettings.save(this, settings.copy(inputsJson = inputsJson))
        lastRollAction = null
        getSharedPreferences(RolaiSettings.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_LAST_ROLL)
            .apply()
    }

    /**
     * Som da queda, tocado junto da animacao. Vale pras DUAS entradas do
     * palco: rolagem propria e eco da sala — quem ve o dado cair ouve o dado
     * cair, venha de onde vier.
     */
    private fun playDiceSound(resultJson: String) {
        impactsThisRoll = 0
        val dados = diceCountOf(resultJson)
        // "Existe" nao e "funcionou": o palco pode nao estar animando (WebGL
        // fora, tier de texto, palco ainda subindo). Se nenhuma colisao
        // chegar a tempo, toca a queda generica — melhor um som simples do
        // que silencio sem explicacao.
        stageHandler.postDelayed({
            if (impactsThisRoll == 0) diceSounds?.playFallback(dados)
        }, SOUND_FALLBACK_MS)
    }

    /** Rola com o que foi preenchido no painel e guarda como novo padrao. */
    private fun rollWithInputs(inputsJson: String) {
        val settings = RolaiSettings.load(this)
        if (settings.system.isEmpty()) return
        RolaiSettings.save(this, settings.copy(inputsJson = inputsJson))
        headlessRoller.rollWithProfile(settings.system, inputsJson)
        // Sem isto, a mini-bolha "repetir ultima rolagem" nunca aprendia
        // sobre rolagem de profile: sempre cai no fallback rollNow(), que
        // pra sistema com input REABRE o formulario em vez de repetir —
        // parecia que o botao de rolar chamava configuracao.
        lastRollAction = { headlessRoller.rollWithProfile(settings.system, inputsJson) }
        getSharedPreferences(RolaiSettings.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_LAST_ROLL)
            .apply()
    }

    /**
     * Sistema "overlay" (roll_under): a notacao vem dos chips do
     * compositor, nao de um dado proprio do sistema — o profile so avalia
     * outcome_rules sobre o resultado (rollOverlay em rules-engine). Vira
     * a "ultima rolagem" da mini-bolha do fan, igual rollNotation.
     */
    private fun rollOverlayNow(notation: String, inputsJson: String) {
        val settings = RolaiSettings.load(this)
        if (settings.system.isEmpty()) return
        RolaiSettings.save(this, settings.copy(inputsJson = inputsJson))
        headlessRoller.rollOverlay(settings.system, notation, inputsJson)
        lastRollAction = { headlessRoller.rollOverlay(settings.system, notation, inputsJson) }
        lastOverlayNotation = notation
        // NAO grava em KEY_LAST_ROLL: aquele campo alimenta loadLastRoll(),
        // que so sabe repetir via headlessRoller.roll(notation) CRU — sem
        // avaliar outcome_rules do overlay. Depois de matar o processo, e
        // melhor cair no fallback de rollNow() (reabre o composer) do que
        // repetir a notacao ignorando a regra "<= valor testado".
        getSharedPreferences(RolaiSettings.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_LAST_ROLL)
            .apply()
    }

    /**
     * Unico ponto de status: pinta no overlay E publica pra SettingsActivity.
     * Sem isso a tela de config nao tinha como dizer se a sala conectou — o
     * botao "Criar" criava a sala e o usuario ficava no escuro.
     */
    private fun publishStatus(text: String, state: RoomState? = null) {
        android.util.Log.d("rolai", "status: $text")
        roomStatus = text
        if (state != null) roomState = state
        overlay.setStatus(text)
    }

    /** Janela do palco interativa enquanto o dado esta na tela. */
    private fun stageShow() {
        diceStage.setInteractive(true)
        stageHandler.removeCallbacks(stageHideRunnable)
        stageHandler.postDelayed(stageHideRunnable, STAGE_SHOW_MS)
    }

    /** Toque no palco (ou timeout): dispensa os dados e devolve o toque. */
    private fun dismissDice() {
        stageHandler.removeCallbacks(stageHideRunnable)
        diceStage.clearDice()
        diceStage.setInteractive(false)
    }

    private fun onRollCalculated(resultJson: String) {
        overlay.showResult(formatResult(resultJson), toneOf(resultJson))
        // Propaga o resultado JA calculado (relay burro — o backend nao
        // recalcula, ver docs/architecture.md). Em sala, quem anima e o eco
        // do servidor, pela WebView espectadora: empurrar TAMBEM aqui faria
        // o dado cair duas vezes.
        //
        // O que decide e a ENTREGA, nao a existencia do cliente. Antes bastava
        // ter codigo de sala configurado pro `play` local ser pulado — com a
        // sala fora do ar (ou codigo inexistente) a rolagem nao ia pra lugar
        // nenhum e o dado 3D simplesmente parava de aparecer.
        val entregue = roomState == RoomState.CONNECTED &&
            roomClient?.sendRoll(resultJson) == true
        if (!entregue) {
            diceStage.play(resultJson)
            playDiceSound(resultJson)
            stageShow()
            // Sem eco do servidor, a nossa rolagem entra no historico aqui.
            overlay.addActivityLine("você: ${formatResult(resultJson)}")
        }
    }

    companion object {
        /** Espera por colisoes antes de cair no som generico. */
        private const val SOUND_FALLBACK_MS = 600L

        /**
         * Espera antes de aplicar config nova. A tela salva a cada toque;
         * sem isto, arrastar o slider de tamanho vira uma rajada de
         * reconexoes.
         */
        private const val SETTINGS_DEBOUNCE_MS = 700L

        /** Respiro entre a bolha e a borda da tela. */
        const val EDGE_INSET_DP = 4

        const val ACTION_START = "app.meioorc.rolai.action.START"
        const val ACTION_STOP = "app.meioorc.rolai.action.STOP"

        /** SharedPrefs: ultima rolagem por notacao (a da mini-bolha do fan). */
        private const val KEY_LAST_ROLL = "last_roll"

        /** Config mudou: remonta palco e sala sem religar o botao. */
        const val ACTION_RELOAD = "app.meioorc.rolai.action.RELOAD"

        /** Usuario pediu pra conectar: reconecta mesmo sem mudanca. */
        const val ACTION_RECONNECT = "app.meioorc.rolai.action.RECONNECT"

        /** Reconexao pedida na mao (botao Entrar). */
        fun requestReconnect(context: Context) {
            if (!RolaiSettings.isOverlayEnabled(context)) return
            runCatching {
                context.startService(
                    Intent(context, OverlayService::class.java).setAction(ACTION_RECONNECT),
                )
            }.onFailure { android.util.Log.w("rolai", "RECONNECT nao entregue", it) }
        }

        /** Avisa o servico, se estiver de pe. Sem overlay ativo, nao faz nada. */
        fun notifySettingsChanged(context: Context) {
            if (!RolaiSettings.isOverlayEnabled(context)) return
            runCatching {
                context.startService(
                    Intent(context, OverlayService::class.java).setAction(ACTION_RELOAD),
                )
            }.onFailure {
                // Nao pode sumir em silencio: se o RELOAD nao chega, a
                // configuracao nova simplesmente nao vale e o usuario fica
                // sem entender por que.
                android.util.Log.w("rolai", "RELOAD nao entregue ao servico", it)
            }
        }
        private const val CHANNEL_ID = "overlay"

        /**
         * Janela do palco fica interativa por este tempo apos uma rolagem:
         * STREAM_RESULT_MS do apps/web (8s) + margem da animacao.
         */
        private const val STAGE_SHOW_MS = 9_000L
        private const val NOTIFICATION_ID = 1

        /** Estado observavel pros instrumented tests (OverlayServiceTest). */
        @Volatile
        var overlayAttached = false
            private set

        /** Ultimo status da sala, lido pela SettingsActivity. */
        @Volatile
        var roomStatus: String = ""
            private set

        /**
         * Estado da conexao como DADO, nao como texto. A tela precisa
         * decidir cor e rotulo; fazer isso lendo a string de status daria
         * um parser fragil ("1 jogador(es)" nao diz que conectou).
         */
        enum class RoomState { NONE, CONNECTING, CONNECTED, ERROR }

        @Volatile
        var roomState: RoomState = RoomState.NONE
            private set

        /**
         * Formata um RollResult JSON (docs/roll-notation.md) como texto
         * curto pro overlay: "2d6 [3, 4] = 7" / "2d6+1 [6, 6] = 13 — strong_hit".
         * Se o grupo nao tem `total` (multi-dado sem operador, ver
         * docs/roll-notation.md), soma os rolls na hora de EXIBIR — nao e
         * regra de negocio, e apresentacao.
         */
        /**
         * Tom do resultado pro overlay pintar falha de vermelho. JSON que nao
         * parseia, ou rolagem livre (sem profile, logo sem outcome), vale
         * neutro — nao ha o que afirmar.
         */
        /**
         * Quantos dados cairam, so pra dosar o som (DiceSounds.impactDelays).
         * JSON quebrado vira 1: melhor um clique do que silencio.
         */
        fun diceCountOf(resultJson: String): Int = runCatching {
            val groups = JSONObject(resultJson).optJSONObject("groups") ?: return@runCatching 1
            var total = 0
            for (key in groups.keys()) {
                total += groups.optJSONObject(key)?.optJSONArray("rolls")?.length() ?: 0
            }
            total.coerceAtLeast(1)
        }.getOrDefault(1)

        fun toneOf(resultJson: String): OutcomeTone {
            val outcome = runCatching {
                JSONObject(resultJson).optString("outcome", "")
            }.getOrDefault("")
            return if (outcome.isEmpty()) OutcomeTone.NEUTRAL else outcomeTone(outcome)
        }

        fun formatResult(resultJson: String): String {
            return try {
                val result = JSONObject(resultJson)
                val notation = result.optString("notation", "?")
                val groups = result.optJSONObject("groups")
                val firstGroup = groups?.keys()?.asSequence()?.firstOrNull()?.let { key ->
                    groups.optJSONObject(key)
                }
                val dice = firstGroup?.optJSONArray("rolls")?.let { rolls ->
                    (0 until rolls.length()).joinToString(", ") { rolls.getInt(it).toString() }
                } ?: ""
                val total = firstGroup?.let { group ->
                    if (group.has("total")) group.getInt("total")
                    else group.optJSONArray("rolls")?.let { rolls ->
                        (0 until rolls.length()).sumOf { rolls.getInt(it) }
                    }
                }
                // Mais de uma flag bateu (Infaernum: "1 milagre" + "2
                // desgraças" na mesma rolagem; Ironsworn: "strong_hit" +
                // "match"): mostra todas, juntas — só o `outcome` (a
                // primeira) escondia o resto sem erro nenhum.
                val flags = result.optJSONArray("outcome_flags")
                val outcome = if (flags != null && flags.length() > 1) {
                    (0 until flags.length()).joinToString(", ") { outcomeLabel(flags.getString(it)) }
                } else {
                    result.optString("outcome", "").let { if (it.isEmpty()) it else outcomeLabel(it) }
                }
                buildString {
                    append(notation)
                    if (dice.isNotEmpty()) append(" [$dice]")
                    if (total != null) append(" = $total")
                    if (outcome.isNotEmpty()) append(" — $outcome")
                }
            } catch (e: Exception) {
                resultJson.take(80)
            }
        }
    }
}
