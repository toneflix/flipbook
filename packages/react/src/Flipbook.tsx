import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
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
import { BookLookProvider } from './BookLook'
import { BackCoverView, BlankPageView, ColophonView, CoverView, PageView, TitlePageView } from './PageView'
import { enterLandscape, playPageTurn } from '@toneflix/flipbook'
import { useElementSize, useOrientation } from './viewport'

/** Width / height of one page. */
const PAGE_ASPECT = 3 / 4
const SOUND_KEY = 'flipbook:sound'

export interface FlipbookPlace {
  /** How many leaves lie on the left: 0 is the closed front cover. */
  flipped: number
  label: string
  faces: Face[]
}

export interface FlipbookProps {
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
  /** Extra controls at the start and end of the top bar, e.g. a close link. */
  topLeft?: ReactNode
  topRight?: ReactNode
  labels?: Partial<FlipbookLabels>
  className?: string
  style?: CSSProperties
  onPageChange?: (place: FlipbookPlace) => void
  /** A page started to turn over. */
  onFlip?: () => void
}

export interface FlipbookHandle {
  next(): void
  prev(): void
  /** Opens at a `flipped` value. */
  go(flipped: number): void
  /** Opens at a page (1-based). */
  goToPage(page: number): void
  readonly reader: FlipbookReader
}

/** Light and shadow drawn around the fold of a turning page. */
type Overlay = 'under' | 'bend' | 'shadow' | 'curl'

const polygon = (points: Vec[], dx = 0, dy = 0) =>
  points.length ? `polygon(${points.map((p) => `${(p.x + dx).toFixed(2)}px ${(p.y + dy).toFixed(2)}px`).join(', ')})` : 'polygon(0 0)'

const stageTint = (book: FlipbookBook) => {
  const [inner, middle, outer] = COVER_THEMES[book.theme ?? 'classic'].stage

  return `radial-gradient(ellipse at 50% 40%, ${inner} 0%, ${middle} 55%, ${outer} 100%)`
}

const readStoredSound = () => {
  try {
    return localStorage.getItem(SOUND_KEY)
  } catch {
    return null
  }
}

