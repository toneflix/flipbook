import { BANDED_FRAMES, type FlipbookPhoto, type FrameStyle } from '../book'
import { PhotoCrop } from '../position'
import { inkOf, type PaperLook } from './paper'
import type { Box, Color, GradientStop, Paint, Point, SceneNode, Shape } from './types'

export const inset = (box: Box, by: number): Box => ({
  x: box.x + by,
  y: box.y + by,
  width: box.width - 2 * by,
  height: box.height - 2 * by,
})

export const rect = (box: Box): Shape => ({ type: 'rect', box })

/** A colour with its alpha replaced, from hex or `rgba()`. */
export function withAlpha(color: Color, alpha: number): Color {
  if (color.startsWith('#')) {
    const hex = color.length === 4 ? [...color.slice(1)].map((c) => c + c).join('') : color.slice(1, 7)
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))

    return `rgba(${r},${g},${b},${alpha})`
  }

  return color.replace(/,\s*[\d.]+\)$/, `,${alpha})`).replace(/^rgb\(/, 'rgba(')
}

/** The radii of a CSS `radial-gradient(ellipse at …)`: reaching the farthest corner with the closest-side shape. */
export function farthestCorner(centre: { x: number; y: number }, box: Box = { x: 0, y: 0, width: 100, height: 400 / 3 }) {
  const rx = Math.min(centre.x - box.x, box.x + box.width - centre.x)
  const ry = Math.min(centre.y - box.y, box.y + box.height - centre.y)
  const k = Math.hypot(
    Math.max(centre.x - box.x, box.x + box.width - centre.x) / rx,
    Math.max(centre.y - box.y, box.y + box.height - centre.y) / ry,
  )

  return { x: rx * k, y: ry * k }
}

/** A CSS `linear-gradient(<angle>deg, ...)` across a box, as two points. */
export function angledGradient(box: Box, angle: number, stops: GradientStop[]): Paint {
  const turn = (angle * Math.PI) / 180
  const dir = { x: Math.sin(turn), y: -Math.cos(turn) }
  const half = (Math.abs(box.width * dir.x) + Math.abs(box.height * dir.y)) / 2
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

  return {
    type: 'linear',
    from: { x: centre.x - dir.x * half, y: centre.y - dir.y * half },
    to: { x: centre.x + dir.x * half, y: centre.y + dir.y * half },
    stops,
  }
}

/** Leaves along a stem, alternating sides and shrinking toward the tip. */
const LEAVES = [14, 24, 34, 44, 54, 64, 74].map((x, i) => ({ x, angle: i % 2 ? 38 : -38, length: 26 - i * 2 }))

const LEAF = 'M0 0 C 5 -5, 14 -5, 20 0 C 14 5, 5 5, 0 0 Z'

const GOLD = '#b48a32'

/** The white border of an instant print. */
export const PRINT_WHITE = 'rgba(255,255,255,0.92)'

/** Film sprocket holes: width, height, and the pitch they repeat at. */
export const SPROCKET = { width: 1.6, height: 1.9, pitch: 3, margin: 0.6 }

/** Washi tape strips: length, width, how far their centre sits inside the photo corner, and colours. */
export const TAPE = { length: 14, width: 4, inset: 2.2, colors: ['#e9967a', '#7ea7d8'] }

/** Where `count` sprocket holes start along a band `length` long, spaced out to fill it evenly. */
export function sprockets(length: number): number[] {
  const { pitch, margin } = SPROCKET
  const room = length - 2 * margin
  const count = Math.max(1, Math.floor(room / pitch))
  const step = count > 1 ? (room - pitch) / (count - 1) : 0

  return Array.from({ length: count }, (_, i) => margin + i * step + (pitch - SPROCKET.width) / 2)
}

/** The radius of an arch's top: a half circle, or as high as the photo when it is too short for one. */
export const archRadius = (box: { width: number; height: number }) => Math.max(0, Math.min(box.width / 2, box.height))

/** The radius of the rounded frame's corners. */
export const ROUNDED_RADIUS = 2.2

/**
 * A photo printed on a page inside its frame: rules, mats, tints and bands under it, keylines, corners
 * and sprigs over it. Sizes are in page units, the same at any page size.
 */
export class FrameScene {
  constructor(readonly look: PaperLook) {}

