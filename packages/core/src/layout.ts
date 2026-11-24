import { spans, type FlipbookPage, type PageHalf } from './book'

/** One side of a leaf. A page printed across a spread has a face for each `half`. */
export type Face =
  | { kind: 'cover' }
  | { kind: 'title' }
  | { kind: 'page'; index: number; half?: PageHalf }
  | { kind: 'blank' }
  | { kind: 'colophon' }
  | { kind: 'back' }

export type Leaf = { front: Face; back: Face }

/** What the reader sees at one resting place in the book. `flipped` is how many leaves lie on the left. */
export type Stop = { flipped: number; faces: Face[] }

export interface BookLayoutOptions {
  /** Two pages side by side (true) or one page at a time. */
  spread: boolean
  /** Covers swing on the spine like board instead of curling like paper. */
  stiffCovers?: boolean
}

/**
 * The physical leaves of a book: a cover, a title page, the pages, a colophon and the back cover.
 * In a spread every leaf has a page on each side, and a panorama takes both pages of one spread;
 * one page at a time, each page gets its own leaf with a blank back.
 */
export class BookLayout {
  readonly pageCount: number
  readonly faces: Face[]
  readonly leaves: Leaf[]
  readonly spread: boolean
  readonly stiffCovers: boolean
  /** Indexes of the pages printed across a spread. */
  readonly panoramas: number[]

  /** `pages` is the book's pages, or just how many there are when none spans a spread. */
  constructor(pages: number | readonly Pick<FlipbookPage, 'layout'>[], { spread, stiffCovers = true }: BookLayoutOptions) {
    const body = BookLayout.body(pages, spread)
    const filler: Face[] = spread && body.length % 2 === 1 ? [{ kind: 'blank' }] : []

    this.pageCount = typeof pages === 'number' ? pages : pages.length
    this.panoramas = typeof pages === 'number' ? [] : BookLayout.panoramas(pages)
    this.spread = spread
    this.stiffCovers = stiffCovers
    this.faces = [{ kind: 'cover' }, { kind: 'title' }, ...body, ...filler, { kind: 'colophon' }, { kind: 'back' }]
    this.leaves = spread ? BookLayout.pair(this.faces) : this.faces.map((front) => ({ front, back: { kind: 'blank' } }))
  }

  /**
   * Every face printed on a sheet of its own, in reading order from the front cover to the back,
   * with the side of the spine it binds on. Panoramas print in halves after any blank they need.
   */
  static sheets(pages: number | readonly Pick<FlipbookPage, 'layout'>[], covers = true): { face: Face; side: PageHalf }[] {
    const faces = new BookLayout(pages, { spread: true }).faces
    const sheets = faces.map((face, i) => ({ face, side: (i % 2 === 1 ? 'left' : 'right') as PageHalf }))
    // The blank that pairs the last page with the colophon only matters in a reader.
    const end = sheets.length - 3

    return sheets.filter(
      ({ face }, i) => !(i === end && face.kind === 'blank') && (covers || (face.kind !== 'cover' && face.kind !== 'back')),
    )
  }

  /** Indexes of the pages printed across a spread, e.g. to tell when a book needs a new layout. */
  static panoramas(pages: readonly Pick<FlipbookPage, 'layout'>[]): number[] {
    return pages.flatMap((page, index) => (spans(page.layout) ? [index] : []))
  }

  /**
   * The page faces after the title page. On a spread a panorama opens on a left-hand page, after a
   * blank when it would fall on the right.
   */
  private static body(pages: number | readonly Pick<FlipbookPage, 'layout'>[], spread: boolean): Face[] {
    if (typeof pages === 'number') return Array.from({ length: pages }, (_, index) => ({ kind: 'page', index }))

    const faces: Face[] = []

    pages.forEach((page, index) => {
      if (!spread || !spans(page.layout)) {
        faces.push({ kind: 'page', index })
        return
      }

      // The cover and title page come first, so an even count here means the next face is on the right.
      if (faces.length % 2 === 0) faces.push({ kind: 'blank' })
      faces.push({ kind: 'page', index, half: 'left' }, { kind: 'page', index, half: 'right' })
    })

    return faces
  }

