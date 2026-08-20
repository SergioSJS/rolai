package app.meioorc.rolai

import org.json.JSONArray
import org.json.JSONObject

/**
 * Leitura de um RollResult JSON (docs/roll-notation.md) como TEXTO — o que
 * o overlay mostra no flash, na linha de historico e no cartao de resultado.
 *
 * Vivia no `companion object` do OverlayService, onde eram ~490 linhas sem
 * relacao nenhuma com ciclo de vida de Service, WindowManager ou WebSocket.
 * Nada aqui toca em Android: so org.json e string, o que deixa tudo
 * coberto por teste JVM (OverlayServiceFormatTest).
 *
 * Espelha `apps/web/src/format.ts` — mudou a leitura de um lado, mude no
 * outro (ver docs/adding-a-system.md).
 */
object ResultFormat {

    /**
     * Quantos dados cairam, so pra dosar o som (DiceSounds.impactDelays).
     * JSON quebrado vira 1: melhor um clique do que silencio.
     */
    fun diceCountOf(resultJson: String): Int = runCatching {
        val groups = JSONObject(resultJson).optJSONObject("groups") ?: return@runCatching 1
        var total = 0
        for (key in groups.keys()) {
            total += groups.optJSONObject(key)?.optJSONArray("rolls")?.length() ?: 0
        }
        total.coerceAtLeast(1)
    }.getOrDefault(1)

    // Simbolo do naipe (mesmo mapa de apps/web/src/cardFormat.ts —
    // SUIT_SYMBOL) pro texto nativo do overlay.
    private val SUIT_SYMBOL = mapOf(
        "hearts" to "♥",
        "diamonds" to "♦",
        "clubs" to "♣",
        "spades" to "♠",
    )

    private val CARD_SUITS = arrayOf("♠", "♥", "♦", "♣")
    private val CARD_RANKS = arrayOf("A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K")

    /** Mapeia 1..13 para A..K com naipe determinístico igual ao web `cardFromRollValue`. */
    fun cardFromRollValue(value: Int, cardIndex: Int = 0): String {
        val rankIdx = (value.coerceIn(1, 13)) - 1
        val rank = CARD_RANKS.getOrElse(rankIdx) { "10" }
        val suit = CARD_SUITS[(value + cardIndex * 2) % CARD_SUITS.size]
        return "$rank$suit"
    }

    /** "10♥, K♠" / "Curinga" — mesma leitura do cardLabel() da web. */
    fun formatCards(cards: JSONArray): String =
        (0 until cards.length()).joinToString(", ") { i ->
            val card = cards.getJSONObject(i)
            val suit = card.optString("suit")
            if (suit == "joker") "Curinga" else "${card.optString("rank")}${SUIT_SYMBOL[suit] ?: ""}"
        }

    /** Quantas cartas vieram no evento — so pra dosar o som (DiceSounds.card). */
    fun cardCountOf(cardsJson: String): Int =
        runCatching { JSONArray(cardsJson).length().coerceAtLeast(1) }.getOrDefault(1)

    /** Sobrecarga pra quando as cartas chegam como JSON em string (eco da sala). */
    fun formatCards(cardsJson: String): String = try {
        formatCards(JSONArray(cardsJson))
    } catch (e: Exception) {
        cardsJson.take(80)
    }

    /** "puxou 2 cartas: 10♥, K♠" — mesma leitura do HistoryList da web. */
    fun formatDeckDrawAction(cards: JSONArray): String {
        val count = cards.length()
        val prefix = if (count == 1) "puxou 1 carta:" else "puxou $count cartas:"
        return "$prefix ${formatCards(cards)}"
    }

    fun formatDeckDrawAction(cardsJson: String): String = try {
        formatDeckDrawAction(JSONArray(cardsJson))
    } catch (e: Exception) {
        "puxou cartas: ${cardsJson.take(80)}"
    }

