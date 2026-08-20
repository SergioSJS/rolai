package app.meioorc.rolai

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import android.os.Handler
import android.os.Looper
import kotlin.random.Random

/**
 * Som de dado tocado NATIVAMENTE, em paralelo com o que a pessoa estiver
 * ouvindo.
 *
 * Antes o som vinha da WebView do palco (a dice-box toca os mp3 de
 * `assets/stage/sounds`). O problema nao e o volume: audio de WebView pede
 * FOCO DE AUDIO ao sistema, e o Android abaixa (ou pausa) musica e podcast
 * de outro app enquanto o dado rola. Rolar um dado no meio da sessao cortava
 * a trilha da mesa.
 *
 * A correcao e o que este arquivo NAO faz: **nunca chama
 * `AudioManager.requestAudioFocus`**. Sem pedido de foco o Android nao manda
 * ninguem abaixar nada — o som sai por cima, misturado. Por isso o palco vai
 * mudo no overlay (`&sound=0` na URL, ver DiceStageWindow).
 *
 * `USAGE_GAME` + `CONTENT_TYPE_SONIFICATION`: efeito curto de interface, que
 * e exatamente o caso, e sai pelo volume de midia como qualquer outro som de
 * app.
 */
class DiceSounds(context: Context) {

    /**
     * Amostras PRONTAS pra tocar. So entram aqui no callback de carga: tocar
     * um id que ainda esta carregando nao faz nada (o SoundPool avisa
     * "play soundID N not READY" no log e segue em silencio).
     */
    private val samples = mutableListOf<Int>()

    /** Idem, pras cartas — ver [card]. */
    private val cardSamples = mutableListOf<Int>()

    private val handler = Handler(Looper.getMainLooper())
    private val random = Random.Default

