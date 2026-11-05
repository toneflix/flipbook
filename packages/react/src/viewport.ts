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
