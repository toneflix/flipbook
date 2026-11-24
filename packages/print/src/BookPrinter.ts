import { BookLayout, PageScene, type FlipbookBook, type PageFace, type Scene } from '@toneflix/flipbook-core'
import { Canvas } from 'skia-canvas'
import { PrintFonts, type PrintFontOptions } from './fonts'
import { SkiaPainter, type PhotoLoader } from './SkiaPainter'
import { SkiaText } from './SkiaText'

export interface BookPrinterOptions {
  /** Page width in millimetres. The height follows the book's 3:4 page. Defaults to 210. */
  width?: number
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
 * A book's pages drawn without a browser: one print-ready PDF, or one image per page. Every page comes
 * from the same scenes the reader lays out, in reading order: the title page, the pages and the colophon.
 */
export class BookPrinter {
  readonly width: number
  readonly dpi: number
  readonly scenes: PageScene

  private readonly painter: SkiaPainter

  constructor(
    readonly book: FlipbookBook,
    { width = 210, dpi = 300, load, fonts }: BookPrinterOptions = {},
  ) {
    const printFonts = new PrintFonts(fonts)

    this.width = width
    this.dpi = dpi
    this.scenes = new PageScene(book, new SkiaText(printFonts))
    this.painter = new SkiaPainter(printFonts, load)
  }

  /** The faces printed, in reading order. */
  get faces(): PageFace[] {
    return new BookLayout(this.book.pages.length, { spread: false }).faces.filter(
      (face): face is PageFace => face.kind !== 'cover' && face.kind !== 'back',
    )
  }

  /** What each printed page is called, in order: title, page-1, page-2…, colophon. */
  get names(): string[] {
    return this.faces.map((face) => (face.kind === 'page' ? `page-${face.index + 1}` : face.kind))
  }

  scene(face: PageFace): Scene {
    return this.scenes.face(face)
  }

  /** Page images are this many pixels across. */
  get pixelWidth(): number {
    return Math.round((this.width / 25.4) * this.dpi)
  }

  /** One page drawn at the print resolution. */
  async canvas(face: PageFace): Promise<Canvas> {
    const scene = this.scene(face)
    const scale = this.pixelWidth / scene.width
    const canvas = new Canvas(this.pixelWidth, Math.round(scene.height * scale))

    await this.painter.paint(canvas.getContext('2d'), scene, scale)
    this.painter.release()

    return canvas
  }

  async png(face: PageFace): Promise<Buffer> {
    return (await this.canvas(face)).toBuffer('png')
  }

  async pixels(face: PageFace): Promise<PagePixels> {
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
