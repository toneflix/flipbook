import { describe, expect, it } from 'vitest'
import { photoFrame } from '../src'

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
