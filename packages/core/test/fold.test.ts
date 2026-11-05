import { describe, expect, it } from 'vitest'
import { Affine, Fold } from '../src'

const W = 300
const H = 400

describe('Fold', () => {
  it('lies flat when the corner has not moved', () => {
    const fold = new Fold(W, H, { x: W, y: H }, { x: W, y: H })

    expect(fold.progress).toBe(0)
    expect(fold.folded).toEqual([])
    expect(fold.flat).toHaveLength(4)
  })

  it('reflects the grabbed corner onto the pointer', () => {
    const origin = { x: W, y: H }
    const fold = new Fold(W, H, origin, { x: 100, y: 300 })
    const landed = fold.reflect(origin)

    expect(landed.x).toBeCloseTo(fold.point.x)
    expect(landed.y).toBeCloseTo(fold.point.y)
    expect(fold.reflection.apply(origin).x).toBeCloseTo(fold.point.x)
  })

  it('splits the page into a flat part and a folded part that cover it', () => {
    const fold = new Fold(W, H, { x: W, y: H }, { x: 50, y: 350 })
    const area = (poly: { x: number; y: number }[]) =>
      Math.abs(poly.reduce((sum, p, i) => sum + p.x * poly[(i + 1) % poly.length].y - poly[(i + 1) % poly.length].x * p.y, 0)) / 2

    expect(area(fold.flat) + area(fold.folded)).toBeCloseTo(W * H)
  })

  it('keeps the grabbed point within reach of the spine', () => {
    const origin = { x: W, y: H }
    const point = Fold.attach({ x: -2 * W, y: H + 500 }, origin, H)

    expect(Math.hypot(point.x, point.y - H)).toBeLessThanOrEqual(W + 1e-6)
    expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(Math.hypot(W, H) + 1e-6)
  })

  it('swings a stiff cover from 0 to -180 degrees', () => {
    expect(Fold.hinge({ x: W, y: H / 2 }, { x: W, y: H / 2 }, 1)).toBeCloseTo(0)
    expect(Fold.hinge({ x: W, y: H / 2 }, { x: 0, y: H / 2 }, 1)).toBeCloseTo(-90)
    expect(Fold.hinge({ x: W, y: H / 2 }, { x: W, y: H / 2 }, -1)).toBeCloseTo(-180)
  })
})

describe('Affine', () => {
  it('places a mirrored box with a rotation and a flip about its centre', () => {
    const transform = Affine.translate(40, 10).after(Affine.rotate(0.3)).after(Affine.scale(-1, 1))
    const { left, top, width, height, angle, mirror } = transform.place(100, 50)
    const corner = { x: 0, y: 0 }
    const centre = { x: left + width / 2, y: top + height / 2 }
    const local = { x: -(corner.x - 50), y: corner.y - 25 }
    const placed = {
      x: centre.x + local.x * Math.cos(angle) - local.y * Math.sin(angle),
      y: centre.y + local.x * Math.sin(angle) + local.y * Math.cos(angle),
    }
    const expected = transform.apply(corner)

    expect(mirror).toBe(true)
    expect(placed.x).toBeCloseTo(expected.x)
    expect(placed.y).toBeCloseTo(expected.y)
  })

  it('inverts', () => {
    const transform = Affine.translate(5, -3).after(Affine.rotate(1.1))
    const p = transform.invert().apply(transform.apply({ x: 7, y: 9 }))

    expect(p.x).toBeCloseTo(7)
    expect(p.y).toBeCloseTo(9)
  })
})