  /** The space inside the frame line (pad), the frame line itself, and extra space under the photo (foot). */
  static measure(frame: FrameStyle): { pad: number; line: number; foot: number } {
    const band = BANDED_FRAMES[frame]

    if (band) return { pad: band + 2.6, line: 0, foot: 0 }
    if (frame === 'instant') return { pad: 2.4, line: 0, foot: 7 }

    return { ...FrameScene.edges(frame), foot: 0 }
  }

  private static edges(frame: FrameStyle): { pad: number; line: number } {
    switch (frame) {
      case 'hairline':
        return { pad: 1.6, line: 0.22 }
      case 'double':
        return { pad: 1.4, line: 0.7 }
      case 'mat':
        return { pad: 4.5, line: 0.7 }
      case 'corners':
        return { pad: 0.7, line: 0 }
      case 'deckle':
        return { pad: 2.6, line: 0 }
      case 'plate':
        return { pad: 3.2, line: 0 }
      case 'oval':
        return { pad: 1.5, line: 0.22 }
      case 'botanical':
        return { pad: 5, line: 0 }
      case 'arch':
        return { pad: 1.5, line: 0.22 }
      case 'tape':
        return { pad: 4.3, line: 0 }
      case 'film':
        return { pad: 4.2, line: 0 }
      case 'deco':
        return { pad: 3.4, line: 0 }
      default:
        return { pad: 0, line: 0 }
    }
  }

  /** The frame's outer box in `slot`: the whole slot, or with `contain` the photo's shape centred in it. */
  static fit(slot: Box, frame: FrameStyle, fit: 'cover' | 'contain', photo: FlipbookPhoto | null): Box {
    if (fit === 'cover') return slot

    const { pad, line, foot } = FrameScene.measure(frame)
    const edge = pad + line
    const ratio = photo?.width && photo.height ? photo.width / photo.height : 4 / 3
    const width = Math.min(slot.width, (slot.height - 2 * edge - foot) * ratio + 2 * edge)
    const height = (width - 2 * edge) / ratio + 2 * edge + foot

    return { x: slot.x + (slot.width - width) / 2, y: slot.y + (slot.height - height) / 2, width, height }
  }

  nodes(photo: FlipbookPhoto | null, frame: FrameStyle, box: Box): SceneNode[] {
    const { pad, line, foot } = FrameScene.measure(frame)
    const inner = { ...inset(box, pad + line), height: box.height - 2 * (pad + line) - foot }

    return [...this.backing(frame, box, line, inner), this.photo(photo, frame, inner), ...this.trim(frame, box, inner)]
  }

  private ink(alpha?: number) {
    return inkOf(this.look, alpha)
  }

  private photo(photo: FlipbookPhoto | null, frame: FrameStyle, box: Box): SceneNode {
    const clip = frame === 'oval' ? 'ellipse' : 'rect'
    const shape = FrameScene.photoShape(frame, box)

    if (!photo) return { kind: 'fill', shape, paint: this.ink(0.15) }

    const { x, y, zoom } = PhotoCrop.of(photo.position)
    const node: SceneNode = {
      kind: 'photo',
      photo: { src: photo.src, width: photo.width, height: photo.height },
      box,
      position: { x, y, zoom },
      clip,
      tone: this.look.tone,
      ...(frame === 'feather' ? { fade: 0.08 } : {}),
    }

    return frame === 'arch' || frame === 'rounded' ? { kind: 'group', clip: shape, children: [node] } : node
  }

  /** The shape a frame cuts its photo to. */
  static photoShape(frame: FrameStyle, box: Box): Shape {
    switch (frame) {
      case 'oval':
        return { type: 'ellipse', box }
      case 'arch': {
        const r = archRadius(box)

        return { type: 'roundrect', box, radii: [r, r, 0, 0] }
      }
      case 'rounded': {
        const r = Math.min(ROUNDED_RADIUS, box.width / 2, box.height / 2)

        return { type: 'roundrect', box, radii: [r, r, r, r] }
      }
      default:
        return rect(box)
    }
  }

