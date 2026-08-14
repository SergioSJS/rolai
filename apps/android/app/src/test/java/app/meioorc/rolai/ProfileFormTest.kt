package app.meioorc.rolai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.json.JSONObject

/**
 * Leitura do systems.json e a conversao dos valores da tela pro JSON que vai
 * ao motor. E o que substituiu o campo de JSON digitado a mao.
 */
class ProfileFormTest {

    private val d20 = """
        [{"system":"d20","label":"d20 — teste contra CD","inputs":[
          {"id":"mode","label":"Modo","type":"select","options":[
            {"value":"","label":"Normal"},
            {"value":"adv","label":"Vantagem"},
            {"value":"dis","label":"Desvantagem"}]},
          {"id":"mod","label":"Modificador","type":"number","options":[]},
          {"id":"dc","label":"CD","type":"number","options":[]}]}]
    """.trimIndent()

    @Test
    fun `le sistema, rotulos e opcoes do select`() {
        val systems = ProfileForm.parseSystems(d20)
        assertEquals(1, systems.size)
        val inputs = systems[0].inputs
        assertEquals(listOf("mode", "mod", "dc"), inputs.map { it.id })
        assertEquals("CD", inputs[2].label)
        assertTrue(inputs[0].isSelect)
        assertEquals(listOf("Normal", "Vantagem", "Desvantagem"), inputs[0].options.map { it.label })
        // Numerico nao vira seletor mesmo com a lista vazia presente.
        assertFalse(inputs[1].isSelect)
    }

    @Test
    fun `systems json ausente ou quebrado nao derruba a tela`() {
        assertEquals(emptyList<SystemInfo>(), ProfileForm.parseSystems(""))
        assertEquals(emptyList<SystemInfo>(), ProfileForm.parseSystems("nao e json"))
    }

    /**
     * O motivo de numero ir como numero: as `outcome_rules` comparam
     * (`roll.total >= {input.dc}`). Com "15" entre aspas viraria comparacao
     * de texto e a CD deixaria de valer.
     */
    @Test
    fun `numero vai como numero, select como texto`() {
        val inputs = ProfileForm.parseSystems(d20)[0].inputs
        val json = JSONObject(
            ProfileForm.toJson(mapOf("mode" to "adv", "mod" to "3", "dc" to "15"), inputs),
        )
        assertEquals(15, json.get("dc"))
        assertEquals(3, json.get("mod"))
        assertEquals("adv", json.get("mode"))
    }

    /** Campo numerico vazio some: o profile trata ausencia, mas nao trata "". */
    @Test
    fun `numero em branco fica de fora do json`() {
        val inputs = ProfileForm.parseSystems(d20)[0].inputs
        val json = JSONObject(ProfileForm.toJson(mapOf("mod" to "", "dc" to "15"), inputs))
        assertFalse(json.has("mod"))
        assertTrue(json.has("dc"))
    }

    /** "Normal" no d20 e string vazia — e uma escolha, nao um campo em branco. */
    @Test
    fun `select com valor vazio continua sendo escolha`() {
        val inputs = ProfileForm.parseSystems(d20)[0].inputs
        val json = JSONObject(ProfileForm.toJson(mapOf("mode" to ""), inputs))
        assertTrue(json.has("mode"))
        assertEquals("", json.get("mode"))
    }

    @Test
    fun `valores salvos voltam pra tela`() {
        assertEquals(
            mapOf("dc" to "15", "mode" to "adv"),
            ProfileForm.fromJson("""{"dc":15,"mode":"adv"}"""),
        )
    }

    /** JSON gravado a mao no campo antigo podia ter numero entre aspas. */
    @Test
    fun `aceita numero como texto vindo do campo antigo`() {
        assertEquals(mapOf("dc" to "15"), ProfileForm.fromJson("""{"dc":"15"}"""))
        assertEquals(emptyMap<String, String>(), ProfileForm.fromJson("lixo"))
    }

    @Test
    fun `sistema sem input nao precisa de formulario`() {
        val semInput = ProfileForm.parseSystems("""[{"system":"x","label":"X"}]""")
        assertFalse(semInput[0].needsForm)
    }

    /** rollType ausente vira "simple" — profiles antigos no systems.json (sem
     * o campo) continuam rolando por rollWithProfile normalmente. */
    @Test
    fun `rollType ausente vira simple, nao overlay`() {
        val semTipo = ProfileForm.parseSystems("""[{"system":"x","label":"X"}]""")
        assertFalse(semTipo[0].isOverlay)
    }

    /** roll_under: sem dado proprio — a rolagem vem do composer normal. */
    @Test
    fun `rollType overlay marca isOverlay`() {
        val overlay = ProfileForm.parseSystems(
            """[{"system":"roll_under","label":"Roll Under","rollType":"overlay","inputs":[
                {"id":"target","label":"Valor testado","type":"number","options":[]}]}]""",
        )
        assertTrue(overlay[0].isOverlay)
    }

    /** default e so hint de UI: pre-preenche o campo sem mudar obrigatoriedade. */
    @Test
    fun `input com default vem preenchido`() {
        val comDefault = ProfileForm.parseSystems(
            """[{"system":"pbta","label":"PbtA","inputs":[
                {"id":"mod","label":"Modificador","type":"number","options":[],"default":"0"}]}]""",
        )
        assertEquals("0", comDefault[0].inputs[0].default)
    }

    @Test
    fun `input sem default fica nulo`() {
        val semDefault = ProfileForm.parseSystems(d20)
        assertEquals(null, semDefault[0].inputs[1].default)
    }
}
