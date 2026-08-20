package app.meioorc.rolai

// GERADO por apps/web/scripts/install-headless.mjs — NAO EDITE NA MAO.
// Fonte: apps/web/src/catalog.ts (que le format.ts e profileFamilies.ts).
// Regenerar: npm run build:headless -w @rolai/web
//
// Isto e APRESENTACAO, nunca regra: quem decide o outcome sao as
// outcome_rules dos YAMLs, calculadas pela WebView headless (AGENTS.md).
// Id que nao estiver aqui cai no proprio id (rotulo) e em NEUTRAL (tom) —
// nunca uma falha pintada de verde.

internal object OutcomeCatalog {

    val LABELS: Map<String, String> = mapOf(
        "strong_hit" to "sucesso completo",
        "weak_hit" to "sucesso parcial",
        "miss" to "falha",
        "match" to "combinação!",
        "critical" to "crítico",
        "full_success" to "sucesso total",
        "partial_success" to "sucesso parcial",
        "success_with_style" to "sucesso com estilo",
        "success" to "sucesso",
        "tie" to "empate",
        "fail" to "falha",
        "critical_success" to "acerto crítico",
        "critical_failure" to "falha crítica",
        "extreme_success" to "sucesso extremo",
        "hard_success" to "sucesso difícil",
        "regular_success" to "sucesso",
        "fumble" to "desastre",
        "sim" to "sim",
        "nao" to "não",
        "desgraca_x1" to "1 desgraça",
        "desgraca_x2" to "2 desgraças",
        "desgraca_x3" to "3 desgraças",
        "vislumbre_x1" to "1 vislumbre",
        "vislumbre_x2" to "2 vislumbres",
        "vislumbre_x3" to "3 vislumbres",
        "facanha_x1" to "1 façanha",
        "facanha_x2" to "2 façanhas",
        "facanha_x3" to "3 façanhas",
        "milagre_x1" to "1 milagre",
        "milagre_x2" to "2 milagres",
        "milagre_x3" to "3 milagres",
        "messy_critical" to "crítico manchado",
        "bestial_failure" to "fracasso bestial",
        "glitch" to "pane",
        "critical_glitch" to "pane crítica",
        "sucesso_impulso_x2" to "sucesso com 1 impulso extra",
        "sucesso_impulso_x3" to "sucesso com 2 impulsos extras",
        "sucesso_impulso_x4" to "sucesso com 3 impulsos extras",
        "ruptura_x1" to "ruptura: 1 fato quebrado",
        "ruptura_x2" to "ruptura: 2 fatos quebrados",
        "ruptura_x3" to "ruptura: 3 fatos quebrados",
        "ruptura_x4" to "ruptura: 4 fatos quebrados",
        "yze_dano_atributo_x1" to "1 dano de atributo",
        "yze_dano_atributo_x2" to "2 danos de atributo",
        "yze_dano_atributo_x3" to "3+ danos de atributo",
        "yze_dano_equipamento_x1" to "1 dano de equipamento",
        "yze_dano_equipamento_x2" to "2 danos de equipamento",
        "yze_dano_equipamento_x3" to "3+ danos de equipamento",
        "yze_panico" to "pânico!",
        "yze_descontrole" to "descontrole!",
        "trophy_ruina_aumenta" to "ruína aumenta (+1)",
    )

    val GROUP_LABELS: Map<String, String> = mapOf(
        "action" to "ação",
        "challenge" to "desafio",
        "verb" to "verbo",
        "noun" to "substantivo",
        "regular" to "regulares",
        "hunger" to "fome/ira",
        "pool" to "pool",
        "roll" to "rolagem",
        "base" to "base",
        "pericia" to "perícia",
        "equipamento" to "equipamento",
        "estresse" to "estresse",
        "claros" to "claros",
        "escuros" to "escuros",
        "ruina" to "ruína",
    )

    val FAILURE: Set<String> = setOf(
        "miss",
        "fail",
        "critical_failure",
        "fumble",
        "desgraca_x1",
        "desgraca_x2",
        "desgraca_x3",
        "bestial_failure",
        "glitch",
        "critical_glitch",
        "nao",
        "yze_dano_atributo_x1",
        "yze_dano_atributo_x2",
        "yze_dano_atributo_x3",
        "yze_dano_equipamento_x1",
        "yze_dano_equipamento_x2",
        "yze_dano_equipamento_x3",
        "yze_panico",
        "yze_descontrole",
        "trophy_ruina_aumenta",
    )

    val PARTIAL: Set<String> = setOf(
        "weak_hit",
        "partial_success",
        "tie",
        "vislumbre_x1",
        "vislumbre_x2",
        "vislumbre_x3",
    )

    val SUCCESS: Set<String> = setOf(
        "strong_hit",
        "full_success",
        "success",
        "success_with_style",
        "critical_success",
        "critical",
        "extreme_success",
        "hard_success",
        "regular_success",
        "facanha_x1",
        "facanha_x2",
        "facanha_x3",
        "milagre_x1",
        "milagre_x2",
        "milagre_x3",
        "messy_critical",
        "sim",
        "sucesso_impulso_x2",
        "sucesso_impulso_x3",
        "sucesso_impulso_x4",
    )

    data class Member(val system: String, val subLabel: String)

    data class Family(
        val key: String,
        val label: String,
        val shortLabel: String,
        val members: List<Member>,
    )

    val FAMILIES: List<Family> = listOf(
        Family(
            key = "infaernum",
            label = "Infaernum",
            shortLabel = "Infaernum",
            members = listOf(
                Member("infaernum", "Ação"),
                Member("infaernum_sim_ou_nao", "Sim ou Não"),
                Member("infaernum_ideias", "Ideias"),
            ),
        ),
        Family(
            key = "yze",
            label = "Year Zero",
            shortLabel = "YZ",
            members = listOf(
                Member("yze", "Genérico"),
                Member("yze_fbl", "Forbidden Lands"),
                Member("yze_alien", "Alien"),
                Member("yze_wdu", "Walking Dead"),
            ),
        ),
        Family(
            key = "trophy",
            label = "Trophy",
            shortLabel = "Trophy",
            members = listOf(
                Member("trophy_dark", "Dark"),
                Member("trophy_gold", "Gold"),
            ),
        ),
    )
}
