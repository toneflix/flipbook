import type { PhotoPosition } from './position'
import { pageSize, type PageShape, type PageSize } from './shape'

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
 * - duo: two tall photos side by side.
 * - feature: one large photo over a row of three small ones.
 * - squares: nine square photos in a 3×3 grid.
 * - aside: one tall photo with writing beside it.
 * - opener: one photo printed to the top and side edges over writing.
 * - panorama: one photo printed across both pages of a spread.
 */
export type PageLayout =
  | 'single'
  | 'framed'
  | 'pair'
  | 'grid'
  | 'collage'
  | 'text'
  | 'triptych'
  | 'mosaic'
  | 'strip'
  | 'contact'
  | 'scatter'
  | 'story'
  | 'duo'
  | 'feature'
  | 'squares'
  | 'aside'
  | 'opener'
  | 'panorama'

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
  duo: { label: 'Side by side', slots: 2 },
  feature: { label: 'Feature', slots: 4 },
  squares: { label: 'Squares', slots: 9 },
  aside: { label: 'Side story', slots: 1 },
  opener: { label: 'Opener', slots: 1 },
  panorama: { label: 'Panorama', slots: 1 },
}

/**
 * A box on a page in page units: 1 unit is 1% of the page's short side, so a portrait page is
 * 100 × 133⅓. `rotate` is in degrees.
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
  /** Photos run off the page edge and are never framed. */
  bleed?: boolean
}

/** The outer margin of placed layouts, in page units. */
const MARGIN = 7

/** `count` boxes stacked down a column. */
const column = (x: number, width: number, count: number, top: number, height: number, gap = 3) => {
  const each = (height - gap * (count - 1)) / count

  return Array.from({ length: count }, (_, i) => ({ x, y: top + i * (each + gap), width, height: each }))
}

/** `count` boxes side by side along a row. */
const row = (x: number, width: number, count: number, top: number, height: number, gap = 3) =>
  column(top, height, count, x, width, gap).map(({ x, y, width, height }) => ({ x: y, y: x, width: height, height: width }))

/** The area photos fill above a caption line, and that caption line. */
const frameOfPage = ({ width, height }: PageSize) => ({
  content: { x: MARGIN, y: MARGIN, width: width - 2 * MARGIN, height: height - 25 - 1 / 3 },
  below: { x: MARGIN, y: height - 15 - 1 / 3, width: width - 2 * MARGIN, height: 10 },
})

