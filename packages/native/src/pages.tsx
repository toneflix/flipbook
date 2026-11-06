import { useId, type ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import { PLACED_LAYOUTS, photoFrame, type FlipbookBook, type FlipbookPage, type PageBox, type PhotoPosition } from '@toneflix/flipbook-core'
import { Gradient } from './Gradient'
import { ink, useBookLook, usePaper, useSerif, type PaperLook } from './look'
import { PrintedPhoto } from './PrintedPhoto'

/** Pages are 3:4, like the web's. */
export const PAGE_RATIO = 3 / 4

type Side = 'left' | 'right'

export interface PageViewProps {
  page: FlipbookPage
  /** Page width; the height follows the 3:4 page shape. */
  width: number
  number?: number
  side?: Side
  showImages?: boolean
  /** Editor: makes each photo slot pressable. */
  onSlotPress?: (slot: number) => void
  activeSlot?: number | null
  /** Editor: lets people drag and pinch the photo in the active slot to choose which part shows. */
  onPhotoPosition?: (slot: number, position: PhotoPosition) => void
  /** Editor: true while a finger is moving a photo, e.g. to pause the scroll view the page sits in. */
  onPositionGesture?: (active: boolean) => void
  /** Editor: colour of the highlighted slot. */
  accent?: string
}

/**
 * The inside of one book page, `width` wide. Sizes are in units of 1% of the width, so the same
 * page looks right as a thumbnail and full screen.
 */
export function PageView({
  page,
  width,
  number,
  side,
  showImages = true,
  onSlotPress,
  activeSlot,
  onPhotoPosition,
  onPositionGesture,
  accent = '#00afff',
}: PageViewProps) {
  const look = usePaper()
  const serif = useSerif()
  const unit = width / 100
  const { layout, caption, photos } = page
  const bookFrame = useBookLook().frame
  const placed = PLACED_LAYOUTS[layout]
  const captionStyle = [serif.italic, styles.caption, { fontSize: 3.8 * unit, lineHeight: 5.2 * unit, color: ink(look) }]

  const slot = (index: number, style: ViewStyle, fit: 'cover' | 'contain' = 'cover') => {
    const photo = photos[index] ?? null
    const frame = photoFrame(page, photo, bookFrame)

    return (
      <Pressable
        key={index}
        disabled={!onSlotPress}
        onPress={() => onSlotPress?.(index)}
        role={onSlotPress ? 'button' : undefined}
        aria-label={onSlotPress ? `Photo slot ${index + 1}` : undefined}
        style={[style, fit === 'cover' && styles.clip]}
      >
        {photo ? (
          <PrintedPhoto
            photo={photo}
            frame={frame}
            unit={unit}
            fit={fit}
            show={showImages}
            onPosition={onPhotoPosition && activeSlot === index ? (position) => onPhotoPosition(index, position) : undefined}
            onPositionGesture={onPositionGesture}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.empty,
              { backgroundColor: ink(look, 0.1) },
              onSlotPress && { borderWidth: 0.4 * unit, borderColor: ink(look, 0.3) },
            ]}
          >
            {onSlotPress && <Text style={{ fontSize: 3.2 * unit, color: ink(look, 0.7) }}>Add a photo</Text>}
          </View>
        )}
        {onSlotPress && activeSlot === index && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 0.8 * unit, borderColor: accent }]} />
        )}
      </Pressable>
    )
  }

  const boxStyle = ({ x, y, width: w, height: h, rotate }: PageBox): ViewStyle => ({
    position: 'absolute',
    left: x * unit,
    top: y * unit,
    width: w * unit,
    height: h * unit,
    transform: rotate ? [{ rotate: `${rotate}deg` }] : undefined,
  })

  const pageCaption = caption ? <Text style={captionStyle}>{caption}</Text> : null

  return (
    <Paper width={width} side={side}>
      {layout === 'single' && (
        <>
          {slot(0, StyleSheet.absoluteFill)}
          {caption ? (
            <View
              pointerEvents="none"
              style={[styles.overlay, { paddingTop: 14 * unit, paddingHorizontal: 7 * unit, paddingBottom: 7 * unit }]}
            >
              <Gradient
                to="top"
                stops={[
                  { offset: 0, color: '#000', opacity: 0.7 },
                  { offset: 0.5, color: '#000', opacity: 0.3 },
                  { offset: 1, color: '#000', opacity: 0 },
                ]}
              />
              <Text style={[serif.italic, { fontSize: 4.2 * unit, lineHeight: 5.7 * unit, color: '#fff' }]}>{caption}</Text>
            </View>
          ) : null}
        </>
      )}

      {layout === 'framed' && (
        <View style={[styles.fill, { paddingTop: 10 * unit, paddingHorizontal: 9 * unit, paddingBottom: 6 * unit }]}>
          {slot(0, styles.flex, 'contain')}
          <Text style={[captionStyle, { marginTop: 5 * unit, minHeight: 6 * unit, fontSize: 4.2 * unit, lineHeight: 5.7 * unit }]}>
            {caption}
          </Text>
        </View>
      )}

      {layout === 'pair' && (
        <View style={[styles.fill, { padding: 7 * unit, gap: 4 * unit }]}>
          {slot(0, styles.flex)}
          {slot(1, styles.flex)}
          {pageCaption}
        </View>
      )}

      {layout === 'grid' && (
        <View style={[styles.fill, { padding: 7 * unit, gap: 3 * unit }]}>
          {[0, 2].map((first) => (
            <View key={first} style={[styles.row, { gap: 3 * unit }]}>
              {slot(first, styles.flex)}
              {slot(first + 1, styles.flex)}
            </View>
          ))}
          {pageCaption}
        </View>
      )}

      {layout === 'collage' && (
        <View style={[styles.fill, { padding: 7 * unit, gap: 3 * unit }]}>
          {slot(0, { flex: 1.4 })}
          <View style={[styles.row, { gap: 3 * unit }]}>
            {slot(1, styles.flex)}
            {slot(2, styles.flex)}
          </View>
          {pageCaption}
        </View>
      )}

      {placed && (
        <>
          {placed.slots.map((box, i) => slot(i, { ...boxStyle(box), ...(placed.loose && styles.loose) }))}
          {caption ? (
            <View pointerEvents="none" style={[boxStyle(placed.caption), !placed.prose && styles.centered]}>
              <Text
                style={placed.prose ? [serif.upright, { fontSize: 4.4 * unit, lineHeight: 6.8 * unit, color: ink(look) }] : captionStyle}
              >
                {caption}
              </Text>
            </View>
          ) : null}
        </>
      )}

      {layout === 'text' && (
        <View style={[styles.fill, styles.centered, { paddingVertical: 14 * unit, paddingHorizontal: 12 * unit }]}>
          <Text
            style={[serif.upright, { fontSize: 18 * unit, lineHeight: 16 * unit, height: 10 * unit, color: ink(look, 0.3) }]}
            accessible={false}
          >
            “
          </Text>
          <Text
            style={[serif.italic, styles.caption, { marginTop: 4 * unit, fontSize: 6 * unit, lineHeight: 8.4 * unit, color: ink(look) }]}
          >
            {caption || (onSlotPress ? 'Write something in the caption box below.' : '')}
          </Text>
        </View>
      )}

      {number !== undefined && layout !== 'single' && (
        <Text
          style={[
            serif.upright,
            styles.number,
            side === 'left' ? styles.left : styles.right,
            { paddingHorizontal: 5 * unit, paddingBottom: 2.6 * unit, fontSize: 2.8 * unit, color: ink(look, 0.6) },
          ]}
        >
          {number}
        </Text>
      )}
    </Paper>
  )
}