    /** Resumo legivel de uma mudanca de config — mesma leitura do
     *  deckConfigChangeLabel() da web (cardFormat.ts). So os campos
     *  presentes (nao-null) entram, igual o evento deck_config em si. */
    fun formatDeckConfigChange(
        includeJokers: Boolean?,
        removalMode: String?,
        autoReshuffleOnEmpty: Boolean?,
    ): String {
        val parts = mutableListOf<String>()
        if (includeJokers != null) parts.add(if (includeJokers) "com curinga" else "sem curinga")
        if (removalMode != null) {
            parts.add(
                if (removalMode == "returns") "carta volta na hora" else "carta some até reembaralhar",
            )
        }
        if (autoReshuffleOnEmpty != null) {
            parts.add(
                if (autoReshuffleOnEmpty) "reembaralha sozinho quando vazio" else "trava quando vazio",
            )
        }
        return parts.joinToString(", ")
    }

    /**
     * Grupos na ordem em que aparecem no JSON, nao na ordem que o
     * `JSONObject` devolver.
     *
     * O pareamento grupo <-> sub-notacao aqui e por INDICE ("{2d6+1} +
     * {0d6}" -> primeiro grupo usa "2d6+1"), e `keys()` nao promete
     * ordem nenhuma: no org.json do JVM ela sai embaralhada, e o pool de
     * pericia acabava rotulado com a notacao da base — inclusive a
     * deteccao de carta/Fudge, que sai justamente dali. Na WebView do
     * aparelho a ordem costuma bater por acaso (LinkedHashMap), que e a
     * pior versao do bug: passa no aparelho e falha em teste, ou vice
     * versa.
     */
    internal fun orderedGroupKeys(resultJson: String, groups: JSONObject): List<String> =
        groups.keys().asSequence().toList().sortedBy { key ->
            resultJson.indexOf("\"$key\"").let { if (it < 0) Int.MAX_VALUE else it }
        }

    /**
     * Nome do pool em pt-BR ("pericia" -> "perícia"). Id desconhecido cai
     * nele mesmo, igual na web.
     *
     * A tabela e GERADA de `apps/web/src/format.ts` (ver OutcomeCatalog.kt);
     * so a regra do `group1`/`group2` fica aqui, porque e codigo e nao dado.
     */
    internal fun groupLabel(name: String): String {
        val lower = name.lowercase()
        val groupMatch = Regex("""^group(\d+)$""").find(lower)
        if (groupMatch != null) {
            val num = (groupMatch.groupValues[1].toIntOrNull() ?: 0) + 1
            return "grupo $num"
        }
        return OutcomeCatalog.GROUP_LABELS[lower] ?: name
    }

    /**
     * Campos "push_*" do JSON salvo em cima do que veio do formulario.
     *
     * A escrituracao do Forçar nao e campo de tela (ver
     * ProfileInput.isPushBookkeeping), entao o formulario SEMPRE volta
     * sem ela. Sem esta juncao, minimizar o painel depois de forcar
     * parecia "mudei os campos": o `lastRollAction` era invalidado e a
     * mini-bolha voltava a abrir o formulario em vez de repetir a
     * rolagem — o bug de sempre, so que entrando por uma porta nova.
     */
    fun mergePushBookkeeping(formJson: String, savedJson: String): String =
        runCatching {
            val merged = JSONObject(formJson)
            val saved = JSONObject(savedJson)
            for (key in saved.keys()) {
                if (key.startsWith("push_")) merged.put(key, saved.get(key))
            }
            merged.toString()
        }.getOrDefault(formJson)

    /** Mesmos pares chave/valor, independente da ordem das chaves. */
    fun sameInputs(a: String, b: String): Boolean =
        ProfileForm.fromJson(a) == ProfileForm.fromJson(b)

    /**
     * Tom do resultado pro overlay pintar falha de vermelho. JSON que nao
     * parseia, ou rolagem livre (sem profile, logo sem outcome), vale
     * neutro — nao ha o que afirmar.
     */
    fun toneOf(resultJson: String): OutcomeTone {
        val outcome = runCatching {
            JSONObject(resultJson).optString("outcome", "")
        }.getOrDefault("")
        return if (outcome.isEmpty()) OutcomeTone.NEUTRAL else outcomeTone(outcome)
    }

