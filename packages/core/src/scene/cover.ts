import { COVER_THEMES, coverHasText, type CoverTheme, type FlipbookBook, type FlipbookPhoto } from '../book'
import { FLEURON, decoArt, printBeside } from '../cover-art'
import { PhotoCrop } from '../position'
import { pageSize, type PageSize } from '../shape'
import { angledGradient, farthestCorner, inset, rect, withAlpha } from './frame'
import { coverArt, ornament } from './marks'
import type { Typesetter } from './text'
import type { Box, Color, FontSpec, Paint, Scene, SceneNode, Shadow, Shape } from './types'

/** One CSS pixel on a 210 mm cover, in page units. */
const PX = 1 / 7.937

/**
 * A row of a column laid out top to bottom: its height, the space above it and what it draws at a
 * given top, centred on the column's middle line.
 */
interface Row {
  height: number
  gap: number
  draw: (top: number, centre: number) => SceneNode[]
}

const heightOf = (rows: Row[]) => rows.reduce((sum, row) => sum + row.gap + row.height, 0)

/** Rows stacked down `box`, from its top or centred in it. */
function column(rows: Row[], box: Box, justify: 'start' | 'center' | 'end' = 'start'): SceneNode[] {
  const total = heightOf(rows)
  const centre = box.x + box.width / 2
  let top = justify === 'start' ? box.y : justify === 'center' ? box.y + (box.height - total) / 2 : box.y + box.height - total

  return rows.flatMap((row) => {
    top += row.gap

    const nodes = row.draw(top, centre)

    top += row.height

    return nodes
  })
}

/**
 * The cloth of each cover theme: light and weave over the cloth colour, as the reader paints it. Light
 * sits at a share of the cover's width and height.
 */
function cloth(theme: CoverTheme, cover: Box): Paint[] {
  const at = (x: number, y: number) => ({ x: (x / 100) * cover.width, y: (y / 100) * cover.height })
  const circle = (x: number, y: number, color: string, to: number): Paint => {
    const centre = at(x, y)
    const reach = Math.max(...[0, cover.width].flatMap((cx) => [0, cover.height].map((cy) => Math.hypot(cx - centre.x, cy - centre.y))))

    return {
      type: 'radial',
      center: centre,
      radius: { x: reach, y: reach },
      stops: [
        { offset: 0, color },
        { offset: to, color: withAlpha(color, 0) },
      ],
    }
  }
  const ellipse = (x: number, y: number, stops: [number, string][]): Paint => {
    const centre = at(x, y)

    return {
      type: 'radial',
      center: centre,
      radius: farthestCorner(centre, cover),
      stops: stops.map(([offset, color]) => ({ offset, color })),
    }
  }
  const rings = (x: number, y: number, color: string, every: number): Paint => ({
    type: 'radial',
    center: at(x, y),
    radius: { x: every * PX, y: every * PX },
    stops: [
      { offset: 0, color },
      { offset: 1 / every, color },
      { offset: 1 / every, color: withAlpha(color, 0) },
      { offset: 1, color: withAlpha(color, 0) },
    ],
    repeat: true,
  })
  const lines = (vertical: boolean, color: string): Paint => ({
    type: 'linear',
    from: vertical ? { x: 0, y: 0 } : { x: 0, y: cover.height },
    to: vertical ? { x: 3 * PX, y: 0 } : { x: 0, y: cover.height - 3 * PX },
    stops: [
      { offset: 0, color },
      { offset: 1 / 3, color },
      { offset: 1 / 3, color: withAlpha(color, 0) },
      { offset: 1, color: withAlpha(color, 0) },
    ],
    repeat: true,
  })

  switch (theme) {
    case 'linen':
      return [lines(true, 'rgba(90,70,40,0.05)'), lines(false, 'rgba(90,70,40,0.05)')]
    case 'midnight':
      return [rings(50, 50, 'rgba(255,255,255,0.02)', 3), circle(70, 15, 'rgba(150,170,255,0.12)', 0.45)]
    case 'leather':
      return [
        rings(70, 80, 'rgba(255,255,255,0.03)', 5),
        rings(20, 30, 'rgba(0,0,0,0.06)', 4),
        ellipse(50, 55, [
          [0.5, 'rgba(0,0,0,0)'],
          [1, 'rgba(0,0,0,0.35)'],
        ]),
        ellipse(30, 18, [
          [0, 'rgba(255,220,170,0.12)'],
          [0.5, 'rgba(255,220,170,0)'],
        ]),
      ]
    case 'sage':
      return [lines(true, 'rgba(255,255,255,0.03)'), lines(false, 'rgba(0,0,0,0.05)'), circle(30, 20, 'rgba(255,255,255,0.08)', 0.45)]
    case 'blush':
      return [lines(true, 'rgba(90,40,30,0.04)'), lines(false, 'rgba(90,40,30,0.05)'), circle(30, 20, 'rgba(255,255,255,0.18)', 0.45)]
    default:
      return [rings(50, 50, 'rgba(0,0,0,0.04)', 3), circle(30, 20, 'rgba(255,255,255,0.08)', 0.45)]
  }
}