/** Layouts drawn from boxes worked out from the page's size, which every renderer places the same way. */
export const PLACED_LAYOUTS: Partial<Record<PageLayout, (page: PageSize) => PlacedLayout>> = {
  triptych: (page) => {
    const { content, below } = frameOfPage(page)
    const height = page.height - 39 - 1 / 3

    return { slots: row(content.x, content.width, 3, 14, height), caption: { ...below, y: page.height - 19 - 1 / 3 } }
  },
  mosaic: (page) => {
    const { content, below } = frameOfPage(page)
    const big = ((content.width - 3) * 51) / 83

    return {
      slots: [{ ...content, width: big }, ...column(content.x + big + 3, content.width - big - 3, 2, content.y, content.height)],
      caption: below,
    }
  },
  strip: (page) => {
    const { content, below } = frameOfPage(page)

    if (page.width <= page.height) return { slots: column(content.x, content.width, 3, content.y, content.height), caption: below }

    const each = (content.width - 6) / 3
    const height = Math.min(content.height, each * 0.75)

    return { slots: row(content.x, content.width, 3, content.y + (content.height - height) / 2, height), caption: below }
  },
  contact: (page) => {
    const { content, below } = frameOfPage(page)
    const [across, down] = page.width < page.height ? [2, 3] : [3, 2]
    const columns = row(content.x, content.width, across, content.y, content.height)
    const rows = column(content.x, content.width, down, content.y, content.height)

    return { slots: rows.flatMap((r) => columns.map((c) => ({ ...c, y: r.y, height: r.height }))), caption: below }
  },
  scatter: ({ width, height }) => {
    const tall = height / width
    const scale = Math.min(1, (height - 2 * MARGIN) / 119)
    const print = (x: number, y: number, w: number, h: number, rotate: number) => ({
      x: x * (width / 100),
      y: y * (height / (tall > 1 ? 133 + 1 / 3 : 100)),
      width: w * scale,
      height: h * scale,
      rotate,
    })

    if (tall > 1)
      return {
        slots: [print(9, 9, 54, 41, -4), print(38, 43, 54, 41, 3), print(11, 80, 48, 35, -2)],
        caption: { x: 63 * (width / 100), y: height - 41 - 1 / 3, width: 30, height: 28 },
        loose: true,
      }

    return {
      slots: [print(8, 9, 54, 41, -4), print(38, 30, 54, 41, 3), print(12, 52, 48, 35, -2)],
      caption: { x: width - 37, y: height - 38, width: 30, height: 28 },
      loose: true,
    }
  },
  story: (page) => {
    if (page.width > page.height) {
      const photo = { x: MARGIN, y: MARGIN, width: (page.width - 2 * MARGIN) * 0.58, height: page.height - 2 * MARGIN - 3 }
      const x = photo.x + photo.width + 6

      return { slots: [photo], caption: { x, y: MARGIN + 2, width: page.width - MARGIN - 2 - x, height: photo.height - 4 }, prose: true }
    }

    const photo = { x: MARGIN, y: MARGIN, width: page.width - 2 * MARGIN, height: page.height * 0.495 }
    const y = photo.y + photo.height + 7

    return { slots: [photo], caption: { x: 9, y, width: page.width - 18, height: page.height - y - 8 - 1 / 3 }, prose: true }
  },
  duo: (page) => {
    const { content, below } = frameOfPage(page)
    const height = page.height - 45 - 1 / 3
    const top = 16 * (page.height / (133 + 1 / 3))

    return { slots: row(content.x, content.width, 2, top, height), caption: { ...below, y: top + height + 4 } }
  },
  feature: (page) => {
    const { content, below } = frameOfPage(page)

    if (page.width > page.height) {
      const big = (content.width - 3) * 0.66

      return {
        slots: [{ ...content, width: big }, ...column(content.x + big + 3, content.width - big - 3, 3, content.y, content.height)],
        caption: below,
      }
    }

    const height = page.height - 61 - 1 / 3

    return {
      slots: [{ ...content, height }, ...row(content.x, content.width, 3, MARGIN + height + 3, 30)],
      caption: { ...below, y: MARGIN + height + 3 + 30 + 3 },
    }
  },
  squares: (page) => {
    const { below } = frameOfPage(page)
    const tall = page.width < page.height
    const top = tall ? 14 : MARGIN
    const cell = tall ? (page.width - 20) / 3 : Math.min((page.width - 20) / 3, (page.height - top - 29) / 3)
    const block = 3 * cell + 6
    const x = (page.width - block) / 2

    return {
      slots: [0, 1, 2].flatMap((i) => row(x, block, 3, top + i * (cell + 3), cell)),
      caption: { ...below, y: top + block + 6 },
    }
  },
  aside: (page) => {
    const height = page.height - 2 * MARGIN
    const photo = ((page.width - 2 * MARGIN - 4) * 52) / 82

    return {
      slots: [{ x: MARGIN, y: MARGIN, width: photo, height }],
      caption: { x: MARGIN + photo + 4, y: MARGIN, width: page.width - 2 * MARGIN - photo - 4, height },
      prose: true,
    }
  },
  opener: (page) => {
    const height = page.height * 0.63

    return {
      slots: [{ x: 0, y: 0, width: page.width, height }],
      caption: { x: 9, y: height + 8, width: page.width - 18, height: page.height - height - 15 - 1 / 3 },
      prose: true,
      bleed: true,
    }
  },
}

/** A placed layout's boxes on a page of this size, or nothing for layouts that flow down the page. */
export function placedLayout(layout: PageLayout, page: PageSize = pageSize()): PlacedLayout | null {
  return PLACED_LAYOUTS[layout]?.(page) ?? null
}

/** The cloth of the cover, which also tints the stage behind the book. */
export type CoverTheme = 'classic' | 'linen' | 'midnight' | 'leather' | 'sage' | 'blush'

export const COVER_THEMES: Record<CoverTheme, { label: string; cloth: string; ink: string; stage: [string, string, string] }> = {
  classic: { label: 'Classic', cloth: '#5a1d22', ink: '#e2c58f', stage: ['#4a2a27', '#22140f', '#0d0807'] },
  linen: { label: 'Linen', cloth: '#e6dcc6', ink: '#3d3226', stage: ['#4a4134', '#241f18', '#0e0c09'] },
  midnight: { label: 'Midnight', cloth: '#141b2e', ink: '#d5dbe8', stage: ['#27324d', '#121827', '#07090f'] },
  leather: { label: 'Tan leather', cloth: '#6b3f24', ink: '#ecc77d', stage: ['#4d3121', '#24170f', '#0d0805'] },
  sage: { label: 'Sage', cloth: '#5d6f5c', ink: '#f1e9d2', stage: ['#3c4a3c', '#1c241c', '#0a0d0a'] },
  blush: { label: 'Blush', cloth: '#d8b4a8', ink: '#5a2f2a', stage: ['#5a4440', '#2a1f1d', '#100b0a'] },
}

/**
 * How the front cover is laid out.
 * - classic: a ruled panel with the title over an inset photo.
 * - gilt: gold rules and corner flourishes around an oval portrait.
 * - window: the photo sits in a window pressed into the board, the title stamped below.
 * - label: a print held by photo corners over a paper title label.
 * - deco: art deco rays rising to an arched photo.
 * - image: the cover photo printed across the whole cover, with optional text.
 */
