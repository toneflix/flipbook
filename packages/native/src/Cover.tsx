import { useId, useState, type ReactNode } from 'react'
import { Image, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import Svg, { ClipPath, Defs, Ellipse, Image as SvgImage, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import {
  COVER_THEMES,
  FLEURON,
  PhotoCrop,
  coverHasText,
  decoArt,
  printBeside,
  type CoverArt,
  type FlipbookBook,
  type FlipbookPhoto,
  type Size,
} from '@toneflix/flipbook-core'
import { Gradient } from './Gradient'
import { PAPERS, pageMetrics, useBookLook, useSerif } from './look'
import { Ornament } from './pages'
import { CroppedImage, useNaturalSize } from './position'

type Side = 'left' | 'right'
type Corner = 'tl' | 'tr' | 'bl' | 'br'

const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br']
const MIRROR: Record<Corner, ViewStyle['transform']> = {
  tl: undefined,
  tr: [{ scaleX: -1 }],
  bl: [{ scaleY: -1 }],
  br: [{ scaleX: -1 }, { scaleY: -1 }],
}

function Art({ art, color, style }: { art: CoverArt; color: string; style: ViewStyle }) {
  return (
    <Svg viewBox={art.viewBox} preserveAspectRatio="none" style={style} pointerEvents="none">
      {art.strokes.map(({ d, width, opacity = 1 }) => (
        <Path key={d} d={d} fill="none" stroke={color} strokeWidth={width} strokeOpacity={opacity} />
      ))}
      {art.fills.map((d) => (
        <Path key={d} d={d} fill={color} />
      ))}
    </Svg>
  )
}

/** Gilt rules and a flourish in each corner. */
function GiltFrame({ unit, color }: { unit: number; color: string }) {
  const size = 18 * unit
  const at = 3.6 * unit
  const place: Record<Corner, ViewStyle> = {
    tl: { top: at, left: at },
    tr: { top: at, right: at },
    bl: { bottom: at, left: at },
    br: { bottom: at, right: at },
  }

  return (
    <>
      <View pointerEvents="none" style={[styles.fill, { margin: 5 * unit, borderWidth: 0.35 * unit, borderColor: color, opacity: 0.85 }]} />
      <View
        pointerEvents="none"
        style={[styles.fill, { margin: 6.6 * unit, borderWidth: 0.15 * unit, borderColor: color, opacity: 0.85 }]}
      />
      {CORNERS.map((corner) => (
        <Art
          key={corner}
          art={FLEURON}
          color={color}
          style={{ position: 'absolute', width: size, height: size, ...place[corner], transform: MIRROR[corner] }}
        />
      ))}
    </>
  )
}

/** A photo clipped to an oval or an arch, ruled in the ink. */
function ShapedPhoto({
  photo,
  shape,
  width,
  height,
  unit,
  color,
  show,
}: {
  photo: FlipbookPhoto
  shape: 'oval' | 'arch'
  width: number
  height: number
  unit: number
  color: string
  show: boolean
}) {
  const id = `c${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const natural = useNaturalSize(show ? photo : null)
  const drawn = PhotoCrop.of(photo.position).rect({ width, height }, natural)
  const r = width / 2
  const arch = `M0 ${height}V${r}A${r} ${r} 0 0 1 ${width} ${r}V${height}Z`
  const outline = shape === 'oval' ? <Ellipse cx={r} cy={height / 2} rx={r - 0.3 * unit} ry={height / 2 - 0.3 * unit} /> : <Path d={arch} />

  return (
    <Svg width={width} height={height}>
      <Defs>
        <ClipPath id={id}>{outline}</ClipPath>
      </Defs>
      {show ? (
        <SvgImage
          href={{ uri: photo.src }}
          x={drawn.left}
          y={drawn.top}
          width={drawn.width}
          height={drawn.height}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${id})`}
        />
      ) : (
        <Rect width={width} height={height} fill={color} fillOpacity={0.15} clipPath={`url(#${id})`} />
      )}
      {shape === 'oval' ? (
        <Ellipse
          cx={r}
          cy={height / 2}
          rx={r - 0.3 * unit}
          ry={height / 2 - 0.3 * unit}
          fill="none"
          stroke={color}
          strokeWidth={0.6 * unit}
        />
      ) : (
        <Path d={arch} fill="none" stroke={color} strokeWidth={1 * unit} />
      )}
    </Svg>
  )
}

