package app.meioorc.rolai

/**
 * Agrupamento de sistemas no seletor de configuracoes — so apresentacao.
 * O systems.json continua com um SystemInfo por sistema, sem fusao nenhuma;
 * isto so decide que Infaernum aparece UMA vez no spinner principal, com um
 * segundo spinner "Modo" pra escolher entre os 3.
 *
 * A lista vem GERADA de `apps/web/src/profileFamilies.ts` (OutcomeCatalog.kt).
 */
data class ProfileFamilyMember(val system: String, val subLabel: String)

data class ProfileFamily(
    val key: String,
    val label: String,
    val members: List<ProfileFamilyMember>,
    /**
     * Nome enxuto pra aba e pro botao do overlay ("ROLAR YZ"). Sem ele,
     * "Year Zero" com quatro modos ja empurrava a aba pra fora do painel de
     * 300dp.
     */
    val shortLabel: String = label,
)

object ProfileFamilies {
    val ALL: List<ProfileFamily> = OutcomeCatalog.FAMILIES.map { family ->
        ProfileFamily(
            key = family.key,
            label = family.label,
            shortLabel = family.shortLabel,
            members = family.members.map { ProfileFamilyMember(it.system, it.subLabel) },
        )
    }

    /** Ids de todo member de toda familia — esses NAO aparecem soltos. */
    val memberSystemIds: Set<String> = ALL.flatMap { it.members.map { m -> m.system } }.toSet()

    /** Familia que contem `system`, se houver — usado pelo overlay pra
     *  mostrar as abas de modo dentro da propria caixa de rolar. */
    fun familyFor(system: String): ProfileFamily? = ALL.find { fam -> fam.members.any { it.system == system } }
}