  private backing(frame: FrameStyle, box: Box, line: number, inner: Box): SceneNode[] {
    const band = BANDED_FRAMES[frame]

    if (band) return [{ kind: 'fill', shape: rect(box), paint: this.look.frameTint }, this.band(frame, box, band)]

    switch (frame) {
      case 'hairline':
        return [{ kind: 'stroke', shape: rect(inset(box, line / 2)), color: this.ink(0.7), width: line }]
      case 'double': {
        const rule = line / 3

        return [rule / 2, rule * 2.5].map((by) => ({ kind: 'stroke', shape: rect(inset(box, by)), color: this.ink(0.75), width: rule }))
      }
      case 'mat':
        return [
          { kind: 'fill', shape: rect(box), paint: this.look.frameTint },
          { kind: 'stroke', shape: rect(inset(box, line / 2)), color: this.ink(0.85), width: line },
        ]
      case 'plate':
        return this.plate(box)
      case 'deckle':
        return [this.deckle(box)]
      case 'oval':
        return [{ kind: 'stroke', shape: { type: 'ellipse', box: inset(box, line / 2) }, color: this.ink(0.7), width: line }]
      case 'arch': {
        const rule = inset(box, line / 2)
        const r = archRadius(inner) + (inner.x - rule.x)

        return [{ kind: 'stroke', shape: { type: 'roundrect', box: rule, radii: [r, r, 0, 0] }, color: this.ink(0.7), width: line }]
      }
      case 'instant':
        return [
          { kind: 'fill', shape: rect(box), paint: PRINT_WHITE },
          { kind: 'stroke', shape: rect(inset(box, 0.075)), color: this.ink(0.16), width: 0.15 },
        ]
      case 'film':
        return [this.film(box, inner)]
      case 'deco':
        return [this.deco(box)]
      default:
        return []
    }
  }

  /** A dark film frame with sprocket holes along the top and bottom, cut through to the paper. */
  private film(box: Box, inner: Box): SceneNode {
    const band = inner.y - box.y
    const holes = sprockets(box.width).flatMap((x): Shape[] =>
      [box.y + (band - SPROCKET.height) / 2, box.y + box.height - (band + SPROCKET.height) / 2].map((y) => ({
        type: 'rect',
        box: { x: box.x + x, y, width: SPROCKET.width, height: SPROCKET.height },
      })),
    )

    return { kind: 'fill', shape: { type: 'cutout', outer: rect(box), inner: { type: 'union', shapes: holes } }, paint: '#1d1b19' }
  }

  /** Gold outer and inner rules with a fan in each corner, printed in the paper's ink blend. */
  private deco(box: Box): SceneNode {
    const { x, y, width: w, height: h } = box
    const corners: [number, number, number, number][] = [
      [x, y, 1, 1],
      [x + w, y, -1, 1],
      [x, y + h, 1, -1],
      [x + w, y + h, -1, -1],
    ]
    const quarter = (cx: number, cy: number, sx: number, sy: number, r: number): Shape => ({
      type: 'path',
      d: `M0 0 H${r * sx} A${r} ${r} 0 0 ${sx * sy > 0 ? 1 : 0} 0 ${r * sy} Z`,
      transform: [1, 0, 0, 1, cx, cy],
    })
    const arc = (cx: number, cy: number, sx: number, sy: number, r: number): Shape => ({
      type: 'path',
      d: `M${r * sx} 0 A${r} ${r} 0 0 ${sx * sy > 0 ? 1 : 0} 0 ${r * sy}`,
      transform: [1, 0, 0, 1, cx, cy],
    })

    return {
      kind: 'group',
      blend: this.look.inkBlend,
      children: [
        { kind: 'stroke', shape: rect(inset(box, 0.225)), color: GOLD, width: 0.45 },
        { kind: 'stroke', shape: rect(inset(box, 1.4)), color: GOLD, width: 0.25 },
        ...corners.flatMap(([cx, cy, sx, sy]): SceneNode[] => [
          { kind: 'fill', shape: quarter(cx, cy, sx, sy, 2.2), paint: GOLD },
          { kind: 'stroke', shape: arc(cx, cy, sx, sy, 2.9), color: GOLD, width: 0.25 },
        ]),
      ],
    }
  }

