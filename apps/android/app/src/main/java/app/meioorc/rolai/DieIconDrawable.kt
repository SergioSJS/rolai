package app.meioorc.rolai

import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.drawable.Drawable

/**
 * Desenha os icones geometricos dos dados (e carta de baralho) em Canvas/Vector.
 * Espelha as silhuetas SVG de DiceIcon.tsx da web.
 */
class DieIconDrawable(
    private val key: String,
    private val strokeColor: Int,
    private val density: Float,
) : Drawable() {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = strokeColor
        style = Paint.Style.STROKE
        strokeWidth = 1.4f * density
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = strokeColor
        style = Paint.Style.FILL
    }
    private val path = Path()

    override fun draw(canvas: Canvas) {
        val b = bounds
        val w = b.width().toFloat()
        val h = b.height().toFloat()
        if (w <= 0 || h <= 0) return

        val cx = b.left + w / 2f
        val cy = b.top + h / 2f
        val s = minOf(w, h) * 0.76f

        path.reset()
        when (key) {
            "2" -> {
                // Moeda: circulo com divisoria vertical
                canvas.drawCircle(cx, cy, s * 0.44f, paint)
                canvas.drawLine(cx, cy - s * 0.32f, cx, cy + s * 0.32f, paint)
            }
            "3" -> {
                // Prisma: triangulo com aresta central
                path.moveTo(cx, cy - s * 0.44f)
                path.lineTo(cx + s * 0.44f, cy + s * 0.4f)
                path.lineTo(cx - s * 0.44f, cy + s * 0.4f)
                path.close()
                canvas.drawPath(path, paint)
                canvas.drawLine(cx, cy - s * 0.44f, cx, cy + s * 0.4f, paint)
            }
            "4" -> {
                // Triangulo (d4)
                path.moveTo(cx, cy - s * 0.44f)
                path.lineTo(cx + s * 0.44f, cy + s * 0.4f)
                path.lineTo(cx - s * 0.44f, cy + s * 0.4f)
                path.close()
                canvas.drawPath(path, paint)
            }
            "6" -> {
                // Quadrado / Cubo (d6)
                val r = s * 0.40f
                val rect = RectF(cx - r, cy - r, cx + r, cy + r)
                canvas.drawRoundRect(rect, 2.5f * density, 2.5f * density, paint)
            }
            "8" -> {
                // Losango / Octaedro (d8)
                path.moveTo(cx, cy - s * 0.46f)
                path.lineTo(cx + s * 0.44f, cy)
                path.lineTo(cx, cy + s * 0.46f)
                path.lineTo(cx - s * 0.44f, cy)
                path.close()
                canvas.drawPath(path, paint)
            }
            "10" -> {
                // Pipa / Kite (d10)
                path.moveTo(cx, cy - s * 0.46f)
                path.lineTo(cx + s * 0.42f, cy - s * 0.12f)
                path.lineTo(cx, cy + s * 0.46f)
                path.lineTo(cx - s * 0.42f, cy - s * 0.12f)
                path.close()
                canvas.drawPath(path, paint)
            }
            "12" -> {
                // Pentagono / Dodecaedro (d12)
                for (i in 0 until 5) {
                    val angle = Math.toRadians((i * 72 - 90).toDouble())
                    val px = cx + (s * 0.44f * Math.cos(angle)).toFloat()
                    val py = cy + (s * 0.44f * Math.sin(angle)).toFloat()
                    if (i == 0) path.moveTo(px, py) else path.lineTo(px, py)
                }
                path.close()
                canvas.drawPath(path, paint)
            }
            "20" -> {
                // Hexagono / Icosaedro (d20)
                for (i in 0 until 6) {
                    val angle = Math.toRadians((i * 60 - 30).toDouble())
                    val px = cx + (s * 0.44f * Math.cos(angle)).toFloat()
                    val py = cy + (s * 0.44f * Math.sin(angle)).toFloat()
                    if (i == 0) path.moveTo(px, py) else path.lineTo(px, py)
                }
                path.close()
                canvas.drawPath(path, paint)
            }
            "66" -> {
                // Par de d6 (d66: dezena e unidade)
                val rect1 = RectF(cx - s * 0.44f, cy - s * 0.42f, cx + s * 0.04f, cy + s * 0.06f)
                val rect2 = RectF(cx - s * 0.04f, cy - s * 0.06f, cx + s * 0.44f, cy + s * 0.42f)
                canvas.drawRoundRect(rect1, 2f * density, 2f * density, paint)
                canvas.drawRoundRect(rect2, 2f * density, 2f * density, paint)
            }
            "100" -> {
                // Par de percentis (d100)
                val r1 = s * 0.26f
                val ox1 = cx - s * 0.22f
                val oy1 = cy - s * 0.10f
                path.moveTo(ox1, oy1 - r1)
                path.lineTo(ox1 + r1 * 0.8f, oy1)
                path.lineTo(ox1, oy1 + r1)
                path.lineTo(ox1 - r1 * 0.8f, oy1)
                path.close()
                val ox2 = cx + s * 0.22f
                val oy2 = cy + s * 0.10f
                path.moveTo(ox2, oy2 - r1)
                path.lineTo(ox2 + r1 * 0.8f, oy2)
                path.lineTo(ox2, oy2 + r1)
                path.lineTo(ox2 - r1 * 0.8f, oy2)
                path.close()
                canvas.drawPath(path, paint)
            }
            "F" -> {
                // Cubo com + e - (dF)
                val r = s * 0.40f
                val rect = RectF(cx - r, cy - r, cx + r, cy + r)
                canvas.drawRoundRect(rect, 2.5f * density, 2.5f * density, paint)
                canvas.drawLine(cx - s * 0.20f, cy - s * 0.12f, cx - s * 0.08f, cy - s * 0.12f, paint)
                canvas.drawLine(cx - s * 0.14f, cy - s * 0.18f, cx - s * 0.14f, cy - s * 0.06f, paint)
                canvas.drawLine(cx + s * 0.08f, cy + s * 0.12f, cx + s * 0.20f, cy + s * 0.12f, paint)
            }
            "C" -> {
                // Carta de baralho
                val rw = s * 0.36f
                val rh = s * 0.46f
                val rect = RectF(cx - rw, cy - rh, cx + rw, cy + rh)
                canvas.drawRoundRect(rect, 2.5f * density, 2.5f * density, paint)
                val cr = s * 0.13f
                path.moveTo(cx, cy - cr)
                path.lineTo(cx + cr * 0.8f, cy)
                path.lineTo(cx, cy + cr)
                path.lineTo(cx - cr * 0.8f, cy)
                path.close()
                canvas.drawPath(path, fillPaint)
            }
        }
    }

    override fun setAlpha(alpha: Int) {
        paint.alpha = alpha
        fillPaint.alpha = alpha
    }

    override fun setColorFilter(colorFilter: ColorFilter?) {
        paint.colorFilter = colorFilter
        fillPaint.colorFilter = colorFilter
    }

    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
    override fun getIntrinsicWidth(): Int = (22 * density).toInt()
    override fun getIntrinsicHeight(): Int = (22 * density).toInt()
}
