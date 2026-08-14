package app.meioorc.rolai

/**
 * Agrupamento de sistemas no seletor da tela de configuracoes — so
 * apresentacao, espelha `apps/web/src/profileFamilies.ts`. O
 * systems.json continua com um SystemInfo por sistema, sem fusao
 * nenhuma; isto so decide que Infaernum aparece UMA vez no spinner
 * principal, com um segundo spinner "Modo" pra escolher entre os 3.
 */
data class ProfileFamilyMember(val system: String, val subLabel: String)

data class ProfileFamily(val key: String, val label: String, val members: List<ProfileFamilyMember>)

object ProfileFamilies {
    val ALL = listOf(
        ProfileFamily(
            key = "infaernum",
            label = "Infaernum",
            members = listOf(
                ProfileFamilyMember("infaernum", "Ação (3d6)"),
                ProfileFamilyMember("infaernum_sim_ou_nao", "Sim ou Não"),
                ProfileFamilyMember("infaernum_ideias", "Ideias"),
            ),
        ),
    )

    /** Ids de todo member de toda familia — esses NAO aparecem soltos. */
    val memberSystemIds: Set<String> = ALL.flatMap { it.members.map { m -> m.system } }.toSet()

    /** Familia que contem `system`, se houver — usado pelo overlay pra
     *  mostrar as abas de modo dentro da propria caixa de rolar. */
    fun familyFor(system: String): ProfileFamily? = ALL.find { fam -> fam.members.any { it.system == system } }
}
