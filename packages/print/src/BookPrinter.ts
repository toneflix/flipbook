import { BookLayout, PageScene, pageMillimetres, type Face, type FlipbookBook, type Scene } from '@toneflix/flipbook-core'
import { Canvas } from 'skia-canvas'
import { PrintFonts, type PrintFontOptions } from './fonts'
import { SkiaPainter, type PhotoLoader } from './SkiaPainter'
import { SkiaText } from './SkiaText'

export interface BookPrinterOptions {
  /** The short side of each page in millimetres; the long side follows the book's page shape. Defaults to 210. */
  shortSide?: number
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
  /** Page width and height in millimetres. */
  readonly width: number
  readonly height: number
  readonly dpi: number
  readonly covers: boolean
  readonly scenes: PageScene

  private readonly painter: SkiaPainter

  constructor(
    readonly book: FlipbookBook,
    { shortSide = 210, covers = true, dpi = 300, load, fonts }: BookPrinterOptions = {},
  ) {
    const printFonts = new PrintFonts(fonts)
    const size = pageMillimetres(book.pageShape, shortSide)

    this.width = size.width
    this.height = size.height
    this.dpi = dpi
    this.covers = covers
    this.scenes = new PageScene(book, new SkiaText(printFonts))
    this.painter = new SkiaPainter(printFonts, load)
  }

  /** The faces printed, in reading order: the covers when asked for, the title page, the pages and the colophon. */
  get faces(): Face[] {
    const faces = new BookLayout(this.book.pages.length, { spread: false }).faces

    return this.covers ? faces : faces.filter((face) => face.kind !== 'cover' && face.kind !== 'back')
  }

  /** What each printed page is called, in order: cover, title, page-1, page-2…, colophon, back. */
  get names(): string[] {
    return this.faces.map((face) => (face.kind === 'page' ? `page-${face.index + 1}` : face.kind))
  }

  scene(face: Face): Scene {
    return this.scenes.face(face)
  }

  /** Page images are this many pixels across. */
  get pixelWidth(): number {
    return Math.round((this.width / 25.4) * this.dpi)
  }

  /** Page images are this many pixels down. */
  get pixelHeight(): number {
    return Math.round((this.pixelWidth * this.height) / this.width)
  }

  /** One page drawn at the print resolution. */
  async canvas(face: Face): Promise<Canvas> {
    const scene = this.scene(face)
    const scale = this.pixelWidth / scene.width
    const canvas = new Canvas(this.pixelWidth, this.pixelHeight)

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
    const [width, height] = [this.width * POINTS_PER_MM, this.height * POINTS_PER_MM]
    const scenes = this.faces.map((face) => this.scene(face))
    const document = new Canvas(width, height)

    for (const scene of scenes) await this.painter.paint(document.newPage(width, height), scene, width / scene.width)

    const pdf = await document.toBuffer('pdf')

    this.painter.release()

    return pdf
  }
}
