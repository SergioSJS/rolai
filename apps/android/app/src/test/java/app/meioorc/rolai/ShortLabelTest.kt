package app.meioorc.rolai

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Nome curto do sistema na aba do overlay. O painel tem 300dp: label inteiro
 * empurra a aba pra fora e quebra palavra no meio — foi o que aconteceu
 * quando o Year Zero chegou com quatro modos.
 *
 * Vivia `private` na OverlayView, a 0%.
 */
class ShortLabelTest {

    @Test
    fun `familia manda, com o shortLabel dela`() {
        assertEquals("YZ", ProfileFamilies.shortLabelFor("yze_fbl", "Year Zero — Forbidden Lands"))
        assertEquals("YZ", ProfileFamilies.shortLabelFor("yze", "Year Zero"))
        assertEquals("Infaernum", ProfileFamilies.shortLabelFor("infaernum_ideias", "Infaernum — Ideias"))
    }

    @Test
    fun `apelidos que a mesa usa`() {
        assertEquals("WoD v5", ProfileFamilies.shortLabelFor("wod5", "Vampiro / World of Darkness v5"))
        assertEquals("PbtA", ProfileFamilies.shortLabelFor("pbta", "Powered by the Apocalypse"))
        assertEquals("PbtA", ProfileFamilies.shortLabelFor("pbta2d10", "PbtA com 2d10"))
        assertEquals("Roll Under", ProfileFamilies.shortLabelFor("roll_under", "Roll Under (d20)"))
    }

    @Test
    fun `sistema novo cai no label cortado no separador`() {
        // Cobre quem nunca foi cadastrado — ninguém precisa lembrar de vir
        // aqui ao adicionar um sistema.
        assertEquals("Sistema X", ProfileFamilies.shortLabelFor("novo", "Sistema X — variante longa"))
        assertEquals("Sistema X", ProfileFamilies.shortLabelFor("novo", "Sistema X - variante"))
        assertEquals("Sistema X", ProfileFamilies.shortLabelFor("novo", "Sistema X (2d6)"))
    }

    @Test
    fun `label curto passa inteiro`() {
        assertEquals("Fitd", ProfileFamilies.shortLabelFor("fitd", "Fitd"))
    }
}
