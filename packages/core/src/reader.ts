import { BookLayout } from './layout'
import { PageTurn, type PageTurnOptions, type TurnFrame } from './page-turn'
import type { Vec } from './vector'

/** The leaf being turned or peeked at. `dir` is 1 when it turns from right to left. */
export type ActiveTurn = { leaf: number; dir: 1 | -1; stiff: boolean; peek: boolean }

export interface GripOptions {
  /** Share of the page width along the outer edge that grabs the edge itself. */
  edgeX: number
  /** Share of the page height along the top and bottom that grabs the edge itself. */
  edgeY: number
  /** Lift a corner when a mouse hovers near it. */
  peek: boolean
}

export const DEFAULT_GRIP: GripOptions = { edgeX: 0.15, edgeY: 0.08, peek: true }

export interface ReaderEvents {
  /** A turning leaf moved: paint it. */
  frame(frame: TurnFrame, turn: ActiveTurn): void
  /** The open page or the leaf being turned changed. */
  change(): void
  /** A page started to turn over, e.g. to play a sound. */
  flip(): void
}

export interface ReaderOptions extends PageTurnOptions {
  grip?: Partial<GripOptions>
  /** Where the book opens: a `flipped` value. */
  flipped?: number
}

type Hold = { leaf: number; dir: 1 | -1; origin: Vec; start: Vec; stiff: boolean }

/** A pointer moving less than this (px) before it lets go is a tap, not a drag. */
const TAP = 6

/**
 * Reads a book: which leaves lie open, which one is turning, and how pointers, buttons and keys
 * turn them. Pointer positions are book pixels from the top of the spine (in a single-page view,
 * from the page's left edge). Platforms render from `flipped` and `active`, paint turning leaves
 * on `frame`, and re-render on `change`.
 */
export class FlipbookReader {
  flipped: number
  active: ActiveTurn | null = null
  layout: BookLayout
  width = 0
  height = 0
  grip: GripOptions

  readonly engine: PageTurn

  private press: { at: Vec; id: number; grabbed: boolean } | null = null
  private grabStart: Vec = { x: 0, y: 0 }
  private grabDir: 1 | -1 = 1
  private grabReach = 1

  constructor(
    layout: BookLayout,
    private events: ReaderEvents,
    options: ReaderOptions = {},
  ) {
    this.layout = layout
    this.flipped = Math.max(0, Math.min(layout.length, options.flipped ?? 0))
    this.grip = { ...DEFAULT_GRIP, ...options.grip }
    this.engine = new PageTurn(
      {
        frame: (frame) => this.active && this.events.frame(frame, this.active),
        settle: (turned) => this.settle(turned),
      },
      options,
    )
  }

  get size() {
    return { width: this.width, height: this.height }
  }

  get atStart() {
    return this.flipped === 0
  }

  get atEnd() {
    return this.flipped === this.layout.length
  }

  /** True unless a leaf is mid-turn (a peeking corner still counts as resting). */
  get settled() {
    return !this.active || this.active.peek
  }

  get label() {
    return this.layout.label(this.flipped)
  }

  /** Swaps the layout (e.g. spread to single pages) and the page size, keeping the reader's place. */
  configure({ layout, width, height }: { layout?: BookLayout; width?: number; height?: number }) {
    const relayout = layout && layout !== this.layout
    const resize = (width !== undefined && width !== this.width) || (height !== undefined && height !== this.height)

    if (!relayout && !resize) return

    if (layout && relayout) {
      this.flipped = layout.convert(this.flipped, this.layout)
      this.layout = layout
    }
    this.width = width ?? this.width
    this.height = height ?? this.height
    this.engine.cancel()
    this.active = null
    this.press = null
    this.events.change()
  }

  /** Opens the book at `target`, turning one leaf with animation or jumping further. */
  go(target: number) {
    const next = Math.max(0, Math.min(this.layout.length, target))

    if (next === this.flipped || this.width === 0) return

    // A turn already under way lands first.
    if (this.engine.active && !this.engine.peeking) {
      this.engine.finish()
      return
    }

    this.engine.cancel()
    this.events.flip()

    if (Math.abs(next - this.flipped) !== 1) {
      this.active = null
      this.flipped = next
      this.events.change()
      return
    }

    const leaf = Math.min(next, this.flipped)
    const stiff = this.layout.isStiff(leaf)

    this.begin({ leaf, dir: next > this.flipped ? 1 : -1, stiff, peek: false })
    this.engine.turn({ x: this.width, y: stiff ? this.height / 2 : this.height }, this.size, stiff)
  }

  next() {
    this.go(this.flipped + 1)
  }

  prev() {
    this.go(this.flipped - 1)
  }

