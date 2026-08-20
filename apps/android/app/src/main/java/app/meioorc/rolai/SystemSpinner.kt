package app.meioorc.rolai

/**
 * Qual posicao do seletor de sistema corresponde ao sistema salvo.
 *
 * Parece trivial e nao e: uma FAMILIA (Infaernum, Year Zero, Trophy) entra
 * no spinner UMA vez, com o PRIMEIRO member como valor. Um modo salvo que
 * nao seja o primeiro ("yze_fbl", "infaernum_ideias") simplesmente nao esta
 * na lista, o `indexOf` devolve -1, e o fallback pro indice 0 e "Notação
 * livre" — a tela escolhia "sem sistema" sozinha e o `saveFromViews` do
 * proprio spinner GRAVAVA isso por cima. O modo do jogador sumia so de
 * abrir as configuracoes.
 *
 * Esse bug ja apareceu duas vezes (primeiro com Infaernum, depois com Year
 * Zero, quando o modo virou a unica forma de escolher a linha) e a correcao
 * morava dentro da SettingsActivity, `private`, sem teste possivel. Aqui e
 * funcao pura: entra a lista, sai a posicao.
 *
 * Ver docs/adding-a-system.md, secao "Modo salvo que não é o primeiro da
 * família some sozinho".
 */
object SystemSpinner {

    /**
     * @param position posicao a marcar no spinner principal.
     * @param activeMember member que deve virar o VALOR ATIVO daquela
     *   posicao (a familia guarda o primeiro member, e trocar de modo troca
     *   o valor da posicao). Nulo = nada a trocar.
     */
    data class Resolucao(val position: Int, val activeMember: SystemInfo?)

    /**
     * @param system id salvo nas preferencias ("" = notacao livre).
     * @param ids ids na ordem do spinner; indice 0 e a notacao livre.
     * @param families posicao -> familia, so pras posicoes que sao familia.
     * @param infoById todo SystemInfo do systems.json, por id.
     */
    fun resolve(
        system: String,
        ids: List<String>,
        families: Map<Int, ProfileFamily>,
        infoById: Map<String, SystemInfo>,
    ): Resolucao {
        val direto = ids.indexOf(system)
        if (direto >= 0) return Resolucao(direto, null)

        // Nao esta na lista: pode ser um member de familia que nao e o
        // primeiro. Se nem familia tem, cai na notacao livre.
        val familia = ProfileFamilies.familyFor(system) ?: return Resolucao(0, null)
        val posicao = families.entries.find { it.value.key == familia.key }?.key
            ?: return Resolucao(0, null)
        // Familia conhecida mas sem info carregada (systems.json defasado):
        // marca a posicao da familia mesmo assim — melhor o sistema certo
        // com o primeiro modo do que "Notação livre".
        val info = infoById[system] ?: return Resolucao(posicao, null)
        return Resolucao(posicao, info)
    }
}