  /** Two strips of see-through tape across the photo's top corners. */
  private tape(photo: Box): SceneNode {
    const { length, width, inset: by, colors } = TAPE
    const strip = (cx: number, cy: number, angle: number, color: string): SceneNode => {
      const turn = (angle * Math.PI) / 180
      const along = { x: (Math.cos(turn) * length) / 2, y: (Math.sin(turn) * length) / 2 }
      const across = { x: (-Math.sin(turn) * width) / 2, y: (Math.cos(turn) * width) / 2 }
      const points: Point[] = [
        { x: cx - along.x - across.x, y: cy - along.y - across.y },
        { x: cx + along.x - across.x, y: cy + along.y - across.y },
        { x: cx + along.x + across.x, y: cy + along.y + across.y },
        { x: cx - along.x + across.x, y: cy - along.y + across.y },
      ]
      const shape: Shape = { type: 'polygon', points }

      return {
        kind: 'group',
        blend: this.look.inkBlend,
        children: [
          { kind: 'fill', shape, paint: withAlpha(color, 0.6) },
          {
            kind: 'fill',
            shape,
            paint: {
              type: 'tile',
              width: 1,
              height: 1,
              origin: { x: cx, y: cy },
              rotate: angle + 90,
              nodes: [{ kind: 'fill', shape: rect({ x: 0, y: 0, width: 0.5, height: 1 }), paint: 'rgba(255,255,255,0.35)' }],
            },
          },
        ],
      }
    }

    return {
      kind: 'group',
      children: [strip(photo.x + by, photo.y + by, -45, colors[0]), strip(photo.x + photo.width - by, photo.y + by, 45, colors[1])],
    }
  }

  private trim(frame: FrameStyle, box: Box, inner: Box): SceneNode[] {
    if (BANDED_FRAMES[frame]) return [this.keyline(inner, 0.2, this.ink(0.22))]

    switch (frame) {
      case 'mat':
        return [this.keyline(inner, 0.25, this.ink(0.18))]
      case 'botanical':
        return [this.keyline(inner, 0.18, this.ink(0.6), 1.6), ...this.sprigs(box)]
      case 'tape':
        return [this.tape(inner)]
      case 'corners': {
        const s = 5.5
        const { x, y, width: w, height: h } = box
        const corners: Point[][] = [
          [
            { x, y },
            { x: x + s, y },
            { x, y: y + s },
          ],
          [
            { x: x + w - s, y },
            { x: x + w, y },
            { x: x + w, y: y + s },
          ],
          [
            { x, y: y + h - s },
            { x: x + s, y: y + h },
            { x, y: y + h },
          ],
          [
            { x: x + w, y: y + h - s },
            { x: x + w, y: y + h },
            { x: x + w - s, y: y + h },
          ],
        ]

        return corners.map((points) => ({ kind: 'fill', shape: { type: 'polygon', points }, paint: this.ink(0.82) }))
      }
      default:
        return []
    }
  }

  /** A printed rule just outside the photo, `gap` away from it. */
  private keyline(photo: Box, weight: number, color: string, gap = 0): SceneNode {
    return { kind: 'stroke', shape: rect(inset(photo, -(gap + weight / 2))), color, width: weight }
  }

  /** A blind plate pressed into the paper: a tint, shadowed along the top and left, lit along the bottom and right. */
  private plate(box: Box): SceneNode[] {
    const p = 0.2
    const { x, y, width: w, height: h } = box
    const right = x + w
    const bottom = y + h

    return [
      { kind: 'fill', shape: rect(box), paint: this.look.plateTint },
      {
        kind: 'fill',
        shape: {
          type: 'polygon',
          points: [
            { x, y },
            { x: right, y },
            { x: right, y: y + p },
            { x: x + p, y: y + p },
            { x: x + p, y: bottom },
            { x, y: bottom },
          ],
        },
        paint: this.look.plateLow,
      },
      {
        kind: 'fill',
        shape: {
          type: 'polygon',
          points: [
            { x: right, y },
            { x: right, y: bottom },
            { x, y: bottom },
            { x, y: bottom - p },
            { x: right - p, y: bottom - p },
            { x: right - p, y },
          ],
        },
        paint: this.look.plateHigh,
      },
    ]
  }

  /** A tint with a scalloped edge, like an old deckled print. */
  private deckle(box: Box): SceneNode {
    const scallop = 1.6
    const r = scallop / 2
    const across = Array.from({ length: Math.ceil(box.width / scallop) }, (_, i) => box.x + r + i * scallop)
    const down = Array.from({ length: Math.ceil(box.height / scallop) }, (_, i) => box.y + r + i * scallop)
    const dot = (x: number, y: number): Shape => ({ type: 'circle', center: { x, y }, radius: r })

    return {
      kind: 'fill',
      opacity: 0.11,
      paint: this.ink(),
      shape: {
        type: 'union',
        shapes: [
          rect(inset(box, r)),
          ...across.flatMap((x) => [dot(x, box.y + r), dot(x, box.y + box.height - r)]),
          ...down.flatMap((y) => [dot(box.x + r, y), dot(box.x + box.width - r, y)]),
        ],
      },
    }
  }

