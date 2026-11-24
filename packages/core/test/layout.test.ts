import { describe, expect, it } from 'vitest'
import { BookLayout, type PageLayout } from '../src'

describe('BookLayout', () => {
  it('pairs faces into leaves for a spread, padding an odd page count', () => {
    const layout = new BookLayout(3, { spread: true })

    expect(layout.faces.map((f) => f.kind)).toEqual(['cover', 'title', 'page', 'page', 'page', 'blank', 'colophon', 'back'])
    expect(layout.length).toBe(4)
  })

  it('gives every page its own leaf one page at a time', () => {
    const layout = new BookLayout(2, { spread: false })

    expect(layout.length).toBe(6)
    expect(layout.leaves.every((leaf) => leaf.back.kind === 'blank')).toBe(true)
  })

  it('labels where the reader is', () => {
    const layout = new BookLayout(4, { spread: true })

    expect(layout.label(0)).toBe('Cover')
    expect(layout.label(1)).toBe('Page 1 of 4')
    expect(layout.label(2)).toBe('Pages 2–3 of 4')
    expect(layout.label(layout.length)).toBe('Back cover')
  })

  it('opens at a page', () => {
    const layout = new BookLayout(6, { spread: true })

    expect(layout.visible(layout.flippedForPage(3))).toContainEqual({ kind: 'page', index: 2 })
    expect(layout.flippedForPage(99)).toBe(0)
  })

  it('keeps the place when switching between spread and single pages', () => {
    const spread = new BookLayout(6, { spread: true })
    const single = new BookLayout(6, { spread: false })

    expect(single.convert(2, spread)).toBe(3)
    expect(spread.convert(3, single)).toBe(2)
  })

  it('makes covers stiff unless asked not to', () => {
    expect(new BookLayout(2, { spread: true }).isStiff(0)).toBe(true)
    expect(new BookLayout(2, { spread: true }).isStiff(1)).toBe(false)
    expect(new BookLayout(2, { spread: true, stiffCovers: false }).isStiff(0)).toBe(false)
  })

  it('lists a stop for every spread', () => {
    const stops = new BookLayout(4, { spread: true }).stops()

    expect(stops.map((s) => s.flipped)).toEqual([0, 1, 2, 3, 4])
    expect(BookLayout.describe(stops[2].faces)).toBe('page 2 and 3')
  })

  describe('panoramas', () => {
    const pages = (...layouts: PageLayout[]) => layouts.map((layout) => ({ layout }))

    it('sets a panorama on the two pages of one spread', () => {
      const layout = new BookLayout(pages('grid', 'panorama', 'grid'), { spread: true })

      expect(layout.faces.slice(2, -2)).toEqual([
        { kind: 'page', index: 0 },
        { kind: 'page', index: 1, half: 'left' },
        { kind: 'page', index: 1, half: 'right' },
        { kind: 'page', index: 2 },
      ])
      expect(layout.visible(2)).toEqual([
        { kind: 'page', index: 1, half: 'left' },
        { kind: 'page', index: 1, half: 'right' },
      ])
      expect(layout.label(2)).toBe('Page 2 of 3')
      expect(layout.panoramas).toEqual([1])
    })

    it('leaves a blank before a panorama that would open on a right-hand page', () => {
      const layout = new BookLayout(pages('grid', 'grid', 'panorama'), { spread: true })

      expect(layout.faces.slice(2, -2)).toEqual([
        { kind: 'page', index: 0 },
        { kind: 'page', index: 1 },
        { kind: 'blank' },
        { kind: 'page', index: 2, half: 'left' },
        { kind: 'page', index: 2, half: 'right' },
        { kind: 'blank' },
      ])
      expect(layout.visible(layout.flippedForPage(3))[0]).toEqual({ kind: 'page', index: 2, half: 'left' })
    })

    it('sets a panorama whole one page at a time', () => {
      const layout = new BookLayout(pages('grid', 'panorama'), { spread: false })

      expect(layout.faces.slice(2, -2)).toEqual([
        { kind: 'page', index: 0 },
        { kind: 'page', index: 1 },
      ])
    })

    it('keeps the place on a panorama when switching views', () => {
      const spread = new BookLayout(pages('grid', 'panorama', 'grid'), { spread: true })
      const single = new BookLayout(pages('grid', 'panorama', 'grid'), { spread: false })

      expect(single.visible(single.convert(2, spread))).toEqual([{ kind: 'page', index: 1 }])
      expect(spread.convert(single.flippedForPage(2), single)).toBe(2)
      expect(spread.convert(single.flippedForPage(3), single)).toBe(3)
    })
  })
})
