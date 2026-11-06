import { useCallback, useEffect, useRef } from 'react'
import { PhotoPositioner } from '@toneflix/flipbook'
import type { PhotoPosition } from '@toneflix/flipbook-core'

/**
 * Attaches a `PhotoPositioner` to the element given to the returned ref, so people can drag, pinch,
 * scroll or use the keyboard to choose which part of its photo shows. Without `onChange` it does nothing.
 */
export function usePhotoPositioner(position: Partial<PhotoPosition> | null | undefined, onChange?: (position: PhotoPosition) => void) {
  const positioner = useRef<PhotoPositioner | null>(null)
  const latest = useRef({ position, onChange })

  latest.current = { position, onChange }

  useEffect(() => {
    if (positioner.current) positioner.current.position = position
  }, [position?.x, position?.y, position?.zoom])

  const enabled = !!onChange

  return useCallback(
    (el: HTMLElement | null) => {
      positioner.current?.destroy()
      positioner.current =
        el && enabled
          ? new PhotoPositioner(el, { position: latest.current.position, onChange: (next) => latest.current.onChange?.(next) })
          : null
    },
    [enabled],
  )
}