export interface CoverSceneOptions {
  /** Draw the shadow of the hinge along the spine, as on a bound book. */
  bound?: boolean
}

/** Stamped into the cloth: a dark edge below the letters and a light one above. */
const STAMPED: Shadow[] = [
  { offset: { x: 0, y: 0.15 }, blur: 0, color: 'rgba(0,0,0,0.35)' },
  { offset: { x: 0, y: -0.1 }, blur: 0, color: 'rgba(255,255,255,0.12)' },
]

/**
 * The front and back covers as scenes: the cloth, the design's layout, the title and the finish over
 * the board, laid out exactly as the web reader lays them out. Covers wider than tall set the photo
 * beside the title where the design stacks them.
 */
export class CoverScene {
  readonly ink: Color
  readonly cloth: Color
  /** The cover's size in page units, the same as a page's. */
  readonly size: PageSize

  private readonly area: Box

  constructor(
    readonly book: FlipbookBook,
    readonly text: Typesetter,
  ) {
    const theme = COVER_THEMES[book.theme ?? 'classic'] ?? COVER_THEMES.classic

    this.ink = theme.ink
    this.cloth = theme.cloth
    this.size = pageSize(book.pageShape)
    this.area = { x: 0, y: 0, ...this.size }
  }

  /** Whether the cover is wider than it is tall. */
  private get wide() {
    return this.size.width > this.size.height
  }

  /** The width of centred writing: `width` on a portrait cover, never more than the cover allows. */
  private measure(width: number) {
    return Math.min(width, this.size.width - (100 - width))
  }

  front({ bound }: CoverSceneOptions = {}): Scene {
    return this.board(this.design(), bound ? 'left' : null, this.book.coverDesign === 'image')
  }

  back({ bound }: CoverSceneOptions = {}): Scene {
    const { book } = this
    const kicker = (text: string, size: number, opacity: number, gap: number): Row =>
      this.textRow(text.toUpperCase(), this.sans(size, 0.3 * size), { width: this.size.width, opacity, gap })
    const rows: Row[] = [
      { height: 9, gap: 0, draw: (top, centre) => ornament({ x: centre - 4.5, y: top, width: 9, height: 9 }, this.ink) },
      ...(book.brand ? [kicker(book.brand, 3, 0.7, 2)] : []),
      ...(book.imprint ? [kicker(book.imprint, 2.4, 0.6, 2)] : []),
    ]
    const gilt = book.coverDesign === 'gilt' ? this.giltFrame() : []

    return this.board(
      [...gilt, ...column(rows, { x: 0, y: 0, width: this.size.width, height: this.size.height - 10 }, 'end')],
      bound ? 'right' : null,
      false,
    )
  }

  private serif(size: number, style: FontSpec['style'] = 'normal', weight = 400, letterSpacing?: number): FontSpec {
    return { family: 'serif', style, weight, size, ...(letterSpacing ? { letterSpacing } : {}) }
  }

  private sans(size: number, letterSpacing: number): FontSpec {
    return { family: 'sans', style: 'normal', weight: 400, size, letterSpacing }
  }

