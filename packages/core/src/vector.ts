export type Vec = { x: number; y: number }

export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y })
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y
export const length = (a: Vec) => Math.hypot(a.x, a.y)

/**
 * A 2D affine transform in CSS `matrix(a, b, c, d, e, f)` order:
 * x' = a·x + c·y + e, y' = b·x + d·y + f.
 */
export class Affine {
  constructor(
    readonly a = 1,
    readonly b = 0,
    readonly c = 0,
    readonly d = 1,
    readonly e = 0,
    readonly f = 0,
  ) {}

  static translate(x: number, y: number) {
    return new Affine(1, 0, 0, 1, x, y)
  }

  static rotate(angle: number) {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    return new Affine(cos, sin, -sin, cos, 0, 0)
  }

  static scale(x: number, y = x) {
    return new Affine(x, 0, 0, y, 0, 0)
  }

  /** Mirror across the line through `point` with unit normal `normal`. */
  static reflect(point: Vec, normal: Vec) {
    const { x: nx, y: ny } = normal
    const along = 2 * dot(point, normal)

    return new Affine(1 - 2 * nx * nx, -2 * nx * ny, -2 * nx * ny, 1 - 2 * ny * ny, along * nx, along * ny)
  }

  /** This transform applied after `other`. */
  after(other: Affine) {
    const { a, b, c, d, e, f } = this

    return new Affine(
      a * other.a + c * other.b,
      b * other.a + d * other.b,
      a * other.c + c * other.d,
      b * other.c + d * other.d,
      a * other.e + c * other.f + e,
      b * other.e + d * other.f + f,
    )
  }

  invert() {
    const { a, b, c, d, e, f } = this
    const det = a * d - b * c

    return new Affine(d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det)
  }

  apply(p: Vec): Vec {
    return { x: this.a * p.x + this.c * p.y + this.e, y: this.b * p.x + this.d * p.y + this.f }
  }

  toCss() {
    return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`
  }

  /**
   * Places a box of `width` × `height` with this transform using only a position, a rotation
   * and an optional horizontal mirror about the box's centre, which is how React Native
   * applies transforms. Only rotations and reflections (no scaling or skew) survive.
   */
  place(width: number, height: number) {
    const center = this.apply({ x: width / 2, y: height / 2 })
    const mirror = this.a * this.d - this.b * this.c < 0
    const angle = mirror ? Math.atan2(-this.b, -this.a) : Math.atan2(this.b, this.a)

    return { left: center.x - width / 2, top: center.y - height / 2, width, height, angle, mirror }
  }
}

export type Placement = ReturnType<Affine['place']>