/**
 * A shaped photo `width` × `height` page units, `gap` units below what is above it, that shrinks in
 * proportion when its column runs short.
 */
function FittedPhoto({ width, height, gap, ...rest }: Parameters<typeof ShapedPhoto>[0] & { gap: number }) {
  const [room, setRoom] = useState<number | null>(null)
  const scale = room === null ? 1 : Math.min(1, room / height)

  return (
    <View
      style={{ marginTop: gap, height, flexShrink: 1, minHeight: 0, alignSelf: 'stretch', alignItems: 'center' }}
      onLayout={(e) => setRoom(e.nativeEvent.layout.height)}
    >
      {room !== null && <ShapedPhoto {...rest} width={width * scale} height={height * scale} />}
    </View>
  )
}

/** A photo covering its parent, cropped by its position. */
function Photo({ photo, show }: { photo: FlipbookPhoto; show: boolean }) {
  const [box, setBox] = useState<Size | null>(null)
  const natural = useNaturalSize(show ? photo : null)

  if (!show) return null

  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setBox(e.nativeEvent.layout)}>
      {box && <CroppedImage photo={photo} crop={PhotoCrop.of(photo.position)} box={box} image={natural} />}
    </View>
  )
}

/** Cover board: cloth, light, the hinge shadow along the spine and a grain finish. */
function Board({
  book,
  width,
  height,
  hinge,
  children,
}: {
  book: Pick<FlipbookBook, 'theme'>
  width: number
  height: number
  hinge: Side
  children?: ReactNode
}) {
  const theme = COVER_THEMES[book.theme ?? 'classic']
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const shade = (a: number, offset: number) => ({ offset, color: '#000', opacity: a })

  return (
    <View style={[styles.board, { width, height, backgroundColor: theme.cloth }]}>
      {children}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <RadialGradient id={`sheen${id}`} cx="30%" cy="20%" rx="45%" ry="45%">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.1} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`edge${id}`} cx="50%" cy="50%" rx="70%" ry="70%">
            <Stop offset="0.6" stopColor="#000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000" stopOpacity={0.25} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#sheen${id})`} />
        <Rect width="100%" height="100%" fill={`url(#edge${id})`} />
      </Svg>
      <Image
        source={PAPERS.ivory.grain}
        resizeMode="repeat"
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: 0.25, mixBlendMode: 'soft-light' }]}
      />
      <Gradient
        to={hinge === 'left' ? 'right' : 'left'}
        style={[styles.hinge, hinge === 'left' ? styles.left : styles.right, { width: Math.min(width, height) * 0.04 }]}
        stops={[shade(0.35, 0), shade(0.1, 0.5), shade(0, 1)]}
      />
    </View>
  )
}

export interface CoverViewProps {
  book: Pick<FlipbookBook, 'title' | 'subtitle' | 'theme' | 'cover' | 'kicker' | 'coverDesign' | 'coverText' | 'pageShape'>
  width: number
  showImages?: boolean
}

