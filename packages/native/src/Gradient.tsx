import { useId } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

export interface GradientStop {
  offset: number
  color: string
  opacity?: number
}

/** A linear gradient filling its box, drawn with react-native-svg so it needs no other native module. */
export function Gradient({
  stops,
  to = 'right',
  style = StyleSheet.absoluteFill,
}: {
  stops: GradientStop[]
  /** Where the last stop lies. */
  to?: 'right' | 'left' | 'bottom' | 'top'
  style?: StyleProp<ViewStyle>
}) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [x1, y1, x2, y2] = { right: [0, 0, 1, 0], left: [1, 0, 0, 0], bottom: [0, 0, 0, 1], top: [0, 1, 0, 0] }[to]

  return (
    <Svg style={style} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
          {stops.map((stop, i) => (
            <Stop key={i} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity ?? 1} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  )
}

/** Stops for a colour given as `rgba(r,g,b,a)`, split so svg gets the alpha separately. */