export type CoverDesign = 'classic' | 'gilt' | 'window' | 'label' | 'deco' | 'image'

export const COVER_DESIGNS: Record<CoverDesign, { label: string; description: string }> = {
  classic: { label: 'Classic', description: 'A ruled panel with the title over an inset photo' },
  gilt: { label: 'Gilt', description: 'Gold rules and corner flourishes around an oval portrait' },
  window: { label: 'Window', description: 'The photo set into a window pressed into the board' },
  label: { label: 'Tipped-in print', description: 'A print held by photo corners over a paper title label' },
  deco: { label: 'Art deco', description: 'Gold rays rising to an arched photo' },
  image: { label: 'Full image', description: 'Your photo across the whole cover, finished like the board' },
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
  | 'instant'
  | 'arch'
  | 'rounded'
  | 'tape'
  | 'film'
  | 'deco'

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
  instant: { label: 'Instant print', description: 'A white print border, deeper along the bottom' },
  arch: { label: 'Arch', description: 'An arched window inside a fine printed rule' },
  rounded: { label: 'Rounded', description: 'The photo with softly rounded corners' },
  tape: { label: 'Washi tape', description: 'Strips of coloured tape across the top corners' },
  film: { label: 'Film', description: 'A dark film frame with sprocket holes' },
  deco: { label: 'Art deco', description: 'Gold rules with fan corners' },
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
  /** Which part of the photo shows where its box crops it. Centred when left out. */
  position?: Partial<PhotoPosition> | null
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
  /** How the front cover is laid out. Defaults to `classic`. */
  coverDesign?: CoverDesign
  /** Print the title on the cover. Defaults to on, except for the `image` design. */
  coverText?: boolean
  paper?: PaperColor
  /** How photos are framed on pages that don't choose their own. */
  frame?: FrameStyle
  /** The shape of every page and both covers. Defaults to `portrait`. */
  pageShape?: PageShape
  pages: FlipbookPage[]
  /** Small capitals above the title on the cover, e.g. "A photo book". */
  kicker?: string | null
  /** A closing line printed inside the back cover. */
  colophon?: string | null
  /** The name printed on the back cover. */
  imprint?: string | null
  /** A brand name printed on the back cover above the imprint. */
  brand?: string | null
}

/** Whether the cover carries its title: on by default, off for full-image covers unless asked for. */
export function coverHasText(book: Pick<FlipbookBook, 'coverDesign' | 'coverText'>): boolean {
  return book.coverText ?? book.coverDesign !== 'image'
}

/** The frame a photo is printed with: its own, else its page's, else the book's. Full-bleed pages have none. */
export function photoFrame(
  page: Pick<FlipbookPage, 'layout' | 'frame'>,
  photo: Pick<FlipbookPhoto, 'frame'> | null | undefined,
  bookFrame: FrameStyle = 'none',
): FrameStyle {
  return bleeds(page.layout) ? 'none' : (photo?.frame ?? frameOf(page, bookFrame))
}

/** The frame a page is printed with: its own, else the book's. Full-bleed pages have none. */
export function frameOf(page: Pick<FlipbookPage, 'layout' | 'frame'>, bookFrame: FrameStyle = 'none'): FrameStyle {
  return bleeds(page.layout) ? 'none' : (page.frame ?? bookFrame)
}

/** Layouts whose photos run off the page edge, which are never framed. */
export function bleeds(layout: PageLayout): boolean {
  return layout === 'single' || layout === 'panorama' || !!placedLayout(layout)?.bleed
}

/** Which page of a spread a face sits on. */
export type PageHalf = 'left' | 'right'

/** Layouts printed across both pages of a spread, which always open on a left-hand page. */
export function spans(layout: PageLayout): boolean {
  return layout === 'panorama'
}

/** Where a panorama's photo and caption sit on one page of it. */
export interface PanoramaView {
  photo: PageBox
  /**
   * `over` sets the caption over a shade at the foot of the photo, as on a full-bleed page; `shade`
   * draws the same shade without the words, which the facing page carries. A box sets it below the photo.
   */
  caption: 'over' | 'shade' | PageBox
}

/**
 * A panorama seen on one half of its spread, or whole on a single page: then the photo keeps the
 * spread's shape across the page, a little above the middle, with its caption below.
 */
export function panoramaView(half?: PageHalf | null, page: PageSize = pageSize()): PanoramaView {
  const { width, height } = page

  if (half)
    return { photo: { x: half === 'left' ? 0 : -width, y: 0, width: 2 * width, height }, caption: half === 'left' ? 'shade' : 'over' }

  const photo = { x: 0, y: height / 4 - 10 / 3, width, height: height / 2 }
  const top = photo.y + photo.height + 7

  return { photo, caption: { x: 9, y: top, width: width - 18, height: height - 7.67 - top } }
}
