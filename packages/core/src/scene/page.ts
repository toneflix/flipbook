import {
  PLACED_LAYOUTS,
  panoramaView,
  photoFrame,
  type FlipbookBook,
  type FlipbookPage,
  type FrameStyle,
  type PageBox,
  type PageHalf,
} from '../book'
import type { Face } from '../layout'
import { CoverScene } from './cover'
import { FrameScene, farthestCorner, rect, withAlpha } from './frame'
import { ornament } from './marks'
import { PAPER_LOOKS, inkOf, type PaperLook } from './paper'
import { Typesetter, type TextBlock } from './text'
import type { Box, FontSpec, Scene, SceneNode, TextMeasure } from './types'

/** Page height in page units: pages are 3:4. */
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

const PAGE: Box = { x: 0, y: 0, width: 100, height: PAGE_HEIGHT }

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

  private readonly frames: FrameScene

  constructor(
    readonly book: FlipbookBook,
    measure: TextMeasure,
  ) {
    this.look = PAPER_LOOKS[book.paper ?? 'ivory'] ?? PAPER_LOOKS.ivory
    this.frame = book.frame ?? 'none'
    this.text = new Typesetter(measure)
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
    const width = 100 - 24
    const credit = [book.author, book.year].filter(Boolean).join(' · ').toUpperCase()
    const heading = this.text.set(book.title, serif(7.5), { width, lineHeight: 1.1, wrap: 'balance' })
    const subtitle = book.subtitle ? this.text.set(book.subtitle, serif(4, 'italic'), { width, lineHeight: 1.45 }) : null
    const creditFont: FontSpec = { family: 'sans', style: 'normal', weight: 400, size: 2.6, letterSpacing: 0.52 }
    const creditText = credit ? this.text.set(credit, creditFont, { width }) : null
    const rows: { height: number; gap: number; draw: (y: number) => SceneNode[] }[] = [
      { height: 9, gap: 0, draw: (y) => ornament({ x: 50 - 4.5, y, width: 9, height: 9 }, this.ink()) },
      { height: heading.height, gap: 6, draw: (y) => [this.lines(heading, { x: 12, y, width, height: heading.height }, 'center')] },
      ...(subtitle
        ? [
            {
              height: subtitle.height,
              gap: 4,
              draw: (y: number) => [this.lines(subtitle, { x: 12, y, width, height: subtitle.height }, 'center')],
            },
          ]
        : []),
      {
        height: 1 / 7.937,
        gap: 7,
        draw: (y) => [
          { kind: 'fill', shape: rect({ x: 40, y, width: 20, height: 1 / 7.937 }), paint: this.ink(), opacity: 0.3 } as SceneNode,
        ],
      },
      ...(creditText
        ? [
            {
              height: creditText.height,
              gap: 5,
              draw: (y: number) => [this.lines(creditText, { x: 12, y, width, height: creditText.height }, 'center')],
            },
          ]
        : []),
    ]
    const total = rows.reduce((sum, row) => sum + row.gap + row.height, 0)
    let y = 12 + (PAGE_HEIGHT - 24 - total) / 2

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
    const block = colophon ? this.text.set(colophon, serif(3.6, 'italic'), { width: 76 }) : null
    const nodes: SceneNode[] = block
      ? [{ ...this.lines(block, { x: 12, y: PAGE_HEIGHT - 12 - block.height, width: 76, height: block.height }, 'center'), opacity: 0.9 }]
      : []

    return this.sheet(nodes, options)
  }

  page(page: FlipbookPage, options: PageSceneOptions = {}): Scene {
    const nodes = PLACED_LAYOUTS[page.layout] ? this.placed(page) : this.flowed(page, options.half)

    if (options.number !== undefined && page.layout !== 'single' && page.layout !== 'panorama')
      nodes.push(this.pageNumber(options.number, options.side ?? 'right'))

    return this.sheet(nodes, options)
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
    return [this.slot(page, 0, PAGE), ...this.captionOver(page)]
  }

  /** One photo across a spread: each half draws its side of it, and a single page sets it whole. */
  private panorama(page: FlipbookPage, half?: PageHalf): SceneNode[] {
    const view = panoramaView(half)
    const photo: SceneNode = { kind: 'group', clip: rect(PAGE), children: [this.slot(page, 0, view.photo)] }

    if (!page.caption) return [photo]
    if (typeof view.caption === 'string') return [photo, ...this.captionOver(page, view.caption === 'over')]

    const block = this.text.set(page.caption, serif(3.8, 'italic'), { width: view.caption.width, lineHeight: 1.35 })
    const top = view.caption.y + (view.caption.height - block.height) / 2

    return [photo, this.lines(block, { ...view.caption, y: top }, 'center')]
  }

  /** The caption set in white over a shade at the foot of a photo that fills the page, or just the shade. */
  private captionOver(page: FlipbookPage, words = true): SceneNode[] {
    if (!page.caption) return []

    const block = this.text.set(page.caption, serif(4.2, 'italic'), { width: 86, lineHeight: 1.35 })
    const height = 14 + block.height + 7
    const shade: Box = { x: 0, y: PAGE_HEIGHT - height, width: 100, height }

    const fill: SceneNode = {
      kind: 'fill',
      shape: rect(shade),
      paint: {
        type: 'linear',
        from: { x: 0, y: PAGE_HEIGHT },
        to: { x: 0, y: shade.y },
        stops: [
          { offset: 0, color: 'rgba(0,0,0,0.7)' },
          { offset: 0.5, color: 'rgba(0,0,0,0.3)' },
          { offset: 1, color: 'rgba(0,0,0,0)' },
        ],
      },
    }

    if (!words) return [fill]

    return [fill, this.lines(block, { x: 7, y: shade.y + 14, width: 86, height: block.height }, 'left', '#fff')]
  }

  private framed(page: FlipbookPage): SceneNode[] {
    const content = { x: 9, y: 10, width: 82, height: PAGE_HEIGHT - 16 }
    const block = this.text.set(page.caption ?? '', serif(4.2, 'italic'), { width: content.width, lineHeight: 1.35 })
    const captionHeight = Math.max(6, block.height)
    const slot = { ...content, height: content.height - 5 - captionHeight }

    return [
      this.slot(page, 0, slot, { fit: 'contain', clip: false }),
      this.lines(block, { x: content.x, y: slot.y + slot.height + 5, width: content.width, height: captionHeight }, 'center'),
    ]
  }

  private words(page: FlipbookPage): SceneNode[] {
    const width = 100 - 24
    const mark = this.text.set('“', serif(18), { width, lineHeight: 0.6 })
    const block = this.text.set(page.caption ?? '', serif(6, 'italic'), { width, lineHeight: 1.4, wrap: 'balance' })
    const total = mark.height + 4 + block.height
    const top = 14 + (PAGE_HEIGHT - 28 - total) / 2

    return [
      { ...this.lines(mark, { x: 12, y: top, width, height: mark.height }, 'center'), opacity: 0.3 },
      this.lines(block, { x: 12, y: top + mark.height + 4, width, height: block.height }, 'center'),
    ]
  }

  /** Pair, grid and collage: rows of photos over a caption. */
  private column(page: FlipbookPage): SceneNode[] {
    const pad = 7
    const gap = page.layout === 'pair' ? 4 : 3
    const content = { x: pad, y: pad, width: 100 - 2 * pad, height: PAGE_HEIGHT - 2 * pad }
    const caption = this.caption(page, content.width)
    const grows = page.layout === 'pair' ? [1, 1] : page.layout === 'collage' ? [1.4, 1] : [1]
    const fixed = caption ? caption.height + gap : 0
    const heights = flex(content.height - fixed - gap * (grows.length - 1), grows)
    const rows: Box[] = []
    let y = content.y

    for (const height of heights) {
      rows.push({ ...content, y, height })
      y += height + gap
    }

    const half = (row: Box, column: number, rowGap = gap): Box => ({
      ...row,
      x: row.x + column * ((row.width + rowGap) / 2),
      width: (row.width - rowGap) / 2,
    })
    const boxes = (() => {
      switch (page.layout) {
        case 'grid': {
          const [grid] = rows
          const top = { ...grid, height: (grid.height - gap) / 2 }
          const bottom = { ...top, y: top.y + top.height + gap }

          return [half(top, 0), half(top, 1), half(bottom, 0), half(bottom, 1)]
        }
        case 'collage':
          return [rows[0], half(rows[1], 0), half(rows[1], 1)]
        default:
          return rows
      }
    })()
    const nodes = boxes.map((box, i) => this.slot(page, i, box))

    if (caption) nodes.push(this.lines(caption, { ...content, y, height: caption.height }, 'center'))

    return nodes
  }

  /** Layouts drawn from the fixed boxes in `PLACED_LAYOUTS`. */
  private placed(page: FlipbookPage): SceneNode[] {
    const placed = PLACED_LAYOUTS[page.layout]!
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
    const block = this.text.set(String(number), serif(2.8), { width: 90 })

    return {
      ...this.lines(
        block,
        { x: 5, y: PAGE_HEIGHT - 2.6 - block.height, width: 90, height: block.height },
        side === 'left' ? 'left' : 'right',
      ),
      opacity: 0.6,
    }
  }

  /** The paper under `nodes`, with its grain over them. */
  private sheet(nodes: SceneNode[], { bound, side }: PageSceneOptions): Scene {
    const look = this.look
    const centre = { x: 50, y: PAGE_HEIGHT / 2 }
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
      width: 100,
      height: PAGE_HEIGHT,
      nodes: [
        { kind: 'fill', shape: rect(PAGE), paint: look.background },
        {
          kind: 'fill',
          shape: rect(PAGE),
          paint: { type: 'texture', texture: look.texture, size: TEXTURE_TILE },
          blend: look.textureBlend,
        },
        {
          kind: 'fill',
          shape: rect(PAGE),
          paint: {
            type: 'radial',
            center: centre,
            radius: farthestCorner(centre),
            stops: [
              { offset: look.vignetteFrom, color: withAlpha(look.vignette, 0) },
              { offset: 1, color: look.vignette },
            ],
          },
        },
        {
          kind: 'fill',
          shape: rect(PAGE),
          paint: {
            type: 'radial',
            center: { x: 30, y: PAGE_HEIGHT * 0.2 },
            radius: farthestCorner({ x: 30, y: PAGE_HEIGHT * 0.2 }),
            stops: [
              { offset: 0, color: look.light },
              { offset: 0.55, color: withAlpha(look.light, 0) },
            ],
          },
        },
        ...nodes,
        {
          kind: 'fill',
          shape: rect(PAGE),
          paint: { type: 'texture', texture: look.grain, size: TEXTURE_TILE },
          opacity: look.grainOpacity,
        },
        ...spine,
      ],
    }
  }

  private edgeGradient(side: Side, stops: [number, string][]): SceneNode {
    const [from, to] = side === 'right' ? [0, 100] : [100, 0]

    return {
      kind: 'fill',
      shape: rect(PAGE),
      paint: { type: 'linear', from: { x: from, y: 0 }, to: { x: to, y: 0 }, stops: stops.map(([offset, color]) => ({ offset, color })) },
    }
  }
}