  /** A block of text set across `width`, centred on the cover's middle line. */
  private textRow(
    text: string,
    font: FontSpec,
    {
      width,
      gap = 0,
      lineHeight,
      wrap,
      color = this.ink,
      opacity,
      shadows,
      x,
    }: {
      width: number
      gap?: number
      lineHeight?: number
      wrap?: 'balance'
      color?: Color
      opacity?: number
      shadows?: Shadow[]
      x?: number
    },
  ): Row {
    const block = this.text.set(text, font, { width, lineHeight, wrap })

    return {
      height: block.height,
      gap,
      draw: (top, centre) => [
        {
          kind: 'text',
          font,
          color,
          lines: block.place(x ?? centre - width / 2, top, width, 'center'),
          ...(opacity !== undefined ? { opacity } : {}),
          ...(shadows ? { shadows } : {}),
        },
      ],
    }
  }

  private kicker(width: number, size = 2.6, color = this.ink): Row[] {
    const { kicker } = this.book

    return kicker ? [this.textRow(kicker.toUpperCase(), this.sans(size, 0.3 * size), { width, color, opacity: 0.7 })] : []
  }

  private title(width: number, size: number, gap: number, extra: { color?: Color; shadows?: Shadow[]; deco?: boolean } = {}): Row {
    const { deco, ...rest } = extra
    const font = deco ? this.serif(size, 'normal', 400, 0.12 * size) : this.serif(size, 'normal', 500)

    return this.textRow(deco ? this.book.title.toUpperCase() : this.book.title, font, {
      width,
      gap,
      lineHeight: 1.05,
      wrap: 'balance',
      shadows: STAMPED,
      ...rest,
    })
  }

  private subtitle(width: number, size: number, gap: number, color = this.ink): Row[] {
    const { subtitle } = this.book

    return subtitle ? [this.textRow(subtitle, this.serif(size, 'italic'), { width, gap, color, opacity: 0.85 })] : []
  }

  /** The cover photo covering `box`, clipped to `clip` (the box itself when left out). */
  private photo(photo: FlipbookPhoto, box: Box, clip: Shape = rect(box)): SceneNode {
    const { x, y, zoom } = PhotoCrop.of(photo.position)

    return {
      kind: 'group',
      clip,
      children: [
        { kind: 'photo', photo: { src: photo.src, width: photo.width, height: photo.height }, box, position: { x, y, zoom }, clip: 'rect' },
      ],
    }
  }

  private design(): SceneNode[] {
    switch (this.book.coverDesign ?? 'classic') {
      case 'gilt':
        return this.gilt()
      case 'window':
        return this.window()
      case 'label':
        return this.label()
      case 'deco':
        return this.deco()
      case 'image':
        return this.image()
      default:
        return this.classic()
    }
  }

  /** A ruled panel with the title over an inset photo, or beside it on a wide cover. */
  private classic(): SceneNode[] {
    const { book } = this
    const { width: w, height: h } = this.size
    const panel: Box = { x: 6, y: 6, width: w - 12, height: h - 12 }
    const content: Box = { x: 6 + PX + 6, y: 6 + PX + 8, width: w - 12 - 2 * PX - 12, height: h - 12 - 2 * PX - 16 }
    const rule: SceneNode = { kind: 'stroke', shape: rect(inset(panel, PX / 2)), color: withAlpha(this.ink, 0.4), width: PX }
    const text = coverHasText(book)
    const inlay = (box: Box): SceneNode[] => {
      const inner = inset(box, 0.8)

      return [
        this.photo(book.cover!, inner),
        { kind: 'shadow', shape: rect(inner), inset: true, offset: { x: 0, y: 0 }, blur: 2, color: 'rgba(0,0,0,0.4)' },
        { kind: 'stroke', shape: rect(inset(box, 0.4)), color: withAlpha(this.ink, 0.6), width: 0.8 },
      ]
    }

    if (this.wide && book.cover && text) {
      const beside = content.width * 0.42
      const rows = [...this.kicker(beside), this.title(beside, 9, 5), ...this.subtitle(beside, 4, 5)]
      const photo: Box = { ...content, x: content.x + beside + 7, width: content.width - beside - 7 }

      return [rule, ...column(rows, { ...content, width: beside }, 'center'), ...inlay(photo)]
    }

    const width = this.measure(content.width)
    const rows: Row[] = text ? [...this.kicker(width), this.title(width, 9, 5)] : []

    if (book.cover) {
      const used = heightOf(rows) + 7
      const height = Math.max(0, Math.min(content.height - used, content.height * 0.62))

      rows.push({ height, gap: 7, draw: (top) => inlay({ x: content.x, y: top, width: content.width, height }) })
    } else if (text) rows.push(...this.subtitle(width, 4, 5))

    return [rule, ...column(rows, content)]
  }

