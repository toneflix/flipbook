import {
  panoramaView,
  placedLayout,
  photoFrame,
  type FlipbookBook,
  type FlipbookPage,
  type FrameStyle,
  type PageBox,
  type PageHalf,
  type PlacedLayout,
} from '../book'
import { pageSize, type PageSize } from '../shape'
import type { Face } from '../layout'
import { CoverScene } from './cover'
import { FrameScene, farthestCorner, rect, withAlpha } from './frame'
import { ornament } from './marks'
import { PAPER_LOOKS, inkOf, type PaperLook } from './paper'
import { Typesetter, type TextBlock } from './text'
import type { Box, FontSpec, Scene, SceneNode, TextMeasure } from './types'

/** The height of a portrait page in page units. */
export const PAGE_HEIGHT = 400 / 3

export type Side = 'left' | 'right'

export interface PageSceneOptions {
  /** Printed in the outer bottom corner. */
  number?: number
  /** Which side of the spine the page sits on, for the page number. */
  side?: Side
  /** Draw the curve into the spine and the light where the page rises, as on an open book. */
  bound?: boolean
  /** The half of a panorama on this page. Left out, the whole panorama is set on the page. */
  half?: PageHalf
}

/**
 * Texture tiles are this many page units square: 256 CSS pixels on a 210 mm page, as the web reader
 * prints them.
 */
export const TEXTURE_TILE = 256 / 7.937

interface SlotOptions {
  /** `contain` keeps the photo's shape inside the slot instead of cropping it to fill. */
  fit?: 'cover' | 'contain'
  /** Clip the frame to the slot, as every slot but loose prints and framed pages does. */
  clip?: boolean
}

const serif = (size: number, style: FontSpec['style'] = 'normal', weight = 400): FontSpec => ({ family: 'serif', style, weight, size })

/** Splits `space` between flexible children in proportion to their `grow`, like CSS flex with no basis. */
const flex = (space: number, grows: number[]) => {
  const total = grows.reduce((sum, grow) => sum + grow, 0)

  return grows.map((grow) => (space * grow) / total)
}

/**
 * Every face of a book as a scene: the covers, the title page, each designed page, the colophon and
 * blanks, laid out exactly as the web reader lays them out.
 */
export class PageScene {
  readonly look: PaperLook
  readonly frame: FrameStyle
  readonly text: Typesetter

  readonly covers: CoverScene
  /** The page's size in page units. */
  readonly size: PageSize

  private readonly frames: FrameScene
  private readonly area: Box

  constructor(
    readonly book: FlipbookBook,
    measure: TextMeasure,
  ) {
    this.look = PAPER_LOOKS[book.paper ?? 'ivory'] ?? PAPER_LOOKS.ivory
    this.frame = book.frame ?? 'none'
    this.text = new Typesetter(measure)
    this.size = pageSize(book.pageShape)
    this.area = { x: 0, y: 0, ...this.size }
    this.frames = new FrameScene(this.look)
    this.covers = new CoverScene(book, this.text)
  }

  /**
   * Any face of the book, covers included. Pages are numbered from 1, the first on the right. `side`
   * says which side of the spine a page sits on when blanks before panoramas move it.
   */
  face(face: Face, options: Omit<PageSceneOptions, 'number' | 'half'> & { numbered?: boolean } = {}): Scene {
    const { numbered = true, side, ...rest } = options

    switch (face.kind) {
      case 'cover':
        return this.covers.front(rest)
      case 'back':
        return this.covers.back(rest)
      case 'title':
        return this.title(rest)
      case 'colophon':
        return this.colophon(rest)
      case 'blank':
        return this.blank(rest)
      case 'page':
        return this.page(this.book.pages[face.index], {
          ...rest,
          number: numbered ? face.index + 1 : undefined,
          side: face.half ?? side ?? (face.index % 2 === 0 ? 'right' : 'left'),
          half: face.half,
        })
    }
  }

  blank(options: PageSceneOptions = {}): Scene {
    return this.sheet([], options)
  }

