import type { FontSpec, TextLine, TextMeasure } from './types'

export interface TextSetting {
  /** The widest a line may run, in page units. */
  width: number
  /** Line height as a multiple of the font size. Left out, lines are as tall as the font's ascent and descent. */
  lineHeight?: number
  /** `balance` evens out line lengths, like CSS `text-wrap: balance`. */
  wrap?: 'greedy' | 'balance'
}

/** Text broken into lines, ready to place. */
export class TextBlock {
  constructor(
    readonly lines: string[],
    readonly font: FontSpec,
    readonly lineHeight: number,
    /** From the top of a line box to its baseline. */
    readonly baseline: number,
  ) {}

  get height(): number {
    return this.lines.length * this.lineHeight
  }

  /** The lines set in a box `width` wide whose top is at `y`. */
  place(x: number, y: number, width: number, align: TextLine['align']): TextLine[] {
    const at = align === 'center' ? x + width / 2 : align === 'right' ? x + width : x

    return this.lines.map((text, i) => ({ text, x: at, y: y + i * this.lineHeight + this.baseline, align }))
  }
}

/** Breaks text into lines with the renderer's own measurements, the way a browser lays out a paragraph. */
export class Typesetter {
  constructor(readonly measure: TextMeasure) {}

  /** How wide a run of text is, letter spacing included. */
  width(text: string, font: FontSpec): number {
    return this.measure.measure(text, font).width + (font.letterSpacing ?? 0) * [...text].length
  }

  set(text: string, font: FontSpec, { width, lineHeight, wrap = 'greedy' }: TextSetting): TextBlock {
    const { ascent, descent } = this.measure.measure('Hg', font)
    const words = text.trim().split(/\s+/).filter(Boolean)
    const greedy = this.wrap(words, font, width)
    const lines = wrap === 'balance' && greedy.length > 1 ? this.balance(words, font, width, greedy.length) : greedy
    const height = lineHeight ? lineHeight * font.size : ascent + descent

    return new TextBlock(lines, font, height, (height - ascent - descent) / 2 + ascent)
  }

  private wrap(words: string[], font: FontSpec, width: number): string[] {
    const lines: string[] = []
    let line = ''

    for (const word of words) {
      const next = line ? `${line} ${word}` : word

      if (line && this.width(next, font) > width) {
        lines.push(line)
        line = word
      } else line = next
    }

    return line ? [...lines, line] : lines
  }

  /** The narrowest wrap that still takes `count` lines. */
  private balance(words: string[], font: FontSpec, width: number, count: number): string[] {
    let low = 0
    let high = width

    for (let i = 0; i < 16; i++) {
      const mid = (low + high) / 2

      if (this.wrap(words, font, mid).length > count) low = mid
      else high = mid
    }

    return this.wrap(words, font, high)
  }
}
