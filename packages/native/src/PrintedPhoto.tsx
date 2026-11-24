import { useId, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native'
import Svg, {
  ClipPath,
  Defs,
  Ellipse,
  G,
  Image as SvgImage,
  LinearGradient as SvgGradient,
  Path,
  Pattern,
  Polygon,
  Rect,
  Circle,
  Stop,
} from 'react-native-svg'
import {
  BANDED_FRAMES,
  FrameScene,
  PRINT_WHITE,
  ROUNDED_RADIUS,
  SPROCKET,
  TAPE,
  archRadius,
  sprockets,
  withAlpha,
  type FlipbookPhoto,
  type FrameStyle,
  type PhotoCrop,
  type PhotoPosition,
  type Size,
} from '@toneflix/flipbook-core'
import { Gradient } from './Gradient'
import { ink, usePaper, type PaperLook } from './look'
import { CroppedImage, useNaturalSize, usePhotoGestures } from './position'

type Box = { left: number; top: number; width: number; height: number }

const BANDS = BANDED_FRAMES

const GOLD = '#b48a32'

/** The frame's pad, line and foot in points: core's page-unit sizes times `unit`. Lines are at least a point wide. */
function measure(frame: FrameStyle, unit: number) {
  const { pad, line, foot } = FrameScene.measure(frame)

  return { pad: pad * unit, line: line ? Math.max(frame === 'double' ? 3 : 1, line * unit) : 0, foot: foot * unit }
}

/**
 * A photo printed on a page inside its frame. It fills its parent, or with `fit="contain"` keeps the
 * photo's shape and centres it. `unit` is 1% of the page's width, so frames look the same at any size.
 */
export interface PrintedPhotoProps {
  photo: FlipbookPhoto | null
  frame: FrameStyle
  /** 1% of the page width. */
  unit: number
  fit?: 'cover' | 'contain'
  /** False draws a placeholder instead of loading the image. */
  show?: boolean
  /** Editor: lets people drag and pinch to choose which part of the photo shows. */
  onPosition?: (position: PhotoPosition) => void
  /** Editor: called with true when a positioning gesture starts and false when it ends. */
  onPositionGesture?: (active: boolean) => void
}

export function PrintedPhoto({ photo, frame, unit, fit = 'cover', show = true, onPosition, onPositionGesture }: PrintedPhotoProps) {
  const look = usePaper()
  const [box, setBox] = useState<{ width: number; height: number } | null>(null)
  const { pad, line, foot } = measure(frame, unit)
  const edge = pad + line
  const ratio = photo?.width && photo.height ? photo.width / photo.height : 4 / 3

  let width = box?.width ?? 0
  let height = box?.height ?? 0

  if (box && fit === 'contain') {
    width = Math.min(box.width, (box.height - 2 * edge - foot) * ratio + 2 * edge)
    height = (width - 2 * edge) / ratio + 2 * edge + foot
  }

  const inner: Box = { left: edge, top: edge, width: Math.max(0, width - 2 * edge), height: Math.max(0, height - 2 * edge - foot) }
  const corner = photoCorners(frame, inner, unit)
  const natural = useNaturalSize(show ? photo : null)
  const { crop, handlers } = usePhotoGestures(photo?.position, inner, natural, photo && show ? onPosition : undefined, onPositionGesture)

  return (
    <View style={styles.box} onLayout={(event: LayoutChangeEvent) => setBox(event.nativeEvent.layout)}>
      {box && (
        <View style={{ width, height }} {...handlers}>
          <Backing frame={frame} look={look} unit={unit} width={width} height={height} line={line} rect={inner} />
          {frame === 'oval' ? (
            <OvalPhoto photo={show ? photo : null} crop={crop} natural={natural} look={look} rect={inner} width={width} height={height} />
          ) : (
            <View style={[styles.abs, inner, corner, corner && styles.clip]}>
              {photo && show ? (
                <CroppedImage photo={photo} crop={crop} box={inner} image={natural} />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: ink(look, 0.15) }]} />
              )}
              {frame === 'feather' && <Feather look={look} />}
            </View>
          )}
          <Trim frame={frame} look={look} unit={unit} width={width} height={height} rect={inner} />
        </View>
      )}
    </View>
  )
}