  /** A patterned band around a mat. */
  private band(frame: FrameStyle, box: Box, width: number): SceneNode {
    const ring: Shape = { type: 'ring', outer: box, inner: inset(box, width) }
    const origin = { x: box.x, y: box.y }
    const group = (children: SceneNode[], opacity?: number): SceneNode => ({ kind: 'group', blend: this.look.inkBlend, opacity, children })

    switch (frame) {
      case 'watercolor':
        return group(
          [
            {
              kind: 'fill',
              shape: ring,
              paint: angledGradient(box, 135, [
                { offset: 0, color: '#f0a993' },
                { offset: 0.3, color: '#f3d27c' },
                { offset: 0.62, color: '#9fd3bf' },
                { offset: 1, color: '#8fb6e2' },
              ]),
            },
          ],
          0.7,
        )
      case 'arcs': {
        const arcs: [number, string][] = [
          [1.2, '#7ea7d8'],
          [0.9, '#79c2a2'],
          [0.6, '#f2c95c'],
          [0.3, '#e9967a'],
        ]
        const nodes: SceneNode[] = arcs.map(([radius, color]) => ({
          kind: 'fill',
          shape: { type: 'circle', center: { x: 1.2, y: 1.3 }, radius },
          paint: color,
        }))

        return group([{ kind: 'fill', shape: ring, paint: { type: 'tile', width: 2.4, height: 1.3, origin, nodes } }], 0.8)
      }
      case 'gilt': {
        const rule = 0.35
        const hatch = (rotate: number): SceneNode => ({
          kind: 'fill',
          shape: ring,
          paint: {
            type: 'tile',
            width: 0.8,
            height: 0.8,
            origin,
            rotate,
            nodes: [{ kind: 'fill', shape: rect({ x: 0, y: 0, width: 0.22, height: 0.8 }), paint: 'rgba(180,138,50,0.75)' }],
          },
        })

        return group([
          { kind: 'fill', shape: ring, paint: 'rgba(214,178,92,0.45)' },
          hatch(45),
          hatch(-45),
          { kind: 'stroke', shape: rect(inset(box, rule / 2)), color: '#b48a32', width: rule },
        ])
      }
      default:
        return group(
          [
            { kind: 'fill', shape: ring, paint: '#cfa874' },
            {
              kind: 'fill',
              shape: ring,
              paint: {
                type: 'tile',
                width: 1.5,
                height: 4,
                origin,
                rotate: 8,
                nodes: [
                  { kind: 'fill', shape: rect({ x: 0, y: 0, width: 0.12, height: 4 }), paint: 'rgba(110,70,30,0.4)' },
                  { kind: 'fill', shape: rect({ x: 0.55, y: 0, width: 0.25, height: 4 }), paint: 'rgba(110,70,30,0.22)' },
                ],
              },
            },
          ],
          0.85,
        )
    }
  }

  /** Line-drawn sprigs of leaves along the top left and bottom right of the frame rule. */
  private sprigs(box: Box): SceneNode[] {
    const width = 26
    const height = 10.4
    const scale = width / 100
    const color = this.ink(0.8)
    const sprig = (x: number, y: number, flip: boolean): SceneNode[] => {
      const [a, d, e, f] = flip ? [-scale, -scale, x + width, y + height] : [scale, scale, x, y]
      const at = (path: string, local: [number, number, number, number, number, number], strokeWidth: number): SceneNode => {
        const [la, lb, lc, ld, le, lf] = local

        return {
          kind: 'stroke',
          shape: { type: 'path', d: path, transform: [a * la, d * lb, a * lc, d * ld, a * le + e, d * lf + f] },
          color,
          width: strokeWidth * scale,
          cap: 'round',
        }
      }

      return [
        at('M4 20 Q 50 17, 92 20', [1, 0, 0, 1, 0, 0], 1.2),
        ...LEAVES.flatMap(({ x: lx, angle, length }) => {
          const turn = (angle * Math.PI) / 180
          const k = length / 20
          const local: [number, number, number, number, number, number] = [
            Math.cos(turn) * k,
            Math.sin(turn) * k,
            -Math.sin(turn) * k,
            Math.cos(turn) * k,
            lx,
            20,
          ]

          return [at(LEAF, local, k), at('M2 0 L 16 0', local, 0.6 * k)]
        }),
      ]
    }

    return [...sprig(box.x + 1.4, box.y - 1.8, false), ...sprig(box.x + box.width - 1.4 - width, box.y + box.height + 1.8 - height, true)]
  }
}
