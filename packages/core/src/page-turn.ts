import { Fold } from './fold'
import { length, sub, type Vec } from './vector'

export type TurnFrame = { origin: Vec; point: Vec; stiff: boolean }

export type PageSize = { width: number; height: number }

export interface PageTurnListener {
  frame: (frame: TurnFrame) => void
  /** The leaf came to rest, either turned over or back where it started. */
  settle: (turned: boolean) => void
}

/** How a released page moves. Frequencies are natural frequencies of critically damped springs, in rad/ms. */
export interface TurnPhysics {
  /** Spring that drops a page after a drag. Higher is snappier. */
  fall: number
  /** Spring for turns started by a button, key or tap. */
  auto: number
  /** Spring that lifts a corner under a hovering mouse. */
  peek: number
  /** How far ahead (ms) a flick carries the page when deciding where it lands. */
  flick: number
  /** How high a falling page lifts off the paper, as a share of the page height. */
  lift: number
}

export const DEFAULT_PHYSICS: TurnPhysics = { fall: 0.0075, auto: 0.0055, peek: 0.02, flick: 170, lift: 0.12 }

/** Clock and frame callbacks, swappable for tests or platforms without `requestAnimationFrame`. */
export interface Scheduler {
  now(): number
  request(callback: (now: number) => void): number
  cancel(handle: number): void
}

const browserScheduler: Scheduler = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
}

const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export interface PageTurnOptions {
  physics?: Partial<TurnPhysics>
  scheduler?: Scheduler
  /** When it returns true, released pages land at once instead of falling. */
  reducedMotion?: () => boolean
}

type Mode = 'idle' | 'drag' | 'fall' | 'peek'

/**
 * Moves one leaf: follows the pointer while dragged, then falls open or shut on a critically
 * damped spring, starting with the speed it was let go at. While falling, the page lifts off the
 * paper in an arc so it curls over instead of sliding flat.
 */
export class PageTurn {
  physics: TurnPhysics

  private mode: Mode = 'idle'
  private origin: Vec = { x: 0, y: 0 }
  private point: Vec = { x: 0, y: 0 }
  private stiff = false
  private size: PageSize = { width: 1, height: 1 }

  /** Spring state; `position.y` excludes the lift arc. */
  private position: Vec = { x: 0, y: 0 }
  private velocity: Vec = { x: 0, y: 0 }
  private target: Vec = { x: 0, y: 0 }
  private omega = DEFAULT_PHYSICS.fall
  private lift = 0
  private turned = false

  private trail: { p: Vec; t: number }[] = []
  private handle = 0
  private last = 0
  private scheduler: Scheduler
  private reducedMotion: () => boolean

  constructor(
    private listener: PageTurnListener,
    options: PageTurnOptions = {},
  ) {
    this.physics = { ...DEFAULT_PHYSICS, ...options.physics }
    this.scheduler = options.scheduler ?? browserScheduler
    this.reducedMotion = options.reducedMotion ?? prefersReducedMotion
  }

  get active() {
    return this.mode !== 'idle'
  }

  get dragging() {
    return this.mode === 'drag'
  }

  get peeking() {
    return this.mode === 'peek'
  }

  get frame(): TurnFrame {
    return { origin: this.origin, point: this.point, stiff: this.stiff }
  }

  /** Takes hold of a leaf at `origin`, currently at `point`. */
  grab(origin: Vec, point: Vec, size: PageSize, stiff: boolean) {
    this.size = size
    this.origin = origin
    this.stiff = stiff
    this.mode = 'drag'
    this.trail = []
    this.stop()
    this.moveTo(point)
  }

  /** Follows the pointer during a drag. */
  drag(point: Vec) {
    if (this.mode !== 'drag') return

    this.moveTo(point)
  }

  /** Lets go: the page lands open or shut depending on where it is and how fast it moves. */
  release() {
    if (this.mode !== 'drag') return false

    const speed = this.speed()
    const ahead = this.point.x + speed.x * this.physics.flick

    this.fall(ahead < 0, speed, this.physics.fall)

    return this.turned
  }

  /** Turns a leaf over on its own, as if lifted by the given corner. */
  turn(origin: Vec, size: PageSize, stiff: boolean) {
    this.size = size
    this.origin = origin
    this.stiff = stiff
    this.point = { ...origin }
    this.fall(true, { x: 0, y: 0 }, this.physics.auto)
  }