/** What is printed under the photo: rules, mats, tints and bands. */
function Backing({
  frame,
  look,
  unit,
  width,
  height,
  line,
  rect,
}: {
  frame: FrameStyle
  look: PaperLook
  unit: number
  width: number
  height: number
  line: number
  rect: Box
}) {
  const band = BANDS[frame]

  if (band) return <Band frame={frame} look={look} unit={unit} band={band * unit} width={width} height={height} />

  switch (frame) {
    case 'hairline':
      return <View style={[StyleSheet.absoluteFill, { borderWidth: line, borderColor: ink(look, 0.7) }]} />
    case 'double': {
      const rule = line / 3
      const color = ink(look, 0.75)

      return (
        <>
          <View style={[StyleSheet.absoluteFill, { borderWidth: rule, borderColor: color }]} />
          <View
            style={[
              styles.abs,
              { top: rule * 2, left: rule * 2, right: rule * 2, bottom: rule * 2, borderWidth: rule, borderColor: color },
            ]}
          />
        </>
      )
    }
    case 'mat':
      return (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: look.frameTint, borderWidth: line, borderColor: ink(look, 0.85) }]} />
      )
    case 'plate': {
      const press = 0.2 * unit

      return (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: look.plateTint,
              borderTopWidth: press,
              borderLeftWidth: press,
              borderBottomWidth: press,
              borderRightWidth: press,
              borderTopColor: look.plateLow,
              borderLeftColor: look.plateLow,
              borderBottomColor: look.plateHigh,
              borderRightColor: look.plateHigh,
            },
          ]}
        />
      )
    }
    case 'deckle':
      return <Deckle look={look} scallop={1.6 * unit} width={width} height={height} />
    case 'oval':
      return (
        <Svg width={width} height={height} style={styles.abs}>
          <Ellipse
            cx={width / 2}
            cy={height / 2}
            rx={width / 2 - line / 2}
            ry={height / 2 - line / 2}
            stroke={ink(look, 0.7)}
            strokeWidth={line}
            fill="none"
          />
        </Svg>
      )
    case 'arch': {
      const r = archRadius(rect) + rect.left

      return (
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderWidth: line, borderColor: ink(look, 0.7), borderTopLeftRadius: r, borderTopRightRadius: r },
          ]}
        />
      )
    }
    case 'instant':
      return (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: PRINT_WHITE, borderWidth: Math.max(1, 0.15 * unit), borderColor: ink(look, 0.16) },
          ]}
        />
      )
    case 'film':
      return <Film unit={unit} width={width} height={height} band={rect.top} />
    case 'deco':
      return <Deco unit={unit} width={width} height={height} />
    default:
      return null
  }
}

/** Corner radii that cut the photo to an arch or round its corners. */
function photoCorners(frame: FrameStyle, rect: Box, unit: number): ViewStyle | undefined {
  if (frame === 'arch') {
    const r = archRadius(rect)

    return { borderTopLeftRadius: r, borderTopRightRadius: r }
  }

  if (frame === 'rounded') return { borderRadius: Math.min(ROUNDED_RADIUS * unit, rect.width / 2, rect.height / 2) }

  return undefined
}

/** A dark film frame with sprocket holes along the top and bottom, cut through to the paper. */
function Film({ unit, width, height, band }: { unit: number; width: number; height: number; band: number }) {
  const w = SPROCKET.width * unit
  const h = SPROCKET.height * unit
  const holes = sprockets(width / unit).flatMap((x) =>
    [(band - h) / 2, height - (band + h) / 2].map((y) => `M${x * unit} ${y}h${w}v${h}h${-w}Z`),
  )

  return (
    <Svg width={width} height={height} style={styles.abs}>
      <Path d={`M0 0H${width}V${height}H0Z ${holes.join(' ')}`} fillRule="evenodd" fill="#1d1b19" />
    </Svg>
  )
}