/** The front cover, laid out by the book's `coverDesign`. */
export function CoverView({ book, width, showImages = true }: CoverViewProps) {
  const color = COVER_THEMES[book.theme ?? 'classic'].ink
  const serif = useSerif()
  const lookShape = useBookLook().shape
  const metrics = pageMetrics(width, book.pageShape ?? lookShape)
  const { unit, size, across, measure } = metrics
  const text = coverHasText(book)
  const beside = across && !!book.cover && text
  const band = (100 / 3) * Math.min(1, size.height / (133 + 1 / 3))
  const windowHeight = size.height - 24 - band
  const stamped: TextStyle = {
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 0.15 * unit },
    textShadowRadius: 0,
  }

  const kicker = (ink = color) =>
    book.kicker ? (
      <Text style={[styles.kicker, { fontSize: 2.6 * unit, letterSpacing: 0.78 * unit, color: ink }]}>{book.kicker.toUpperCase()}</Text>
    ) : null
  const title = (size: number, ink = color, extra?: TextStyle) => (
    <Text
      style={[
        serif.upright,
        styles.center,
        stamped,
        { marginTop: 4 * unit, fontSize: size * unit, lineHeight: size * 1.08 * unit, fontWeight: '500', color: ink },
        extra,
      ]}
    >
      {book.title}
    </Text>
  )
  const subtitle = (size = 4, ink = color) =>
    book.subtitle ? (
      <Text
        style={[
          serif.italic,
          styles.center,
          { marginTop: 3 * unit, fontSize: size * unit, lineHeight: size * 1.35 * unit, color: ink, opacity: 0.85 },
        ]}
      >
        {book.subtitle}
      </Text>
    ) : null

  const words = (
    <View style={[styles.words, { width: '42%' }]}>
      {kicker()}
      {title(9)}
      {subtitle()}
    </View>
  )
  const print = (style: ViewStyle) =>
    book.cover && (
      <View style={[styles.print, { padding: 2.4 * unit }, style]}>
        <View style={[styles.flex, styles.clip]}>
          <Photo photo={book.cover} show={showImages} />
        </View>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
          <Path d="M0 0H9L0 9Z M100 0V9L91 0Z M0 100V91L9 100Z M100 100H91L100 91Z" fill="#1f1b18" />
        </Svg>
      </View>
    )
  const label = (style: ViewStyle) =>
    text && (
      <View style={[styles.label, { padding: 4 * unit }, style]}>
        <View
          pointerEvents="none"
          style={[styles.fill, { margin: 1.2 * unit, borderWidth: 0.2 * unit, borderColor: 'rgba(60,45,30,0.5)' }]}
        />
        {kicker('#3a2f25')}
        {title(6.4, '#3a2f25', { marginTop: 1 * unit, textShadowColor: 'transparent' })}
        {subtitle(3, '#3a2f25')}
      </View>
    )
  const at = ({ x, y, width: w, height: h }: { x: number; y: number; width: number; height: number }): ViewStyle => ({
    left: x * unit,
    top: y * unit,
    width: w * unit,
    height: h * unit,
  })

  const designs = {
    classic: () =>
      beside ? (
        <View
          style={[
            styles.panel,
            styles.across,
            { margin: 6 * unit, paddingVertical: 8 * unit, paddingHorizontal: 6 * unit, borderColor: color },
          ]}
        >
          {words}
          <View style={[styles.flex, styles.clip, { marginLeft: 7 * unit, borderWidth: 0.8 * unit, borderColor: color }]}>
            <Photo photo={book.cover!} show={showImages} />
          </View>
        </View>
      ) : (
        <View style={[styles.panel, { margin: 6 * unit, paddingVertical: 8 * unit, paddingHorizontal: 6 * unit, borderColor: color }]}>
          {text && kicker()}
          {text && title(9)}
          {book.cover ? (
            <View style={[styles.coverPhoto, { marginTop: 7 * unit, borderWidth: 0.8 * unit, borderColor: color }]}>
              <Photo photo={book.cover} show={showImages} />
            </View>
          ) : (
            text && subtitle()
          )}
        </View>
      ),
    gilt: () => (
      <>
        <GiltFrame unit={unit} color={color} />
        {beside ? (
          <View style={[styles.stack, styles.across, { top: 14 * unit, bottom: 14 * unit, left: 12 * unit, right: 12 * unit }]}>
            <View style={[styles.centered, { width: '50%' }]}>
              <ShapedPhoto
                photo={book.cover!}
                shape="oval"
                width={52 * unit}
                height={64 * unit}
                unit={unit}
                color={color}
                show={showImages}
              />
            </View>
            <View style={[styles.words, { flex: 1, marginLeft: 4 * unit }]}>
              {kicker()}
              {title(8)}
              {subtitle()}
            </View>
          </View>
        ) : (
          <View style={[styles.stack, { top: 14 * unit, bottom: 14 * unit, left: 12 * unit, right: 12 * unit }]}>
            {text && kicker()}
            {text && title(8)}
            {book.cover && (
              <FittedPhoto
                photo={book.cover}
                shape="oval"
                width={52 * unit}
                height={64 * unit}
                gap={6 * unit}
                unit={unit}
                color={color}
                show={showImages}
              />
            )}
            {text && subtitle()}
          </View>
        )}
      </>
    ),
    window: () => (
      <>
        <View
          style={[
            styles.window,
            { top: 10 * unit, left: 12 * unit, right: 12 * unit, height: windowHeight * unit, borderRadius: 0.6 * unit },
          ]}
        >
          {book.cover ? (
            <Photo photo={book.cover} show={showImages} />
          ) : (
            <View style={[styles.fill, styles.centered]}>
              <Ornament size={16 * unit} color={color} />
            </View>
          )}
          <Gradient
            to="bottom"
            style={[styles.edge, { top: 0, height: 4 * unit }]}
            stops={[
              { offset: 0, color: '#000', opacity: 0.55 },
              { offset: 1, color: '#000', opacity: 0 },
            ]}
          />
          <Gradient
            to="right"
            style={[styles.edgeV, { left: 0, width: 2 * unit }]}
            stops={[
              { offset: 0, color: '#000', opacity: 0.3 },
              { offset: 1, color: '#000', opacity: 0 },
            ]}
          />
          <Gradient
            to="left"
            style={[styles.edgeV, { right: 0, width: 2 * unit }]}
            stops={[
              { offset: 0, color: '#000', opacity: 0.25 },
              { offset: 1, color: '#000', opacity: 0 },
            ]}
          />
        </View>
        {text && (
          <View style={[styles.stack, { top: (14 + windowHeight) * unit, bottom: 8 * unit, left: measure(10), right: measure(10) }]}>
            {kicker()}
            {title(7.5, color, { textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: -0.15 * unit } })}
            {subtitle(3.4)}
          </View>
        )}
      </>
    ),
    label: () => {
      if (book.cover && across) {
        const place = printBeside(size, text)

        return (
          <>
            {print({ position: 'absolute', ...at(place.print) })}
            {label({
              position: 'absolute',
              left: place.label.x * unit,
              width: place.label.width * unit,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
            })}
          </>
        )
      }

      if (book.cover && size.width === size.height)
        return (
          <View style={[styles.mount, { top: 11 * unit, bottom: 6 * unit, gap: 11 * unit }]}>
            {print({ position: 'relative', height: 62 * unit, aspectRatio: 68 / 62, flexShrink: 1, minHeight: 0 })}
            {label({ position: 'relative', width: 64 * unit })}
          </View>
        )

      if (!book.cover && size.height < 133)
        return <View style={[styles.fill, styles.centered]}>{label({ position: 'relative', width: 64 * unit })}</View>

      return (
        <>
          {print({ position: 'absolute', top: 11 * unit, left: 16 * unit, right: 16 * unit, height: 62 * unit })}
          {label({ position: 'absolute', top: (book.cover ? 84 : 44) * unit, left: 18 * unit, right: 18 * unit })}
        </>
      )
    },
    deco: () => (
      <>
        <Art art={decoArt(size)} color={color} style={StyleSheet.absoluteFill as ViewStyle} />
        <View
          style={[styles.stack, { top: 17 * unit, bottom: 15 * unit, left: measure(14), right: measure(14), justifyContent: 'flex-start' }]}
        >
          {text && kicker()}
          {book.cover && (
            <FittedPhoto
              photo={book.cover}
              shape="arch"
              width={56 * unit}
              height={62 * unit}
              gap={4 * unit}
              unit={unit}
              color={color}
              show={showImages}
            />
          )}
          {text && title(6.6, color, { marginTop: 7 * unit, fontWeight: '400', letterSpacing: 0.8 * unit, textTransform: 'uppercase' })}
          {text && subtitle(3.4)}
        </View>
      </>
    ),
    image: () => (
      <>
        {book.cover && <Photo photo={book.cover} show={showImages} />}
        {book.cover && (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: 0.18, mixBlendMode: 'soft-light' }]}
          />
        )}
        {text &&
          (book.cover ? (
            <View style={[styles.caption, { paddingTop: 26 * unit, paddingHorizontal: measure(10), paddingBottom: 10 * unit }]}>
              <Gradient
                to="top"
                stops={[
                  { offset: 0, color: '#000', opacity: 0.65 },
                  { offset: 0.55, color: '#000', opacity: 0.25 },
                  { offset: 1, color: '#000', opacity: 0 },
                ]}
              />
              {kicker('#fff')}
              {title(9, '#fff', { textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 1.2 * unit })}
              {subtitle(4, '#fff')}
            </View>
          ) : (
            <View style={[styles.fill, styles.centered, { paddingVertical: 10 * unit, paddingHorizontal: measure(10) }]}>
              {kicker()}
              {title(9)}
              {subtitle()}
            </View>
          ))}
      </>
    ),
  }

  return (
    <Board book={book} width={width} height={metrics.height} hinge="left">
      {designs[book.coverDesign ?? 'classic']()}
    </Board>
  )
}

