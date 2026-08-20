package app.meioorc.rolai

/**
 * O chip de status de sala da tela de configurações, decidido como DADO.
 *
 * Vivia no meio do `renderRoomStatus`, misturado com `ColorStateList` e
 * `setTextColor` — 38 linhas dentro de uma Activity a 0% de cobertura. O que
 * ele resolve é uma tabela de decisão com três entradas (botão ligado,
 * código digitado, estado da conexão), e é justamente o tipo de coisa que
 * fica errada em silêncio: um estado a menos e a pessoa vê "SEM SALA"
 * enquanto está conectada.
 *
 * A Activity fica com pintar; aqui fica decidir o quê.
 */
object RoomStatusChip {

    /** Tom do chip. A cor concreta é da tela — aqui é o significado. */
    enum class Tom {
        /** Sem sala nenhuma: informação, não problema. */
        NEUTRO,

        /** Depende de uma ação da pessoa (ligar o botão) ou está em curso. */
        ESPERA,

        /** Na sala. */
        CONECTADO,

        /** Devia estar conectado e não está. */
        PROBLEMA,
    }

    data class Chip(val rotulo: String, val tom: Tom, val detalhe: String)

    /**
     * @param overlayLigado o botão flutuante está ativo? Sem ele não há
     *   Service, e sem Service não há conexão — dizer "SEM CONEXÃO" nesse
     *   caso culparia a rede por uma escolha da pessoa.
     * @param codigo o que está no campo de sala (já aparado).
     * @param estado o que o Service publicou.
     * @param statusDoServico texto livre do Service ("2 na sala"), quando há.
     */
    fun de(
        overlayLigado: Boolean,
        codigo: String,
        estado: OverlayService.Companion.RoomState,
        statusDoServico: String,
    ): Chip {
        val temCodigo = codigo.isNotEmpty()

        // A palavra vem primeiro e em CAIXA ALTA: o que importa é saber, de
        // relance, se está ou não na sala.
        val (rotulo, tom) = when {
            !overlayLigado && !temCodigo -> "SEM SALA" to Tom.NEUTRO
            !overlayLigado -> "AGUARDANDO" to Tom.ESPERA
            estado == OverlayService.Companion.RoomState.CONNECTED -> "CONECTADO" to Tom.CONECTADO
            estado == OverlayService.Companion.RoomState.CONNECTING -> "CONECTANDO…" to Tom.ESPERA
            estado == OverlayService.Companion.RoomState.ERROR -> "SEM CONEXÃO" to Tom.PROBLEMA
            !temCodigo -> "SEM SALA" to Tom.NEUTRO
            else -> "SEM CONEXÃO" to Tom.PROBLEMA
        }

        val detalhe = when {
            !overlayLigado && temCodigo -> "$codigo — ative o botão flutuante para conectar"
            !overlayLigado -> "o dado rola só neste aparelho"
            !temCodigo -> "o dado rola só neste aparelho"
            statusDoServico.isNotEmpty() -> "$codigo · $statusDoServico"
            else -> codigo
        }

        return Chip(rotulo, tom, detalhe)
    }
}
