import { describe, expect, it, vi } from 'vitest'
import { BookLayout, FlipbookReader, type Scheduler } from '../src'

/** Runs animation frames on demand. */
class ManualClock implements Scheduler {
  time = 0
  private queue = new Map<number, (now: number) => void>()
  private id = 0

  now() {
    return this.time
  }

  request(callback: (now: number) => void) {
    this.queue.set(++this.id, callback)
    return this.id
  }

  cancel(handle: number) {
    this.queue.delete(handle)
  }

  run(ms: number) {
    for (let t = 0; t < ms; t += 16) {
      this.time += 16
      const due = [...this.queue.values()]
      this.queue.clear()
      due.forEach((callback) => callback(this.time))
    }
  }
}

const setup = (pages = 6) => {
  const clock = new ManualClock()
  const events = { frame: vi.fn(), change: vi.fn(), flip: vi.fn() }
  const reader = new FlipbookReader(new BookLayout(pages, { spread: true }), events, { scheduler: clock, reducedMotion: () => false })

  reader.configure({ width: 300, height: 400 })

  return { clock, events, reader }
}

describe('FlipbookReader', () => {
  it('turns a page with the next button and lands it', () => {
    const { clock, events, reader } = setup()

    reader.next()

    expect(reader.active).toMatchObject({ leaf: 0, dir: 1, stiff: true })
    expect(events.flip).toHaveBeenCalledOnce()

    clock.run(3000)

    expect(reader.active).toBeNull()
    expect(reader.flipped).toBe(1)
    expect(events.frame).toHaveBeenCalled()
  })

  it('jumps without animating when going further than one leaf', () => {
    const { reader } = setup()

    reader.go(3)

    expect(reader.active).toBeNull()
    expect(reader.flipped).toBe(3)
  })

  it('turns a page dragged past the spine and drops one let go early', () => {
    const { clock, reader } = setup()

    reader.go(2)
    reader.down({ x: 290, y: 390 }, 1)
    reader.move({ x: 250, y: 380 }, 1)
    reader.move({ x: -150, y: 360 }, 1)
    clock.time += 400
    reader.move({ x: -151, y: 360 }, 1)
    reader.up({ x: -151, y: 360 }, 1)
    clock.run(3000)

    expect(reader.flipped).toBe(3)

    reader.down({ x: 290, y: 390 }, 2)
    reader.move({ x: 200, y: 380 }, 2)
    clock.time += 400
    reader.move({ x: 199, y: 380 }, 2)
    reader.up({ x: 199, y: 380 }, 2)
    clock.run(3000)

    expect(reader.flipped).toBe(3)
  })

  it('reports a tap when the pointer barely moves', () => {
    const { reader } = setup()

    reader.down({ x: 100, y: 100 }, 1)

    expect(reader.up({ x: 102, y: 101 }, 1)).toBe('tap')
  })

  it('peeks at a corner under the mouse and lets it drop', () => {
    const { clock, reader } = setup()

    reader.go(2)
    reader.hover({ x: 290, y: 395 })

    expect(reader.active).toMatchObject({ peek: true, dir: 1 })

    reader.leave()
    clock.run(2000)

    expect(reader.active).toBeNull()
    expect(reader.flipped).toBe(2)
  })

  it('keeps its place when the layout changes', () => {
    const { reader } = setup()

    reader.go(2)
    reader.configure({ layout: new BookLayout(6, { spread: false }) })

    expect(reader.flipped).toBe(3)
  })
})