  title(options: PageSceneOptions = {}): Scene {
    const { book } = this
    const { x, width } = this.measure()
    const credit = [book.author, book.year].filter(Boolean).join(' · ').toUpperCase()
    const heading = this.text.set(book.title, serif(7.5), { width, lineHeight: 1.1, wrap: 'balance' })
    const subtitle = book.subtitle ? this.text.set(book.subtitle, serif(4, 'italic'), { width, lineHeight: 1.45 }) : null
    const creditFont: FontSpec = { family: 'sans', style: 'normal', weight: 400, size: 2.6, letterSpacing: 0.52 }
    const creditText = credit ? this.text.set(credit, creditFont, { width }) : null
    const rows: { height: number; gap: number; draw: (y: number) => SceneNode[] }[] = [
      { height: 9, gap: 0, draw: (y) => ornament({ x: this.size.width / 2 - 4.5, y, width: 9, height: 9 }, this.ink()) },
      { height: heading.height, gap: 6, draw: (y) => [this.lines(heading, { x, y, width, height: heading.height }, 'center')] },
      ...(subtitle
        ? [
            {
              height: subtitle.height,
              gap: 4,
              draw: (y: number) => [this.lines(subtitle, { x, y, width, height: subtitle.height }, 'center')],
            },
          ]
        : []),
      {
        height: 1 / 7.937,
        gap: 7,
        draw: (y) => [
          {
            kind: 'fill',
            shape: rect({ x: this.size.width / 2 - 10, y, width: 20, height: 1 / 7.937 }),
            paint: this.ink(),
            opacity: 0.3,
          } as SceneNode,
        ],
      },
      ...(creditText
        ? [
            {
              height: creditText.height,
              gap: 5,
              draw: (y: number) => [this.lines(creditText, { x, y, width, height: creditText.height }, 'center')],
            },
          ]
        : []),
    ]
    const total = rows.reduce((sum, row) => sum + row.gap + row.height, 0)
    let y = 12 + (this.size.height - 24 - total) / 2

    return this.sheet(
      rows.flatMap((row) => {
        y += row.gap
        const nodes = row.draw(y)

        y += row.height

        return nodes
      }),
      options,
    )
  }

  colophon(options: PageSceneOptions = {}): Scene {
    const { colophon } = this.book
    const { x, width } = this.measure()
    const block = colophon ? this.text.set(colophon, serif(3.6, 'italic'), { width }) : null
    const nodes: SceneNode[] = block
      ? [{ ...this.lines(block, { x, y: this.size.height - 12 - block.height, width, height: block.height }, 'center'), opacity: 0.9 }]
      : []

    return this.sheet(nodes, options)
  }

  page(page: FlipbookPage, options: PageSceneOptions = {}): Scene {
    const placed = placedLayout(page.layout, this.size)
    const nodes = placed ? this.placed(page, placed) : this.flowed(page, options.half)

    if (options.number !== undefined && page.layout !== 'single' && page.layout !== 'panorama')
      nodes.push(this.pageNumber(options.number, options.side ?? 'right'))

    return this.sheet(nodes, options)
  }

  /** The measure of centred writing: the page less its margins, never wider than a portrait page's. */
  private measure() {
    const width = Math.min(this.size.width, 100) - 24

    return { x: (this.size.width - width) / 2, width }
  }

  private ink(alpha?: number) {
    return inkOf(this.look, alpha)
  }

  /** A photo slot: the photo in its frame, or a tint where the page has no photo for it. */
  private slot(page: FlipbookPage, index: number, box: Box, { fit = 'cover', clip = true }: SlotOptions = {}): SceneNode {
    const photo = page.photos[index] ?? null
    const frame = photoFrame(page, photo, this.frame)
    const children: SceneNode[] = photo
      ? this.frames.nodes(photo, frame, FrameScene.fit(box, frame, fit, photo))
      : [{ kind: 'fill', shape: rect(box), paint: this.ink(0.08) }]

    return clip ? { kind: 'group', clip: rect(box), children } : { kind: 'group', children }
  }

  private lines(block: TextBlock, box: Box, align: 'left' | 'center' | 'right', color = this.ink()): SceneNode & { kind: 'text' } {
    return { kind: 'text', font: block.font, color, lines: block.place(box.x, box.y, box.width, align) }
  }

  private caption(page: FlipbookPage, width: number) {
    return page.caption ? this.text.set(page.caption, serif(3.8, 'italic'), { width }) : null
  }

  /** Layouts that flow down the page in a column. */
  private flowed(page: FlipbookPage, half?: PageHalf): SceneNode[] {
    switch (page.layout) {
      case 'single':
        return this.single(page)
      case 'panorama':
        return this.panorama(page, half)
      case 'framed':
        return this.framed(page)
      case 'text':
        return this.words(page)
      default:
        return this.column(page)
    }
  }

  private single(page: FlipbookPage): SceneNode[] {
    return [this.slot(page, 0, this.area), ...this.captionOver(page)]
  }

  /** One photo across a spread: each half draws its side of it, and a single page sets it whole. */
  private panorama(page: FlipbookPage, half?: PageHalf): SceneNode[] {
    const view = panoramaView(half, this.size)
    const photo: SceneNode = { kind: 'group', clip: rect(this.area), children: [this.slot(page, 0, view.photo)] }

    if (!page.caption) return [photo]
    if (typeof view.caption === 'string') return [photo, ...this.captionOver(page, view.caption === 'over')]

    const block = this.text.set(page.caption, serif(3.8, 'italic'), { width: view.caption.width, lineHeight: 1.35 })
    const top = view.caption.y + (view.caption.height - block.height) / 2

    return [photo, this.lines(block, { ...view.caption, y: top }, 'center')]
  }

