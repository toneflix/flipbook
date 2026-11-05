import { useEffect, useState, type RefObject } from 'react'

/** Whether the device is a phone or tablet held upright. `ready` stays false during SSR so the server never guesses. */
export function useOrientation() {
  const [state, setState] = useState({ ready: false, portrait: false, touch: false })

  useEffect(() => {
    const portraitQuery = matchMedia('(orientation: portrait)')
    const touchQuery = matchMedia('(pointer: coarse)')
    const update = () => setState({ ready: true, portrait: portraitQuery.matches, touch: touchQuery.matches })

    update()
    portraitQuery.addEventListener('change', update)
    touchQuery.addEventListener('change', update)
    window.addEventListener('resize', update)

    return () => {
      portraitQuery.removeEventListener('change', update)
      touchQuery.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return state
}

/** Size of an element, updated as it resizes. */
export function useElementSize<T extends HTMLElement>(ref: RefObject<T | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current

    if (!el) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect

      setSize({ width, height })
    })

    observer.observe(el)

    return () => observer.disconnect()
  }, [ref])

  return size
}

/**
 * Goes full screen and locks the screen to landscape where the browser allows it (Chrome on
 * Android). iOS Safari supports neither for pages, so callers keep the rotate prompt there.
 */
export async function enterLandscape(el: HTMLElement): Promise<boolean> {
  try {
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' })
  } catch {
    // Full screen refused; locking will fail too.
  }

  try {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: 'landscape') => Promise<void> }

    if (orientation?.lock) {
      await orientation.lock('landscape')
      return true
    }
  } catch {
    // Not supported on this browser.
  }

  return false
}
