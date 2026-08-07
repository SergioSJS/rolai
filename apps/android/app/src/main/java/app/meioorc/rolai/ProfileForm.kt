package app.meioorc.rolai

import org.json.JSONArray
import org.json.JSONObject

/**
 * Inputs de um sistema (CD, modificador, vantagem...) lidos de
 * `assets/headless/systems.json`, que e gerado pelo bundle do motor
 * (`apps/web/scripts/install-headless.mjs`).
 *
 * Existe porque antes o app pedia o JSON CRU desses valores num campo de
 * texto da tela de configuracoes (`{"mod": 3, "dc": 15}`): pra mudar a CD de
 * um teste era preciso sair do jogo, abrir o app, rolar ate "Rolagem rapida",
 * digitar JSON e voltar. Com o spec dos inputs aqui, tela e overlay montam
 * formulario de verdade.
 *
 * Nao ha regra nenhuma neste arquivo: os campos vem do profile e os valores
 * vao inteiros pro motor na WebView headless (AGENTS.md).
 */
data class ProfileOption(val value: String, val label: String)

data class ProfileInput(
    val id: String,
    val label: String,
    val type: String,
    val options: List<ProfileOption>,
) {
    val isSelect: Boolean get() = type == "select" && options.isNotEmpty()
}

data class SystemInfo(
    val system: String,
    val label: String,
    val inputs: List<ProfileInput>,
) {
    /** Sistema sem input nenhum rola direto — nao ha o que perguntar. */
    val needsForm: Boolean get() = inputs.isNotEmpty()
}

object ProfileForm {

    /** Le o systems.json. Arquivo ausente ou corrompido vira lista vazia. */
    fun parseSystems(json: String): List<SystemInfo> {
        val array = runCatching { JSONArray(json) }.getOrNull() ?: return emptyList()
        return buildList {
            for (i in 0 until array.length()) {
                val system = array.optJSONObject(i) ?: continue
                val id = system.optString("system")
                if (id.isEmpty()) continue
                add(
                    SystemInfo(
                        system = id,
                        label = system.optString("label", id),
                        inputs = parseInputs(system.optJSONArray("inputs")),
                    ),
                )
            }
        }
    }

    private fun parseInputs(array: JSONArray?): List<ProfileInput> {
        if (array == null) return emptyList()
        return buildList {
            for (i in 0 until array.length()) {
                val input = array.optJSONObject(i) ?: continue
                val id = input.optString("id")
                if (id.isEmpty()) continue
                add(
                    ProfileInput(
                        id = id,
                        label = input.optString("label", id),
                        type = input.optString("type", "number"),
                        options = parseOptions(input.optJSONArray("options")),
                    ),
                )
            }
        }
    }

    private fun parseOptions(array: JSONArray?): List<ProfileOption> {
        if (array == null) return emptyList()
        return buildList {
            for (i in 0 until array.length()) {
                val option = array.optJSONObject(i) ?: continue
                val value = option.optString("value")
                add(ProfileOption(value, option.optString("label", value)))
            }
        }
    }

    /**
     * Valores da tela -> JSON pro motor.
     *
     * Numero vai como NUMERO, nao como texto: as `outcome_rules` do profile
     * comparam (`roll.total >= {input.dc}`), e "15" entre aspas viraria
     * comparacao de string. Campo numerico vazio some do JSON — o profile
     * trata a ausencia; mandar `""` quebraria a conta.
     */
    fun toJson(values: Map<String, String>, inputs: List<ProfileInput>): String {
        val json = JSONObject()
        for (input in inputs) {
            val raw = values[input.id]?.trim().orEmpty()
            if (input.isSelect) {
                // Select com valor vazio E uma escolha valida (d20: "Normal").
                json.put(input.id, raw)
            } else {
                val numero = raw.toIntOrNull() ?: raw.toDoubleOrNull()
                if (numero != null) json.put(input.id, numero)
            }
        }
        return json.toString()
    }

    /**
     * JSON salvo -> valores pra preencher a tela. Aceita numero ou string
     * (o campo antigo era digitado a mao, entao ha JSON com `"dc": "15"`
     * gravado por ai).
     */
    fun fromJson(json: String): Map<String, String> {
        val obj = runCatching { JSONObject(json) }.getOrNull() ?: return emptyMap()
        return buildMap {
            for (key in obj.keys()) {
                put(key, obj.opt(key)?.toString().orEmpty())
            }
        }
    }
}