  /** Gold rules with a flourish in each corner, each casting a hard shadow. */
  private giltFrame(): SceneNode[] {
    const frame = inset(this.area, 5)
    const shadow: Shadow = { offset: { x: 0, y: 0.15 }, blur: 0, color: 'rgba(0,0,0,0.3)' }
    const fleuron = (x: number, y: number, mirror: { x?: boolean; y?: boolean }): SceneNode => ({
      kind: 'group',
      shadow,
      children: coverArt(FLEURON, { x, y, width: 18, height: 18 }, this.ink, mirror),
    })
    const far = { x: this.size.width - 3.6 - 18, y: this.size.height - 3.6 - 18 }

    return [
      {
        kind: 'group',
        shadow,
        opacity: 0.85,
        children: [
          { kind: 'stroke', shape: rect(inset(frame, 0.175)), color: this.ink, width: 0.35 },
          { kind: 'stroke', shape: rect(inset(frame, 1.6 - 0.075)), color: this.ink, width: 0.15 },
        ],
      },
      fleuron(3.6, 3.6, {}),
      fleuron(far.x, 3.6, { x: true }),
      fleuron(3.6, far.y, { y: true }),
      fleuron(far.x, far.y, { x: true, y: true }),
    ]
  }

  /** A photo cut to an oval or an arch: an ink rule on its edge, a ring of ink around it and a soft shadow inside. */
  private shapedPhoto(photo: FlipbookPhoto, box: Box, shape: 'oval' | 'arch'): SceneNode[] {
    const border = shape === 'oval' ? 0.6 : 0.5
    const ring = shape === 'oval' ? 1.5 : 1.7
    const outline = (by: number): Shape => {
      const b = inset(box, by)

      if (shape === 'oval') return { type: 'ellipse', box: b }

      const r = Math.max(0, Math.min(28, box.width / 2) - by)

      return { type: 'roundrect', box: b, radii: [r, r, 0, 0] }
    }
    const inner = outline(border)

    return [
      {
        kind: 'fill',
        shape: { type: 'cutout', outer: outline(-ring), inner: outline(0) },
        paint: withAlpha(this.ink, shape === 'oval' ? 0.55 : 0.6),
      },
      this.photo(photo, inset(box, border), inner),
      { kind: 'shadow', shape: inner, inset: true, offset: { x: 0, y: 0 }, blur: 3, color: 'rgba(0,0,0,0.45)' },
      { kind: 'stroke', shape: outline(border / 2), color: this.ink, width: border },
    ]
  }

  /**
   * A shaped photo `width` × `height` as a row, shrunk to `room` when the column is short and kept in
   * its own proportions.
   */
  private shapedRow(width: number, height: number, gap: number, room: number, shape: 'oval' | 'arch'): Row {
    const scale = Math.min(1, Math.max(0, room) / height)
    const size = { width: width * scale, height: height * scale }

    return {
      height: size.height,
      gap,
      draw: (top, centre) => this.shapedPhoto(this.book.cover!, { x: centre - size.width / 2, y: top, ...size }, shape),
    }
  }