    /** Perfis Year Zero: pool de d6 onde o 6 e sucesso, sem total somavel. */
    private val YZE_PROFILES = listOf("yze", "yze_fbl", "yze_alien", "yze_wdu")

    /** Sub-notacao de cada grupo: "{2d6+mod} vs {2c}" -> ["2d6+mod", "2c"]. */
    private fun groupNotationsOf(notation: String): List<String> =
        Regex("""\{([^}]+)\}""").findAll(notation).map { it.groupValues[1] }.toList()

    /** Pools ja formatados, na ordem do JSON, mais a soma quando ela existe. */
    private data class GroupWalk(val groupStrings: List<String>, val grandTotal: Int?)

    /**
     * Percorre os grupos montando "perícia [6, 2] + 1 = 2" pra cada um.
     *
     * Era o mesmo bloco de ~70 linhas copiado em formatDisplayLines e em
     * formatResult; a unica diferenca real entre as duas leituras e a
     * semente do total (`seedTotal`) e o separador que o chamador escolhe
     * depois. Manter duas copias fazia cada correcao de exibicao (o "—" do
     * pool vazio, a carta que nao soma, o nome do pool) precisar ser feita
     * duas vezes — e a segunda era esquecida.
     *
     * `seedTotal` nulo = esta rolagem nao tem soma que faca sentido (vs,
     * pool de sucessos, ou desfecho ja resolvido pelo profile).
     */
    private fun walkGroups(
        resultJson: String,
        notation: String,
        groupsObj: JSONObject?,
        isVs: Boolean,
        seedTotal: Int?,
    ): GroupWalk {
        val groupStrings = mutableListOf<String>()
        var grandTotal: Int? = seedTotal
        if (groupsObj == null) return GroupWalk(groupStrings, grandTotal)

        val groupNotations = groupNotationsOf(notation)
        val groupKeys = orderedGroupKeys(resultJson, groupsObj)
        var totalCardIndex = 0

        for (gi in groupKeys.indices) {
            val groupKey = groupKeys[gi]
            val group = groupsObj.optJSONObject(groupKey) ?: continue
            val subNotation = groupNotations.getOrNull(gi) ?: notation
            val isCardGroup = Regex("""\b\d*c\b""").containsMatchIn(subNotation)
            val isFudgeGroup = Regex("""\b\d*dF\b""").containsMatchIn(subNotation)

            val rolls = group.optJSONArray("rolls")
            val rollsFormatted = if (rolls != null && rolls.length() > 0) {
                (0 until rolls.length()).joinToString(", ") { ri ->
                    val v = rolls.getInt(ri)
                    when {
                        isCardGroup -> cardFromRollValue(v, totalCardIndex++)
                        isFudgeGroup -> if (v > 0) "+" else if (v < 0) "−" else "0"
                        else -> v.toString()
                    }
                }
            } else ""

            val mod = if (group.has("modifier")) group.getInt("modifier") else 0
            val modText = if (mod > 0) " + $mod" else if (mod < 0) " − ${kotlin.math.abs(mod)}" else ""
            val total = if (group.has("total")) {
                group.getInt("total")
            } else if (!isVs && rolls != null && rolls.length() > 0 && !isCardGroup && !isFudgeGroup) {
                (0 until rolls.length()).sumOf { rolls.getInt(it) } + mod
            } else null
            val totalText = if (total != null && !isCardGroup) " = $total" else ""
            if (total != null && grandTotal != null) {
                grandTotal += total
            } else if (isCardGroup || isFudgeGroup) {
                grandTotal = null
            }

            val groupStr = buildString {
                // Tres pools de d6 iguais (Forbidden Lands) viravam tres
                // listas anonimas na mesma linha — sem o nome nao da pra
                // saber qual "= 1" veio de onde.
                if (groupKeys.size > 1) append("${groupLabel(groupKey)} ")
                if (rollsFormatted.isNotEmpty()) {
                    append("[$rollsFormatted]")
                } else {
                    // Pool de zero dados ("0d6"): existe, mas nao rolou
                    // nada. "[]" parecia bug.
                    append("—")
                }
                append(modText)
                append(totalText)
            }
            if (groupStr.isNotEmpty()) groupStrings.add(groupStr)
        }
        return GroupWalk(groupStrings, grandTotal)
    }