/** A photo book that opens across two pages, turned by dragging, flicking, tapping, buttons or keys. */
export const Flipbook = forwardRef<FlipbookHandle, FlipbookProps>(function Flipbook(props, ref) {
  const {
    book,
    startPage,
    layout: layoutMode = 'auto',
    controls = true,
    autoHide = 3200,
    thumbnails = true,
    soundButton = true,
    fullscreenButton = true,
    landscape = true,
    keyboard = true,
    stiffCovers = true,
    physics,
    grip,
    shading = 1,
    background,
    topLeft,
    topRight,
    className,
    style,
    onPageChange,
    onFlip,
  } = props
  const labels = { ...DEFAULT_LABELS, ...props.labels }

  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<HTMLDivElement>(null)
  const stage = useElementSize(stageRef)
  const { ready, portrait, touch } = useOrientation()

  const [portraitChoice, setPortraitChoice] = useState<'ask' | 'single'>('ask')
  const [fullscreen, setFullscreen] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [showPages, setShowPages] = useState(false)
  const [sound, setSound] = useState(!!props.sound)
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  // Phones held upright are asked to rotate: landscape is the default way to read, single pages the fallback.
  const mobilePortrait = landscape && ready && touch && portrait
  const showRotatePrompt = mobilePortrait && portraitChoice === 'ask' && layoutMode !== 'single'
  const narrow = stage.width > 0 && stage.width / stage.height < 0.95
  const spread = layoutMode === 'auto' ? !(mobilePortrait && portraitChoice === 'single') && !narrow : layoutMode === 'spread'

  const pageCount = book.pages.length
  const layout = useMemo(() => new BookLayout(pageCount, { spread, stiffCovers }), [pageCount, spread, stiffCovers])

  // Page size: as large as fits, keeping the page aspect, with room for the controls.
  const pagesAcross = spread ? 2 : 1
  const marginY = !controls || stage.height < 500 ? 16 : Math.min(150, stage.height * 0.16)
  const availW = Math.max(0, stage.width - (spread ? 64 : 24))
  const availH = Math.max(0, stage.height - marginY)
  const pageW = Math.floor(Math.min(availH * PAGE_ASPECT, availW / pagesAcross))
  const pageH = Math.floor(pageW / PAGE_ASPECT)

  // ------------------------------------------------- Turning pages
  const faceRefs = useRef(new Map<string, HTMLDivElement>())
  const overlayRefs = useRef(new Map<Overlay, { clip: HTMLDivElement | null; light: HTMLDivElement | null }>())

  const paint = useCallback(
    (frame: TurnFrame, turn: ActiveTurn) => {
      const s = turn.dir
      const front = faceRefs.current.get(`${turn.leaf}:front`)
      const back = faceRefs.current.get(`${turn.leaf}:back`)

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
      const flap = fold.flap
      const strength = fold.shade * shading

      if (top) {
        Object.assign(top.style, {
          transformOrigin: '',
          transform: '',
          clipPath: polygon(fold.flat.map((p) => ({ x: s === 1 ? p.x : pageW - p.x, y: p.y }))),
        })
      }
      if (under) {
        Object.assign(under.style, {
          transformOrigin: '0 0',
          transform: fold.flapMatrix(s),
          clipPath: polygon(fold.folded.map((p) => ({ x: s === 1 ? pageW - p.x : p.x, y: p.y }))),
        })
      }

      const layer = (name: Overlay, region: Vec[], toward: 1 | -1, opacity: number) => {
        const refs = overlayRefs.current.get(name)

        if (!refs?.clip || !refs.light) return

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
      layer('shadow', flap, -1, strength * 0.6)
      layer('curl', flap, -1, strength)
    },
    [pageW, pageH, shading],
  )

  const handlers = useRef({ paint, onFlip, sound })
  handlers.current = { paint, onFlip, sound }

  const [reader] = useState(
    () =>
      new FlipbookReader(
        layout,
        {
          frame: (frame, turn) => handlers.current.paint(frame, turn),
          change: rerender,
          flip: () => {
            if (handlers.current.sound) playPageTurn()
            handlers.current.onFlip?.()
          },
        },
        { flipped: layout.flippedForPage(startPage), physics, grip },
      ),
  )
  const { flipped, active } = reader

  useLayoutEffect(() => reader.configure({ layout, width: pageW, height: pageH }), [reader, layout, pageW, pageH])

  useEffect(() => {
    reader.engine.physics = { ...reader.engine.physics, ...physics }
    reader.grip = { ...reader.grip, ...grip }
  }, [reader, physics, grip])

  useEffect(() => () => reader.destroy(), [reader])

  // Faces change roles when a turn starts or ends: place them before the browser paints.
  useLayoutEffect(() => {
    faceRefs.current.forEach((el, key) => {
      const turning = active && (key === `${active.leaf}:front` || key === `${active.leaf}:back`)

      if (!turning) Object.assign(el.style, { transform: '', transformOrigin: '', clipPath: '' })
    })
    if (active) paint(reader.engine.frame, active)
  }, [active, paint, reader])

  const place = `${layout.spread}:${flipped}`
  const onPageChangeRef = useRef(onPageChange)
  onPageChangeRef.current = onPageChange

  useEffect(() => {
    onPageChangeRef.current?.({ flipped: reader.flipped, label: reader.label, faces: reader.layout.visible(reader.flipped) })
  }, [place, reader])

  useImperativeHandle(
    ref,
    () => ({
      next: () => reader.next(),
      prev: () => reader.prev(),
      go: (target) => reader.go(target),
      goToPage: (page) => reader.go(reader.layout.flippedForPage(page)),
      reader,
    }),
    [reader],
  )

  // ------------------------------------------------- Sound, chrome, full screen, keys
  useEffect(() => {
    const stored = readStoredSound()

    if (soundButton && stored) setSound(stored === 'on')
  }, [soundButton])

  useEffect(() => setSound(!!props.sound), [props.sound])

  const toggleSound = () => {
    const on = !sound

    setSound(on)
    if (on) playPageTurn()
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
    } catch {
      // Storage blocked; the choice lasts until the page closes.
    }
  }

  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const poke = useCallback(() => {
    setChromeVisible(true)
    clearTimeout(hideTimer.current)
    if (autoHide !== false) hideTimer.current = setTimeout(() => setChromeVisible(false), autoHide)
  }, [autoHide])

  useEffect(() => {
    poke()
    return () => clearTimeout(hideTimer.current)
  }, [poke])

  const chromeShown = chromeVisible || showPages

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current)

    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
    else if (rootRef.current) await enterLandscape(rootRef.current)
  }

  const onKey = useCallback(
    (e: { key: string; target: EventTarget | null; preventDefault(): void }) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return

      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault()
        reader.next()
      } else if (['ArrowLeft', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        reader.prev()
      } else if (e.key === 'Home') reader.go(0)
      else if (e.key === 'End') reader.go(reader.layout.length)
      else if (e.key === 'Escape') setShowPages(false)
    },
    [reader],
  )

  useEffect(() => {
    if (keyboard !== 'global') return

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keyboard, onKey])

  // ------------------------------------------------- Pointer: grab, drag, peek
  /** Pointer position from the top of the spine. */
  const toBook = (e: PointerEvent): Vec => {
    const rect = bookRef.current?.getBoundingClientRect()

    if (!rect) return { x: 0, y: 0 }

    return { x: e.clientX - (rect.left + (layout.spread ? rect.width / 2 : 0)), y: e.clientY - rect.top }
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return

    reader.down(toBook(e), e.pointerId)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = toBook(e)

    poke()
    if (e.pointerType === 'mouse') reader.hover(p)
    if (reader.move(p, e.pointerId) && !e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerUp = (e: PointerEvent) => {
    if (reader.up(toBook(e), e.pointerId) !== 'tap') return

    // A tap on the outer thirds turns the page.
    const rect = stageRef.current?.getBoundingClientRect()

    if (!rect) return

    const x = e.clientX - rect.left
    const third = rect.width / 3

    if (x > rect.width - third) reader.next()
    else if (x < third) reader.prev()
  }

  // ------------------------------------------------- Rendering
  const renderFace = (face: Face, side: 'left' | 'right') => {
    switch (face.kind) {
      case 'cover':
        return <CoverView book={book} />
      case 'back':
        return <BackCoverView book={book} />
      case 'title':
        return <TitlePageView book={book} side={side} />
      case 'colophon':
        return <ColophonView book={book} side={side} />
      case 'blank':
        return <BlankPageView side={side} />
      case 'page':
        return <PageView page={book.pages[face.index]} number={face.index + 1} side={side} />
    }
  }

  // A closed book sits centred: shift by half a page at either end.
  const settled = reader.settled
  const atStart = reader.atStart
  const atEnd = reader.atEnd
  const leaves = layout.leaves
  let shift = 0

  if (layout.spread && atStart && settled) shift = -pageW / 2
  if (layout.spread && atEnd && settled) shift = pageW / 2

  // Faces of the leaves around the opening. Each keeps its element while it moves between roles, so pages never reload mid-turn.
  const turnLeaf = active?.leaf ?? null
  const turnDir = active?.dir ?? 1
  const rightLeaf = turnLeaf !== null ? turnLeaf + 1 : flipped
  const leftLeaf = turnLeaf !== null ? turnLeaf - 1 : flipped - 1
  const faceElements: ReactNode[] = []

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
            : k === leftLeaf && layout.spread
              ? 'left'
              : 'spare'
      const z = { right: 1, left: 1, turning: 3, flap: 6, spare: 0 }[role]
      const onLeft = role === 'left' || (role === 'turning' && turnDir === -1 && !active?.stiff)

      faceElements.push(
        <div
          key={key}
          ref={(el) => {
            if (el) faceRefs.current.set(key, el)
            else faceRefs.current.delete(key)
          }}
          className="fb-face"
          style={{ left: onLeft ? -pageW : 0, width: pageW, height: pageH, zIndex: z, visibility: role === 'spare' ? 'hidden' : 'visible' }}
          aria-hidden={role !== 'left' && role !== 'right'}
        >
          {renderFace(side === 'front' ? leaves[k].front : leaves[k].back, side === 'front' ? 'right' : 'left')}
        </div>,
      )
    }
  }

  const overlay = (name: Overlay, z: number, light: string) => {
    const shadow = name === 'shadow'
    const bind = (part: 'clip' | 'light') => (el: HTMLDivElement | null) => {
      const refs = overlayRefs.current.get(name) ?? { clip: null, light: null }

      refs[part] = el
      overlayRefs.current.set(name, refs)
    }

    return (
      <div
        key={name}
        ref={bind('clip')}
        className="fb-overlay"
        style={{
          left: -pageW,
          top: -pageH,
          width: pageW * 2,
          height: pageH * 3,
          zIndex: z,
          filter: shadow ? `blur(${Math.max(3, pageW * 0.012)}px)` : undefined,
        }}
      >
        <div
          ref={bind('light')}
          className="fb-light"
          style={shadow ? { inset: 0, background: light } : { width: pageW * 3, height: pageH * 4, background: light }}
        />
      </div>
    )
  }
  const w = (share: number) => `${(pageW * share).toFixed(1)}px`

  const open = layout.spread && !atStart && !atEnd
  // Stacked page edges, thicker on the side with more pages left.
  const edge = (count: number) => Math.min(10, Math.max(0, count) * 0.8)
  const leftEdge = layout.spread && flipped > 1 ? edge(flipped - 1) : 0
  const rightEdge = layout.spread && flipped < leaves.length - 1 ? edge(leaves.length - flipped - 1) : 0

  return (
    <BookLookProvider paper={book.paper} frame={book.frame}>
      <div
        ref={rootRef}
        className={`fb-root ${className ?? ''}`}
        style={{ background: background ?? stageTint(book), ...style }}
        tabIndex={keyboard === true ? 0 : undefined}
        onKeyDown={keyboard === true ? (e: KeyboardEvent) => onKey(e) : undefined}
      >
        {controls && (
          <div className={`fb-bar fb-bar-top ${chromeShown ? '' : 'is-hidden'}`}>
            <div className="fb-bar-group">
              {topLeft}
              <div className="fb-heading">
                <h1 className="fb-title">{book.title}</h1>
                {book.author && <p className="fb-byline">{labels.byline(book.author)}</p>}
              </div>
            </div>
            <div className="fb-bar-group">
              {topRight}
              {soundButton && (
                <RoundButton onClick={toggleSound} label={sound ? labels.soundOff : labels.soundOn}>
                  {sound ? <IconSoundOn /> : <IconSoundOff />}
                </RoundButton>
              )}
              {fullscreenButton && (
                <RoundButton onClick={toggleFullscreen} label={fullscreen ? labels.exitFullscreen : labels.fullscreen}>
                  {fullscreen ? <IconCollapse /> : <IconExpand />}
                </RoundButton>
              )}
            </div>
          </div>
        )}

        <div
          ref={stageRef}
          className="fb-stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => reader.leave()}
          onPointerCancel={() => reader.cancel()}
        >
          {pageW > 0 && (
            <div
              ref={bookRef}
              className="fb-book"
              style={{
                width: pageW * pagesAcross,
                height: pageH,
                transform: `translateX(${shift}px)`,
                cursor: reader.engine.dragging ? 'grabbing' : 'grab',
                clipPath: layout.spread ? undefined : 'inset(-50% -50% -50% 0)',
              }}
            >
              <div
                className="fb-book-shadow"
                style={{
                  left: layout.spread && atStart && settled ? '52%' : '2%',
                  right: layout.spread && atEnd && settled ? '52%' : '2%',
                }}
              />
              {open && leftEdge > 0 && <div className="fb-edge" style={{ left: -leftEdge, width: leftEdge }} />}
              {(open || (layout.spread && atStart)) && rightEdge > 0 && (
                <div className="fb-edge" style={{ right: -rightEdge, width: rightEdge }} />
              )}

              {/* Everything inside is placed from the top of the spine. */}
              <div className="fb-spine" style={{ left: layout.spread ? pageW : 0 }}>
                {faceElements}
                {active &&
                  !active.stiff && [
                    overlay(
                      'under',
                      2,
                      `linear-gradient(to right, rgb(0 0 0 / 0.42), rgb(0 0 0 / 0.2) ${w(0.05)}, rgb(0 0 0 / 0.06) ${w(0.16)}, transparent ${w(0.3)})`,
                    ),
                    overlay('bend', 4, `linear-gradient(to right, rgb(0 0 0 / 0.16), rgb(0 0 0 / 0.04) ${w(0.05)}, transparent ${w(0.1)})`),
                    overlay('shadow', 5, 'rgb(0 0 0 / 0.55)'),
                    overlay(
                      'curl',
                      7,
                      `linear-gradient(to right, rgb(0 0 0 / 0.3), rgb(0 0 0 / 0.1) ${w(0.035)}, rgb(255 255 255 / 0.2) ${w(0.11)}, rgb(255 255 255 / 0.06) ${w(0.25)}, rgb(0 0 0 / 0.05) ${w(0.6)}, rgb(0 0 0 / 0.12) ${w(1)})`,
                    ),
                  ]}
              </div>
            </div>
          )}
        </div>

        {showPages && (
          <PageStrip
            book={book}
            layout={layout}
            flipped={flipped}
            onPick={(target) => {
              reader.go(target)
              setShowPages(false)
            }}
          />
        )}

        {controls && (
          <div className={`fb-bar fb-bar-bottom ${chromeShown ? '' : 'is-hidden'}`}>
            <RoundButton onClick={() => reader.prev()} disabled={atStart} label={labels.previous}>
              <IconChevron dir="left" />
            </RoundButton>
            <button
              type="button"
              onClick={() => thumbnails && setShowPages((s) => !s)}
              className="fb-pages-button"
              aria-expanded={thumbnails ? showPages : undefined}
              aria-live="polite"
            >
              {thumbnails && <IconGrid />}
              {reader.label}
            </button>
            <RoundButton onClick={() => reader.next()} disabled={atEnd} label={labels.next}>
              <IconChevron dir="right" />
            </RoundButton>
          </div>
        )}

        {showRotatePrompt && (
          <RotatePrompt
            labels={labels}
            onFullscreen={async () => {
              if (rootRef.current) await enterLandscape(rootRef.current)
            }}
            onStayPortrait={() => setPortraitChoice('single')}
          />
        )}
      </div>
    </BookLookProvider>
  )
})

