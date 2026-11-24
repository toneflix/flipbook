import { describe, expect, it } from 'vitest'
import type { FlipbookBook } from '@toneflix/flipbook-core'
import { Canvas } from 'skia-canvas'
import { BookPrinter } from '../src'

const photo = async () => {
  const canvas = new Canvas(300, 200)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#2a6f97'
  ctx.fillRect(0, 0, 300, 200)

  return canvas.toBuffer('jpg')
}

const book: FlipbookBook = {
  title: 'Mornings',
  author: 'Ada',
  year: 2026,
  colophon: 'For the family.',
  paper: 'kraft',
  frame: 'gilt',
  pages: [
    { layout: 'grid', caption: 'Four corners', photos: [{ src: 'a' }, { src: 'b' }, { src: 'c' }, null] },
    { layout: 'scatter', caption: 'Loose prints', photos: [{ src: 'a' }, { src: 'b', frame: 'deckle' }, { src: 'c', frame: 'feather' }] },
  ],
}

describe('BookPrinter', () => {
  const printer = new BookPrinter(book, { dpi: 72, load: photo })

  it('prints every face from the front cover to the back', () => {
    expect(printer.names).toEqual(['cover', 'title', 'page-1', 'page-2', 'colophon', 'back'])
  })

  it('draws a page as an image at the print resolution', async () => {
    const pixels = await printer.pixels(printer.faces[2])

    expect(pixels.width).toBe(595)
    expect(pixels.height).toBe(793)
    expect(pixels.data.length).toBe(595 * 793 * 4)
  })

  it('prints the whole book as one PDF, a page per face', async () => {
    const pdf = (await printer.pdf()).toString('latin1')

    expect(pdf.startsWith('%PDF')).toBe(true)
    expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(6)
  })
})