/** A sheet of the book's paper: texture under the content, grain and page light over it. */
export function Paper({ width, side, children, style }: { width: number; side?: Side; children?: ReactNode; style?: ViewStyle }) {
  const look = usePaper()

  return (
    <View style={[styles.page, { width, height: width / PAGE_RATIO, backgroundColor: look.background }, style]}>
      <Image source={look.texture} resizeMode="repeat" style={[StyleSheet.absoluteFill, styles.tile, { opacity: look.textureOpacity }]} />
      <PageLight look={look} />
      {children}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image source={look.grain} resizeMode="repeat" style={[StyleSheet.absoluteFill, styles.tile, { opacity: look.grainOpacity }]} />
        {side && <Gutter side={side} />}
      </View>
    </View>
  )
}

/** Soft light from the top left and darker edges, like a real sheet. */
function PageLight({ look }: { look: PaperLook }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')

  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id={`light${id}`} cx="30%" cy="20%" rx="55%" ry="55%">
          <Stop offset="0" stopColor={look.light} />
          <Stop offset="1" stopColor={look.light} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`vignette${id}`} cx="50%" cy="50%" rx="70%" ry="70%">
          <Stop offset="0.6" stopColor={look.vignette} stopOpacity={0} />
          <Stop offset="1" stopColor={look.vignette} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#light${id})`} />
      <Rect width="100%" height="100%" fill={`url(#vignette${id})`} />
    </Svg>
  )
}

