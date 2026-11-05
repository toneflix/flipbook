import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import {
  BookLayout,
  COVER_THEMES,
  DEFAULT_LABELS,
  FlipbookReader,
  type Face,
  type FlipbookBook,
  type FlipbookLabels,
  type GripOptions,
  type TurnPhysics,
  type Vec,
} from '@toneflix/flipbook-core'
import { FoldLayout, type Band, type Role } from './geometry'
import { Gradient } from './Gradient'
import { BookLookProvider, type BookFonts } from './look'
import { BackCoverView, CoverView } from './Cover'
import { BlankPageView, ColophonView, PAGE_RATIO, PageView, TitlePageView } from './pages'
import { lockLandscape } from './orientation'

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
  /** Hide the bars after this many ms without a touch, or never with false. */
  autoHide?: number | false
  thumbnails?: boolean
  /**
   * Read sideways like a real book: locks the screen to landscape while the book is open when
   * `expo-screen-orientation` is installed, and otherwise asks the reader to turn the phone.
   */
  landscape?: boolean
  /** Covers swing on the spine like board instead of curling like paper. */
  stiffCovers?: boolean
  physics?: Partial<TurnPhysics>
  grip?: Partial<GripOptions>
  /** Strength of the light and shadow around a turning page, from 0 to 1 or more. */
  shading?: number
  /** Backdrop colour behind the book. Defaults to a glow tinted by the cover. */
  background?: string
  fonts?: BookFonts
  labels?: Partial<FlipbookLabels>
  /** Extra controls at the start and end of the top bar, e.g. a close button. */
  topLeft?: ReactNode
  topRight?: ReactNode
  style?: StyleProp<ViewStyle>
  onPageChange?: (place: FlipbookPlace) => void
  /** A page started to turn over, e.g. to play a sound. */
  onFlip?: () => void
}

export interface FlipbookHandle {
  next(): void
  prev(): void
  go(flipped: number): void
  goToPage(page: number): void
  readonly reader: FlipbookReader
}

/** One face's content. Memoised so turning a page only moves its wrappers. */
const FaceContent = memo(function FaceContent({
  face,
  book,
  width,
  side,
}: {
  face: Face
  book: FlipbookBook
  width: number
  side: 'left' | 'right'
}) {
  switch (face.kind) {
    case 'cover':
      return <CoverView book={book} width={width} />
    case 'back':
      return <BackCoverView book={book} width={width} />
    case 'title':
      return <TitlePageView book={book} width={width} side={side} />
    case 'colophon':
      return <ColophonView book={book} width={width} side={side} />
    case 'blank':
      return <BlankPageView width={width} side={side} />
    case 'page':
      return <PageView page={book.pages[face.index]} width={width} number={face.index + 1} side={side} />
  }
})

const BAND_STOPS: Record<Band['name'], { offset: number; color: string; opacity: number }[]> = {
  under: [
    { offset: 0, color: '#000', opacity: 0.42 },
    { offset: 0.17, color: '#000', opacity: 0.2 },
    { offset: 0.53, color: '#000', opacity: 0.06 },
    { offset: 1, color: '#000', opacity: 0 },
  ],
  bend: [
    { offset: 0, color: '#000', opacity: 0.16 },
    { offset: 0.5, color: '#000', opacity: 0.04 },
    { offset: 1, color: '#000', opacity: 0 },
  ],
  curl: [
    { offset: 0, color: '#000', opacity: 0.3 },
    { offset: 0.035, color: '#000', opacity: 0.1 },
    { offset: 0.11, color: '#fff', opacity: 0.2 },
    { offset: 0.25, color: '#fff', opacity: 0.06 },
    { offset: 0.6, color: '#000', opacity: 0.05 },
    { offset: 1, color: '#000', opacity: 0.12 },
  ],
}