/** Gold outer and inner rules with a fan in each corner. */
function Deco({ unit, width, height }: { unit: number; width: number; height: number }) {
  const outer = 0.45 * unit
  const inner = 0.25 * unit
  const fan = 2.2 * unit
  const arc = 2.9 * unit
  const corners: [number, number, number, number][] = [
    [0, 0, 1, 1],
    [width, 0, -1, 1],
    [0, height, 1, -1],
    [width, height, -1, -1],
  ]

  return (
    <Svg width={width} height={height} style={styles.abs}>
      <Rect x={outer / 2} y={outer / 2} width={width - outer} height={height - outer} stroke={GOLD} strokeWidth={outer} fill="none" />
      <Rect
        x={1.4 * unit}
        y={1.4 * unit}
        width={width - 2.8 * unit}
        height={height - 2.8 * unit}
        stroke={GOLD}
        strokeWidth={inner}
        fill="none"
      />
      {corners.map(([cx, cy, sx, sy]) => {
        const sweep = sx * sy > 0 ? 1 : 0

        return (
          <G key={`${sx}${sy}`}>
            <Path d={`M${cx} ${cy}h${fan * sx}A${fan} ${fan} 0 0 ${sweep} ${cx} ${cy + fan * sy}Z`} fill={GOLD} />
            <Path
              d={`M${cx + arc * sx} ${cy}A${arc} ${arc} 0 0 ${sweep} ${cx} ${cy + arc * sy}`}
              stroke={GOLD}
              strokeWidth={inner}
              fill="none"
            />
          </G>
        )
      })}
    </Svg>
  )
}

/** Two strips of see-through tape across the photo's top corners. */
function Tape({ unit, width, height, rect }: { unit: number; width: number; height: number; rect: Box }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const length = TAPE.length * unit
  const across = TAPE.width * unit
  const by = TAPE.inset * unit
  const strips: [number, number, number, string][] = [
    [rect.left + by, rect.top + by, -45, TAPE.colors[0]],
    [rect.left + rect.width - by, rect.top + by, 45, TAPE.colors[1]],
  ]

  return (
    <Svg width={width} height={height} style={styles.abs}>
      <Defs>
        <Pattern id={`stripes${id}`} patternUnits="userSpaceOnUse" width={length} height={unit} y={-across / 2}>
          <Rect width={length} height={unit / 2} fill="rgba(255,255,255,0.35)" />
        </Pattern>
      </Defs>
      {strips.map(([cx, cy, angle, color]) => (
        <G key={angle} transform={`translate(${cx} ${cy}) rotate(${angle})`}>
          <Rect x={-length / 2} y={-across / 2} width={length} height={across} fill={withAlpha(color, 0.6)} />
          <Rect x={-length / 2} y={-across / 2} width={length} height={across} fill={`url(#stripes${id})`} />
        </G>
      ))}
    </Svg>
  )
}

/** What is printed over or around the photo's edge: keylines, corners and sprigs. */
function Trim({
  frame,
  look,
  unit,
  width,
  height,
  rect,
}: {
  frame: FrameStyle
  look: PaperLook
  unit: number
  width: number
  height: number
  rect: Box
}) {
  if (BANDS[frame]) return <Keyline rect={rect} weight={Math.max(1, 0.2 * unit)} color={ink(look, 0.22)} />

  switch (frame) {
    case 'mat':
      return <Keyline rect={rect} weight={Math.max(1, 0.25 * unit)} color={ink(look, 0.18)} />
    case 'tape':
      return <Tape unit={unit} width={width} height={height} rect={rect} />
    case 'botanical':
      return (
        <>
          <Keyline rect={rect} weight={Math.max(1, 0.18 * unit)} gap={1.6 * unit} color={ink(look, 0.6)} />
          <Sprig color={ink(look, 0.8)} unit={unit} style={{ top: -1.8 * unit, left: 1.4 * unit }} />
          <Sprig color={ink(look, 0.8)} unit={unit} style={{ bottom: -1.8 * unit, right: 1.4 * unit, transform: [{ rotate: '180deg' }] }} />
        </>
      )
    case 'corners': {
      const size = 5.5 * unit

      return (
        <Svg width={width} height={height} style={styles.abs}>
          <G fill={ink(look, 0.82)}>
            <Polygon points={`0,0 ${size},0 0,${size}`} />
            <Polygon points={`${width - size},0 ${width},0 ${width},${size}`} />
            <Polygon points={`0,${height - size} ${size},${height} 0,${height}`} />
            <Polygon points={`${width},${height - size} ${width},${height} ${width - size},${height}`} />
          </G>
        </Svg>
      )
    }
    default:
      return null
  }
}