/** The page curving into the spine on a spread, and the sheen where it rises. */
function Gutter({ side }: { side: Side }) {
  const to = side === 'right' ? 'right' : 'left'
  const shade = (a: number, offset: number) => ({ offset, color: 'rgb(20,12,4)', opacity: a })
  const sheen = (a: number, offset: number) => ({ offset, color: 'rgb(255,250,240)', opacity: a })

  return (
    <>
      <Gradient
        to={to}
        stops={[shade(0.5, 0), shade(0.3, 0.015), shade(0.14, 0.04), shade(0.05, 0.08), shade(0, 0.15), shade(0, 0.94), shade(0.07, 1)]}
      />
      <Gradient to={to} stops={[sheen(0, 0.06), sheen(0.07, 0.13), sheen(0.02, 0.26), sheen(0, 0.4)]} />
    </>
  )
}

/** Inside the front cover: a title page. */
export function TitlePageView({
  book,
  width,
  side,
}: {
  book: Pick<FlipbookBook, 'title' | 'subtitle' | 'author' | 'year'>
  width: number
  side?: Side
}) {
  const look = usePaper()
  const serif = useSerif()
  const unit = width / 100
  const credit = [book.author, book.year].filter(Boolean).join(' · ')

  return (
    <Paper width={width} side={side}>
      <View style={[styles.fill, styles.centered, { padding: 12 * unit }]}>
        <Ornament size={9 * unit} color={ink(look)} />
        <Text
          style={[serif.upright, styles.center, { marginTop: 6 * unit, fontSize: 7.5 * unit, lineHeight: 8.3 * unit, color: ink(look) }]}
        >
          {book.title}
        </Text>
        {book.subtitle ? (
          <Text
            style={[serif.italic, styles.center, { marginTop: 4 * unit, fontSize: 4 * unit, lineHeight: 5.8 * unit, color: ink(look) }]}
          >
            {book.subtitle}
          </Text>
        ) : null}
        <View style={{ marginTop: 7 * unit, height: StyleSheet.hairlineWidth, width: 20 * unit, backgroundColor: ink(look, 0.3) }} />
        {credit ? (
          <Text style={[styles.kicker, { marginTop: 5 * unit, fontSize: 2.6 * unit, letterSpacing: 0.52 * unit, color: ink(look) }]}>
            {credit.toUpperCase()}
          </Text>
        ) : null}
      </View>
    </Paper>
  )
}

/** Inside the back cover, with the book's closing line. */
export function ColophonView({ book, width, side }: { book: Pick<FlipbookBook, 'colophon'>; width: number; side?: Side }) {
  const look = usePaper()
  const serif = useSerif()
  const unit = width / 100

  return (
    <Paper width={width} side={side}>
      <View style={[styles.fill, { alignItems: 'center', justifyContent: 'flex-end', padding: 12 * unit }]}>
        {book.colophon ? (
          <Text style={[serif.italic, styles.center, { fontSize: 3.6 * unit, color: ink(look, 0.9) }]}>{book.colophon}</Text>
        ) : null}
      </View>
    </Paper>
  )
}

export function BlankPageView({ width, side }: { width: number; side?: Side }) {
  return <Paper width={width} side={side} />
}

export function Ornament({ size, color }: { size: number; color: string }) {
  return (
    <Svg viewBox="0 0 40 40" width={size} height={size}>
      <Circle cx="20" cy="20" r="18.5" fill="none" stroke={color} strokeOpacity={0.6} />
      <Path d="M20 9 L 27 20 L 20 31 L 13 20 Z" fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <Circle cx="20" cy="20" r="2.2" fill={color} />
    </Svg>
  )
}

const styles = StyleSheet.create({
  page: { overflow: 'hidden' },
  tile: { width: '100%', height: '100%' },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  clip: { overflow: 'hidden' },
  loose: { boxShadow: '0 2px 6px rgba(0,0,0,0.25)' },
  empty: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  caption: { textAlign: 'center' },
  number: { position: 'absolute', bottom: 0 },
  left: { left: 0 },
  right: { right: 0 },
  hinge: { position: 'absolute', top: 0, bottom: 0 },
  panel: { flex: 1, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  kicker: { textAlign: 'center', opacity: 0.7 },
  coverPhoto: { width: '100%', flex: 1, maxHeight: '62%', overflow: 'hidden' },
  imprint: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
})
