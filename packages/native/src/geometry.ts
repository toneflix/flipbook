import { Affine, Fold, type ActiveTurn, type TurnFrame, type Vec } from '@toneflix/flipbook-core'
import type { ViewStyle } from 'react-native'

export type Role = 'right' | 'left' | 'turning' | 'flap' | 'spare'

/** A strip of light or shadow laid along the fold, inside one face. */
export interface Band {
  name: 'under' | 'bend' | 'curl'
  style: ViewStyle
  opacity: number
}

/** Where one face sits: a clip window, a frame undoing the window's rotation, and the face itself. */
export interface FacePlacement {
  clip: ViewStyle
  frame: ViewStyle
  face: ViewStyle
  bands: Band[]
}

/** Band widths as shares of the page width. */
const BAND_WIDTH = { under: 0.3, bend: 0.1, curl: 1 }

const styleOf = (transform: Affine, width: number, height: number): ViewStyle => {
  const { left, top, angle, mirror } = transform.place(width, height)

  return {
    position: 'absolute',
    left,
    top,
    width,
    height,
    transform: mirror ? [{ rotate: `${angle}rad` }, { scaleX: -1 }] : [{ rotate: `${angle}rad` }],
  }
}

/**
 * Lays out the faces of a book for React Native, which can't clip to a polygon. Coordinates are
 * page pixels from the top of the spine. A folded page is clipped by a large window rotated to
 * line up with the fold, inside which the faces are placed back in spine coordinates, so the
 * same three nested views serve every face whether it's turning or lying still.
 */
export class FoldLayout {
  private readonly side: number
  private readonly rest: Affine
  private readonly window: Affine
  private readonly fold: Fold | null
  private readonly dir: 1 | -1
  private readonly reflection: Affine

  constructor(
    readonly width: number,
    readonly height: number,
    readonly turn: ActiveTurn | null,
    readonly frame: TurnFrame | null,
    readonly shading = 1,
  ) {
    this.side = 4 * Math.max(width, height)
    this.rest = Affine.translate(-2 * width, -height)
    this.dir = turn?.dir ?? 1
    this.fold = turn && frame && !turn.stiff ? new Fold(width, height, frame.origin, frame.point) : null
    this.window = this.rest
    this.reflection = new Affine()

    if (!this.fold) return

    const { center, normal } = this.fold
    const c = { x: this.dir * center.x, y: center.y }
    const n = { x: this.dir * normal.x, y: normal.y }

    this.window = Affine.translate(c.x, c.y)
      .after(Affine.rotate(Math.atan2(n.y, n.x)))
      .after(Affine.translate(-this.side, -this.side / 2))
    this.reflection = Affine.reflect(c, n)
  }

  /** Spine coordinates of the fold's centre and its normal toward the folded part. */
  private get line(): { c: Vec; n: Vec } {
    const { center, normal } = this.fold!

    return { c: { x: this.dir * center.x, y: center.y }, n: { x: this.dir * normal.x, y: normal.y } }
  }

  /** Places a face given its role, which side of the leaf it is, and whether it lies on the left. */
  place(role: Role, side: 'front' | 'back', onLeft: boolean): FacePlacement {
    const { width, height, fold } = this
    const turning = role === 'turning' || role === 'flap'
    const clipped = !!fold && turning
    const window = clipped ? this.window : this.rest
    const windowSize = clipped ? { w: this.side, h: this.side } : { w: 4 * width, h: 3 * height }
    const toFrame = window.invert().after(Affine.translate(-width, 0))
    let face = Affine.translate(onLeft ? -width : 0, 0)

    if (fold && role === 'flap') {
      const leaf = side === 'back' ? new Affine(-1, 0, 0, 1, width, 0) : new Affine()

      face = this.reflection.after(Affine.scale(this.dir, 1)).after(leaf)
    }

    const placement: FacePlacement = {
      clip: { ...styleOf(window, windowSize.w, windowSize.h), overflow: clipped ? 'hidden' : 'visible' },
      frame: styleOf(toFrame, 2 * width, height),
      face: { ...styleOf(Affine.translate(width, 0).after(face), width, height), overflow: 'hidden' },
      bands: [],
    }

    if (fold) placement.bands = this.bands(role, face)
    if (this.turn?.stiff && turning) placement.face = this.hinge(side, placement.face)

    return placement
  }

  /** Light and shadow along the fold that fall on this face. */
  private bands(role: Role, face: Affine): Band[] {
    const strength = this.fold!.shade * this.shading
    const band = (name: Band['name'], into: 1 | -1): Band => {
      const { c, n } = this.line
      const m = { x: into * n.x, y: into * n.y }
      const d = { x: -n.y, y: n.x }
      const width = this.width * BAND_WIDTH[name]
      const height = this.side
      const strip = new Affine(m.x, m.y, d.x, d.y, c.x - (height / 2) * d.x, c.y - (height / 2) * d.y)

      return { name, style: styleOf(face.invert().after(strip), width, height), opacity: strength }
    }

    if (role === 'turning') return [band('bend', -1)]
    if (role === 'flap') return [band('curl', -1)]

    const revealed = this.turn && (this.dir === 1 ? role === 'right' : role === 'left')

    return revealed ? [band('under', 1)] : []
  }

  /** A stiff cover swings on the spine instead of folding. */
  private hinge(side: 'front' | 'back', style: ViewStyle): ViewStyle {
    const { width, frame } = this
    const angle = frame ? Fold.hinge(frame.origin, frame.point, this.dir) : 0
    const swing = [{ translateX: -width / 2 }, { perspective: Math.max(1800, width * 5) }, { rotateY: `${angle}deg` }]
    const transform =
      side === 'front'
        ? [...swing, { translateX: width / 2 }]
        : [...swing, { translateX: width }, { rotateY: '180deg' }, { translateX: width / 2 }]

    return { ...style, transform, backfaceVisibility: 'hidden' } as ViewStyle
  }
}
