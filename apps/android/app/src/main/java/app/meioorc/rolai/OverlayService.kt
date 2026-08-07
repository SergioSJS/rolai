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
        headlessRoller = HeadlessRoller(
            this,
            onResult = ::onRollCalculated,
            onError = { message -> overlay.showResult("erro: $message") },
        )
        overlay.onRollClicked = ::rollNow
        overlay.onQuickRoll = { (lastRollAction ?: ::rollNow).invoke() }
        overlay.onRollNotation = { notation -> rollNotation(notation) }
        lastQuickKey = quickKeyOf(settings)
        overlay.setQuickNotation(settings.notation)
        overlay.onWindowFocusMode = ::setOverlayFocusable
        // START_STICKY recria o service do zero quando o sistema mata o
        // processo — sem persistir, a mini-bolha "esquecia" a ultima rolagem
        // e voltava pra configurada. Sobrevive a restart.
        loadLastRoll()?.let { saved -> lastRollAction = { headlessRoller.roll(saved) } }
        overlay.onOpenApp = { launchFromOverlay(TwaActivity.intentFor(this)) }
        overlay.onOpenSettings = { launchFromOverlay(Intent(this, SettingsActivity::class.java)) }

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
            x = 0
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
            stageShow()
        }

        override fun onRoster(memberNames: List<String>) {
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

    private fun rollNow() {
        val settings = RolaiSettings.load(this)
        overlay.setQuickNotation(settings.notation)
        if (settings.system.isEmpty()) {
            headlessRoller.roll(settings.notation)
        } else {
            headlessRoller.rollWithProfile(settings.system, settings.inputsJson)
        }
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
        overlay.showResult(formatResult(resultJson))
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
            stageShow()
            // Sem eco do servidor, a nossa rolagem entra no historico aqui.
            overlay.addActivityLine("você: ${formatResult(resultJson)}")
        }
    }

    companion object {
        /**
         * Espera antes de aplicar config nova. A tela salva a cada toque;
         * sem isto, arrastar o slider de tamanho vira uma rajada de
         * reconexoes.
         */
        private const val SETTINGS_DEBOUNCE_MS = 700L

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
                val outcome = result.optString("outcome", "")
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
