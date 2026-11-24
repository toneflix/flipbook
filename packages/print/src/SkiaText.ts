import type { FontSpec, TextMeasure, TextMetrics } from '@toneflix/flipbook-core'
import { Canvas, type CanvasRenderingContext2D } from 'skia-canvas'
import { PrintFonts } from './fonts'

/** Measures text with Skia, in page units, so scenes break lines where Skia will draw them. */
export class SkiaText implements TextMeasure {
  private readonly ctx: CanvasRenderingContext2D
  private readonly scale = PrintFonts.CSS_PX_PER_UNIT

  constructor(readonly fonts: PrintFonts) {
    this.ctx = new Canvas(8, 8).getContext('2d')
  }

  measure(text: string, font: FontSpec): TextMetrics {
    this.ctx.font = this.fonts.font(font, this.scale)
    this.ctx.fontVariationSettings = this.fonts.variations(font)

    const metrics = this.ctx.measureText(text)

    return {
      width: metrics.width / this.scale,
      ascent: metrics.fontBoundingBoxAscent / this.scale,
      descent: metrics.fontBoundingBoxDescent / this.scale,
    }
  }
}