/** The back cover: the same board, with the brand and imprint. */
export function BackCoverView({
  book,
  width,
}: {
  book: Pick<FlipbookBook, 'theme' | 'imprint' | 'brand' | 'coverDesign' | 'pageShape'>
  width: number
}) {
  const color = COVER_THEMES[book.theme ?? 'classic'].ink
  const lookShape = useBookLook().shape
  const { unit, height } = pageMetrics(width, book.pageShape ?? lookShape)

  return (
    <Board book={book} width={width} height={height} hinge="right">
      {book.coverDesign === 'gilt' && <GiltFrame unit={unit} color={color} />}
      <View style={[styles.imprint, { bottom: 10 * unit }]}>
        <Ornament size={9 * unit} color={color} />
        {book.brand ? (
          <Text style={[styles.kicker, { marginTop: 2 * unit, fontSize: 3 * unit, letterSpacing: 0.9 * unit, color }]}>
            {book.brand.toUpperCase()}
          </Text>
        ) : null}
        {book.imprint ? (
          <Text style={[styles.kicker, { marginTop: 2 * unit, fontSize: 2.4 * unit, letterSpacing: 0.72 * unit, color, opacity: 0.6 }]}>
            {book.imprint.toUpperCase()}
          </Text>
        ) : null}
      </View>
    </Board>
  )
}

const styles = StyleSheet.create({
  board: { overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  flex: { flex: 1 },
  clip: { overflow: 'hidden' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  hinge: { position: 'absolute', top: 0, bottom: 0 },
  left: { left: 0 },
  right: { right: 0 },
  panel: { flex: 1, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  kicker: { textAlign: 'center', opacity: 0.7 },
  coverPhoto: { width: '100%', flex: 1, maxHeight: '62%', overflow: 'hidden' },
  stack: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  across: { flexDirection: 'row', alignItems: 'stretch' },
  words: { justifyContent: 'center', alignItems: 'center' },
  mount: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  window: { position: 'absolute', overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.12)' },
  edge: { position: 'absolute', left: 0, right: 0 },
  edgeV: { position: 'absolute', top: 0, bottom: 0 },
  print: { position: 'absolute', backgroundColor: '#f7f2e7', transform: [{ rotate: '-2.5deg' }], boxShadow: '0 3px 8px rgba(0,0,0,0.4)' },
  label: { position: 'absolute', alignItems: 'center', backgroundColor: '#f4eddc', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  imprint: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
})
