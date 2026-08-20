package app.meioorc.rolai

/**
 * Label pt-BR de um outcome. Desconhecido (profile custom, versao nova de
 * um profile) cai no id cru, igual na web.
 *
 * A tabela e GERADA a partir de `apps/web/src/format.ts` — ver
 * OutcomeCatalog.kt. Era copiada na mao aqui, e o efeito de esquecer de
 * copiar nao era erro nenhum: o overlay mostrava o id interno da regra
 * ("desgraca_x1", "milagre_x2") direto na tela, enquanto a web ja dizia
 * "1 desgraça" / "2 milagres".
 */
fun outcomeLabel(outcome: String): String = OutcomeCatalog.LABELS[outcome] ?: outcome