    /**
     * Sucessos do Vampiro v5: 6+ conta, e cada PAR de 10 (entre regulares e
     * fome/ira juntos) vale +2 de bonus critico. Nulo quando nao e wod5.
     */
    private fun wod5Successes(profile: String, groupsObj: JSONObject?): Int? {
        if (profile != "wod5" || groupsObj == null) return null
        val regRolls = groupsObj.optJSONObject("regular")?.optJSONArray("rolls")
        val hungRolls = groupsObj.optJSONObject("hunger")?.optJSONArray("rolls")
        var successes = 0
        var totalTens = 0
        for (arr in listOfNotNull(regRolls, hungRolls)) {
            for (i in 0 until arr.length()) {
                val v = arr.getInt(i)
                if (v >= 6) successes++
                if (v == 10) totalTens++
            }
        }
        return successes + (totalTens / 2) * 2
    }

    /** "Dificuldade: 2, Valor testado: 10" — nulo quando o profile nao testa nada. */
    private fun testedText(result: JSONObject): String? =
        result.optJSONArray("tested")?.let { arr ->
            (0 until arr.length()).joinToString(", ") { i ->
                val item = arr.getJSONObject(i)
                "${item.getString("label")}: ${item.get("value")}"
            }
        }

    /** Plural na mao: "1 sucesso" / "3 sucessos". */
    private fun successesLabel(n: Int): String = "$n ${if (n == 1) "sucesso" else "sucessos"}"

    /** As tres linhas que o cartao de resultado do overlay desenha. */
    data class ResultDisplayLines(
        val headline: String,
        val tested: String?,
        val detail: String?,
        val flags: List<Pair<String, String>>,
    )

    fun formatDisplayLines(resultJson: String): ResultDisplayLines {
        return try {
            val result = JSONObject(resultJson)
            val notation = result.optString("notation", "?")
            val groupsObj = result.optJSONObject("groups")
            val profile = result.optString("profile", "")

            val isVs = notation.contains(" vs ")
            val isYze = YZE_PROFILES.contains(profile)
            val joiner = if (isVs) " vs " else " • "

            // 1. Desfechos. Mais de uma flag pode bater na mesma rolagem
            // (Infaernum: varias categorias no mesmo 3d6).
            val flags = result.optJSONArray("outcome_flags")
            val rawOutcome = result.optString("outcome", "")
            val outcomeList = mutableListOf<Pair<String, String>>() // label to rawFlag
            if (flags != null && flags.length() > 0) {
                for (i in 0 until flags.length()) {
                    val f = flags.getString(i)
                    val label = outcomeLabel(f)
                    if (label.isNotEmpty() && outcomeList.none { it.first == label }) {
                        outcomeList.add(label to f)
                    }
                }
            } else if (rawOutcome.isNotEmpty()) {
                outcomeList.add(outcomeLabel(rawOutcome) to rawOutcome)
            }

            // 2. Pools. So soma quando a rolagem e livre: com desfecho, com
            // "vs" ou em pool de sucessos o total nao quer dizer nada.
            val seedTotal = if (!isVs && outcomeList.isEmpty() && !isYze) 0 else null
            val walk = walkGroups(resultJson, notation, groupsObj, isVs, seedTotal)
            val groupStrings = walk.groupStrings

            val yzeSuccesses = if (isYze && groupsObj != null && groupsObj.length() > 1) {
                orderedGroupKeys(resultJson, groupsObj)
                    .sumOf { groupsObj.optJSONObject(it)?.optInt("total", 0) ?: 0 }
            } else null
            val wod5 = wod5Successes(profile, groupsObj)
            val poolSuccesses = yzeSuccesses ?: wod5
            val tested = testedText(result)

            if (outcomeList.isNotEmpty()) {
                val outcomeStr = outcomeList.joinToString(", ") { it.first }
                val headline = if (wod5 != null) "$outcomeStr (${successesLabel(wod5)})" else outcomeStr
                val detail = if (groupStrings.isNotEmpty()) {
                    val isMultiNamedGroup = groupsObj != null && groupsObj.length() > 1
                    if (!isMultiNamedGroup) {
                        "$notation ${groupStrings.joinToString(joiner)}"
                    } else {
                        groupStrings.joinToString(joiner)
                    }
                } else null
                ResultDisplayLines(headline, tested, detail, outcomeList)
            } else if (poolSuccesses != null) {
                val detail = if (groupStrings.isNotEmpty()) groupStrings.joinToString(joiner) else null
                ResultDisplayLines(successesLabel(poolSuccesses), tested, detail, emptyList())
            } else if (isVs && groupStrings.size == 2) {
                val keys = orderedGroupKeys(resultJson, groupsObj ?: JSONObject())
                val t1 = groupsObj?.optJSONObject(keys.getOrNull(0) ?: "")?.optInt("total", 0) ?: 0
                val t2 = groupsObj?.optJSONObject(keys.getOrNull(1) ?: "")?.optInt("total", 0) ?: 0
                ResultDisplayLines("$t1 vs $t2", tested, groupStrings.joinToString(" vs "), emptyList())
            } else if (walk.grandTotal != null && groupStrings.isNotEmpty()) {
                val detail = if (groupStrings.size == 1 && (groupsObj?.length() ?: 0) == 1) {
                    "$notation ${groupStrings.first()}"
                } else {
                    groupStrings.joinToString(" + ")
                }
                ResultDisplayLines(walk.grandTotal.toString(), tested, detail, emptyList())
            } else {
                ResultDisplayLines(notation, tested, null, emptyList())
            }
        } catch (e: Exception) {
            ResultDisplayLines(resultJson.take(80), null, null, emptyList())
        }
    }

