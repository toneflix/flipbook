import { describe, expect, it } from 'vitest'
import { PAGE_LAYOUTS, PLACED_LAYOUTS, photoFrame, type PageLayout } from '../src'

describe('placed layouts', () => {
  const placed = Object.entries(PLACED_LAYOUTS) as [PageLayout, NonNullable<(typeof PLACED_LAYOUTS)[PageLayout]>][]

  it('has a box for every slot', () => {
    for (const [layout, { slots }] of placed) expect(slots.length, layout).toBe(PAGE_LAYOUTS[layout].slots)
  })

  it('keeps every box on the page', () => {
    for (const [layout, { slots, caption }] of placed)
      for (const box of [...slots, caption]) {
        expect(box.x, layout).toBeGreaterThanOrEqual(0)
        expect(box.y, layout).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width, layout).toBeLessThanOrEqual(100)
        expect(box.y + box.height, layout).toBeLessThanOrEqual(400 / 3)
      }
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
  })
})
