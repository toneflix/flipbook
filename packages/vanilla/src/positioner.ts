import { PhotoCrop, type PhotoPosition, type Size } from '@toneflix/flipbook-core'

export interface PhotoPositionerOptions {
  /** Where the photo starts. */
  position?: Partial<PhotoPosition> | null
  /** Called once a drag, pinch, scroll or key press has moved the photo. */
  onChange: (position: PhotoPosition) => void
}

/** How far one arrow key press moves the photo (it moves the way the arrow points), and how much one zoom step enlarges it. */
const STEP = { pan: 2, zoom: 0.1 }

/**
 * Lets people choose which part of a photo shows inside the element that crops it: drag or use the arrow
 * keys to move it, and pinch, scroll or press + and − to zoom. The element must hold the photo's `<img>`.
 */
export class PhotoPositioner {
  private crop: PhotoCrop
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private gesture: { crop: PhotoCrop; spread: number } | null = null
  private readonly abort = new AbortController()
  private settle?: ReturnType<typeof setTimeout>

  constructor(
    private readonly el: HTMLElement,
    private readonly options: PhotoPositionerOptions,
  ) {
    this.crop = PhotoCrop.of(options.position)

    const signal = this.abort.signal

    el.classList.add('fb-positioning')
    el.tabIndex = 0
    el.setAttribute('aria-roledescription', 'photo position')
    el.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown + -')
    el.addEventListener('pointerdown', (e) => this.down(e), { signal })
    el.addEventListener('pointermove', (e) => this.move(e), { signal })
    el.addEventListener('pointerup', (e) => this.up(e), { signal })
    el.addEventListener('pointercancel', (e) => this.up(e), { signal })
    el.addEventListener('wheel', (e) => this.wheel(e), { signal, passive: false })
    el.addEventListener('keydown', (e) => this.key(e), { signal })
    el.addEventListener('dragstart', (e) => e.preventDefault(), { signal })
  }

  get position(): PhotoPosition {
    return this.crop.toJSON()
  }

  /** Moves the photo without reporting it, e.g. when the position changes elsewhere. */
  set position(position: Partial<PhotoPosition> | null | undefined) {
    this.crop = PhotoCrop.of(position)
    this.paint()
  }

  destroy() {
    clearTimeout(this.settle)
    this.abort.abort()
    this.el.classList.remove('fb-positioning', 'is-moving')
    this.el.removeAttribute('tabindex')
    this.el.removeAttribute('aria-roledescription')
    this.el.removeAttribute('aria-keyshortcuts')
  }

  private get image(): HTMLImageElement | null {
    return this.el.querySelector('img')
  }

  private get box(): Size {
    const img = this.image

    return { width: img?.clientWidth ?? 0, height: img?.clientHeight ?? 0 }
  }

  private get natural(): Size | null {
    const img = this.image

    return img?.naturalWidth ? { width: img.naturalWidth, height: img.naturalHeight } : null
  }

  private paint() {
    const img = this.image

    if (img) Object.assign(img.style, this.crop.css)
  }

  private commit() {
    this.options.onChange(this.crop.toJSON())
  }

  private spread() {
    const [a, b] = [...this.pointers.values()]

    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  private down(e: PointerEvent) {
    if (e.button !== 0 || !this.image) return

    e.stopPropagation()
    this.el.setPointerCapture(e.pointerId)
    this.el.classList.add('is-moving')
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    this.gesture = { crop: this.crop, spread: this.spread() }
  }

  private move(e: PointerEvent) {
    const last = this.pointers.get(e.pointerId)

    if (!last || !this.gesture) return

    e.stopPropagation()

    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (this.pointers.size > 1) {
      if (this.gesture.spread) this.crop = this.crop.zoomTo((this.gesture.crop.zoom * this.spread()) / this.gesture.spread)
    } else {
      const scale = this.el.getBoundingClientRect().width / (this.el.offsetWidth || 1)

      this.crop = this.crop.pan((e.clientX - last.x) / scale, (e.clientY - last.y) / scale, this.box, this.natural)
    }

    this.paint()
  }

  private up(e: PointerEvent) {
    if (!this.pointers.delete(e.pointerId)) return

    e.stopPropagation()
    this.gesture = this.pointers.size ? { crop: this.crop, spread: this.spread() } : null
    if (this.pointers.size) return

    this.el.classList.remove('is-moving')
    this.commit()
  }

  private wheel(e: WheelEvent) {
    e.preventDefault()
    this.crop = this.crop.zoomTo(this.crop.zoom * Math.exp(-e.deltaY / 500))
    this.paint()
    clearTimeout(this.settle)
    this.settle = setTimeout(() => this.commit(), 250)
  }

  private key(e: KeyboardEvent) {
    const moves: Record<string, () => PhotoCrop> = {
      ArrowLeft: () => new PhotoCrop(this.crop.x + STEP.pan, this.crop.y, this.crop.zoom),
      ArrowRight: () => new PhotoCrop(this.crop.x - STEP.pan, this.crop.y, this.crop.zoom),
      ArrowUp: () => new PhotoCrop(this.crop.x, this.crop.y + STEP.pan, this.crop.zoom),
      ArrowDown: () => new PhotoCrop(this.crop.x, this.crop.y - STEP.pan, this.crop.zoom),
      '+': () => this.crop.zoomTo(this.crop.zoom + STEP.zoom),
      '=': () => this.crop.zoomTo(this.crop.zoom + STEP.zoom),
      '-': () => this.crop.zoomTo(this.crop.zoom - STEP.zoom),
      '0': () => PhotoCrop.CENTRE,
    }
    const next = moves[e.key]?.()

    if (!next) return

    e.preventDefault()
    e.stopPropagation()
    this.crop = next
    this.paint()
    this.commit()
  }
}
