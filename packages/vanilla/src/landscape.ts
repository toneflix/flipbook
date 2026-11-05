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

/** Media queries that decide whether a phone is held upright. */
export function watchOrientation(onChange: (state: { portrait: boolean; touch: boolean }) => void) {
  const portrait = matchMedia('(orientation: portrait)')
  const touch = matchMedia('(pointer: coarse)')
  const update = () => onChange({ portrait: portrait.matches, touch: touch.matches })

  update()
  portrait.addEventListener('change', update)
  touch.addEventListener('change', update)
  window.addEventListener('resize', update)

  return () => {
    portrait.removeEventListener('change', update)
    touch.removeEventListener('change', update)
    window.removeEventListener('resize', update)
  }
}