/** A printed rule just outside the photo, `gap` away from it. */
function Keyline({ rect, weight, color, gap = 0 }: { rect: Box; weight: number; color: string; gap?: number }) {
  const out = gap + weight

  return (
    <View
      style={[
        styles.abs,
        {
          left: rect.left - out,
          top: rect.top - out,
          width: rect.width + out * 2,
          height: rect.height + out * 2,
          borderWidth: weight,
          borderColor: color,
        },
      ]}
    />
  )
}

/** A tint with a scalloped edge, like an old deckled print. */
function Deckle({ look, scallop, width, height }: { look: PaperLook; scallop: number; width: number; height: number }) {
  const r = scallop / 2
  const across = Array.from({ length: Math.ceil(width / scallop) }, (_, i) => r + i * scallop)
  const down = Array.from({ length: Math.ceil(height / scallop) }, (_, i) => r + i * scallop)

  return (
    <Svg width={width} height={height} style={styles.abs}>
      <G opacity={0.11} fill={ink(look)}>
        <Rect x={r} y={r} width={width - scallop} height={height - scallop} />
        {across.map((x) => (
          <G key={`x${x}`}>
            <Circle cx={x} cy={r} r={r} />
            <Circle cx={x} cy={height - r} r={r} />
          </G>
        ))}
        {down.map((y) => (
          <G key={`y${y}`}>
            <Circle cx={r} cy={y} r={r} />
            <Circle cx={width - r} cy={y} r={r} />
          </G>
        ))}
      </G>
    </Svg>
  )
}

/** A mat with a patterned band printed around it. */
function Band({
  frame,
  look,
  unit,
  band,
  width,
  height,
}: {
  frame: FrameStyle
  look: PaperLook
  unit: number
  band: number
  width: number
  height: number
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const ring = `M0 0H${width}V${height}H0Z M${band} ${band}V${height - band}H${width - band}V${band}Z`
  const gilt = Math.max(1, 0.35 * unit)

  return (
    <>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: look.frameTint }]} />
      <Svg width={width} height={height} style={styles.abs}>
        <Defs>
          <SvgGradient id={`wash${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#f0a993" />
            <Stop offset="0.3" stopColor="#f3d27c" />
            <Stop offset="0.62" stopColor="#9fd3bf" />
            <Stop offset="1" stopColor="#8fb6e2" />
          </SvgGradient>
          <Pattern id={`arcs${id}`} patternUnits="userSpaceOnUse" width={2.4 * unit} height={1.3 * unit}>
            {[
              [1.2, '#7ea7d8'],
              [0.9, '#79c2a2'],
              [0.6, '#f2c95c'],
              [0.3, '#e9967a'],
            ].map(([radius, color]) => (
              <Circle key={color} cx={1.2 * unit} cy={1.3 * unit} r={(radius as number) * unit} fill={color as string} />
            ))}
          </Pattern>
          {[45, -45].map((angle) => (
            <Pattern
              key={angle}
              id={`hatch${angle}${id}`}
              patternUnits="userSpaceOnUse"
              width={0.8 * unit}
              height={0.8 * unit}
              patternTransform={`rotate(${angle})`}
            >
              <Rect width={0.22 * unit} height={0.8 * unit} fill="rgba(180,138,50,0.75)" />
            </Pattern>
          ))}
          <Pattern id={`grain${id}`} patternUnits="userSpaceOnUse" width={1.5 * unit} height={4 * unit} patternTransform="rotate(8)">
            <Rect width={0.12 * unit} height={4 * unit} fill="rgba(110,70,30,0.4)" />
            <Rect x={0.55 * unit} width={0.25 * unit} height={4 * unit} fill="rgba(110,70,30,0.22)" />
          </Pattern>
        </Defs>
        {frame === 'watercolor' && <Path d={ring} fillRule="evenodd" fill={`url(#wash${id})`} opacity={0.7} />}
        {frame === 'arcs' && <Path d={ring} fillRule="evenodd" fill={`url(#arcs${id})`} opacity={0.8} />}
        {frame === 'gilt' && (
          <>
            <Path d={ring} fillRule="evenodd" fill="rgba(214,178,92,0.45)" />
            <Path d={ring} fillRule="evenodd" fill={`url(#hatch45${id})`} />
            <Path d={ring} fillRule="evenodd" fill={`url(#hatch-45${id})`} />
            <Rect x={gilt / 2} y={gilt / 2} width={width - gilt} height={height - gilt} stroke="#b48a32" strokeWidth={gilt} fill="none" />
          </>
        )}
        {frame === 'woodgrain' && (
          <G opacity={0.85}>
            <Path d={ring} fillRule="evenodd" fill="#cfa874" />
            <Path d={ring} fillRule="evenodd" fill={`url(#grain${id})`} />
          </G>
        )}
      </Svg>
    </>
  )
}