  private gilt(): SceneNode[] {
    const { book } = this
    const { width: w, height: h } = this.size
    const text = coverHasText(book)
    const area: Box = { x: 12, y: 14, width: w - 24, height: h - 28 }

    if (this.wide && book.cover && text) {
      const half = area.width / 2
      const words = [...this.kicker(half - 4), this.title(half - 4, 8, 5), ...this.subtitle(half - 4, 4, 5)]

      return [
        ...this.giltFrame(),
        ...column([this.shapedRow(52, 64, 0, area.height, 'oval')], { ...area, width: half }, 'center'),
        ...column(words, { ...area, x: area.x + half + 4, width: half - 4 }, 'center'),
      ]
    }

    const width = this.measure(76)
    const words = text ? [...this.kicker(width), this.title(width, 8, 5)] : []
    const after = text ? this.subtitle(width, 4, 5) : []
    const room = area.height - heightOf(words) - heightOf(after) - 6
    const rows: Row[] = [...words, ...(book.cover ? [this.shapedRow(52, 64, 6, room, 'oval')] : []), ...after]

    return [...this.giltFrame(), ...column(rows, area, 'center')]
  }

  /** The photo set into a window pressed into the board, the title stamped below. */
  private window(): SceneNode[] {
    const { book } = this
    const { width: w, height: h } = this.size
    const band = (100 / 3) * Math.min(1, h / (133 + 1 / 3))
    const box: Box = { x: 12, y: 10, width: w - 24, height: h - 24 - band }
    const r = 0.6
    const shape: Shape = { type: 'roundrect', box, radii: [r, r, r, r] }
    const inside = (x: number, y: number, blur: number, color: string): SceneNode => ({
      kind: 'shadow',
      shape,
      inset: true,
      offset: { x, y },
      blur,
      color,
    })
    const outside = (y: number, color: string): SceneNode => ({ kind: 'shadow', shape, offset: { x: 0, y }, blur: 0, color })
    const nodes: SceneNode[] = [
      outside(-0.3, 'rgba(0,0,0,0.25)'),
      outside(0.3, 'rgba(255,255,255,0.1)'),
      ...(book.cover
        ? [this.photo(book.cover, box, shape)]
        : [{ kind: 'fill', shape, paint: 'rgba(0,0,0,0.12)' } as SceneNode, ...this.emptyOrnament(box)]),
      inside(0, -0.3, 0.6, 'rgba(255,255,255,0.12)'),
      inside(0, 0.8, 1.6, 'rgba(0,0,0,0.55)'),
      inside(-0.6, 0, 1.2, 'rgba(0,0,0,0.2)'),
      inside(0.6, 0, 1.2, 'rgba(0,0,0,0.25)'),
      inside(0, 1.2, 2, 'rgba(0,0,0,0.5)'),
    ]

    if (!coverHasText(book)) return nodes

    const width = this.measure(80)
    const rows: Row[] = [
      ...this.kicker(width),
      this.title(width, 7.5, 1.5, {
        shadows: [
          { offset: { x: 0, y: -0.15 }, blur: 0, color: 'rgba(0,0,0,0.45)' },
          { offset: { x: 0, y: 0.15 }, blur: 0, color: 'rgba(255,255,255,0.18)' },
        ],
      }),
      ...this.subtitle(width, 3.4, 2),
    ]

    return [...nodes, ...column(rows, { x: 10, y: box.y + box.height + 6, width: w - 20, height: band }, 'center')]
  }

  private emptyOrnament(box: Box): SceneNode[] {
    const size = 16

    return [
      {
        kind: 'group',
        opacity: 0.6,
        children: ornament({ x: box.x + (box.width - size) / 2, y: box.y + (box.height - size) / 2, width: size, height: size }, this.ink),
      },
    ]
  }

  /** The tipped-in print: a mounted photo turned a little, held by four photo corners. */
  private print(print: Box): SceneNode {
    const corner = 5.5 * 1.1
    const { x, y, width: w, height: h } = print
    const corners = [
      [
        { x, y },
        { x: x + corner, y },
        { x, y: y + corner },
      ],
      [
        { x: x + w - corner, y },
        { x: x + w, y },
        { x: x + w, y: y + corner },
      ],
      [
        { x, y: y + h - corner },
        { x: x + corner, y: y + h },
        { x, y: y + h },
      ],
      [
        { x: x + w, y: y + h - corner },
        { x: x + w, y: y + h },
        { x: x + w - corner, y: y + h },
      ],
    ]

    return {
      kind: 'group',
      rotate: { angle: -2.5, origin: { x: x + w / 2, y: y + h / 2 } },
      children: [
        { kind: 'shadow', shape: rect(print), offset: { x: 0, y: 2 }, blur: 4, spread: -1.6, color: 'rgba(0,0,0,0.45)' },
        { kind: 'shadow', shape: rect(print), offset: { x: 0, y: 0.6 }, blur: 1.2, color: 'rgba(0,0,0,0.35)' },
        { kind: 'fill', shape: rect(print), paint: '#f7f2e7' },
        this.photo(this.book.cover!, inset(print, 2.4)),
        ...corners.map((points): SceneNode => ({ kind: 'fill', shape: { type: 'polygon', points }, paint: '#1f1b18' })),
      ],
    }
  }

