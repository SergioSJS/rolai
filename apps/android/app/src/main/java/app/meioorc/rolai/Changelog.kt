package app.meioorc.rolai

/**
 * Notas de versao mostradas em Configuracoes > Versao. Web e Android saem
 * juntos por versao (ver AGENTS.md), entao uma lista so descreve os dois —
 * mas nao ha camada compartilhada de texto estatico (so o rules-engine e),
 * entao esta lista e mantida a mao em espelho de apps/web/src/changelog.ts.
 * Atualizar as duas no mesmo commit que muda `versionName` em build.gradle.kts.
 */
data class ChangelogEntry(val version: String, val date: String, val notes: List<String>)

object Changelog {
    val ENTRIES = listOf(
        ChangelogEntry(
            "1.0.1",
            "2026-08-16",
            listOf(
                "Histórico do overlay com ordenação correta (mais recentes no topo) e tags de jogadores destacadas.",
                "Formatação rica de rolagens com múltiplos grupos e cartas (Firelights e Ironsworn) no overlay.",
                "Correção na exibição e ciclo de fade do palco de cartas do overlay.",
            ),
        ),
        ChangelogEntry(
            "1.0.0",
            "2026-08-16",
            listOf(
                "Motor de baralho de cartas com embaralhamento determinístico, saques, modos de descarte e sincronização em sala.",
                "Palco de cartas 3D (Three.js) com física e modo 2D leve com efeito flip de cartas.",
                "Efeitos sonoros reais gravados de manuseio e embaralhamento de cartas (Kenney Casino Audio — CC0).",
                "Suporte ao sistema Firelights ({2d6+mod} vs {2c}) e rolagens com termos de cartas (notação livre).",
                "Teclado de dados com d2 (moedinha 3D), d3, d66 e cartas; nova aba dedicada de Baralho no painel flutuante.",
                "Seção independente de Desempenho e Qualidade Gráfica nas configurações.",
            ),
        ),
        ChangelogEntry(
            "0.13.8",
            "2026-08-15",
            listOf(
                "Vantagem e desvantagem também no PbtA (2d6 e o 2d10 do Kult) e no Roll Under, quando a rolagem é um dado só (ex.: 1d20).",
                "O resultado agora mostra contra o que foi medido (CD, perícia, valor testado...), não só sucesso/falha.",
                "No overlay, segurar um dado tira ele do pool — antes só dava pra limpar tudo.",
                "Corrige cartões do overlay (compor, histórico, sala) cortados em paisagem — agora rolam e reposicionam pra caber na tela.",
            ),
        ),
        ChangelogEntry(
            "0.13.7",
            "2026-08-14",
            listOf("Corrige o menu \"Sim/Não\" (ex.: Vantagem do Fractal) ilegível no overlay em alguns aparelhos."),
        ),
        ChangelogEntry(
            "0.13.6",
            "2026-08-14",
            listOf("Contato (site e e-mail) em Sobre."),
        ),
        ChangelogEntry(
            "0.13.5",
            "2026-08-10",
            listOf("Aviso de versão nova aparece assim que a tela de configurações abre, sem precisar fechar e reabrir o app."),
        ),
        ChangelogEntry(
            "0.13.4",
            "2026-08-10",
            listOf("Campo \"Endereço do app\" nas configurações avançadas, pra quem usa build de teste."),
        ),
        ChangelogEntry(
            "0.13.3",
            "2026-08-07",
            listOf("Corrige cor de dado escolhida na mão sendo apagada pelo preset toda vez que a tela de configurações abria."),
        ),
        ChangelogEntry(
            "0.13.2",
            "2026-08-07",
            listOf(
                "Corrige botão flutuante virando um cartão vazio ao ligar/desligar.",
                "Aviso de versão nova, que ficava escondido no fim da tela, sobe pro topo.",
            ),
        ),
        ChangelogEntry(
            "0.13.0",
            "2026-08-07",
            listOf(
                "Formulário de verdade pros campos de sistema (CD, bônus, vantagem/desvantagem) — antes era preciso digitar JSON na mão.",
                "Número da versão instalada visível nas configurações, com aviso quando sai uma nova.",
                "Falha (miss/fail) também aparece em vermelho no overlay, igual na web.",
            ),
        ),
    )

    /** "0.13.8 (2026-08-15)\n- nota\n- nota\n\n0.13.7 (...)\n..." */
    fun formatted(): String =
        ENTRIES.joinToString("\n\n") { entry ->
            val header = "${entry.version} (${entry.date})"
            val notes = entry.notes.joinToString("\n") { "• $it" }
            "$header\n$notes"
        }
}
