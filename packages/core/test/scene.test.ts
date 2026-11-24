import { describe, expect, it } from 'vitest'
import {
  FRAME_STYLES,
  PAGE_HEIGHT,
  PAGE_LAYOUTS,
  PageScene,
  Typesetter,
  type FlipbookBook,
  type FrameStyle,
  type PageLayout,
  type SceneNode,
  type TextMeasure,
} from '../src'

/** Every letter is half the type size wide. */
const measure: TextMeasure = {
  measure: (text, font) => ({ width: text.length * font.size * 0.5, ascent: font.size, descent: font.size * 0.25 }),
}

const photo = { src: 'a.jpg', width: 1500, height: 1000 }

const book = (layout: PageLayout, frame: FrameStyle = 'hairline'): FlipbookBook => ({
  title: 'A book',
  frame,
  pages: [{ layout, caption: 'A short caption', photos: Array.from({ length: PAGE_LAYOUTS[layout].slots }, () => photo) }],
})

const flatten = (nodes: SceneNode[]): SceneNode[] =>
  nodes.flatMap((node) => (node.kind === 'group' ? [node, ...flatten(node.children)] : [node]))

describe('Typesetter', () => {
  const text = new Typesetter(measure)
  const font = { family: 'serif', style: 'normal', weight: 400, size: 2 } as const

  it('breaks lines where the next word would overflow', () => {
    expect(text.set('aaaa bbbb cccc', font, { width: 9 }).lines).toEqual(['aaaa bbbb', 'cccc'])
  })

  it('evens out lines when balancing', () => {
    expect(text.set('aaaa bbbb cccc dd', font, { width: 14, wrap: 'balance' }).lines).toEqual(['aaaa bbbb', 'cccc dd'])
  })

  it('places baselines inside taller line boxes', () => {
    const block = text.set('aaaa', font, { width: 50, lineHeight: 1.5 })

    expect(block.place(10, 20, 30, 'center')).toEqual([{ text: 'aaaa', x: 25, y: 20 + (3 - 2.5) / 2 + 2, align: 'center' }])
  })
})

describe('PageScene', () => {
  it('lays a grid out as the reader does', () => {
    const scene = new PageScene(book('grid'), measure).page(book('grid').pages[0])
    const slots = scene.nodes.filter((node) => node.kind === 'group' && node.clip?.type === 'rect')
    const boxes = slots.map((node) => (node.kind === 'group' && node.clip?.type === 'rect' ? node.clip.box : null))

    expect(scene.height).toBeCloseTo(PAGE_HEIGHT)
    expect(boxes.map((box) => [box!.x, box!.width])).toEqual([
      [7, 41.5],
      [51.5, 41.5],
      [7, 41.5],
      [51.5, 41.5],
    ])
  })

  it('keeps a framed photo in its own shape', () => {
    const scene = new PageScene(book('framed', 'none'), measure).page(book('framed', 'none').pages[0])
    const drawn = flatten(scene.nodes).find((node) => node.kind === 'photo')

    expect(drawn?.kind === 'photo' && drawn.box.width / drawn.box.height).toBeCloseTo(1.5)
  })

  it('draws every layout in every frame', () => {
    for (const layout of Object.keys(PAGE_LAYOUTS) as PageLayout[])
      for (const frame of Object.keys(FRAME_STYLES) as FrameStyle[]) {
        const scene = new PageScene(book(layout, frame), measure).page(book(layout, frame).pages[0], { number: 1 })

        expect(JSON.stringify(scene)).not.toContain('null')
        expect(flatten(scene.nodes).filter((node) => node.kind === 'photo')).toHaveLength(PAGE_LAYOUTS[layout].slots)
      }
  })

  it('numbers pages on their outer corner', () => {
    const scenes = new PageScene({ ...book('grid'), pages: [book('grid').pages[0], book('grid').pages[0]] }, measure)
    const number = (index: number) =>
      flatten(scenes.face({ kind: 'page', index }).nodes)
        .flatMap((node) => (node.kind === 'text' ? node.lines : []))
        .find((line) => line.text === String(index + 1))

    expect(number(0)?.align).toBe('right')
    expect(number(1)?.align).toBe('left')
  })

  it('reaches the farthest corner with the closest-side shape', () => {
    const radius = PageScene.farthestCorner({ x: 50, y: PAGE_HEIGHT / 2 })

    expect(radius.x).toBeCloseTo(50 * Math.SQRT2)
    expect(radius.y).toBeCloseTo((PAGE_HEIGHT / 2) * Math.SQRT2)
  })
})
