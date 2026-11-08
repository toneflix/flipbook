import { useEffect, useMemo, useRef, useState } from 'react'
import { Image, PanResponder, StyleSheet, View, type GestureResponderEvent } from 'react-native'
import { PhotoCrop, type FlipbookPhoto, type PhotoPosition, type Size } from '@toneflix/flipbook-core'

/** The photo's own size: from the photo data, else read from the image once. */
export function useNaturalSize(photo: Pick<FlipbookPhoto, 'src' | 'width' | 'height'> | null): Size | null {
  const known = photo?.width && photo.height ? { width: photo.width, height: photo.height } : null
  const [read, setRead] = useState<{ src: string; size: Size } | null>(null)

  useEffect(() => {
    if (known || !photo) return

    let live = true

    Image.getSize(
      photo.src,
      (width, height) => live && setRead({ src: photo.src, size: { width, height } }),
      () => undefined,
    )

    return () => {
      live = false
    }
  }, [photo?.src, !!known])

  return known ?? (read && read.src === photo?.src ? read.size : null)
}

const spread = (e: GestureResponderEvent) => {
  const [a, b] = e.nativeEvent.touches

  return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0
}

/**
 * Drag to move a photo in its box and pinch to zoom it. Returns the position to draw, which follows the
 * fingers, and the handlers for the box. `onChange` gets the new position when the fingers lift; without it
 * the photo stays put. `onGesture` hears when fingers go down and lift, e.g. to pause a scroll view.
 */
export function usePhotoGestures(
  position: Partial<PhotoPosition> | null | undefined,
  box: Size,
  image: Size | null,
  onChange?: (position: PhotoPosition) => void,
  onGesture?: (active: boolean) => void,
) {
  const [moving, setMoving] = useState<PhotoCrop | null>(null)
  const latest = useRef({ position, box, image, onChange, onGesture })

  latest.current = { position, box, image, onChange, onGesture }

  useEffect(() => setMoving(null), [position?.x, position?.y, position?.zoom])

  const responder = useMemo(() => {
    let crop = PhotoCrop.CENTRE
    let last = { dx: 0, dy: 0 }
    let pinch = { spread: 0, zoom: 1 }

    const finish = () => {
      const { position, onChange, onGesture } = latest.current

      onGesture?.(false)
      if (crop.equals(position)) setMoving(null)
      else onChange?.(crop.toJSON())
    }

    return PanResponder.create({
      onStartShouldSetPanResponder: () => !!latest.current.onChange,
      onMoveShouldSetPanResponder: () => !!latest.current.onChange,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        latest.current.onGesture?.(true)
        crop = PhotoCrop.of(latest.current.position)
        last = { dx: 0, dy: 0 }
        pinch = { spread: spread(e), zoom: crop.zoom }
      },
      onPanResponderMove: (e, { dx, dy }) => {
        const now = spread(e)

        if (now && pinch.spread) crop = crop.zoomTo((pinch.zoom * now) / pinch.spread)
        else if (now) pinch = { spread: now, zoom: crop.zoom }
        else {
          pinch.spread = 0
          crop = crop.pan(dx - last.dx, dy - last.dy, latest.current.box, latest.current.image)
        }

        last = { dx, dy }
        setMoving(crop)
      },
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    })
  }, [])

  return { crop: moving ?? PhotoCrop.of(position), handlers: onChange ? responder.panHandlers : {} }
}

export interface CroppedImageProps {
  photo: FlipbookPhoto
  crop: PhotoCrop
  /** The box the photo covers, which this fills. */
  box: Size
  image: Size | null
}

/** A photo covering its box, moved and zoomed by `crop`. Android decodes it at the size it is drawn, not the photo's full size. */
export function CroppedImage({ photo, crop, box, image }: CroppedImageProps) {
  const rect = crop.rect(box, image)

  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]}>
      <Image
        source={{ uri: photo.src }}
        style={[styles.abs, rect]}
        resizeMode="cover"
        resizeMethod="resize"
        aria-label={photo.alt ?? undefined}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  clip: { overflow: 'hidden' },
})
