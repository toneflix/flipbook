import { describe, expect, it } from 'vitest'
import {
  COVER_DESIGNS,
  COVER_THEMES,
  FRAME_STYLES,
  PAGE_HEIGHT,
  PAGE_LAYOUTS,
  PAGE_SHAPES,
  PageScene,
  pageSize,
  farthestCorner,
  sprockets,
  withAlpha,
  Typesetter,
  type CoverDesign,
  type CoverTheme,
  type FlipbookBook,
  type FrameStyle,
  type PageLayout,
  type PageShape,
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

  it('leaves room under an instant print', () => {
    const scene = new PageScene(book('framed', 'instant'), measure).page(book('framed', 'instant').pages[0])
    const drawn = flatten(scene.nodes).find((node) => node.kind === 'photo')

    expect(drawn?.kind === 'photo' && drawn.box.width / drawn.box.height).toBeCloseTo(1.5)
  })

  it('cuts an arch to a half circle on top', () => {
    const scene = new PageScene(book('framed', 'arch'), measure).page(book('framed', 'arch').pages[0])
    const arch = flatten(scene.nodes).find((node) => node.kind === 'group' && node.clip?.type === 'roundrect')
    const clip = arch?.kind === 'group' && arch.clip?.type === 'roundrect' ? arch.clip : null

    expect(clip?.radii[0]).toBeCloseTo(clip!.box.width / 2)
    expect(clip?.radii[2]).toBe(0)
  })

  it('spaces sprocket holes evenly along the band', () => {
    const holes = sprockets(30)

    expect(holes).toHaveLength(9)
    expect(holes[0]).toBeCloseTo(0.6 + 0.7)
    expect(holes.at(-1)! + 1.6).toBeCloseTo(30 - 0.6 - 0.7)
  })

  it('draws every layout in every frame in every shape', () => {
    for (const pageShape of Object.keys(PAGE_SHAPES) as PageShape[])
      for (const layout of Object.keys(PAGE_LAYOUTS) as PageLayout[])
        for (const frame of Object.keys(FRAME_STYLES) as FrameStyle[]) {
          const shaped = { ...book(layout, frame), pageShape }
          const scene = new PageScene(shaped, measure).page(shaped.pages[0], { number: 1 })
          const json = JSON.stringify(scene)

          expect(json).not.toContain('null')
          expect(json).not.toContain('NaN')
          expect(flatten(scene.nodes).filter((node) => node.kind === 'photo')).toHaveLength(PAGE_LAYOUTS[layout].slots)
        }
  })

  it('sizes the page by its shape', () => {
    const scene = new PageScene({ ...book('pair'), pageShape: 'wide' }, measure).page(book('pair').pages[0])
    const slots = scene.nodes.flatMap((node) => (node.kind === 'group' && node.clip?.type === 'rect' ? [node.clip.box] : []))

    expect([scene.width, scene.height]).toEqual([150, 100])
    expect(slots[0].y).toBeCloseTo(slots[1].y)
    expect(slots[1].x).toBeGreaterThan(slots[0].x + slots[0].width)
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
    const radius = farthestCorner({ x: 50, y: PAGE_HEIGHT / 2 })

    expect(radius.x).toBeCloseTo(50 * Math.SQRT2)
    expect(radius.y).toBeCloseTo((PAGE_HEIGHT / 2) * Math.SQRT2)
  })

  it('adds alpha to hex and rgb colours', () => {
    expect(withAlpha('#fff', 0.5)).toBe('rgba(255,255,255,0.5)')
    expect(withAlpha('#1a2b3c', 0.2)).toBe('rgba(26,43,60,0.2)')
    expect(withAlpha('rgba(1,2,3,0.9)', 0.1)).toBe('rgba(1,2,3,0.1)')
  })
})

describe('CoverScene', () => {
  const covers = (coverDesign: CoverDesign, theme: CoverTheme, withPhoto: boolean, pageShape: PageShape = 'portrait') =>
    new PageScene(
      { ...book('single'), coverDesign, theme, pageShape, subtitle: 'A subtitle', brand: 'Studio', cover: withPhoto ? photo : undefined },
      measure,
    ).covers

  it('draws every design in every theme and shape, with and without a photo', () => {
    for (const pageShape of Object.keys(PAGE_SHAPES) as PageShape[])
      for (const design of Object.keys(COVER_DESIGNS) as CoverDesign[])
        for (const theme of Object.keys(COVER_THEMES) as CoverTheme[])
          for (const withPhoto of [true, false]) {
            const scenes = covers(design, theme, withPhoto, pageShape)
            const front = scenes.front({ bound: true })
            const back = scenes.back()
            const json = JSON.stringify([front, back])

            expect(json).not.toContain('null')
            expect(json).not.toContain('NaN')
            expect([front.width, front.height]).toEqual([pageSize(pageShape).width, pageSize(pageShape).height])
            expect(flatten(front.nodes).some((node) => node.kind === 'photo')).toBe(withPhoto)
          }
  })

  it('sets the title on the front', () => {
    const lines = flatten(covers('classic', 'classic', false).front().nodes).flatMap((node) => (node.kind === 'text' ? node.lines : []))

    expect(lines.map((line) => line.text)).toContain('A book')
  })
})