/** A strip of every spread (or page) to jump around the book. */
function PageStrip({
  book,
  layout,
  flipped,
  onPick,
}: {
  book: FlipbookBook
  layout: BookLayout
  flipped: number
  onPick: (flipped: number) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const stops = useMemo(() => layout.stops(), [layout])

  useEffect(() => {
    listRef.current?.querySelector("[aria-current='true']")?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [])

  const mini = (face: Face, key: number) => (
    <div key={key} className="fb-strip-face">
      {face.kind === 'cover' ? (
        <CoverView book={book} />
      ) : face.kind === 'back' ? (
        <BackCoverView book={book} />
      ) : face.kind === 'title' ? (
        <TitlePageView book={book} />
      ) : face.kind === 'colophon' ? (
        <ColophonView book={book} />
      ) : face.kind === 'page' ? (
        <PageView page={book.pages[face.index]} />
      ) : (
        <BlankPageView />
      )}
    </div>
  )

  return (
    <div className="fb-strip">
      <div ref={listRef} className="fb-strip-list">
        {stops.map((stop) => (
          <button
            key={stop.flipped}
            type="button"
            onClick={() => onPick(stop.flipped)}
            aria-current={stop.flipped === flipped}
            className="fb-strip-stop"
            aria-label={`Go to ${BookLayout.describe(stop.faces)}`}
          >
            {stop.faces.map(mini)}
          </button>
        ))}
      </div>
    </div>
  )
}

function RotatePrompt({
  labels,
  onFullscreen,
  onStayPortrait,
}: {
  labels: FlipbookLabels
  onFullscreen: () => void
  onStayPortrait: () => void
}) {
  return (
    <div className="fb-rotate">
      <svg viewBox="0 0 64 64" className="fb-rotate-hint" aria-hidden>
        <rect x="20" y="6" width="24" height="52" rx="4" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="32" cy="51" r="2" fill="currentColor" />
      </svg>
      <div>
        <p className="fb-rotate-title">{labels.rotateTitle}</p>
        <p className="fb-rotate-body">{labels.rotateBody}</p>
      </div>
      <button type="button" onClick={onFullscreen} className="fb-rotate-primary">
        {labels.rotateFullscreen}
      </button>
      <button type="button" onClick={onStayPortrait} className="fb-rotate-secondary">
        {labels.rotateSingle}
      </button>
    </div>
  )
}

function RoundButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void
  label: string
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="fb-button" aria-label={label} title={label}>
      {children}
    </button>
  )
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconChevron = ({ dir }: { dir: 'left' | 'right' }) => icon(dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6')
const IconExpand = () => icon('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5')
const IconCollapse = () => icon('M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5')
const IconSoundOn = () => icon('M4 10v4h3l5 4V6L7 10H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11')
const IconSoundOff = () => icon('M4 10v4h3l5 4V6L7 10H4zM17 10l4 4M21 10l-4 4')
const IconGrid = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect x="3" y="5" width="8" height="14" rx="1" />
    <rect x="13" y="5" width="8" height="14" rx="1" />
  </svg>
)
