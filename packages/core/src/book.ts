/**
 * How photos are set on a page.
 * - single: one photo printed to the edges, caption over it.
 * - framed: one photo on a mat with its caption below.
 * - pair: two photos stacked.
 * - grid: up to four photos in a 2×2 grid.
 * - collage: one large photo over two smaller ones.
 * - text: no photos, just the caption set as a page of writing.
 * - triptych: three tall photos side by side.
 * - mosaic: one tall photo beside two smaller ones.
 * - strip: three wide photos stacked like a film strip.
 * - contact: six photos in a contact sheet.
 * - scatter: three loose prints dropped on the page at an angle.
 * - story: one photo over a paragraph of writing.
 */
export type PageLayout =
  'single' | 'framed' | 'pair' | 'grid' | 'collage' | 'text' | 'triptych' | 'mosaic' | 'strip' | 'contact' | 'scatter' | 'story'

export const PAGE_LAYOUTS: Record<PageLayout, { label: string; slots: number }> = {
  single: { label: 'Full bleed', slots: 1 },
  framed: { label: 'Framed', slots: 1 },
  pair: { label: 'Pair', slots: 2 },
  grid: { label: 'Grid', slots: 4 },
  collage: { label: 'Collage', slots: 3 },
  text: { label: 'Words', slots: 0 },
  triptych: { label: 'Triptych', slots: 3 },
  mosaic: { label: 'Mosaic', slots: 3 },
  strip: { label: 'Film strip', slots: 3 },
  contact: { label: 'Contact sheet', slots: 6 },
  scatter: { label: 'Loose prints', slots: 3 },
  story: { label: 'Story', slots: 1 },
}

/**
 * A box on a page in page units: 1 unit is 1% of the page width, so a 3:4 page is 100 × 133⅓.
 * `rotate` is in degrees.
 */
export interface PageBox {
  x: number
  y: number
  width: number
  height: number
  rotate?: number
}

export interface PlacedLayout {
  slots: PageBox[]
  caption: PageBox
  /** Set the caption as a paragraph of writing instead of a short italic line. */
  prose?: boolean
  /** Photos are loose prints that cast a shadow on the page. */
  loose?: boolean
}

const column = (x: number, width: number, count: number, top = 7, height = 108, gap = 3) => {
  const each = (height - gap * (count - 1)) / count

  return Array.from({ length: count }, (_, i) => ({ x, y: top + i * (each + gap), width, height: each }))
}

const BELOW: PageBox = { x: 7, y: 118, width: 86, height: 10 }

/** Layouts drawn from fixed boxes, which every renderer places the same way. */
export const PLACED_LAYOUTS: Partial<Record<PageLayout, PlacedLayout>> = {
  triptych: {
    slots: [7, 36.67, 66.33].map((x) => ({ x, y: 14, width: 26.67, height: 94 })),
    caption: { ...BELOW, y: 114 },
  },
  mosaic: {
    slots: [{ x: 7, y: 7, width: 51, height: 108 }, ...column(61, 32, 2)],
    caption: BELOW,
  },
  strip: { slots: column(7, 86, 3), caption: BELOW },
  contact: {
    slots: column(7, 41.5, 3).flatMap((left, row) => [left, column(51.5, 41.5, 3)[row]]),
    caption: BELOW,
  },
  scatter: {
    slots: [
      { x: 9, y: 9, width: 54, height: 41, rotate: -4 },
      { x: 38, y: 43, width: 54, height: 41, rotate: 3 },
      { x: 11, y: 80, width: 48, height: 35, rotate: -2 },
    ],
    caption: { ...BELOW, x: 63, y: 92, width: 30, height: 28 },
    loose: true,
  },
  story: {
    slots: [{ x: 7, y: 7, width: 86, height: 66 }],
    caption: { x: 9, y: 80, width: 82, height: 45 },
    prose: true,
  },
}

/** The cloth of the cover, which also tints the stage behind the book. */
export type CoverTheme = 'classic' | 'linen' | 'midnight'

export const COVER_THEMES: Record<CoverTheme, { label: string; cloth: string; ink: string; stage: [string, string, string] }> = {
  classic: { label: 'Classic', cloth: '#5a1d22', ink: '#e2c58f', stage: ['#4a2a27', '#22140f', '#0d0807'] },
  linen: { label: 'Linen', cloth: '#e6dcc6', ink: '#3d3226', stage: ['#4a4134', '#241f18', '#0e0c09'] },
  midnight: { label: 'Midnight', cloth: '#141b2e', ink: '#d5dbe8', stage: ['#27324d', '#121827', '#07090f'] },
}

