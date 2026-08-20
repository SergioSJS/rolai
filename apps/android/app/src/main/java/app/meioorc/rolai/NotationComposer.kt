package app.meioorc.rolai

/**
 * Montagem da notação pelos chips de dado do overlay — `String -> String`.
 *
 * Vivia dentro da OverlayView, que é 1100 linhas de construção de UI a 0% de
 * cobertura. Não toca em View nenhuma: estava lá só porque nasceu lá. É a
 * mesma extração que `RichTextPlan` recebeu, pelo mesmo motivo — a versão
 * 1.2.0 corrigiu "compositor apagava notação de slot ao clicar botão de dado
 * (1[d20])" sem deixar nada que impeça a volta.
 *
 * O que a notação pode ser, e por isso os quatro casos de [addDie]:
 *  - vazia;
 *  - expressão simples: `2d6+1d4`;
 *  - com slot de cor: `1[2d6] + 2[1d20]` (o número antes do `[` é o slot);
 *  - com grupo: `{2d6} vs {1d20}`;
 *  - a meio caminho: `1[`, `2d6 +`, `{2d6} vs {`.
 */
object NotationComposer {

    /** Rótulo de um dado novo: "C" = carta, "F" = Fudge. */
    private fun label(key: String): String = when (key) {
        "C" -> "1c"
        "F" -> "1dF"
        else -> "1d$key"
    }

    /** Como aquele tipo de dado aparece na notação, pra contar e substituir. */
    private fun padrao(key: String): Regex = when (key) {
        "C" -> Regex("""(\d+)c\b""", RegexOption.IGNORE_CASE)
        "F" -> Regex("""(\d+)dF\b""", RegexOption.IGNORE_CASE)
        else -> Regex("""(\d+)d$key\b""", RegexOption.IGNORE_CASE)
    }

    private fun comContagem(key: String, n: Int): String = when (key) {
        "C" -> "${n}c"
        "F" -> "${n}dF"
        else -> "${n}d$key"
    }

    /**
     * Soma um dado à notação, respeitando onde o cursor conceitualmente está.
     *
     * O caso que quebrou antes é o 2: com `1[2d6]` na tela, um toque no d6
     * precisa virar `1[3d6]` — e não substituir a notação inteira por `1d6`,
     * que era o que apagava o slot.
     */
    fun addDie(notation: String, key: String): String {
        val trimmed = notation.trim()
        if (trimmed.isEmpty()) return label(key)

        // 1. Slot ou grupo ABERTO no fim: "1[", "2d6 + 3[", "{2d6} vs {"
        val aberto = Regex("""^(.*(?:\b[123]\[|\{))\s*$""").find(trimmed)
        if (aberto != null) {
            val prefixo = aberto.groupValues[1]
            val fecha = if (prefixo.endsWith("{")) "}" else "]"
            return "$prefixo${label(key)}$fecha"
        }

        // 2. Bloco de slot FECHADO no fim: "1[2d6]" -> soma DENTRO dele.
        val bloco = Regex("""^(.*?\b[123]\[)([^\]]*?)(\])\s*$""").find(trimmed)
        if (bloco != null) {
            val (prefixo, dentro, fecha) = bloco.destructured
            return "$prefixo${addDieToSimpleExpression(dentro.trim(), key)}$fecha"
        }

        // 3. Operador pendente: "2d6 +", "2d6+", "... vs"
        val operadorPendente = Regex("""[+\-*/]\s*$""").containsMatchIn(trimmed) ||
            Regex("""\bvs\s*$""", RegexOption.IGNORE_CASE).containsMatchIn(trimmed)
        if (operadorPendente) {
            val espaco = if (trimmed.endsWith(" ")) "" else " "
            return "$trimmed$espaco${label(key)}"
        }

        // 4. Expressão normal.
        return addDieToSimpleExpression(trimmed, key)
    }

    /** Remove um dado. Zerou o slot, o slot inteiro sai junto. */
    fun removeDie(notation: String, key: String): String {
        val trimmed = notation.trim()
        if (trimmed.isEmpty()) return ""

        val bloco = Regex("""^(.*?\b[123]\[)([^\]]*?)(\])\s*$""").find(trimmed)
        if (bloco != null) {
            val (prefixo, dentro, fecha) = bloco.destructured
            val atualizado = removeDieFromSimpleExpression(dentro.trim(), key)
            if (atualizado.isEmpty()) {
                // Slot vazio não fica na tela como "1[]".
                return prefixo.replace(Regex("""\b[123]\[$"""), "").trim().removeSuffix("+").trim()
            }
            return "$prefixo$atualizado$fecha"
        }
        return removeDieFromSimpleExpression(trimmed, key)
    }

    /**
     * Quantos dados de cada tipo a notação tem — o que o chip mostra no
     * rótulo e usa pra saber se está aceso.
     *
     * Soma todas as ocorrências: em `1[2d6] + 2[3d6]` o d6 conta 5.
     */
    fun countsByKey(notation: String, keys: List<String>): Map<String, Int> =
        keys.associateWith { key ->
            padrao(key).findAll(notation).sumOf { it.groupValues[1].toIntOrNull() ?: 1 }
        }

    /** Soma dentro de uma expressão sem slot nem grupo. */
    private fun addDieToSimpleExpression(expr: String, key: String): String {
        val padrao = padrao(key)
        val achado = padrao.find(expr)
        if (achado != null) {
            val n = (achado.groupValues[1].toIntOrNull() ?: 1) + 1
            return expr.replaceFirst(padrao, comContagem(key, n))
        }
        if (expr.isEmpty()) return label(key)
        return "$expr+${label(key)}"
    }

    /** Idem, removendo. Chegou a zero, o termo some e a soma é remendada. */
    private fun removeDieFromSimpleExpression(expr: String, key: String): String {
        val padrao = padrao(key)
        val achado = padrao.find(expr) ?: return expr
        val n = achado.groupValues[1].toIntOrNull() ?: 1
        if (n > 1) return expr.replaceFirst(padrao, comContagem(key, n - 1))
        return expr.replaceFirst(padrao, "")
            .replace("++", "+")
            .trim()
            .removePrefix("+")
            .removeSuffix("+")
            .trim()
    }
}