/** A photo book that opens across two pages, turned by dragging, flicking, tapping or the buttons. */
export const Flipbook = forwardRef<FlipbookHandle, FlipbookProps>(function Flipbook(props, ref) {
  const {
    book,
    startPage,
    layout: layoutMode = 'auto',
    controls = true,
    autoHide = 3200,
    thumbnails = true,
    landscape = true,
    stiffCovers = true,
    physics,
    grip,
    shading = 1,
    background,
    fonts,
    topLeft,
    topRight,
    style,
    onPageChange,
    onFlip,
  } = props
  const labels = { ...DEFAULT_LABELS, ...props.labels }
  const screen = useWindowDimensions()
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const [portraitChoice, setPortraitChoice] = useState<'ask' | 'single'>('ask')
  const [locked, setLocked] = useState(false)
  const [showPages, setShowPages] = useState(false)
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const reducedMotion = useRef(false)

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then((on) => (reducedMotion.current = on))
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (on) => (reducedMotion.current = on))

    return () => subscription?.remove()
  }, [])

  useEffect(() => {
    if (!landscape) return

    let release: (() => void) | undefined
    let cancelled = false

    lockLandscape().then((unlock) => {
      if (cancelled) return unlock?.()

      release = unlock ?? undefined
      setLocked(!!unlock)
    })

    return () => {
      cancelled = true
      release?.()
    }
  }, [landscape])

  // Phones held upright are asked to turn sideways when the screen can't be locked; single pages are the fallback.
  const portrait = screen.height > screen.width
  const showRotatePrompt = landscape && !locked && portrait && portraitChoice === 'ask' && layoutMode !== 'single'
  const narrow = stage.width > 0 && stage.width / stage.height < 0.95
  const spread = layoutMode === 'auto' ? !(portrait && portraitChoice === 'single') && !narrow : layoutMode === 'spread'

  const pageCount = book.pages.length
  const layout = useMemo(() => new BookLayout(pageCount, { spread, stiffCovers }), [pageCount, spread, stiffCovers])

  // Page size: as large as fits, keeping the page shape, with room for the controls.
  const across = spread ? 2 : 1
  const marginY = !controls || stage.height < 500 ? 16 : Math.min(150, stage.height * 0.16)
  const pageW = Math.floor(Math.max(0, Math.min((stage.height - marginY) * PAGE_RATIO, (stage.width - (spread ? 48 : 16)) / across)))
  const pageH = Math.floor(pageW / PAGE_RATIO)

  const handlers = useRef({ onFlip })
  handlers.current = { onFlip }

  const [reader] = useState(
    () =>
      new FlipbookReader(
        layout,
        { frame: rerender, change: rerender, flip: () => handlers.current.onFlip?.() },
        { flipped: layout.flippedForPage(startPage), physics, grip, reducedMotion: () => reducedMotion.current },
      ),
  )

  useLayoutEffect(() => reader.configure({ layout, width: pageW, height: pageH }), [reader, layout, pageW, pageH])

  useEffect(() => {
    reader.engine.physics = { ...reader.engine.physics, ...physics }
    reader.grip = { ...reader.grip, ...grip }
  }, [reader, physics, grip])

  useEffect(() => () => reader.destroy(), [reader])

  const { flipped, active } = reader
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

  // ------------------------------------------------- Controls that hide while reading
  const chrome = useRef(new Animated.Value(1)).current
  const [chromeShown, setChromeShown] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const poke = useCallback(() => {
    clearTimeout(hideTimer.current)
    setChromeShown(true)
    Animated.timing(chrome, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    if (autoHide === false) return

    hideTimer.current = setTimeout(() => {
      setChromeShown(false)
      Animated.timing(chrome, { toValue: 0, duration: 300, useNativeDriver: true }).start()
    }, autoHide)
  }, [autoHide, chrome])

  useEffect(() => {
    poke()
    return () => clearTimeout(hideTimer.current)
  }, [poke])

  // ------------------------------------------------- A closed book sits centred
  const settled = reader.settled
  const shift = layout.spread && settled ? (reader.atStart ? -pageW / 2 : reader.atEnd ? pageW / 2 : 0) : 0
  const shiftValue = useRef(new Animated.Value(shift)).current

  useEffect(() => {
    Animated.timing(shiftValue, { toValue: shift, duration: 600, useNativeDriver: true }).start()
  }, [shift, shiftValue])

  // ------------------------------------------------- Touch: grab, drag, flick, tap
  const geometry = useRef({ stage, pageW, pageH, across, spread: layout.spread, shift })
  geometry.current = { stage, pageW, pageH, across, spread: layout.spread, shift }

  const grant = useRef<Vec>({ x: 0, y: 0 })

  /** A point on the stage measured from the top of the spine. */
  const toBook = (p: Vec): Vec => {
    const g = geometry.current
    const left = (g.stage.width - g.pageW * g.across) / 2 + g.shift
    const top = (g.stage.height - g.pageH) / 2

    return { x: p.x - left - (g.spread ? g.pageW : 0), y: p.y - top }
  }

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          grant.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }
          poke()
          reader.down(toBook(grant.current), 1)
        },
        onPanResponderMove: (_, g) => {
          reader.move(toBook({ x: grant.current.x + g.dx, y: grant.current.y + g.dy }), 1)
        },
        onPanResponderRelease: (_, g) => {
          const at = { x: grant.current.x + g.dx, y: grant.current.y + g.dy }

          if (reader.up(toBook(at), 1) !== 'tap') return

          // A tap on the outer thirds turns the page.
          const width = geometry.current.stage.width

          if (at.x > (width * 2) / 3) reader.next()
          else if (at.x < width / 3) reader.prev()
        },
        onPanResponderTerminate: () => reader.cancel(),
      }),
    [reader, poke],
  )

  // ------------------------------------------------- Faces around the opening
  const fold = new FoldLayout(pageW, pageH, active, active ? reader.engine.frame : null, shading)
  const leaves = layout.leaves
  const turnLeaf = active?.leaf ?? null
  const turnDir = active?.dir ?? 1
  const rightLeaf = turnLeaf !== null ? turnLeaf + 1 : flipped
  const leftLeaf = turnLeaf !== null ? turnLeaf - 1 : flipped - 1
  const faces: ReactNode[] = []

  for (let k = Math.max(0, flipped - 2); k <= Math.min(leaves.length - 1, flipped + 1) && pageW > 0; k++) {
    for (const side of ['front', 'back'] as const) {
      const facesUp = (side === 'front') === (turnDir === 1)
      const role: Role =
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

      if (role === 'spare') continue

      const onLeft = role === 'left' || (role === 'turning' && turnDir === -1 && !active?.stiff)
      const placement = fold.place(role, side, onLeft)
      const z = { right: 1, left: 1, turning: 3, flap: 6 }[role]

      faces.push(
        <View key={`${k}:${side}`} style={[placement.clip, { zIndex: z }]} pointerEvents="none">
          <View style={placement.frame}>
            <View style={placement.face}>
              <FaceContent
                face={side === 'front' ? leaves[k].front : leaves[k].back}
                book={book}
                width={pageW}
                side={side === 'front' ? 'right' : 'left'}
              />
              {placement.bands.map((band) => (
                <View key={band.name} style={[band.style, { opacity: band.opacity }]}>
                  <Gradient stops={BAND_STOPS[band.name]} />
                </View>
              ))}
            </View>
          </View>
        </View>,
      )
    }
  }

  const tint = COVER_THEMES[book.theme ?? 'classic'].stage

  return (
    <BookLookProvider paper={book.paper} frame={book.frame} fonts={fonts}>
      <View style={[styles.root, { backgroundColor: background ?? tint[2] }, style]}>
        {!background && <StageGlow colors={tint} />}

        <View
          style={styles.stage}
          onLayout={(e: LayoutChangeEvent) => setStage({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
          pointerEvents="box-only"
          {...responder.panHandlers}
        >
          {pageW > 0 && (
            <Animated.View style={{ width: pageW * across, height: pageH, transform: [{ translateX: shiftValue }] }} pointerEvents="none">
              <View
                style={[
                  styles.shadow,
                  {
                    left: layout.spread && reader.atStart && settled ? '52%' : '2%',
                    right: layout.spread && reader.atEnd && settled ? '52%' : '2%',
                  },
                ]}
              />
              <View style={[styles.spine, { left: layout.spread ? pageW : 0 }]}>{faces}</View>
            </Animated.View>
          )}
        </View>

        {controls && (
          <Animated.View style={[styles.bar, styles.top, { opacity: chrome }]} pointerEvents={chromeShown ? 'box-none' : 'none'}>
            <Gradient
              to="bottom"
              stops={[
                { offset: 0, color: '#000', opacity: 0.6 },
                { offset: 1, color: '#000', opacity: 0 },
              ]}
            />
            <View style={styles.group}>
              {topLeft}
              <View style={styles.heading}>
                <Text style={styles.title} numberOfLines={1}>
                  {book.title}
                </Text>
                {book.author ? (
                  <Text style={styles.byline} numberOfLines={1}>
                    {labels.byline(book.author)}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.group}>{topRight}</View>
          </Animated.View>
        )}

        {showPages && thumbnails && (
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
          <Animated.View style={[styles.bar, styles.bottom, { opacity: chrome }]} pointerEvents={chromeShown ? 'box-none' : 'none'}>
            <Gradient
              to="top"
              stops={[
                { offset: 0, color: '#000', opacity: 0.6 },
                { offset: 1, color: '#000', opacity: 0 },
              ]}
            />
            <RoundButton label={labels.previous} disabled={reader.atStart} onPress={() => reader.prev()} icon="M15 6l-6 6 6 6" />
            <Pressable
              onPress={() => thumbnails && setShowPages((s) => !s)}
              style={styles.pages}
              role="button"
              aria-expanded={thumbnails ? showPages : undefined}
            >
              <Text style={styles.pagesText}>{reader.label}</Text>
            </Pressable>
            <RoundButton label={labels.next} disabled={reader.atEnd} onPress={() => reader.next()} icon="M9 6l6 6-6 6" />
          </Animated.View>
        )}

        {showRotatePrompt && (
          <View style={styles.rotate}>
            <Svg viewBox="0 0 64 64" width={80} height={80}>
              <Rect x="20" y="6" width="24" height="52" rx="4" fill="none" stroke="#fff" strokeWidth={2.5} />
              <Path d="M32 49a2 2 0 1 0 0.01 0" stroke="#fff" strokeWidth={4} strokeLinecap="round" />
            </Svg>
            <Text style={styles.rotateTitle}>{labels.rotateTitle}</Text>
            <Text style={styles.rotateBody}>{labels.rotateBody}</Text>
            <Pressable onPress={() => setPortraitChoice('single')} role="button">
              <Text style={styles.rotateSecondary}>{labels.rotateSingle}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </BookLookProvider>
  )
})

/** A soft glow behind the book, tinted by the cover. */
function StageGlow({ colors }: { colors: [string, string, string] }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id="fbStage" cx="50%" cy="40%" rx="70%" ry="70%">
          <Stop offset="0" stopColor={colors[0]} />
          <Stop offset="0.55" stopColor={colors[1]} />
          <Stop offset="1" stopColor={colors[2]} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#fbStage)" />
    </Svg>
  )
}

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
  const width = 54

  return (
    <View style={styles.strip}>
      <ScrollView horizontal contentContainerStyle={styles.stripList} showsHorizontalScrollIndicator={false}>
        {layout.stops().map((stop) => (
          <Pressable
            key={stop.flipped}
            onPress={() => onPick(stop.flipped)}
            role="button"
            aria-label={`Go to ${BookLayout.describe(stop.faces)}`}
            style={[styles.stop, stop.flipped === flipped && styles.stopCurrent]}
          >
            {stop.faces.map((face, i) => (
              <FaceContent key={i} face={face} book={book} width={width} side={i === 0 && stop.faces.length > 1 ? 'left' : 'right'} />
            ))}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

function RoundButton({ label, icon, disabled, onPress }: { label: string; icon: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} role="button" aria-label={label} style={[styles.button, disabled && styles.disabled]}>
      <Svg viewBox="0 0 24 24" width={20} height={20}>
        <Path d={icon} stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', userSelect: 'none' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  spine: { position: 'absolute', top: 0, width: 0, height: 0 },
  shadow: { position: 'absolute', bottom: -10, height: 20, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.25)' },
  bar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  top: { top: 0, justifyContent: 'space-between', paddingVertical: 12 },
  bottom: { bottom: 0, justifyContent: 'center', paddingTop: 24, paddingBottom: 16 },
  group: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  heading: { flexShrink: 1 },
  title: { color: '#fff', fontSize: 18 },
  byline: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  button: { padding: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  disabled: { opacity: 0.3 },
  pages: {
    minWidth: 160,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  pagesText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontVariant: ['tabular-nums'] },
  strip: { position: 'absolute', left: 16, right: 16, bottom: 80, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)' },
  stripList: { gap: 12, padding: 12 },
  stop: { flexDirection: 'row', borderWidth: 2, borderColor: 'transparent', opacity: 0.8 },
  stopCurrent: { borderColor: '#fcd34d', opacity: 1 },
  rotate: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  rotateTitle: { color: '#fff', fontSize: 24, textAlign: 'center' },
  rotateBody: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center' },
  rotateSecondary: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textDecorationLine: 'underline' },
})
