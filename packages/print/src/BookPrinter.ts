import { BookLayout, PageScene, type Face, type FlipbookBook, type Scene } from '@toneflix/flipbook-core'
import { Canvas } from 'skia-canvas'
import { PrintFonts, type PrintFontOptions } from './fonts'
import { SkiaPainter, type PhotoLoader } from './SkiaPainter'
import { SkiaText } from './SkiaText'

export interface BookPrinterOptions {
  /** Page width in millimetres. The height follows the book's 3:4 page. Defaults to 210. */
  width?: number
  /** Include the front and back covers. Defaults to true. */
  covers?: boolean
  /** Resolution of page images. Defaults to 300. */
  dpi?: number
  /** Where each photo's bytes come from. Defaults to reading `src` as a file path or URL. */
  load?: PhotoLoader
  fonts?: PrintFontOptions
}

/** A page drawn as RGBA pixels, ready for any image encoder. */
export interface PagePixels {
  data: Buffer
  width: number
  height: number
}

const POINTS_PER_MM = 72 / 25.4

/**
 * A book drawn without a browser: one print-ready PDF, or one image per page. Every page comes from
 * the same scenes the reader lays out, in reading order from the front cover to the back.
 */
export class BookPrinter {
  readonly width: number
  readonly dpi: number
  readonly covers: boolean
  readonly scenes: PageScene

  private readonly painter: SkiaPainter
  private printed?: { face: Face; side: 'left' | 'right' }[]

  constructor(
    readonly book: FlipbookBook,
    { width = 210, covers = true, dpi = 300, load, fonts }: BookPrinterOptions = {},
  ) {
    const printFonts = new PrintFonts(fonts)

    this.width = width
    this.dpi = dpi
    this.covers = covers
    this.scenes = new PageScene(book, new SkiaText(printFonts))
    this.painter = new SkiaPainter(printFonts, load)
  }

  /**
   * The faces printed, in reading order: the covers when asked for, the title page, the pages and the
   * colophon. A panorama prints as its two halves, after a blank when it would open on a right-hand page.
   */
  get faces(): Face[] {
    return this.sheets.map(({ face }) => face)
  }

  /** What each printed page is called, in order: cover, title, page-1, page-2-left, page-2-right, blank-1…, colophon, back. */
  get names(): string[] {
    let blanks = 0

    return this.faces.map((face) => {
      if (face.kind === 'blank') return `blank-${++blanks}`
      if (face.kind !== 'page') return face.kind

      return face.half ? `page-${face.index + 1}-${face.half}` : `page-${face.index + 1}`
    })
  }

  /** A face drawn as it binds: its page number on the outer corner. */
  scene(face: Face): Scene {
    const sheet = this.sheets.find((sheet) => sheet.face === face)

    return this.scenes.face(face, { side: sheet?.side })
  }

  private get sheets() {
    return (this.printed ??= BookLayout.sheets(this.book.pages, this.covers))
  }

  /** Page images are this many pixels across. */
  get pixelWidth(): number {
    return Math.round((this.width / 25.4) * this.dpi)
  }

  /** One page drawn at the print resolution. */
  async canvas(face: Face): Promise<Canvas> {
    const scene = this.scene(face)
    const scale = this.pixelWidth / scene.width
    const canvas = new Canvas(this.pixelWidth, Math.round(scene.height * scale))

    await this.painter.paint(canvas.getContext('2d'), scene, scale)
    this.painter.release()

    return canvas
  }

  async png(face: Face): Promise<Buffer> {
    return (await this.canvas(face)).toBuffer('png')
  }

  async pixels(face: Face): Promise<PagePixels> {
    const canvas = await this.canvas(face)

    return { data: await canvas.toBuffer('raw'), width: canvas.width, height: canvas.height }
  }

  /** The whole book as one PDF, text and rules kept as vectors and photos embedded at their own resolution. */
  async pdf(): Promise<Buffer> {
    const points = this.width * POINTS_PER_MM
    const scenes = this.faces.map((face) => this.scene(face))
    const scale = points / 100
    const document = new Canvas(points, scenes[0].height * scale)

    for (const scene of scenes) await this.painter.paint(document.newPage(points, scene.height * scale), scene, scale)

    const pdf = await document.toBuffer('pdf')

    this.painter.release()

    return pdf
  }
}
