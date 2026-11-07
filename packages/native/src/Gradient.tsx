import { useId, useState } from 'react'
import { StyleSheet, View, type LayoutRectangle, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

export interface GradientStop {
  offset: number
  color: string
  opacity?: number
}

/** A linear gradient filling its box, drawn with react-native-svg at the box's measured size so it needs no other native module. */
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
  const [box, setBox] = useState<Pick<LayoutRectangle, 'width' | 'height'> | null>(null)
  const [x1, y1, x2, y2] = { right: [0, 0, 1, 0], left: [1, 0, 0, 0], bottom: [0, 0, 0, 1], top: [0, 1, 0, 0] }[to]

  return (
    <View
      style={style}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout

        setBox((old) => (old?.width === width && old?.height === height ? old : { width, height }))
      }}
    >
      {box && box.width > 0 && box.height > 0 && (
        <Svg width={box.width} height={box.height}>
          <Defs>
            <LinearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
              {stops.map((stop, i) => (
                <Stop key={i} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity ?? 1} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width={box.width} height={box.height} fill={`url(#${id})`} />
        </Svg>
      )}
    </View>
  )
}

/** Stops for a colour given as `rgba(r,g,b,a)`, split so svg gets the alpha separately. */