  /** The caption set in white over a shade at the foot of a photo that fills the page, or just the shade. */
  private captionOver(page: FlipbookPage, words = true): SceneNode[] {
    if (!page.caption) return []

    const { width, height: pageHeight } = this.size
    const block = this.text.set(page.caption, serif(4.2, 'italic'), { width: width - 14, lineHeight: 1.35 })
    const height = 14 + block.height + 7
    const shade: Box = { x: 0, y: pageHeight - height, width, height }
    const fill: SceneNode = {
      kind: 'fill',
      shape: rect(shade),
      paint: {
        type: 'linear',
        from: { x: 0, y: pageHeight },
        to: { x: 0, y: shade.y },
        stops: [
          { offset: 0, color: 'rgba(0,0,0,0.7)' },
          { offset: 0.5, color: 'rgba(0,0,0,0.3)' },
          { offset: 1, color: 'rgba(0,0,0,0)' },
        ],
      },
    }

    if (!words) return [fill]

    return [fill, this.lines(block, { x: 7, y: shade.y + 14, width: width - 14, height: block.height }, 'left', '#fff')]
  }

  private framed(page: FlipbookPage): SceneNode[] {
    const content = { x: 9, y: 10, width: this.size.width - 18, height: this.size.height - 16 }
    const block = this.text.set(page.caption ?? '', serif(4.2, 'italic'), { width: content.width, lineHeight: 1.35 })
    const captionHeight = Math.max(6, block.height)
    const slot = { ...content, height: content.height - 5 - captionHeight }

    return [
      this.slot(page, 0, slot, { fit: 'contain', clip: false }),
      this.lines(block, { x: content.x, y: slot.y + slot.height + 5, width: content.width, height: captionHeight }, 'center'),
    ]
  }

  private words(page: FlipbookPage): SceneNode[] {
    const { x, width } = this.measure()
    const mark = this.text.set('“', serif(18), { width, lineHeight: 0.6 })
    const block = this.text.set(page.caption ?? '', serif(6, 'italic'), { width, lineHeight: 1.4, wrap: 'balance' })
    const total = mark.height + 4 + block.height
    const top = 14 + (this.size.height - 28 - total) / 2

    return [
      { ...this.lines(mark, { x, y: top, width, height: mark.height }, 'center'), opacity: 0.3 },
      this.lines(block, { x, y: top + mark.height + 4, width, height: block.height }, 'center'),
    ]
  }

  /**
   * Pair, grid and collage: rows of photos over a caption. On pages wider than tall, the pair sits
   * side by side and the collage's large photo stands beside the other two.
   */
  private column(page: FlipbookPage): SceneNode[] {
    const pad = 7
    const gap = page.layout === 'pair' ? 4 : 3
    const across = this.size.width > this.size.height && page.layout !== 'grid'
    const content = { x: pad, y: pad, width: this.size.width - 2 * pad, height: this.size.height - 2 * pad }
    const caption = this.caption(page, content.width)
    const fixed = caption ? caption.height + gap : 0
    const area = { ...content, height: content.height - fixed }
    const grows = page.layout === 'pair' ? [1, 1] : page.layout === 'collage' ? [1.4, 1] : [1]
    const lengths = flex((across ? area.width : area.height) - gap * (grows.length - 1), grows)
    const tracks: Box[] = []
    let at = across ? area.x : area.y

    for (const length of lengths) {
      tracks.push(across ? { ...area, x: at, width: length } : { ...area, y: at, height: length })
      at += length + gap
    }

    const half = (track: Box, index: number, stacked = false): Box =>
      stacked
        ? { ...track, y: track.y + index * ((track.height + gap) / 2), height: (track.height - gap) / 2 }
        : { ...track, x: track.x + index * ((track.width + gap) / 2), width: (track.width - gap) / 2 }
    const boxes = (() => {
      switch (page.layout) {
        case 'grid': {
          const [grid] = tracks

          return [half(half(grid, 0, true), 0), half(half(grid, 0, true), 1), half(half(grid, 1, true), 0), half(half(grid, 1, true), 1)]
        }
        case 'collage':
          return [tracks[0], half(tracks[1], 0, across), half(tracks[1], 1, across)]
        default:
          return tracks
      }
    })()
    const nodes = boxes.map((box, i) => this.slot(page, i, box))

    if (caption) nodes.push(this.lines(caption, { ...content, y: area.y + area.height + gap, height: caption.height }, 'center'))

    return nodes
  }