  /** Lifts a corner a little toward `point`, as a hint that it can be turned. */
  peek(origin: Vec, point: Vec, size: PageSize, stiff: boolean) {
    if (this.mode === 'drag' || this.mode === 'fall') return

    if (this.mode === 'idle' || this.origin.x !== origin.x || this.origin.y !== origin.y) {
      this.size = size
      this.origin = origin
      this.stiff = stiff
      this.point = { ...origin }
      this.position = { ...this.point }
      this.velocity = { x: 0, y: 0 }
      this.lift = 0
    }

    this.mode = 'peek'
    this.omega = this.physics.peek
    this.target = point
    this.turned = point.x < 0
    this.run()
  }

  /** Lets a peeking corner drop back. */
  unpeek() {
    if (this.mode !== 'peek') return

    this.mode = 'fall'
    this.target = this.turned ? { x: -this.origin.x, y: this.origin.y } : { ...this.origin }
    this.run()
  }

  /** Ends any turn immediately, landing it where it was heading. */
  finish() {
    if (this.mode === 'idle') return

    const turned = this.mode === 'fall' ? this.turned : this.point.x < 0

    this.stop()
    this.mode = 'idle'
    this.listener.settle(turned)
  }

  /** Drops the turn without settling, e.g. when the book is resized. */
  cancel() {
    this.stop()
    this.mode = 'idle'
  }

  private moveTo(point: Vec) {
    const p = this.stiff
      ? { x: Math.max(-this.origin.x, Math.min(this.origin.x, point.x)), y: this.origin.y }
      : Fold.attach(point, this.origin, this.size.height)
    const now = this.scheduler.now()

    this.point = p
    this.trail.push({ p, t: now })
    this.trail = this.trail.filter((s) => now - s.t < 100)
    this.listener.frame(this.frame)
  }

  private speed(): Vec {
    if (this.trail.length < 2) return { x: 0, y: 0 }

    const first = this.trail[0]
    const last = this.trail[this.trail.length - 1]
    const dt = Math.max(1, last.t - first.t)

    return { x: (last.p.x - first.p.x) / dt, y: (last.p.y - first.p.y) / dt }
  }

  private fall(turned: boolean, velocity: Vec, omega: number) {
    if (this.reducedMotion()) {
      this.stop()
      this.mode = 'idle'
      this.listener.settle(turned)
      return
    }

    this.mode = 'fall'
    this.turned = turned
    this.omega = omega
    this.target = turned ? { x: -this.origin.x, y: this.origin.y } : { ...this.origin }
    this.lift = this.stiff ? 0 : this.size.height * this.physics.lift * (this.origin.y > this.size.height / 2 ? -1 : 1)
    this.position = { x: this.point.x, y: this.point.y - this.arc(this.point.x) }
    this.velocity = velocity
    this.run()
  }

  /** How far the page lifts off the paper at x while falling. */
  private arc(x: number) {
    const reach = Math.max(1, this.origin.x)
    const t = Math.min(1, Math.abs(x) / reach)

    return this.lift * (1 - t * t)
  }

  private run() {
    if (this.handle) return

    this.last = this.scheduler.now()
    this.handle = this.scheduler.request(this.tick)
  }

  private stop() {
    if (this.handle) this.scheduler.cancel(this.handle)
    this.handle = 0
  }

  private tick = (now: number) => {
    const dt = Math.min(48, now - this.last)
    const w = this.omega

    this.last = now

    for (let step = 0; step < dt; step += 4) {
      const h = Math.min(4, dt - step)

      for (const axis of ['x', 'y'] as const) {
        const accel = w * w * (this.target[axis] - this.position[axis]) - 2 * w * this.velocity[axis]
        this.velocity[axis] += accel * h
        this.position[axis] += this.velocity[axis] * h
      }
    }

    const point = { x: this.position.x, y: this.position.y + (this.mode === 'fall' ? this.arc(this.position.x) : 0) }

    this.point = this.stiff ? { x: point.x, y: this.origin.y } : Fold.attach(point, this.origin, this.size.height)
    this.listener.frame(this.frame)

    const resting = length(sub(this.target, this.position)) < 0.5 && length(this.velocity) < 0.02

    if (resting && this.mode === 'fall') {
      this.handle = 0
      this.mode = 'idle'
      this.listener.settle(this.turned)
      return
    }

    this.handle = resting ? 0 : this.scheduler.request(this.tick)
  }
}