/** The colour of the pages inside a book. */
export type PaperColor = 'ivory' | 'white' | 'kraft' | 'charcoal'

export const PAPER_COLORS: Record<PaperColor, { label: string; swatch: string }> = {
  ivory: { label: 'Ivory', swatch: '#fbf8f1' },
  white: { label: 'White', swatch: '#ffffff' },
  kraft: { label: 'Kraft', swatch: '#d8c4a2' },
  charcoal: { label: 'Charcoal', swatch: '#2a2826' },
}

/** How a photo is set on its page. Every style is printed into the paper, never raised off it. */
export type FrameStyle =
  | 'none'
  | 'hairline'
  | 'double'
  | 'mat'
  | 'corners'
  | 'deckle'
  | 'plate'
  | 'feather'
  | 'oval'
  | 'botanical'
  | 'watercolor'
  | 'arcs'
  | 'gilt'
  | 'woodgrain'

export const FRAME_STYLES: Record<FrameStyle, { label: string; description: string }> = {
  none: { label: 'Plain', description: 'The photo printed straight onto the page' },
  hairline: { label: 'Hairline', description: 'A fine printed rule around the photo' },
  double: { label: 'Double rule', description: 'Two printed rules, like a classic album keyline' },
  mat: { label: 'Gallery mat', description: 'A wide printed mat with a thin frame line' },
  corners: { label: 'Photo corners', description: 'Printed album corners holding the photo' },
  deckle: { label: 'Deckled edge', description: 'A vintage print with a scalloped border' },
  plate: { label: 'Plate mark', description: 'The photo sits in a plate pressed into the paper' },
  feather: { label: 'Soft edge', description: 'The photo fades into the paper at its edges' },
  oval: { label: 'Oval', description: 'An oval cameo inside a fine printed ring' },
  botanical: { label: 'Botanical', description: 'Line-drawn sprigs of leaves around a fine rule' },
  watercolor: { label: 'Watercolour', description: 'A wash of soft colour printed around a mat' },
  arcs: { label: 'Rainbow arcs', description: 'A printed border of little rainbow arcs around a mat' },
  gilt: { label: 'Gilt', description: 'An engraved border printed in gold ink' },
  woodgrain: { label: 'Woodgrain', description: 'A printed woodgrain border around a mat' },
}

/** Frames printed as a patterned band around a mat, with the band's width in page units. */
export const BANDED_FRAMES: Partial<Record<FrameStyle, number>> = { watercolor: 3, arcs: 3, gilt: 2.6, woodgrain: 3 }

export interface FlipbookPhoto {
  src: string
  /** This photo's frame, or nothing to use the page's. */
  frame?: FrameStyle | null
  alt?: string | null
  /** Natural size, used to keep the photo's shape on framed pages. */
  width?: number | null
  height?: number | null
}

export interface FlipbookPage {
  layout: PageLayout
  /** Photos in slot order. A missing photo leaves its slot blank. */
  photos: (FlipbookPhoto | null)[]
  caption?: string | null
  /** This page's frame, or nothing to use the book's. Full-bleed pages are never framed. */
  frame?: FrameStyle | null
}

export interface FlipbookBook {
  title: string
  /** A line under the title on the title page, and on the cover when there is no cover photo. */
  subtitle?: string | null
  /** Credited on the title page with the year. */
  author?: string | null
  year?: number | string | null
  /** The photo set into the front cover. */
  cover?: FlipbookPhoto | null
  theme?: CoverTheme
  paper?: PaperColor
  /** How photos are framed on pages that don't choose their own. */
  frame?: FrameStyle
  pages: FlipbookPage[]
  /** Small capitals above the title on the cover, e.g. "A photo book". */
  kicker?: string | null
  /** A closing line printed inside the back cover. */
  colophon?: string | null
  /** The name printed on the back cover. */
  imprint?: string | null
}

/** The frame a photo is printed with: its own, else its page's, else the book's. Full-bleed pages have none. */
export function photoFrame(
  page: Pick<FlipbookPage, 'layout' | 'frame'>,
  photo: Pick<FlipbookPhoto, 'frame'> | null | undefined,
  bookFrame: FrameStyle = 'none',
): FrameStyle {
  return page.layout === 'single' ? 'none' : (photo?.frame ?? frameOf(page, bookFrame))
}

/** The frame a page is printed with: its own, else the book's. Full-bleed pages have none. */
export function frameOf(page: Pick<FlipbookPage, 'layout' | 'frame'>, bookFrame: FrameStyle = 'none'): FrameStyle {
  return page.layout === 'single' ? 'none' : (page.frame ?? bookFrame)
}
