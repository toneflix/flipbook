import { pageSize, type PageSize } from './shape'

/** Line art for the cover designs, as SVG path data, shared by every renderer. */
export interface CoverArt {
  viewBox: string
  /** Paths drawn as lines, with their stroke width in view box units. */
  strokes: { d: string; width: number; opacity?: number }[]
  /** Paths filled with the ink. */
  fills: string[]
}

/** A gilt corner flourish for the top left corner. Mirror it for the others. */
export const FLEURON: CoverArt = {
  viewBox: '0 0 40 40',
  strokes: [
    { d: 'M3 37V12Q3 3 12 3H37', width: 1 },
    { d: 'M7 37V16Q7 7 16 7H37', width: 0.6 },
    { d: 'M12 12C16 10 20 12 20 16C20 19 17 20 15.5 18.5', width: 0.8 },
  ],
  fills: [
    'M16 7C18 10 21 11 24 10C22 8 19 7 16 7Z',
    'M7 16C10 18 11 21 10 24C8 22 7 19 7 16Z',
    'M10.7 12a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0Z',
  ],
}

const RAY_COUNT = 17

/** The height of the band under the deco arch that holds the title, in page units. */
export function decoTitleBand(size: PageSize): number {
  return Math.min(45 + 1 / 3, size.height * 0.34)
}

/**
 * Art deco rays fanning up behind the photo, aimed at the foot of the cover, inside a notched double
 * frame. Rays stop above the title band so they never cross the title.
 */
export function decoArt(size: PageSize = pageSize()): CoverArt {
  const { width: w, height: h } = size
  const foot = { x: w / 2, y: h - 9 - 1 / 3 }
  const end = h - decoTitleBand(size)
  const t = (foot.y - end) / (foot.y - 16)
  const n = (v: number) => Number(v.toFixed(2))

  return {
    viewBox: `0 0 ${n(w)} ${n(h)}`,
    strokes: [
      ...Array.from({ length: RAY_COUNT }, (_, i) => {
        const x = 12 + (i / (RAY_COUNT - 1)) * (w - 24)
        const endX = foot.x + (x - foot.x) * t

        return { d: `M${endX.toFixed(2)} ${n(end)}L${x.toFixed(2)} 16`, width: 0.25, opacity: 0.3 }
      }),
      { d: `M5 5H${n(w - 5)}V${n(h - 5)}H5Z`, width: 0.5 },
      { d: `M11 8H${n(w - 11)}L${n(w - 8)} 11V${n(h - 11)}L${n(w - 11)} ${n(h - 8)}H11L8 ${n(h - 11)}V11Z`, width: 0.35 },
    ],
    fills: [
      `M${n(w / 2)} 8.5L${n(w / 2 + 2)} 11L${n(w / 2)} 13.5L${n(w / 2 - 2)} 11Z`,
      `M${n(w / 2)} ${n(h - 13.5)}L${n(w / 2 + 2)} ${n(h - 11)}L${n(w / 2)} ${n(h - 8.5)}L${n(w / 2 - 2)} ${n(h - 11)}Z`,
    ],
  }
}

/** The deco art on a portrait cover. */
export const DECO: CoverArt = decoArt()

/** Where the tipped-in print sits on a cover wider than tall, and where the title label beside it goes. */
export function printBeside(size: PageSize, withLabel: boolean) {
  const width = Math.min(68, (size.width - 24) / 2)
  const height = (width * 62) / 68

  return {
    print: { x: withLabel ? 10 : (size.width - width) / 2, y: (size.height - height) / 2, width, height },
    label: { x: 16 + width, width: Math.min(64, size.width - 26 - width) },
  }
}
