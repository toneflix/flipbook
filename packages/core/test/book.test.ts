import { describe, expect, it } from 'vitest'
import {
  PAGE_LAYOUTS,
  PAGE_SHAPES,
  PLACED_LAYOUTS,
  coverHasText,
  pageMillimetres,
  pageSize,
  photoFrame,
  placedLayout,
  type PageLayout,
  type PageShape,
} from '../src'

describe('placed layouts', () => {
  const layouts = Object.keys(PLACED_LAYOUTS) as PageLayout[]
  const shapes = Object.keys(PAGE_SHAPES) as PageShape[]

  it('has a box for every slot', () => {
    for (const shape of shapes)
      for (const layout of layouts) expect(placedLayout(layout, pageSize(shape))!.slots.length, layout).toBe(PAGE_LAYOUTS[layout].slots)
  })

  it('keeps every box on the page in every shape', () => {
    for (const shape of shapes) {
      const size = pageSize(shape)

      for (const layout of layouts) {
        const { slots, caption } = placedLayout(layout, size)!

        for (const box of [...slots, caption]) {
          expect(box.x, `${layout} ${shape}`).toBeGreaterThanOrEqual(0)
          expect(box.y, `${layout} ${shape}`).toBeGreaterThanOrEqual(0)
          expect(box.x + box.width, `${layout} ${shape}`).toBeLessThanOrEqual(size.width + 1e-9)
          expect(box.y + box.height, `${layout} ${shape}`).toBeLessThanOrEqual(size.height + 1e-9)
        }
      }
    }
  })

  it('keeps the portrait boxes', () => {
    expect(placedLayout('triptych')!.slots.map((box) => box.x.toFixed(2))).toEqual(['7.00', '36.67', '66.33'])
    expect(placedLayout('story')).toMatchObject({ slots: [{ x: 7, y: 7, width: 86 }], caption: { x: 9, width: 82 } })
    expect(placedLayout('story')!.slots[0].height).toBeCloseTo(66)
    expect(placedLayout('mosaic')!.caption).toMatchObject({ x: 7, width: 86, height: 10 })
    expect(placedLayout('mosaic')!.caption.y).toBeCloseTo(118)
  })
})

describe('pageSize', () => {
  it('measures pages on their short side', () => {
    expect(pageSize()).toEqual({ width: 100, height: 400 / 3 })
    expect(pageSize('wide')).toEqual({ width: 150, height: 100 })
    expect(pageSize('square')).toEqual({ width: 100, height: 100 })
    expect(pageMillimetres('landscape')).toEqual({ width: 280, height: 210 })
    expect(pageMillimetres('wide')).toEqual({ width: 315, height: 210 })
  })
})

describe('photoFrame', () => {
  it('prefers the photo, then the page, then the book', () => {
    expect(photoFrame({ layout: 'grid', frame: 'mat' }, { frame: 'oval' }, 'gilt')).toBe('oval')
    expect(photoFrame({ layout: 'grid', frame: 'mat' }, {}, 'gilt')).toBe('mat')
    expect(photoFrame({ layout: 'grid' }, null, 'gilt')).toBe('gilt')
  })

  it('never frames full-bleed pages', () => {
    expect(photoFrame({ layout: 'single' }, { frame: 'oval' }, 'gilt')).toBe('none')
    expect(photoFrame({ layout: 'opener' }, { frame: 'oval' }, 'gilt')).toBe('none')
  })
})

describe('coverHasText', () => {
  it('prints the title unless the cover is a full image', () => {
    expect(coverHasText({})).toBe(true)
    expect(coverHasText({ coverDesign: 'gilt' })).toBe(true)
    expect(coverHasText({ coverDesign: 'image' })).toBe(false)
  })

  it('follows coverText when given', () => {
    expect(coverHasText({ coverDesign: 'image', coverText: true })).toBe(true)
    expect(coverHasText({ coverDesign: 'classic', coverText: false })).toBe(false)
  })
})
