import { BANDED_FRAMES, type FlipbookPhoto, type FrameStyle } from '../book'
import { PhotoCrop } from '../position'
import { inkOf, type PaperLook } from './paper'
import type { Box, GradientStop, Paint, Point, SceneNode, Shape } from './types'

export const inset = (box: Box, by: number): Box => ({
  x: box.x + by,
  y: box.y + by,
  width: box.width - 2 * by,
  height: box.height - 2 * by,
})

export const rect = (box: Box): Shape => ({ type: 'rect', box })

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

/**
 * A photo printed on a page inside its frame: rules, mats, tints and bands under it, keylines, corners
 * and sprigs over it. Sizes are in page units, the same at any page size.
 */
export class FrameScene {
  constructor(readonly look: PaperLook) {}

  /** The space inside the frame line (pad) and the frame line itself. */
  static measure(frame: FrameStyle): { pad: number; line: number } {
    const band = BANDED_FRAMES[frame]

    if (band) return { pad: band + 2.6, line: 0 }

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
      default:
        return { pad: 0, line: 0 }
    }
  }

  /** The frame's outer box in `slot`: the whole slot, or with `contain` the photo's shape centred in it. */
  static fit(slot: Box, frame: FrameStyle, fit: 'cover' | 'contain', photo: FlipbookPhoto | null): Box {
    if (fit === 'cover') return slot

    const { pad, line } = FrameScene.measure(frame)
    const edge = pad + line
    const ratio = photo?.width && photo.height ? photo.width / photo.height : 4 / 3
    const width = Math.min(slot.width, (slot.height - 2 * edge) * ratio + 2 * edge)
    const height = (width - 2 * edge) / ratio + 2 * edge

    return { x: slot.x + (slot.width - width) / 2, y: slot.y + (slot.height - height) / 2, width, height }
  }

  nodes(photo: FlipbookPhoto | null, frame: FrameStyle, box: Box): SceneNode[] {
    const { pad, line } = FrameScene.measure(frame)
    const inner = inset(box, pad + line)

    return [...this.backing(frame, box, line), this.photo(photo, frame, inner), ...this.trim(frame, box, inner)]
  }

  private ink(alpha?: number) {
    return inkOf(this.look, alpha)
  }

  private photo(photo: FlipbookPhoto | null, frame: FrameStyle, box: Box): SceneNode {
    const clip = frame === 'oval' ? 'ellipse' : 'rect'

    if (!photo) return { kind: 'fill', shape: clip === 'ellipse' ? { type: 'ellipse', box } : rect(box), paint: this.ink(0.15) }

    const { x, y, zoom } = PhotoCrop.of(photo.position)

    return {
      kind: 'photo',
      photo: { src: photo.src, width: photo.width, height: photo.height },
      box,
      position: { x, y, zoom },
      clip,
      tone: this.look.tone,
      ...(frame === 'feather' ? { fade: 0.08 } : {}),
    }
  }

  private backing(frame: FrameStyle, box: Box, line: number): SceneNode[] {
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
      default:
        return []
    }
  }

  private trim(frame: FrameStyle, box: Box, inner: Box): SceneNode[] {
    if (BANDED_FRAMES[frame]) return [this.keyline(inner, 0.2, this.ink(0.22))]

    switch (frame) {
      case 'mat':
        return [this.keyline(inner, 0.25, this.ink(0.18))]
      case 'botanical':
        return [this.keyline(inner, 0.18, this.ink(0.6), 1.6), ...this.sprigs(box)]
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
