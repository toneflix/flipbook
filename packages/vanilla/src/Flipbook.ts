import {
  BookLayout,
  COVER_THEMES,
  DEFAULT_LABELS,
  FlipbookReader,
  Fold,
  type ActiveTurn,
  type Face,
  type FlipbookBook,
  type FlipbookLabels,
  type GripOptions,
  type TurnFrame,
  type TurnPhysics,
  type Vec,
} from '@toneflix/flipbook-core'
import { h, svg } from './dom'
import { enterLandscape, watchOrientation } from './landscape'
import { renderFace } from './pages'
import { playPageTurn } from './sound'

/** Width / height of one page. */
const PAGE_ASPECT = 3 / 4
const SOUND_KEY = 'flipbook:sound'

export interface FlipbookPlace {
  /** How many leaves lie on the left: 0 is the closed front cover. */
  flipped: number
  label: string
  faces: Face[]
}

export interface FlipbookOptions {
  book: FlipbookBook
  /** Open at this page (1-based) instead of the cover. */
  startPage?: number
  /** Two pages side by side, one at a time, or whichever fits the space (default). */
  layout?: 'auto' | 'spread' | 'single'
  /** Show the top and bottom bars. */
  controls?: boolean
  /** Hide the bars after this many ms without movement, or never with false. */
  autoHide?: number | false
  thumbnails?: boolean
  soundButton?: boolean
  /** Play a paper sound on each turn. The sound button remembers the reader's choice. */
  sound?: boolean
  fullscreenButton?: boolean
  /** Cover the book with a "Tap to open full screen" prompt until the first tap or key press, where pages can go full screen. */
  fullscreenPrompt?: boolean
  /** Ask phones held upright to turn sideways, offering single pages instead. */
  landscape?: boolean
  /** Arrow, page and Home/End keys: while the book has focus (true) or anywhere on the page ('global'). */
  keyboard?: boolean | 'global'
  /** Covers swing on the spine like board instead of curling like paper. */
  stiffCovers?: boolean
  physics?: Partial<TurnPhysics>
  grip?: Partial<GripOptions>
  /** Strength of the light and shadow around a turning page, from 0 to 1 or more. */
  shading?: number
  /** Backdrop behind the book. Defaults to a glow tinted by the cover. */
  background?: string
  labels?: Partial<FlipbookLabels>
  onPageChange?: (place: FlipbookPlace) => void
  /** A page started to turn over. */
  onFlip?: () => void
}

type Settings = Required<Omit<FlipbookOptions, 'startPage' | 'physics' | 'grip' | 'background' | 'onPageChange' | 'onFlip' | 'labels'>> &
  Pick<FlipbookOptions, 'startPage' | 'physics' | 'grip' | 'background' | 'onPageChange' | 'onFlip'> & { labels: FlipbookLabels }

const DEFAULTS: Omit<Settings, 'book'> = {
  layout: 'auto',
  controls: true,
  autoHide: 3200,
  thumbnails: true,
  soundButton: true,
  sound: false,
  fullscreenButton: true,
  fullscreenPrompt: false,
  landscape: true,
  keyboard: true,
  stiffCovers: true,
  shading: 1,
  labels: DEFAULT_LABELS,
}

/** Light and shadow drawn around the fold of a turning page. */
type Overlay = 'under' | 'bend' | 'shadow' | 'curl'

const OVERLAYS: { name: Overlay; z: number }[] = [
  { name: 'under', z: 2 },
  { name: 'bend', z: 4 },
  { name: 'shadow', z: 5 },
  { name: 'curl', z: 7 },
]

const polygon = (points: Vec[], dx = 0, dy = 0) =>
  points.length ? `polygon(${points.map((p) => `${(p.x + dx).toFixed(2)}px ${(p.y + dy).toFixed(2)}px`).join(', ')})` : 'polygon(0 0)'