    /** Formata o resultado completo de rolagem, cobrindo todos os grupos
     *  (como `{2d6+1} vs {2c}` no Firelights ou `{1d6+2} vs {2d10}` no Ironsworn),
     *  valores de cartas e Fudge, e múltiplas flags de outcome. */
    fun formatResult(resultJson: String): String {
        return try {
            val result = JSONObject(resultJson)
            val notation = result.optString("notation", "?")
            val groupsObj = result.optJSONObject("groups")
            val profile = result.optString("profile", "")

            val isVs = notation.contains(" vs ")
            val isYze = YZE_PROFILES.contains(profile)
            val isWod5 = profile == "wod5"
            val joiner = if (isVs) " vs " else " + "

            // Mais de uma flag bateu (Infaernum: "1 milagre" + "2
            // desgraças" na mesma rolagem; Ironsworn: "strong_hit" +
            // "match"): mostra todas, juntas.
            val flags = result.optJSONArray("outcome_flags")
            val outcome = if (flags != null && flags.length() > 1) {
                (0 until flags.length()).joinToString(", ") { outcomeLabel(flags.getString(it)) }
            } else {
                result.optString("outcome", "").let { if (it.isEmpty()) it else outcomeLabel(it) }
            }

            val wod5 = wod5Successes(profile, groupsObj)
            val seedTotal = if (!isVs && outcome.isEmpty() && !isYze && !isWod5) 0 else null
            val walk = walkGroups(resultJson, notation, groupsObj, isVs, seedTotal)
            val groupStrings = walk.groupStrings

            val allGroupsText = buildString {
                append(groupStrings.joinToString(joiner))
                if (seedTotal != null && groupStrings.size > 1 && walk.grandTotal != null) {
                    append(" = ${walk.grandTotal}")
                }
            }

            val tested = testedText(result) ?: ""

            val finalOutcome = when {
                wod5 == null -> outcome
                outcome.isNotEmpty() -> "$outcome (${successesLabel(wod5)})"
                else -> successesLabel(wod5)
            }

            buildString {
                append(notation)
                if (allGroupsText.isNotEmpty()) append(" $allGroupsText")
                if (finalOutcome.isNotEmpty()) append(" — $finalOutcome")
                if (tested.isNotEmpty()) append(" ($tested)")
            }
        } catch (e: Exception) {
            resultJson.take(80)
        }
    }
}