  /** Two faces show the same thing: the same page (either half), or the same kind of face. */
  private static same(a: Face, b: Face) {
    return a.kind === b.kind && (a.kind !== 'page' || (b.kind === 'page' && a.index === b.index))
  }

  private static pair(faces: Face[]) {
    const leaves: Leaf[] = []

    for (let i = 0; i < faces.length; i += 2) leaves.push({ front: faces[i], back: faces[i + 1] })

    return leaves
  }

  /** Number of leaves. `flipped` runs from 0 (closed, cover up) to this (closed, back up). */
  get length() {
    return this.leaves.length
  }

  /** The `flipped` value that shows a face. */
  flippedForFace(face: number) {
    return this.spread ? Math.ceil(face / 2) : face
  }

  /** The `flipped` value that shows a page (1-based), or the cover when it is out of range. */
  flippedForPage(page?: number | null) {
    if (!page || page < 1 || page > this.pageCount) return 0

    return this.flippedForFace(this.faces.findIndex((face) => face.kind === 'page' && face.index === page - 1))
  }

  /** The same place in this book laid out the other way: the first face open in `from`, open here. */
  convert(flipped: number, from: BookLayout) {
    if (flipped <= 0) return 0
    if (flipped >= from.length) return this.length

    const open = from.visible(flipped)
    const shown = open.find((face) => face.kind !== 'blank') ?? open[0]
    const face = this.faces.findIndex((face) => BookLayout.same(face, shown))

    return face < 0 ? Math.min(flipped, this.length) : this.flippedForFace(face)
  }

  isStiff(leaf: number) {
    const { front, back } = this.leaves[leaf] ?? {}

    return this.stiffCovers && (front?.kind === 'cover' || front?.kind === 'back' || back?.kind === 'back')
  }

  /** The faces lying open at `flipped`, left to right. */
  visible(flipped: number): Face[] {
    if (flipped <= 0) return [this.leaves[0].front]
    if (flipped >= this.length) return [this.spread ? this.leaves[this.length - 1].back : this.faces[this.faces.length - 1]]

    return this.spread ? [this.leaves[flipped - 1].back, this.leaves[flipped].front] : [this.leaves[flipped].front]
  }

  /** Every resting place in the book, for a strip of thumbnails. */
  stops(): Stop[] {
    if (!this.spread) return this.faces.map((face, i) => ({ flipped: i, faces: [face] }))

    const stops: Stop[] = [{ flipped: 0, faces: [this.faces[0]] }]

    for (let i = 1; i < this.faces.length - 1; i += 2)
      stops.push({ flipped: this.flippedForFace(i), faces: [this.faces[i], this.faces[i + 1]] })
    stops.push({ flipped: this.length, faces: [this.faces[this.faces.length - 1]] })

    return stops
  }

  /** A short label for the place, e.g. "Pages 3–4 of 12". */
  label(flipped: number) {
    if (flipped <= 0) return 'Cover'
    if (flipped >= this.length) return 'Back cover'

    const numbers = BookLayout.pageNumbers(this.visible(flipped))

    if (numbers.length === 0) return this.visible(flipped).some((f) => f.kind === 'title') ? 'Title page' : 'The end'
    if (numbers.length === 1) return `Page ${numbers[0]} of ${this.pageCount}`

    return `Pages ${numbers[0]}–${numbers[1]} of ${this.pageCount}`
  }

  /** What a thumbnail shows, for its accessible name. */
  static describe(faces: Face[]) {
    const numbers = BookLayout.pageNumbers(faces)

    if (numbers.length) return `page ${numbers.join(' and ')}`

    return faces[0].kind === 'back' ? 'the back cover' : faces[0].kind === 'cover' ? 'the cover' : 'the title page'
  }

  /** The page numbers on show, once each: both halves of a panorama are one page. */
  private static pageNumbers(faces: Face[]) {
    return [...new Set(faces.filter((f): f is Extract<Face, { kind: 'page' }> => f.kind === 'page').map((f) => f.index + 1))]
  }
}