/** The photo cut to an oval. */
function OvalPhoto({
  photo,
  crop,
  natural,
  look,
  rect,
  width,
  height,
}: {
  photo: FlipbookPhoto | null
  crop: PhotoCrop
  natural: Size | null
  look: PaperLook
  rect: Box
  width: number
  height: number
}) {
  const id = `oval${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const drawn = crop.rect(rect, natural)

  return (
    <Svg width={width} height={height} style={styles.abs}>
      <Defs>
        <ClipPath id={id}>
          <Ellipse cx={width / 2} cy={height / 2} rx={rect.width / 2} ry={rect.height / 2} />
        </ClipPath>
      </Defs>
      {photo ? (
        <SvgImage
          href={{ uri: photo.src }}
          x={rect.left + drawn.left}
          y={rect.top + drawn.top}
          width={drawn.width}
          height={drawn.height}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${id})`}
        />
      ) : (
        <Ellipse cx={width / 2} cy={height / 2} rx={rect.width / 2} ry={rect.height / 2} fill={ink(look, 0.15)} />
      )}
    </Svg>
  )
}

/** Fades the photo's edges into the paper. */
function Feather({ look }: { look: PaperLook }) {
  const stops = [
    { offset: 0, color: look.background },
    { offset: 0.08, color: look.background, opacity: 0 },
    { offset: 0.92, color: look.background, opacity: 0 },
    { offset: 1, color: look.background },
  ]

  return (
    <>
      <Gradient stops={stops} to="right" />
      <Gradient stops={stops} to="bottom" />
    </>
  )
}

/** Leaves along a stem, alternating sides and shrinking toward the tip. */
const LEAVES = [14, 24, 34, 44, 54, 64, 74].map((x, i) => ({ x, angle: i % 2 ? 38 : -38, length: 26 - i * 2 }))

/** A sprig of leaves drawn in ink like a pen sketch, its stem along the frame rule. */
function Sprig({ color, unit, style }: { color: string; unit: number; style: ViewStyle }) {
  return (
    <Svg
      viewBox="0 0 100 40"
      width={26 * unit}
      height={10.4 * unit}
      style={[styles.abs, style]}
      fill="none"
      stroke={color}
      strokeLinecap="round"
    >
      <Path d="M4 20 Q 50 17, 92 20" strokeWidth={1.2} />
      {LEAVES.map(({ x, angle, length }) => (
        <G key={x} transform={`translate(${x} 20) rotate(${angle}) scale(${length / 20})`}>
          <Path d="M0 0 C 5 -5, 14 -5, 20 0 C 14 5, 5 5, 0 0 Z" strokeWidth={1} />
          <Path d="M2 0 L 16 0" strokeWidth={0.6} />
        </G>
      ))}
    </Svg>
  )
}

const styles = StyleSheet.create({
  box: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
  clip: { overflow: 'hidden' },
})
