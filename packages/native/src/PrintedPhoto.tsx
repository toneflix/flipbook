import { useId, useState } from 'react'
import { Image, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native'
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
import { BANDED_FRAMES, type FlipbookPhoto, type FrameStyle } from '@toneflix/flipbook-core'
import { Gradient } from './Gradient'
import { ink, usePaper, type PaperLook } from './look'

type Box = { left: number; top: number; width: number; height: number }

const BANDS = BANDED_FRAMES

/** The space inside the frame line (pad) and the frame line itself, in page units. Mirrors the web's .frame-* styles. */
function measure(frame: FrameStyle, unit: number) {
  const band = BANDS[frame]

  if (band) return { pad: (band + 2.6) * unit, line: 0 }

  switch (frame) {
    case 'hairline':
      return { pad: 1.6 * unit, line: Math.max(1, 0.22 * unit) }
    case 'double':
      return { pad: 1.4 * unit, line: Math.max(3, 0.7 * unit) }
    case 'mat':
      return { pad: 4.5 * unit, line: Math.max(1, 0.7 * unit) }
    case 'corners':
      return { pad: 0.7 * unit, line: 0 }
    case 'deckle':
      return { pad: 2.6 * unit, line: 0 }
    case 'plate':
      return { pad: 3.2 * unit, line: 0 }
    case 'oval':
      return { pad: 1.5 * unit, line: Math.max(1, 0.22 * unit) }
    case 'botanical':
      return { pad: 5 * unit, line: 0 }
    default:
      return { pad: 0, line: 0 }
  }
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
}

export function PrintedPhoto({ photo, frame, unit, fit = 'cover', show = true }: PrintedPhotoProps) {
  const look = usePaper()
  const [box, setBox] = useState<{ width: number; height: number } | null>(null)
  const { pad, line } = measure(frame, unit)
  const edge = pad + line
  const ratio = photo?.width && photo.height ? photo.width / photo.height : 4 / 3

  let width = box?.width ?? 0
  let height = box?.height ?? 0

  if (box && fit === 'contain') {
    width = Math.min(box.width, (box.height - 2 * edge) * ratio + 2 * edge)
    height = (width - 2 * edge) / ratio + 2 * edge
  }

  const inner: Box = { left: edge, top: edge, width: Math.max(0, width - 2 * edge), height: Math.max(0, height - 2 * edge) }

  return (
    <View style={styles.box} onLayout={(event: LayoutChangeEvent) => setBox(event.nativeEvent.layout)}>
      {box && (
        <View style={{ width, height }}>
          <Backing frame={frame} look={look} unit={unit} width={width} height={height} line={line} />
          {frame === 'oval' ? (
            <OvalPhoto photo={show ? photo : null} look={look} rect={inner} width={width} height={height} line={line} />
          ) : (
            <View style={[styles.abs, inner]}>
              {photo && show ? (
                <Image source={{ uri: photo.src }} style={StyleSheet.absoluteFill} resizeMode="cover" aria-label={photo.alt ?? undefined} />
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
}: {
  frame: FrameStyle
  look: PaperLook
  unit: number
  width: number
  height: number
  line: number
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
    default:
      return null
  }
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
  look,
  rect,
  width,
  height,
}: {
  photo: FlipbookPhoto | null
  look: PaperLook
  rect: Box
  width: number
  height: number
  line: number
}) {
  const id = `oval${useId().replace(/[^a-zA-Z0-9]/g, '')}`

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
          x={rect.left}
          y={rect.top}
          width={rect.width}
          height={rect.height}
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
})