  /** A print held by photo corners over a paper title label, the label beside it on a wide cover. */
  private label(): SceneNode[] {
    const { book } = this
    const { width: w, height: h } = this.size
    const text = coverHasText(book)
    const ink = '#3a2f25'
    const labelRows = (width: number): Row[] => [
      ...this.kicker(width, 2.2, ink),
      this.title(width, 6.4, 1, { color: ink, shadows: [] }),
      ...this.subtitle(width, 3, 1.5, ink),
    ]
    const labelOf = (x: number, y: number, width: number): SceneNode[] => {
      const rows = labelRows(width - 8)
      const height = 4 + heightOf(rows) + 4.5
      const box: Box = { x, y: y < 0 ? -y - height / 2 : y, width, height }

      return [
        { kind: 'shadow', shape: rect(box), offset: { x: 0, y: 0.3 }, blur: 0.8, color: 'rgba(0,0,0,0.3)' },
        { kind: 'fill', shape: rect(box), paint: '#f4eddc' },
        { kind: 'fill', shape: rect(box), paint: { type: 'texture', texture: 'paper-fine', size: 50 } },
        { kind: 'fill', shape: { type: 'ring', outer: box, inner: inset(box, 1.4) }, paint: 'rgba(60,45,30,0.5)' },
        { kind: 'fill', shape: { type: 'ring', outer: box, inner: inset(box, 1.2) }, paint: '#f4eddc' },
        ...column(rows, { x: box.x + 4, y: box.y + 4, width: width - 8, height: height - 8.5 }),
      ]
    }

    if (!book.cover) return text ? labelOf((w - 64) / 2, h === 400 / 3 ? 44 : -h / 2, 64) : []

    if (this.wide) {
      const { print, label } = printBeside(this.size, text)

      return text ? [this.print(print), ...labelOf(label.x, -h / 2, label.width)] : [this.print(print)]
    }

    const rows = text ? labelRows(56) : []
    const room = text ? h - 11 - 11 - (4 + heightOf(rows) + 4.5) - 6 : h - 22
    const height = Math.min(62, room)
    const width = (height * 68) / 62
    const print = this.print({ x: (w - width) / 2, y: 11, width, height })

    return text ? [print, ...labelOf((w - 64) / 2, 11 + height + 11, 64)] : [print]
  }

  /** Art deco rays rising to an arched photo, the title spaced out below. */
  private deco(): SceneNode[] {
    const { book } = this
    const { width: w, height: h } = this.size
    const text = coverHasText(book)
    const width = this.measure(72)
    const kicker = text ? this.kicker(width) : []
    const after = text ? [this.title(width, 6.6, 7, { deco: true }), ...this.subtitle(width, 3.4, 2.5)] : []
    const room = h - 32 - heightOf(kicker) - heightOf(after) - 4
    const rows: Row[] = [...kicker, ...(book.cover ? [this.shapedRow(56, 62, 4, room, 'arch')] : []), ...after]

    return [
      { kind: 'group', opacity: 0.9, children: coverArt(decoArt(this.size), this.area, this.ink) },
      ...column(rows, { x: 14, y: 17, width: w - 28, height: h - 32 }),
    ]
  }

