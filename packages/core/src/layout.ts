/** One side of a leaf. */
export type Face =
  { kind: 'cover' } | { kind: 'title' } | { kind: 'page'; index: number } | { kind: 'blank' } | { kind: 'colophon' } | { kind: 'back' }

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
 * In a spread every leaf has a page on each side; one page at a time, each page gets its own leaf
 * with a blank back.
 */
export class BookLayout {
  readonly faces: Face[]
  readonly leaves: Leaf[]
  readonly spread: boolean
  readonly stiffCovers: boolean

  constructor(
    readonly pageCount: number,
    { spread, stiffCovers = true }: BookLayoutOptions,
  ) {
    const pages: Face[] = Array.from({ length: pageCount }, (_, index) => ({ kind: 'page', index }))
    const filler: Face[] = spread && pageCount % 2 === 1 ? [{ kind: 'blank' }] : []

    this.spread = spread
    this.stiffCovers = stiffCovers
    this.faces = [{ kind: 'cover' }, { kind: 'title' }, ...pages, ...filler, { kind: 'colophon' }, { kind: 'back' }]
    this.leaves = spread ? BookLayout.pair(this.faces) : this.faces.map((front) => ({ front, back: { kind: 'blank' } }))
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

    return this.flippedForFace(page + 1)
  }

  /** The same place in this book laid out the other way. */
  convert(flipped: number, from: BookLayout) {
    if (from.spread === this.spread) return Math.min(flipped, this.length)

    return this.spread ? Math.ceil(flipped / 2) : Math.max(0, flipped * 2 - 1)
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

  private static pageNumbers(faces: Face[]) {
    return faces.filter((f): f is Extract<Face, { kind: 'page' }> => f.kind === 'page').map((f) => f.index + 1)
  }
}
