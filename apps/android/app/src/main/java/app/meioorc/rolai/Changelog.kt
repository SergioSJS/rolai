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
            "1.5.0",
            "2026-08-21",
            listOf(
                "Tela Servidor nova, no menu: salas ativas, gente conectada agora, rolagens retransmitidas desde que o servidor ligou e limites de abuso atingidos. Atualiza sozinha a cada 20 segundos enquanto estiver aberta.",
                "As salas somem depois de um tempo sem uso, e agora o app diz isso — na tela de Sala e na Ajuda, com o prazo que o servidor informa (6 horas no rolai.app). Cada rolagem renova o prazo, então mesa em andamento não expira no meio.",
                "O aviso aparece também ao lado de Exportar histórico: o histórico vive no servidor e some junto com a sala, então exporte o que quiser guardar.",
                "Corrigido: a contagem de “salas com gente” do servidor contava cada sala duas vezes, e continuava marcando sala ocupada depois que todo mundo tinha saído.",
            ),
        ),
        ChangelogEntry(
            "1.4.0",
            "2026-08-21",
            listOf(
                "Ocultar o histórico daqui pra trás: some da SUA tela e volta com um clique em “Mostrar tudo”. O resto da mesa continua vendo tudo, e um F5 não desfaz o que você escondeu.",
                "Limpar a sala: apaga o histórico para todo mundo, sem desfazer, com confirmação em dois cliques. Fora de sala, apaga o histórico local.",
                "Exportar passa a respeitar o que está à vista: o que você ocultou fica de fora do arquivo.",
                "Hora de cada rolagem no histórico, no seu fuso — carimbada pelo servidor, então a mesa inteira vê a mesma ordem mesmo com relógio torto em algum aparelho.",
                "Ícones nos botões que eram só texto: Rolar, Forçar, Puxar, Reembaralhar, Criar sala, Entrar, Copiar link, Sair da sala e os do histórico.",
                "Corrigido: quando o servidor recusava uma ação, o clique não fazia nada e a tela não dizia o motivo. Agora o erro aparece no painel de histórico.",
            ),
        ),
        ChangelogEntry(
            "1.3.0",
            "2026-08-20",
            listOf(
                "Som de carta no Android: puxar carta no aparelho — ou receber a de outro jogador na sala — agora faz barulho. Antes era mudo nos dois sentidos.",
                "Som no modo stream/OBS: o palco subia sem áudio quando a aba não estava em primeiro plano (o caso de toda Browser Source) e nunca mais tentava. Agora liga sozinho assim que a aba aparece, e a carta também toca.",
                "Corrigido: arrastar o seletor de cor do dado dentro de uma sala derrubava quem mexeu para fora dela — cada movimento reabria a conexão e estourava o limite do servidor.",
                "Corrigido: trocar a cor dos dados em sala anunciava só o slot 1, e a mesa continuava vendo os dados 2 e 3 na cor antiga até a próxima entrada.",
                "Android: o campo Servidor (avançado) passa a aceitar um backend na rede local, não só via cabo USB.",
                "Android: quando a sala cai, o motivo aparece no log em vez de só 'reconectando…'.",
                "App mais leve para abrir: a cena 3D do baralho saiu do carregamento inicial (-30% no pacote de entrada).",
            ),
        ),
        ChangelogEntry(
            "1.2.0",
            "2026-08-20",
            listOf(
                "Vampiro / WoD v5: contagem automática de sucessos (≥6), bônus de par de 10s (+2 cada par) e destaque visual de dados (borda verde ≥6, dourada 10, vermelha 1 na Fome).",
                "Layout hierárquico no resultado do overlay: headline grande colorida pelo desfecho + detalhe menor com pools nomeados.",
                "Corrigido: dados 3D perdiam cores de slot na segunda rolagem ao trocar de modo (ex.: Vampiro → livre → Vampiro).",
                "Corrigido: compositor apagava notação de slot ao clicar botão de dado (1[d20]).",
                "Corrigido: rolagem multi-grupo (1[1d6] + 2[2d6]) sem grand total.",
            ),
        ),
        ChangelogEntry(
            "1.1.1",
            "2026-08-19",
            listOf(
                "Personalização independente dos 3 Slots de Cores de Dados (Primário, Secundário e Terciário) nas preferências e sincronização em sala.",
                "Suporte completo a dados 3D multi-cores por grupo e sistema (cada pool de dados cai com a sua respectiva cor e material na mesa).",
                "Adicionados perfis oficiais para Trophy Dark e Trophy Gold com mecânica de Forçar (Push), dados claros e escuros/ruína.",
                "Suporte completo a Year Zero Engine e Forbidden Lands com pools independentes de Base, Perícia e Equipamento e dano por 1s.",
                "Formatação visual rica no histórico e logs do overlay, com nomes destacados, cores por slot e desfechos semânticos.",
                "Seletores e menus de sistemas organizados em ordem alfabética.",
            ),
        ),
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