    private val pool: SoundPool = SoundPool.Builder()
        .setMaxStreams(MAX_STREAMS)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build(),
        )
        .build()

    /** id do SoundPool -> e carta? Preenchido no load, lido no callback. */
    private val ehCarta = mutableMapOf<Int, Boolean>()

    init {
        pool.setOnLoadCompleteListener { _, sampleId, status ->
            if (status == 0) {
                if (ehCarta[sampleId] == true) cardSamples.add(sampleId) else samples.add(sampleId)
            } else {
                android.util.Log.w("rolai", "som: amostra $sampleId nao carregou")
            }
        }
        for ((res, carta) in SAMPLES.map { it to false } + CARD_SAMPLES.map { it to true }) {
            runCatching { pool.load(context, res, 1) }
                .onSuccess { ehCarta[it] = carta }
                .onFailure {
                    // Sem som o dado continua rolando — nunca derrubar a rolagem.
                    android.util.Log.w("rolai", "som: recurso $res indisponivel", it)
                }
        }
    }

    /**
     * Carta pousando na mesa. Uma amostra por carta puxada, com um respiro
     * entre elas quando vem mais de uma — puxar 3 de uma vez tocando tudo no
     * mesmo instante vira um estalo so.
     *
     * Vale pra carta puxada AQUI e pra que chega da sala: os dois caminhos
     * eram mudos, porque o som de carta so existia na web (deckSound.ts) e o
     * palco do overlay roda com `&sound=0`.
     */
    fun card(count: Int = 1) {
        if (cardSamples.isEmpty()) return
        for (i in 0 until count.coerceIn(1, MAX_STREAMS)) {
            val atraso = i * CARD_GAP_MS
            handler.postDelayed({
                val id = cardSamples[random.nextInt(cardSamples.size)]
                pool.play(id, CARD_VOLUME, CARD_VOLUME, 1, 0, 1f)
            }, atraso)
        }
    }

    /**
     * Um impacto da fisica do palco (0..1 de forca), tocado na hora.
     *
     * E o que faz soar como dado rolando em vez de um clique seco: o barulho
     * de dado vem de UMA COLISAO POR VEZ, e quem sabe quando elas acontecem e
     * a fisica, que roda na WebView (ver renderers/diceBox.ts).
     */
    fun impact(strength: Float) {
        if (samples.isEmpty()) return
        val id = samples[random.nextInt(samples.size)]
        val volume = volumeFor(strength)
        // Pancada forte soa um tico mais grave; leve, mais aguda. Barato e
        // faz duas batidas seguidas nao saírem identicas.
        val rate = 0.92f + random.nextFloat() * 0.16f
        pool.play(id, volume, volume, 0, 0, rate)
    }

    /**
     * Toca a queda de `dice` dados sem depender da fisica: rede de seguranca
     * pra quando NENHUM impacto chega (palco 3D nao subiu, tier de texto).
     * Sem isto, "sem impacto" viraria "sem som" e ninguem saberia por que.
     */
    fun playFallback(dice: Int) {
        if (samples.isEmpty()) return
        for (atraso in impactDelays(dice, random)) {
            val id = samples[random.nextInt(samples.size)]
            val volume = 0.55f + random.nextFloat() * 0.35f
            handler.postDelayed({ pool.play(id, volume, volume, 0, 0, 1f) }, atraso)
        }
    }

    fun release() {
        handler.removeCallbacksAndMessages(null)
        pool.release()
        samples.clear()
    }

    companion object {
        private const val MAX_STREAMS = 6

        /** Respiro entre cartas de uma mesma puxada. */
        private const val CARD_GAP_MS = 90L

        /** Carta e mais discreta que dado batendo na mesa. */
        private const val CARD_VOLUME = 0.7f

        /**
         * Amostras de plastico (o dado padrao do app), em WAV, em `res/raw`.
         *
         * Nao sao os mp3 de `assets/stage/sounds` que o palco usa, e o motivo
         * esta no log do aparelho: o SoundPool falhava neles com
         * "NuMediaExtractor: failed to create MediaExtractor" +
         * "doLoad: unable to load sound", por asset, por arquivo em cache,
         * sempre. Sao mp3 validos — o Chromium toca — mas minusculos: ~1,6 KB
         * de audio (umas 4 frames) atras de 2 KB de tag ID3. O extractor do
         * SoundPool nao da conta de um stream tao curto.
         *
         * WAV/PCM nao tem o que interpretar: carrega direto. Convertidos dos
         * proprios mp3 (mono 44.1 kHz), ~6 KB cada.
         */
        private val SAMPLES = listOf(
            R.raw.dice_hit1,
            R.raw.dice_hit2,
            R.raw.dice_hit3,
            R.raw.dice_hit4,
        )

        /**
         * Carta na mesa. Mesmos arquivos Kenney CC0 que a web usa
         * (public/sounds/cards/card-place-*.ogg) — copiados pra res/raw
         * porque o palco vai MUDO no overlay e o audio aqui e nativo.
         */
        private val CARD_SAMPLES = listOf(
            R.raw.card_place1,
            R.raw.card_place2,
            R.raw.card_place3,
            R.raw.card_place4,
        )

        /**
         * Volume de um impacto. Piso alto de proposito: colisao fraca ainda
         * precisa ser audivel por cima da musica que continua tocando (o som
         * nao pede foco de audio, entao nao ha ducking pra ajudar).
         */
        fun volumeFor(strength: Float): Float =
            0.45f + strength.coerceIn(0f, 1f) * 0.55f

        /** Teto de impactos: 20 dados nao viram vinte cliques. */
        const val MAX_IMPACTS = 4

        /**
         * Atrasos (ms) dos impactos de uma rolagem de `dice` dados.
         *
         * Um dado bate uma vez; varios batem em sequencia rapida e
         * irregular. Ritmo perfeitamente igual soa a metronomo, dai o
         * sorteio. Pool grande nao aumenta o barulho alem de MAX_IMPACTS.
         */
        fun impactDelays(dice: Int, random: Random = Random.Default): List<Long> {
            val impactos = dice.coerceIn(1, MAX_IMPACTS)
            var acumulado = 0L
            return List(impactos) { i ->
                if (i == 0) 0L else {
                    acumulado += 45L + random.nextInt(70)
                    acumulado
                }
            }
        }
    }
}
