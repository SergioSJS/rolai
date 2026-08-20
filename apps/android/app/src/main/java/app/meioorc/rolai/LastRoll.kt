package app.meioorc.rolai

/**
 * O que a mini-bolha do fan repete — como DADO, não como closure.
 *
 * Era um `(() -> Unit)?` no OverlayService, escrito em 10 lugares e zerado
 * em 4. Nada disso dava pra observar de fora, e o resultado está registrado
 * no AGENTS.md: repetir rolagem com valor velho "voltou disfarçado de bug
 * novo umas quatro vezes".
 *
 * Closure não dá pra comparar nem pra inspecionar. É justamente a comparação
 * ("o que está no formulário AGORA é diferente do que foi REALMENTE rolado?")
 * que decide invalidar — e era ela que vivia espalhada e sem teste.
 *
 * Aqui ficam a descrição e as três decisões puras que a cercam. Quem traduz
 * descrição em chamada do motor continua sendo o Service: isto não conhece
 * WebView, SharedPreferences nem View.
 */
object LastRoll {

    /** Uma repetição possível. */
    sealed interface Action {
        /** Notação crua do compositor ("2d6+1"). */
        data class Notation(val notation: String) : Action

        /** Profile com os campos preenchidos no painel. */
        data class Profile(val system: String, val inputsJson: String) : Action

        /**
         * Profile "overlay" (roll_under): a notação vem do compositor e o
         * profile só avalia as outcome_rules em cima do resultado.
         */
        data class Overlay(
            val system: String,
            val notation: String,
            val inputsJson: String,
        ) : Action

        /** Puxada de carta — a mini-bolha repete a puxada, não a rolagem. */
        data class DeckDraw(val count: Int) : Action
    }

    /**
     * O que sobrevive a um restart do processo (KEY_LAST_ROLL), ou null pra
     * apagar o que estiver salvo.
     *
     * Só notação crua persiste. O campo salvo alimenta um
     * `headlessRoller.roll(notation)` puro, que NÃO avalia outcome_rules —
     * repetir um roll_under por esse caminho ignoraria a regra "<= valor
     * testado" e devolveria um número sem desfecho, parecendo certo. Depois
     * de o processo morrer é melhor cair no fallback (reabrir o compositor)
     * do que repetir errado em silêncio.
     */
    fun persisted(action: Action?): String? = when (action) {
        is Action.Notation -> action.notation
        else -> null
    }

    /**
     * Assinatura da rolagem CONFIGURADA (Preferências). Mudou a assinatura,
     * a "última rolagem" da mini-bolha deixa de fazer sentido e ela volta a
     * disparar a configurada.
     */
    fun quickKey(system: String, notation: String, inputsJson: String): String =
        listOf(system, notation, inputsJson).joinToString("|")

    /**
     * Fechar o painel do sistema (o "—") invalida a repetição?
     *
     * Só quando o campo — ou, no roll_under, a notação do compositor — de
     * fato MUDOU desde o que foi realmente rolado. Sem essa comparação, o
     * fluxo normal (abre, rola, minimiza) zerava a repetição que o próprio
     * rollWithInputs tinha acabado de registrar, e o botão de repetir voltava
     * a abrir o formulário — o mesmo bug, entrando por outra porta.
     *
     * @param inputsDoForm o que o formulário devolveu ao fechar. NUNCA traz
     *   os campos `push_*` (não aparecem na tela), por isso o chamador
     *   precisa mesclar os salvos antes — ver ResultFormat.mergePushBookkeeping.
     * @param inputsSalvos o que estava valendo.
     * @param notacao notação do compositor, só no roll_under; null nos demais.
     * @param ultimaNotacaoRolada a última notação de overlay REALMENTE rolada.
     */
    fun invalidadaPorEdicao(
        inputsDoForm: String,
        inputsSalvos: String,
        notacao: String?,
        ultimaNotacaoRolada: String?,
    ): Boolean {
        val camposMudaram = !ResultFormat.sameInputs(inputsDoForm, inputsSalvos)
        val notacaoMudou = notacao != null && notacao != ultimaNotacaoRolada
        return camposMudaram || notacaoMudou
    }
}