const icon = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="${d}" stroke-linecap="round" stroke-linejoin="round"/></svg>`

const ICONS = {
  prev: icon('M15 6l-6 6 6 6'),
  next: icon('M9 6l6 6-6 6'),
  expand: icon('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'),
  collapse: icon('M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5'),
  soundOn: icon('M4 10v4h3l5 4V6L7 10H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11'),
  soundOff: icon('M4 10v4h3l5 4V6L7 10H4zM17 10l4 4M21 10l-4 4'),
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="8" height="14" rx="1"/><rect x="13" y="5" width="8" height="14" rx="1"/></svg>',
  phone:
    '<svg viewBox="0 0 64 64" class="fb-rotate-hint" aria-hidden="true"><rect x="20" y="6" width="24" height="52" rx="4" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="32" cy="51" r="2" fill="currentColor"/></svg>',
}

const readStoredSound = () => {
  try {
    return localStorage.getItem(SOUND_KEY)
  } catch {
    return null
  }
}

/**
 * A photo book that opens across two pages, turned by dragging, flicking, tapping, buttons or
 * keys. Mount it into any sized element; call `destroy()` when it goes away.
 */
export class Flipbook {
  readonly root: HTMLDivElement
  readonly reader: FlipbookReader

  private settings: Settings
  private layout: BookLayout
  private size = { width: 0, height: 0 }
  private orientation = { portrait: false, touch: false }
  private portraitChoice: 'ask' | 'single' = 'ask'
  private promptAnswered = false
  private soundOn: boolean
  private stripOpen = false
  private chromeVisible = true
  private hideTimer: ReturnType<typeof setTimeout> | undefined
  private lastPlace = ''
  private rendering = false
  private dirty = false
  private faces = new Map<string, HTMLDivElement>()
  private overlays = new Map<Overlay, { clip: HTMLDivElement; light: HTMLDivElement }>()
  private cleanups: (() => void)[] = []

  private els: {
    top: HTMLDivElement
    title: HTMLHeadingElement
    byline: HTMLParagraphElement
    topRight: HTMLDivElement
    sound: HTMLButtonElement
    fullscreen: HTMLButtonElement
    stage: HTMLDivElement
    book: HTMLDivElement
    shadow: HTMLDivElement
    leftEdge: HTMLDivElement
    rightEdge: HTMLDivElement
    spine: HTMLDivElement
    bottom: HTMLDivElement
    prev: HTMLButtonElement
    pages: HTMLButtonElement
    next: HTMLButtonElement
    strip: HTMLDivElement | null
    rotate: HTMLDivElement | null
    prompt: HTMLButtonElement | null
  }

  constructor(
    readonly container: HTMLElement,
    options: FlipbookOptions,
  ) {
    this.settings = Flipbook.resolve(options)
    this.soundOn = this.settings.sound
    this.layout = this.buildLayout()
    this.reader = new FlipbookReader(
      this.layout,
      {
        frame: (frame, turn) => this.paint(frame, turn),
        change: () => this.render(),
        flip: () => {
          if (this.soundOn) playPageTurn()
          this.settings.onFlip?.()
        },
      },
      { flipped: this.layout.flippedForPage(this.settings.startPage), physics: options.physics, grip: options.grip },
    )

    this.root = h('div', { class: 'fb-root' })
    this.els = this.build()
    container.append(this.root)

    const stored = readStoredSound()

    if (this.settings.soundButton && stored) this.soundOn = stored === 'on'

    this.listen()
    this.poke()
    this.render()
  }

  /** Changes options in place; the reader keeps their page. */
  update(options: Partial<FlipbookOptions>) {
    const bookChanged = options.book && options.book !== this.settings.book

    if (options.fullscreenPrompt && !this.settings.fullscreenPrompt) this.promptAnswered = false
    this.settings = Flipbook.resolve({ ...this.settings, ...options, labels: { ...this.settings.labels, ...options.labels } })
    if (options.sound !== undefined) this.soundOn = options.sound
    if (options.physics) this.reader.engine.physics = { ...this.reader.engine.physics, ...options.physics }
    if (options.grip) this.reader.grip = { ...this.reader.grip, ...options.grip }
    if (bookChanged || options.stiffCovers !== undefined) this.clearFaces()

    this.els.title.textContent = this.settings.book.title
    this.poke()
    this.render()
  }

  next() {
    this.reader.next()
  }

  prev() {
    this.reader.prev()
  }

  /** Opens at a `flipped` value. */
  go(flipped: number) {
    this.reader.go(flipped)
  }

  /** Opens at a page (1-based). */
  goToPage(page: number) {
    this.reader.go(this.reader.layout.flippedForPage(page))
  }

  destroy() {
    this.reader.destroy()
    clearTimeout(this.hideTimer)
    this.cleanups.forEach((cleanup) => cleanup())
    this.root.remove()
  }

  private static resolve(options: FlipbookOptions & { labels?: Partial<FlipbookLabels> }): Settings {
    const defined = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined))

    return { ...DEFAULTS, ...defined, labels: { ...DEFAULT_LABELS, ...options.labels } } as Settings
  }

  private get spread() {
    const { layout, landscape } = this.settings
    const mobilePortrait = landscape && this.orientation.touch && this.orientation.portrait
    const stage = this.els?.stage.getBoundingClientRect()
    const narrow = !!stage && stage.width > 0 && stage.width / stage.height < 0.95

    if (layout !== 'auto') return layout === 'spread'

    return !(mobilePortrait && this.portraitChoice === 'single') && !narrow
  }

  private buildLayout() {
    return new BookLayout(this.settings.book.pages.length, { spread: this.spread, stiffCovers: this.settings.stiffCovers })
  }

  // ------------------------------------------------- Building

  private build() {
    const button = (label: string, markup: string, onClick: () => void) => {
      const el = h('button', { type: 'button', class: 'fb-button', 'aria-label': label, title: label })

      el.append(svg(markup))
      el.addEventListener('click', onClick)

      return el
    }

    const title = h('h1', { class: 'fb-title' }, this.settings.book.title)
    const byline = h('p', { class: 'fb-byline' })
    const sound = button('', ICONS.soundOff, () => this.toggleSound())
    const fullscreen = button('', ICONS.expand, () => this.toggleFullscreen())
    const topRight = h('div', { class: 'fb-bar-group' }, sound, fullscreen)
    const top = h(
      'div',
      { class: 'fb-bar fb-bar-top' },
      h('div', { class: 'fb-bar-group' }, h('div', { class: 'fb-heading' }, title, byline)),
      topRight,
    )

    const shadow = h('div', { class: 'fb-book-shadow' })
    const leftEdge = h('div', { class: 'fb-edge' })
    const rightEdge = h('div', { class: 'fb-edge' })
    const spine = h('div', { class: 'fb-spine' })
    const book = h('div', { class: 'fb-book' }, shadow, leftEdge, rightEdge, spine)
    const stage = h('div', { class: 'fb-stage' }, book)

    const prev = button('', ICONS.prev, () => this.reader.prev())
    const next = button('', ICONS.next, () => this.reader.next())
    const pages = h('button', { type: 'button', class: 'fb-pages-button', 'aria-live': 'polite' })
    const bottom = h('div', { class: 'fb-bar fb-bar-bottom' }, prev, pages, next)

    pages.addEventListener('click', () => {
      if (!this.settings.thumbnails) return

      this.stripOpen = !this.stripOpen
      this.render()
    })

    for (const { name, z } of OVERLAYS) {
      const light = h('div', { class: 'fb-light' })
      const clip = h('div', { class: 'fb-overlay', style: { zIndex: String(z) } }, light)

      this.overlays.set(name, { clip, light })
    }

    this.root.append(top, stage, bottom)

    return {
      top,
      title,
      byline,
      topRight,
      sound,
      fullscreen,
      stage,
      book,
      shadow,
      leftEdge,
      rightEdge,
      spine,
      bottom,
      prev,
      pages,
      next,
      strip: null,
      rotate: null,
      prompt: null,
    }
  }

  private listen() {
    const { stage } = this.els
    const on = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Document | Window,
      type: K,
      handler: (e: HTMLElementEventMap[K]) => void,
    ) => {
      target.addEventListener(type, handler as EventListener)
      this.cleanups.push(() => target.removeEventListener(type, handler as EventListener))
    }

    const observer = new ResizeObserver(() => this.render())

    observer.observe(stage)
    this.cleanups.push(() => observer.disconnect())
    this.cleanups.push(
      watchOrientation((state) => {
        this.orientation = state
        this.render()
      }),
    )

    on(stage, 'pointerdown', (e) => {
      if (e.button === 0) this.reader.down(this.toBook(e), e.pointerId)
    })
    on(stage, 'pointermove', (e) => {
      const p = this.toBook(e)

      this.poke()
      if (e.pointerType === 'mouse') this.reader.hover(p)
      if (this.reader.move(p, e.pointerId) && !stage.hasPointerCapture(e.pointerId)) stage.setPointerCapture(e.pointerId)
    })
    on(stage, 'pointerup', (e) => {
      if (this.reader.up(this.toBook(e), e.pointerId) !== 'tap') return

      // A tap on the outer thirds turns the page.
      const rect = stage.getBoundingClientRect()
      const x = e.clientX - rect.left

      if (x > (rect.width * 2) / 3) this.reader.next()
      else if (x < rect.width / 3) this.reader.prev()
    })
    on(stage, 'pointerleave', () => this.reader.leave())
    on(stage, 'pointercancel', () => this.reader.cancel())
    on(this.root, 'keydown', (e) => this.settings.keyboard === true && this.onKey(e))
    on(window, 'keydown', (e) => this.els.prompt && this.answerPrompt(e.key !== 'Escape'))
    on(window, 'keydown', (e) => this.settings.keyboard === 'global' && this.onKey(e))
    on(document, 'fullscreenchange', () => {
      if (document.fullscreenElement === this.root) this.promptAnswered = true
      this.render()
    })
  }

  private onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return

    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) {
      e.preventDefault()
      this.reader.next()
    } else if (['ArrowLeft', 'PageUp'].includes(e.key)) {
      e.preventDefault()
      this.reader.prev()
    } else if (e.key === 'Home') this.reader.go(0)
    else if (e.key === 'End') this.reader.go(this.reader.layout.length)
    else if (e.key === 'Escape' && this.stripOpen) {
      this.stripOpen = false
      this.render()
    }
  }

  /** Pointer position from the top of the spine. */
  private toBook(e: PointerEvent): Vec {
    const rect = this.els.book.getBoundingClientRect()

    return { x: e.clientX - (rect.left + (this.layout.spread ? rect.width / 2 : 0)), y: e.clientY - rect.top }
  }

  private poke() {
    const { autoHide } = this.settings

    clearTimeout(this.hideTimer)
    if (!this.chromeVisible) {
      this.chromeVisible = true
      this.renderChrome()
    }
    if (autoHide === false) return

    this.hideTimer = setTimeout(() => {
      this.chromeVisible = false
      this.renderChrome()
    }, autoHide)
  }

  private toggleSound() {
    this.soundOn = !this.soundOn
    if (this.soundOn) playPageTurn()
    try {
      localStorage.setItem(SOUND_KEY, this.soundOn ? 'on' : 'off')
    } catch {
      // Storage blocked; the choice lasts until the page closes.
    }
    this.renderChrome()
  }

  private async toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
    else await enterLandscape(this.root)
  }

  /** Closes the full screen prompt, going full screen unless the reader declined. */
  private answerPrompt(open: boolean) {
    this.promptAnswered = true
    this.render()

    if (open) enterLandscape(this.root)
  }

  private clearFaces() {
    this.faces.forEach((el) => el.remove())
    this.faces.clear()
  }

  // ------------------------------------------------- Rendering

  /** Brings the DOM in line with the reader. Re-entrant calls (from the reader) run once more at the end. */
  private render() {
    if (this.rendering) {
      this.dirty = true
      return
    }

    this.rendering = true
    do {
      this.dirty = false
      this.renderOnce()
    } while (this.dirty)
    this.rendering = false
  }

  private renderOnce() {
    const { settings, reader, els } = this
    const { book, controls } = settings
    const stage = els.stage.getBoundingClientRect()
    const spread = this.spread

    if (spread !== this.layout.spread || book.pages.length !== this.layout.pageCount || settings.stiffCovers !== this.layout.stiffCovers) {
      this.layout = this.buildLayout()
      this.clearFaces()
    }

    // Page size: as large as fits, keeping the page aspect, with room for the controls.
    const across = spread ? 2 : 1
    const marginY = !controls || stage.height < 500 ? 16 : Math.min(150, stage.height * 0.16)
    const availW = Math.max(0, stage.width - (spread ? 64 : 24))
    const availH = Math.max(0, stage.height - marginY)
    const pageW = Math.floor(Math.min(availH * PAGE_ASPECT, availW / across))
    const pageH = Math.floor(pageW / PAGE_ASPECT)

    this.size = { width: pageW, height: pageH }
    reader.configure({ layout: this.layout, width: pageW, height: pageH })

    const { flipped, active, settled, atStart, atEnd } = reader
    const leaves = this.layout.leaves
    let shift = 0

    if (spread && atStart && settled) shift = -pageW / 2
    if (spread && atEnd && settled) shift = pageW / 2

    this.root.style.background = settings.background ?? Flipbook.stageTint(book)
    this.root.tabIndex = settings.keyboard === true ? 0 : -1
    els.book.hidden = pageW <= 0
    Object.assign(els.book.style, {
      width: `${pageW * across}px`,
      height: `${pageH}px`,
      transform: `translateX(${shift}px)`,
      cursor: reader.engine.dragging ? 'grabbing' : 'grab',
      clipPath: spread ? '' : 'inset(-50% -50% -50% 0)',
    })
    Object.assign(els.shadow.style, { left: spread && atStart && settled ? '52%' : '2%', right: spread && atEnd && settled ? '52%' : '2%' })

    // Stacked page edges, thicker on the side with more pages left.
    const open = spread && !atStart && !atEnd
    const edge = (count: number) => Math.min(10, Math.max(0, count) * 0.8)
    const leftEdge = open && flipped > 1 ? edge(flipped - 1) : 0
    const rightEdge = (open || (spread && atStart)) && flipped < leaves.length - 1 ? edge(leaves.length - flipped - 1) : 0

    Object.assign(els.leftEdge.style, { display: leftEdge ? '' : 'none', left: `${-leftEdge}px`, width: `${leftEdge}px` })
    Object.assign(els.rightEdge.style, { display: rightEdge ? '' : 'none', right: `${-rightEdge}px`, width: `${rightEdge}px` })
    els.spine.style.left = `${spread ? pageW : 0}px`

    this.renderFaces(active, flipped, pageW, pageH)
    this.renderOverlays(active, pageW, pageH)
    this.renderChrome()
    this.renderStrip()
    this.renderRotatePrompt()
    this.renderFullscreenPrompt()

    const place = `${spread}:${flipped}`

    if (place !== this.lastPlace) {
      this.lastPlace = place
      settings.onPageChange?.({ flipped, label: reader.label, faces: this.layout.visible(flipped) })
    }
  }

  /** Faces of the leaves around the opening. Each keeps its element while it moves between roles, so pages never reload mid-turn. */
  private renderFaces(active: ActiveTurn | null, flipped: number, pageW: number, pageH: number) {
    const leaves = this.layout.leaves
    const turnLeaf = active?.leaf ?? null
    const turnDir = active?.dir ?? 1
    const rightLeaf = turnLeaf !== null ? turnLeaf + 1 : flipped
    const leftLeaf = turnLeaf !== null ? turnLeaf - 1 : flipped - 1
    const wanted = new Set<string>()

    for (let k = Math.max(0, flipped - 2); k <= Math.min(leaves.length - 1, flipped + 1); k++) {
      for (const side of ['front', 'back'] as const) {
        const key = `${k}:${side}`
        const facesUp = (side === 'front') === (turnDir === 1)
        const role =
          k === turnLeaf
            ? facesUp
              ? 'turning'
              : 'flap'
            : side === 'front'
              ? k === rightLeaf
                ? 'right'
                : 'spare'
              : k === leftLeaf && this.layout.spread
                ? 'left'
                : 'spare'
        const onLeft = role === 'left' || (role === 'turning' && turnDir === -1 && !active?.stiff)
        let el = this.faces.get(key)

        if (!el) {
          el = h('div', { class: 'fb-face' })
          el.append(
            renderFace(side === 'front' ? leaves[k].front : leaves[k].back, this.settings.book, side === 'front' ? 'right' : 'left'),
          )
          this.faces.set(key, el)
          this.els.spine.append(el)
        }

        wanted.add(key)
        Object.assign(el.style, {
          left: `${onLeft ? -pageW : 0}px`,
          width: `${pageW}px`,
          height: `${pageH}px`,
          zIndex: String({ right: 1, left: 1, turning: 3, flap: 6, spare: 0 }[role]),
          visibility: role === 'spare' ? 'hidden' : 'visible',
        })
        el.setAttribute('aria-hidden', String(role !== 'left' && role !== 'right'))
        if (k !== turnLeaf) Object.assign(el.style, { transform: '', transformOrigin: '', clipPath: '' })
      }
    }

    for (const [key, el] of this.faces) {
      if (wanted.has(key)) continue

      el.remove()
      this.faces.delete(key)
    }

    if (active) this.paint(this.reader.engine.frame, active)
  }

  private renderOverlays(active: ActiveTurn | null, pageW: number, pageH: number) {
    const show = !!active && !active.stiff
    const w = (share: number) => `${(pageW * share).toFixed(1)}px`
    const lights: Record<Overlay, string> = {
      under: `linear-gradient(to right, rgb(0 0 0 / 0.42), rgb(0 0 0 / 0.2) ${w(0.05)}, rgb(0 0 0 / 0.06) ${w(0.16)}, transparent ${w(0.3)})`,
      bend: `linear-gradient(to right, rgb(0 0 0 / 0.16), rgb(0 0 0 / 0.04) ${w(0.05)}, transparent ${w(0.1)})`,
      shadow: 'rgb(0 0 0 / 0.55)',
      curl: `linear-gradient(to right, rgb(0 0 0 / 0.3), rgb(0 0 0 / 0.1) ${w(0.035)}, rgb(255 255 255 / 0.2) ${w(0.11)}, rgb(255 255 255 / 0.06) ${w(0.25)}, rgb(0 0 0 / 0.05) ${w(0.6)}, rgb(0 0 0 / 0.12) ${w(1)})`,
    }

    for (const [name, { clip, light }] of this.overlays) {
      if (!show) {
        clip.remove()
        continue
      }

      const shadow = name === 'shadow'

      Object.assign(clip.style, {
        left: `${-pageW}px`,
        top: `${-pageH}px`,
        width: `${pageW * 2}px`,
        height: `${pageH * 3}px`,
        filter: shadow ? `blur(${Math.max(3, pageW * 0.012)}px)` : '',
      })
      Object.assign(
        light.style,
        shadow ? { inset: '0', background: lights[name] } : { width: `${pageW * 3}px`, height: `${pageH * 4}px`, background: lights[name] },
      )
      if (!clip.isConnected) this.els.spine.append(clip)
    }

    if (show && active) this.paint(this.reader.engine.frame, active)
  }

  private paint(frame: TurnFrame, turn: ActiveTurn) {
    const { width: pageW, height: pageH } = this.size
    const s = turn.dir
    const front = this.faces.get(`${turn.leaf}:front`)
    const back = this.faces.get(`${turn.leaf}:back`)

    if (frame.stiff) {
      const perspective = `perspective(${Math.max(1800, pageW * 5)}px) rotateY(${Fold.hinge(frame.origin, frame.point, s)}deg)`

      if (front) Object.assign(front.style, { transformOrigin: '0 50%', transform: perspective, clipPath: '' })
      if (back)
        Object.assign(back.style, {
          transformOrigin: '0 50%',
          transform: `${perspective} translateX(${pageW}px) rotateY(180deg)`,
          clipPath: '',
        })
      return
    }

    // The side facing up where the leaf started, and the side the fold turns over.
    const top = s === 1 ? front : back
    const under = s === 1 ? back : front
    const fold = new Fold(pageW, pageH, frame.origin, frame.point)
    const strength = fold.shade * this.settings.shading

    if (top)
      Object.assign(top.style, {
        transformOrigin: '',
        transform: '',
        clipPath: polygon(fold.flat.map((p) => ({ x: s === 1 ? p.x : pageW - p.x, y: p.y }))),
      })
    if (under) {
      Object.assign(under.style, {
        transformOrigin: '0 0',
        transform: fold.flapMatrix(s),
        clipPath: polygon(fold.folded.map((p) => ({ x: s === 1 ? pageW - p.x : p.x, y: p.y }))),
      })
    }

    const layer = (name: Overlay, region: Vec[], toward: 1 | -1, opacity: number) => {
      const refs = this.overlays.get(name)

      if (!refs) return

      const shape = polygon(
        region.map((p) => ({ x: s * p.x, y: p.y })),
        pageW,
        pageH,
      )

      refs.clip.style.opacity = String(opacity)

      // The flap's shadow is its own silhouette, blurred by the layer around it.
      if (name === 'shadow') {
        refs.light.style.clipPath = shape
        return
      }

      const angle = Math.atan2(toward * fold.normal.y, s * toward * fold.normal.x)

      refs.clip.style.clipPath = shape
      refs.light.style.transform = `translate(${s * fold.center.x + pageW}px, ${fold.center.y + pageH}px) rotate(${angle}rad) translateY(-50%)`
    }

    layer('under', fold.folded, 1, strength)
    layer('bend', fold.flat, -1, strength)
    layer('shadow', fold.flap, -1, strength * 0.6)
    layer('curl', fold.flap, -1, strength)
  }

  private renderChrome() {
    const { els, settings, reader } = this
    const { labels } = settings
    const shown = this.chromeVisible || this.stripOpen
    const fullscreen = document.fullscreenElement === this.root
    const setButton = (el: HTMLButtonElement, label: string, markup?: string) => {
      el.setAttribute('aria-label', label)
      el.title = label
      if (markup) el.replaceChildren(svg(markup))
    }

    els.top.hidden = !settings.controls
    els.bottom.hidden = !settings.controls
    els.top.classList.toggle('is-hidden', !shown)
    els.bottom.classList.toggle('is-hidden', !shown)
    els.title.textContent = settings.book.title
    els.byline.textContent = settings.book.author ? labels.byline(settings.book.author) : ''
    els.byline.hidden = !settings.book.author
    els.sound.hidden = !settings.soundButton
    els.fullscreen.hidden = !settings.fullscreenButton
    setButton(els.sound, this.soundOn ? labels.soundOff : labels.soundOn, this.soundOn ? ICONS.soundOn : ICONS.soundOff)
    setButton(els.fullscreen, fullscreen ? labels.exitFullscreen : labels.fullscreen, fullscreen ? ICONS.collapse : ICONS.expand)
    setButton(els.prev, labels.previous)
    setButton(els.next, labels.next)
    els.prev.disabled = reader.atStart
    els.next.disabled = reader.atEnd
    els.pages.replaceChildren(...(settings.thumbnails ? [svg(ICONS.grid)] : []), reader.label)
    els.pages.setAttribute('aria-expanded', String(this.stripOpen))
  }

  /** A strip of every spread (or page) to jump around the book. */
  private renderStrip() {
    const open = this.stripOpen && this.settings.thumbnails
    const { book } = this.settings

    if (!open) {
      this.els.strip?.remove()
      this.els.strip = null
      return
    }

    const list = h('div', { class: 'fb-strip-list' })

    for (const stop of this.layout.stops()) {
      const button = h('button', {
        type: 'button',
        class: 'fb-strip-stop',
        'aria-current': String(stop.flipped === this.reader.flipped),
        'aria-label': `Go to ${BookLayout.describe(stop.faces)}`,
      })

      for (const face of stop.faces) button.append(h('div', { class: 'fb-strip-face' }, renderFace(face, book, undefined, false)))
      button.addEventListener('click', () => {
        this.stripOpen = false
        this.reader.go(stop.flipped)
        this.render()
      })
      list.append(button)
    }

    const strip = h('div', { class: 'fb-strip' }, list)

    this.els.strip?.remove()
    this.els.strip = strip
    this.els.bottom.before(strip)
    list.querySelector("[aria-current='true']")?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }

  /** Shown on phones held upright: books are read sideways. */
  private renderRotatePrompt() {
    const { landscape, layout, labels } = this.settings
    const show = landscape && layout !== 'single' && this.orientation.touch && this.orientation.portrait && this.portraitChoice === 'ask'

    if (!show) {
      this.els.rotate?.remove()
      this.els.rotate = null
      return
    }
    if (this.els.rotate) return

    const primary = h('button', { type: 'button', class: 'fb-rotate-primary' }, labels.rotateFullscreen)
    const secondary = h('button', { type: 'button', class: 'fb-rotate-secondary' }, labels.rotateSingle)

    primary.addEventListener('click', () => enterLandscape(this.root))
    secondary.addEventListener('click', () => {
      this.portraitChoice = 'single'
      this.render()
    })
    this.els.rotate = h(
      'div',
      { class: 'fb-rotate' },
      svg(ICONS.phone),
      h('div', {}, h('p', { class: 'fb-rotate-title' }, labels.rotateTitle), h('p', { class: 'fb-rotate-body' }, labels.rotateBody)),
      primary,
      secondary,
    )
    this.root.append(this.els.rotate)
  }

  /** Browsers only go full screen after a gesture, so the first tap or key press does it. The rotate prompt offers it already. */
  private renderFullscreenPrompt() {
    const { fullscreenPrompt, labels } = this.settings
    const show = fullscreenPrompt && !this.promptAnswered && document.fullscreenEnabled && !document.fullscreenElement && !this.els.rotate

    if (!show) {
      this.els.prompt?.remove()
      this.els.prompt = null
      return
    }
    if (this.els.prompt) return

    const prompt = h('button', { type: 'button', class: 'fb-fullscreen-prompt' })
    const pill = h('span', { class: 'fb-fullscreen-prompt-label' }, labels.fullscreenPrompt)

    pill.prepend(svg(ICONS.expand))
    prompt.append(pill)
    prompt.addEventListener('click', () => this.answerPrompt(true))
    this.els.prompt = prompt
    this.root.append(prompt)
  }

  private static stageTint(book: FlipbookBook) {
    const [inner, middle, outer] = COVER_THEMES[book.theme ?? 'classic'].stage

    return `radial-gradient(ellipse at 50% 40%, ${inner} 0%, ${middle} 55%, ${outer} 100%)`
  }
}