  /** The photo across the whole cover, the title over a shade at its foot. */
  private image(): SceneNode[] {
    const { book, area } = this
    const { width: w, height: h } = this.size
    const text = coverHasText(book)
    const nodes: SceneNode[] = book.cover
      ? [this.photo(book.cover, area), { kind: 'fill', shape: rect(area), paint: this.ink, blend: 'soft-light', opacity: 0.18 }]
      : []

    if (!text) return nodes

    const width = this.measure(80)
    const color = book.cover ? '#fff' : this.ink
    const rows: Row[] = [
      ...this.kicker(width, 2.6, color),
      this.title(width, 9, 2, {
        color,
        shadows: [{ offset: { x: 0, y: 0.3 }, blur: 1.2, color: 'rgba(0,0,0,0.5)' }],
      }),
      ...this.subtitle(width, 4, 5, color),
    ]

    if (!book.cover) return column(rows, { x: 10, y: 26, width: w - 20, height: h - 36 }, 'center')

    const height = 26 + heightOf(rows) + 10
    const shade: Box = { x: 0, y: h - height, width: w, height }

    return [
      ...nodes,
      {
        kind: 'fill',
        shape: rect(shade),
        paint: {
          type: 'linear',
          from: { x: 0, y: h },
          to: { x: 0, y: shade.y },
          stops: [
            { offset: 0, color: 'rgba(0,0,0,0.65)' },
            { offset: 0.55, color: 'rgba(0,0,0,0.25)' },
            { offset: 1, color: 'rgba(0,0,0,0)' },
          ],
        },
      },
      ...column(rows, { x: 10, y: shade.y + 26, width: w - 20, height: height - 36 }),
    ]
  }

  /** The board: cloth, the design, the hinge's shadow on a bound book and the finish over everything. */
  private board(design: SceneNode[], hinge: 'left' | 'right' | null, photographic: boolean): Scene {
    const { area } = this
    const { width: w, height: h } = this.size
    const centre = { x: w / 2, y: h / 2 }
    const shade = (offset: number, alpha: number) => ({ offset, color: `rgba(0,0,0,${alpha})` })
    const finish: SceneNode[] = [
      { kind: 'fill', shape: rect(area), paint: { type: 'texture', texture: 'grain-fine', size: 40 } },
      {
        kind: 'fill',
        shape: rect(area),
        paint: {
          type: 'radial',
          center: centre,
          radius: farthestCorner(centre, area),
          stops: [
            { offset: 0.6, color: 'rgba(0,0,0,0)' },
            { offset: 1, color: 'rgba(0,0,0,0.22)' },
          ],
        },
      },
      {
        kind: 'fill',
        shape: rect(area),
        paint: angledGradient(area, 115, [
          { offset: 0, color: 'rgba(255,255,255,0.1)' },
          { offset: 0.35, color: 'rgba(255,255,255,0)' },
          { offset: 0.7, color: 'rgba(255,255,255,0)' },
          { offset: 1, color: 'rgba(255,255,255,0.05)' },
        ]),
      },
      { kind: 'shadow', shape: rect(area), inset: true, offset: { x: 0, y: 0 }, blur: 2, color: 'rgba(0,0,0,0.18)' },
      { kind: 'fill', shape: { type: 'ring', outer: area, inner: inset(area, 0.3) }, paint: 'rgba(0,0,0,0.12)' },
    ]
    const hinges: SceneNode[] = hinge
      ? [
          {
            kind: 'fill',
            shape: rect({ x: hinge === 'left' ? 0 : w - 4, y: 0, width: 4, height: h }),
            paint: {
              type: 'linear',
              from: { x: hinge === 'left' ? 0 : w, y: 0 },
              to: { x: hinge === 'left' ? 4 : w - 4, y: 0 },
              stops: [shade(0, 0.35), shade(0.5, 0.1), shade(1, 0)],
            },
          },
        ]
      : []

    return {
      width: w,
      height: h,
      nodes: [
        { kind: 'fill', shape: rect(area), paint: this.cloth },
        ...cloth(this.book.theme ?? 'classic', area).map((paint): SceneNode => ({ kind: 'fill', shape: rect(area), paint })),
        ...design,
        ...hinges,
        {
          kind: 'group',
          blend: photographic ? 'overlay' : 'soft-light',
          children: photographic ? finish.map((node): SceneNode => ({ ...node, opacity: 0.9 })) : finish,
        },
      ],
    }
  }
}
