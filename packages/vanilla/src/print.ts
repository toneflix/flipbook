import { BookLayout, pageMillimetres, type Face, type FlipbookBook } from '@toneflix/flipbook-core'
import { h } from './dom'
import { renderFace, type Side } from './pages'

export interface FlipbookPrintOptions {
  /** The short side of each sheet in millimetres; the long side follows the book's page shape. Defaults to 210. */
  shortSide?: number
  /** Include the front and back covers. Defaults to true. */
  covers?: boolean
}

/**
 * Every face of a book laid flat, one sheet per printed page, in reading order: the front cover,
 * title page, pages, colophon and back cover. Each sheet is drawn by the same renderers as the
 * viewer, without the shading a turning page adds, and the print page size matches the sheets.
 */
export class FlipbookPrint {
  readonly element: HTMLElement
  /** Sheet width and height in millimetres. */
  readonly width: number
  readonly height: number

  private readonly rule: HTMLStyleElement

  constructor(
    readonly container: HTMLElement,
    readonly book: FlipbookBook,
    { shortSide = 210, covers = true }: FlipbookPrintOptions = {},
  ) {
    const size = pageMillimetres(book.pageShape, shortSide)

    this.width = size.width
    this.height = size.height
    this.rule = h('style', {}, FlipbookPrint.pageRule(this.width, this.height))
    this.element = h('div', { class: 'fb-print-book' })
    this.element.style.setProperty('--fb-print-width', `${this.width}mm`)
    this.element.style.setProperty('--fb-print-height', `${this.height}mm`)
    this.element.append(this.rule, ...BookLayout.sheets(book.pages, covers).map(({ face, side }) => this.sheet(face, side)))
    container.append(this.element)
  }

  /** The faces printed for a book, in reading order. A panorama prints as its two halves. */
  static faces(book: FlipbookBook, covers = true): Face[] {
    return BookLayout.sheets(book.pages, covers).map(({ face }) => face)
  }

  /** The print page rule for sheets of this size, in millimetres. */
  static pageRule(width: number, height: number): string {
    return `@page { size: ${width}mm ${height}mm; margin: 0; }`
  }

  /** Resolves once the book's fonts and every photo have loaded, so nothing prints half drawn. */
  async ready(): Promise<void> {
    const images = Array.from(this.element.querySelectorAll('img'))

    await Promise.all([
      document.fonts?.ready,
      ...images.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))),
    ])
  }

  /** Opens the browser's print dialog once the book is ready. */
  async print(): Promise<void> {
    await this.ready()
    window.print()
  }

  destroy() {
    this.element.remove()
  }

  /** Pages carry their number on the outer corner of the side they bind on. */
  private sheet(face: Face, binding: Side) {
    const side = face.kind === 'page' ? binding : undefined

    return h('section', { class: `fb-print-sheet is-${face.kind}` }, renderFace(face, this.book, side))
  }
}
