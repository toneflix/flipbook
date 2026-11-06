import { describe, expect, it } from 'vitest'
import { PHOTO_ZOOM, PhotoCrop } from '../src'

const box = { width: 100, height: 100 }
const wide = { width: 200, height: 100 }

describe('PhotoCrop', () => {
  it('defaults to the centre and clamps stored values', () => {
    expect(PhotoCrop.of(null).isCentred).toBe(true)
    expect(PhotoCrop.of({ x: 30 }).toJSON()).toEqual({ x: 30, y: 50, zoom: 1 })
    expect(PhotoCrop.of({ x: -10, y: 140, zoom: 9 }).toJSON()).toEqual({ x: 0, y: 100, zoom: PHOTO_ZOOM.max })
  })

  it('covers the box and lines up the chosen point', () => {
    expect(new PhotoCrop(50, 50).rect(box, wide)).toEqual({ left: -50, top: 0, width: 200, height: 100 })
    expect(new PhotoCrop(0, 50).rect(box, wide).left).toBeCloseTo(0)
    expect(new PhotoCrop(100, 50).rect(box, wide).left).toBe(-100)
  })

  it('zooms around the chosen point', () => {
    const rect = new PhotoCrop(50, 50, 2).rect(box, wide)

    expect(rect).toEqual({ left: -150, top: -50, width: 400, height: 200 })
  })

  it('matches the browser: object-position, then scale around the same point', () => {
    const crop = new PhotoCrop(20, 70, 1.5)
    const fitted = new PhotoCrop(20, 70).rect(box, wide)
    const origin = { x: box.width * 0.2, y: box.height * 0.7 }
    const rect = crop.rect(box, wide)

    expect(rect.left).toBeCloseTo(origin.x + (fitted.left - origin.x) * 1.5)
    expect(rect.top).toBeCloseTo(origin.y + (fitted.top - origin.y) * 1.5)
  })

  it('pans with the drag and stops at the edges', () => {
    const crop = new PhotoCrop(50, 50)

    expect(crop.pan(25, 0, box, wide).x).toBe(25)
    expect(crop.pan(500, 0, box, wide).x).toBe(0)
    expect(crop.pan(0, 30, box, wide).y).toBe(50)
    expect(crop.movable(box, wide)).toEqual({ x: true, y: false })
  })

  it('writes CSS for a cropped image', () => {
    expect(new PhotoCrop(10, 90, 2).css).toEqual({ objectPosition: '10% 90%', transform: 'scale(2)', transformOrigin: '10% 90%' })
    expect(PhotoCrop.CENTRE.css.transform).toBe('')
  })
})