  /** Lifts the outer corner nearest a hovering mouse, or lets it drop when none is near. */
  hover(p: Vec) {
    if (this.press || this.engine.dragging) return

    const corner = this.grip.peek ? this.cornerAt(p) : null

    if (!corner) {
      this.engine.unpeek()
      return
    }

    const { width, height } = this
    const dir = corner.x > 0 ? 1 : -1
    const leaf = dir === 1 ? this.flipped : this.flipped - 1
    const stiff = this.layout.isStiff(leaf)
    const origin = { x: width, y: stiff ? height / 2 : corner.y }
    const toward = { x: dir * (p.x - corner.x), y: p.y - corner.y }
    const distance = Math.hypot(toward.x, toward.y) || 1
    const lift = Math.max(width * 0.12, Math.min(width * 0.2, distance * 2))
    const point = {
      x: width + (toward.x / distance) * lift,
      y: stiff ? origin.y : corner.y + (toward.y / distance) * lift,
    }

    if (this.active?.leaf !== leaf || this.active.dir !== dir) this.begin({ leaf, dir, stiff, peek: true })
    this.engine.peek(origin, point, this.size, stiff)
  }

  /** The pointer left the book. */
  leave() {
    this.engine.unpeek()
  }

  down(p: Vec, id: number) {
    this.press = { at: p, id, grabbed: false }
  }

  /** Follows a pressed pointer; returns true once it has taken hold of a leaf (to capture the pointer). */
  move(p: Vec, id: number) {
    const start = this.press

    if (!start || start.id !== id) return false

    const dx = p.x - start.at.x
    const dy = p.y - start.at.y

    if (!start.grabbed) {
      if (Math.hypot(dx, dy) < TAP || (this.engine.active && !this.engine.peeking)) return false

      const peeked =
        this.engine.peeking && this.active ? { ...this.active, origin: this.engine.frame.origin, start: this.engine.frame.point } : null
      const hold = peeked ?? this.holdAt(start.at)

      if (!hold) return false

      start.grabbed = true
      this.grabStart = hold.start
      this.grabDir = hold.dir
      // On a single page the previous leaf lies out of sight, so it moves twice as far to show up under the pointer.
      this.grabReach = !this.layout.spread && hold.dir === -1 ? 2 : 1
      this.begin({ leaf: hold.leaf, dir: hold.dir, stiff: hold.stiff, peek: false })
      this.engine.grab(hold.origin, hold.start, this.size, hold.stiff)
    }

    this.engine.drag({ x: this.grabStart.x + this.grabDir * this.grabReach * dx, y: this.grabStart.y + dy })

    return true
  }

  /** Lets go of a pointer. Returns 'tap' when it barely moved, so the caller can turn by tapping. */
  up(p: Vec, id: number): 'tap' | 'turn' | null {
    const start = this.press

    if (!start || start.id !== id) return null

    this.press = null

    if (start.grabbed) {
      if (this.engine.release()) this.events.flip()
      return 'turn'
    }

    return Math.abs(p.x - start.at.x) < TAP + 2 && Math.abs(p.y - start.at.y) < TAP + 2 ? 'tap' : null
  }

  /** The pointer was taken away (e.g. by scrolling): drop whatever it held. */
  cancel() {
    this.press = null
    if (this.engine.dragging) this.engine.release()
  }

  destroy() {
    this.engine.cancel()
  }

  private begin(turn: ActiveTurn) {
    this.active = turn
    this.events.change()
  }

  private settle(turned: boolean) {
    const turn = this.active

    if (!turn) return

    // A leaf turned from the right lands on the left, and the other way round.
    const landedLeft = turn.dir === 1 ? turned : !turned

    this.flipped = landedLeft ? turn.leaf + 1 : turn.leaf
    this.active = null
    this.events.change()
  }

  /**
   * Which leaf a press at `p` takes hold of, and where on it. Presses near an outer edge or
   * corner hold that spot; anywhere else holds the outer edge at the same height, so a swipe
   * across the page turns it.
   */
  private holdAt(p: Vec): Hold | null {
    const { width, height, layout } = this
    const forward = layout.spread ? p.x >= 0 : p.x >= width * 0.3
    const leaf = forward ? this.flipped : this.flipped - 1

    if (leaf < 0 || leaf >= layout.length) return null

    // Measured from the spine toward the side the leaf lies on.
    const onLeaf = forward ? p : { x: layout.spread ? -p.x : width, y: p.y }
    const nearOuter = onLeaf.x > width * (1 - this.grip.edgeX)
    const nearTop = onLeaf.y < height * this.grip.edgeY
    const nearBottom = onLeaf.y > height * (1 - this.grip.edgeY)
    const stiff = layout.isStiff(leaf)
    const origin = {
      x: nearOuter || !(nearTop || nearBottom) ? width : Math.max(1, onLeaf.x),
      y: stiff ? height / 2 : nearTop ? 0 : nearBottom ? height : Math.max(0, Math.min(height, onLeaf.y)),
    }

    return { leaf, dir: forward ? 1 : -1, origin, stiff, start: origin }
  }

  /** The outer corner under a hovering pointer, if any. */
  private cornerAt(p: Vec) {
    const { width, height, layout, flipped } = this
    const reach = Math.max(36, width * 0.12)
    const corners = [
      ...(flipped < layout.length
        ? [
            { x: width, y: 0 },
            { x: width, y: height },
          ]
        : []),
      ...(layout.spread && flipped > 0
        ? [
            { x: -width, y: 0 },
            { x: -width, y: height },
          ]
        : []),
    ]

    return corners.find((c) => Math.hypot(p.x - c.x, p.y - c.y) < reach) ?? null
  }
}
