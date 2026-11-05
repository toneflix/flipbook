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

/** Rays aim at the foot of the cover but stop at the arch, so they never cross the title. */
const RAY_FOOT = { x: 50, y: 124 }
const RAY_END = 88

/** Art deco rays fanning up behind the photo, aimed at the foot of a 100 × 133⅓ cover, inside a notched double frame. */
export const DECO: CoverArt = {
  viewBox: '0 0 100 133.33',
  strokes: [
    ...Array.from({ length: RAY_COUNT }, (_, i) => {
      const x = 12 + (i / (RAY_COUNT - 1)) * 76
      const t = (RAY_FOOT.y - RAY_END) / (RAY_FOOT.y - 16)
      const endX = RAY_FOOT.x + (x - RAY_FOOT.x) * t

      return { d: `M${endX.toFixed(2)} ${RAY_END}L${x.toFixed(2)} 16`, width: 0.25, opacity: 0.3 }
    }),
    { d: 'M5 5H95V128.33H5Z', width: 0.5 },
    { d: 'M11 8H89L92 11V122.33L89 125.33H11L8 122.33V11Z', width: 0.35 },
  ],
  fills: ['M50 8.5L52 11L50 13.5L48 11Z', 'M50 119.83L52 122.33L50 124.83L48 122.33Z'],
}