  /** Layouts drawn from the boxes in `PLACED_LAYOUTS`. */
  private placed(page: FlipbookPage, placed: PlacedLayout): SceneNode[] {
    const nodes = placed.slots.map((slot, i) => this.placedSlot(page, i, slot, !!placed.loose))

    if (!page.caption) return nodes

    const box: Box = { x: placed.caption.x, y: placed.caption.y, width: placed.caption.width, height: placed.caption.height }
    const block = placed.prose
      ? this.text.set(page.caption, serif(4.4), { width: box.width, lineHeight: 1.55 })
      : this.text.set(page.caption, serif(3.8, 'italic'), { width: box.width, lineHeight: 1.35 })
    const top = placed.prose ? box.y : box.y + (box.height - block.height) / 2

    return [
      ...nodes,
      { kind: 'group', clip: rect(box), children: [this.lines(block, { ...box, y: top }, placed.prose ? 'left' : 'center')] },
    ]
  }

  private placedSlot(page: FlipbookPage, index: number, { rotate, ...box }: PageBox, loose: boolean): SceneNode {
    const slot = this.slot(page, index, box, { clip: !loose })
    const shadows: SceneNode[] = loose
      ? [
          { kind: 'shadow', shape: rect(box), color: 'rgba(0,0,0,0.18)', offset: { x: 0, y: 0.4 }, blur: 0.8 },
          { kind: 'shadow', shape: rect(box), color: 'rgba(0,0,0,0.25)', offset: { x: 0, y: 1.6 }, blur: 3.2, spread: -1 },
        ]
      : []
    const children = [...shadows, slot]

    if (!rotate) return { kind: 'group', children }

    return { kind: 'group', rotate: { angle: rotate, origin: { x: box.x + box.width / 2, y: box.y + box.height / 2 } }, children }
  }

  private pageNumber(number: number, side: Side): SceneNode {
    const width = this.size.width - 10
    const block = this.text.set(String(number), serif(2.8), { width })

    return {
      ...this.lines(
        block,
        { x: 5, y: this.size.height - 2.6 - block.height, width, height: block.height },
        side === 'left' ? 'left' : 'right',
      ),
      opacity: 0.6,
    }
  }

  /** The paper under `nodes`, with its grain over them. */
  private sheet(nodes: SceneNode[], { bound, side }: PageSceneOptions): Scene {
    const { look, area } = this
    const { width, height } = this.size
    const centre = { x: width / 2, y: height / 2 }
    const light = { x: width * 0.3, y: height * 0.2 }
    const spine: SceneNode[] =
      bound && side
        ? [
            this.edgeGradient(side, [
              [0, 'rgba(20,12,4,0.5)'],
              [0.015, 'rgba(20,12,4,0.3)'],
              [0.04, 'rgba(20,12,4,0.14)'],
              [0.08, 'rgba(20,12,4,0.05)'],
              [0.15, 'rgba(20,12,4,0)'],
              [0.94, 'rgba(20,12,4,0)'],
              [1, 'rgba(20,12,4,0.07)'],
            ]),
            this.edgeGradient(side, [
              [0.06, 'rgba(255,250,240,0)'],
              [0.13, 'rgba(255,250,240,0.07)'],
              [0.26, 'rgba(255,250,240,0.02)'],
              [0.4, 'rgba(255,250,240,0)'],
            ]),
          ]
        : []

    return {
      width,
      height,
      nodes: [
        { kind: 'fill', shape: rect(area), paint: look.background },
        {
          kind: 'fill',
          shape: rect(area),
          paint: { type: 'texture', texture: look.texture, size: TEXTURE_TILE },
          blend: look.textureBlend,
        },
        {
          kind: 'fill',
          shape: rect(area),
          paint: {
            type: 'radial',
            center: centre,
            radius: farthestCorner(centre, area),
            stops: [
              { offset: look.vignetteFrom, color: withAlpha(look.vignette, 0) },
              { offset: 1, color: look.vignette },
            ],
          },
        },
        {
          kind: 'fill',
          shape: rect(area),
          paint: {
            type: 'radial',
            center: light,
            radius: farthestCorner(light, area),
            stops: [
              { offset: 0, color: look.light },
              { offset: 0.55, color: withAlpha(look.light, 0) },
            ],
          },
        },
        ...nodes,
        {
          kind: 'fill',
          shape: rect(area),
          paint: { type: 'texture', texture: look.grain, size: TEXTURE_TILE },
          opacity: look.grainOpacity,
        },
        ...spine,
      ],
    }
  }

  private edgeGradient(side: Side, stops: [number, string][]): SceneNode {
    const [from, to] = side === 'right' ? [0, this.size.width] : [this.size.width, 0]

    return {
      kind: 'fill',
      shape: rect(this.area),
      paint: { type: 'linear', from: { x: from, y: 0 }, to: { x: to, y: 0 }, stops: stops.map(([offset, color]) => ({ offset, color })) },
    }
  }
}
