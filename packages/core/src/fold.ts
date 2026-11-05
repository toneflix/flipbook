import { Affine, dot, length, sub, type Vec } from './vector'

/**
 * A leaf folded so that the point grabbed (`origin`) lands on `point`.
 *
 * Coordinates are page pixels from the top of the spine, measured toward the side the leaf
 * starts on: the leaf lies flat over x ∈ [0, width] and is fully turned over x ∈ [-width, 0].
 * The fold line is the perpendicular bisector of `origin` and `point`; the part of the leaf
 * past it is flipped over, showing the back of the page.
 */
export class Fold {
  readonly point: Vec
  /** Middle of the fold line. */
  readonly center: Vec
  /** Unit normal of the fold line, pointing toward the folded-over part. */
  readonly normal: Vec
  /** 0 when flat, 1 when fully turned. */
  readonly progress: number
  /** The part of the leaf still lying flat, in leaf coordinates. */
  readonly flat: Vec[]
  /** The part of the leaf that is folded over, in leaf coordinates (before it is flipped). */
  readonly folded: Vec[]

  constructor(
    readonly width: number,
    readonly height: number,
    readonly origin: Vec,
    point: Vec,
  ) {
    this.point = Fold.attach(point, origin, height)

    const span = sub(origin, this.point)
    const distance = length(span)
    const page = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ]

    this.center = { x: (origin.x + this.point.x) / 2, y: (origin.y + this.point.y) / 2 }
    this.progress = Math.min(1, distance / Math.max(1, 2 * origin.x))

    if (distance < 0.5) {
      this.normal = { x: 1, y: 0 }
      this.flat = page
      this.folded = []
      return
    }

    this.normal = { x: span.x / distance, y: span.y / distance }
    this.flat = this.clip(page, -1)
    this.folded = this.clip(page, 1)
  }

  /**
   * Keeps the grabbed point within reach of the spine, so the leaf stretches around its
   * binding instead of tearing away from it.
   */
  static attach(point: Vec, origin: Vec, height: number): Vec {
    const anchors = [
      { x: 0, y: 0 },
      { x: 0, y: height },
    ]
    let p = point

    for (let pass = 0; pass < 3; pass++) {
      for (const anchor of anchors) {
        const reach = length(sub(origin, anchor))
        const offset = sub(p, anchor)
        const distance = length(offset)

        if (distance > reach) p = { x: anchor.x + (offset.x * reach) / distance, y: anchor.y + (offset.y * reach) / distance }
      }
    }

    return p
  }

  /**
   * Angle in degrees a stiff leaf (a cover) has swung about the spine: 0 lying on the right,
   * -180 lying on the left. `dir` is the side the leaf started on, as in `flapMatrix`.
   */
  static hinge(origin: Vec, point: Vec, dir: 1 | -1) {
    const cos = Math.max(-1, Math.min(1, (dir * point.x) / Math.max(1, origin.x)))

    return (-Math.acos(cos) * 180) / Math.PI
  }

  /** How strongly light and shadow show around the fold: strongest mid-turn, fading as the page lies flat. */
  get shade() {
    return Math.min(1, this.progress * 8) * Math.min(1, (1 - this.progress) * 6)
  }

  /** Mirrors a point across the fold line. */
  reflect(p: Vec): Vec {
    const side = 2 * dot(sub(p, this.center), this.normal)

    return { x: p.x - side * this.normal.x, y: p.y - side * this.normal.y }
  }

  /** The mirror across the fold line as a transform. */
  get reflection() {
    return Affine.reflect(this.center, this.normal)
  }

  /** Where the folded part of the leaf now lies. */
  get flap(): Vec[] {
    return this.folded.map((p) => this.reflect(p))
  }

  /**
   * CSS matrix placing the hidden side of the leaf over the flap, for a page element whose
   * left edge sits on the spine. `dir` is 1 when the leaf started on the right (the flap shows
   * its back, laid out with the spine on the right) and -1 when it started on the left (the
   * flap shows its front).
   */
  flapMatrix(dir: 1 | -1): string {
    const { x: nx, y: ny } = this.normal
    const mirror = dir === 1 ? -1 : 1
    const a = dir * (1 - 2 * nx * nx) * mirror
    const b = -2 * nx * ny * mirror
    const c = -2 * dir * nx * ny
    const d = 1 - 2 * ny * ny
    const shift = this.reflect({ x: dir === 1 ? this.width : 0, y: 0 })

    return `matrix(${a}, ${b}, ${c}, ${d}, ${dir * shift.x}, ${shift.y})`
  }

  /** Keeps the part of a polygon on one side of the fold (1: the folded side). */
  private clip(polygon: Vec[], side: 1 | -1): Vec[] {
    const out: Vec[] = []
    const inside = (p: Vec) => side * dot(sub(p, this.center), this.normal) >= 0

    polygon.forEach((current, i) => {
      const previous = polygon[(i + polygon.length - 1) % polygon.length]
      const a = side * dot(sub(previous, this.center), this.normal)
      const b = side * dot(sub(current, this.center), this.normal)

      if (inside(current) !== inside(previous)) {
        const t = a / (a - b)
        out.push({ x: previous.x + (current.x - previous.x) * t, y: previous.y + (current.y - previous.y) * t })
      }
      if (inside(current)) out.push(current)
    })

    return out
  }
}
