type ScreenOrientationModule = {
  OrientationLock: { LANDSCAPE: number }
  getOrientationLockAsync(): Promise<number>
  lockAsync(lock: number): Promise<void>
}

/** `expo-screen-orientation`, when the app has it installed. */
const screenOrientation: ScreenOrientationModule | null = (() => {
  try {
    return require('expo-screen-orientation')
  } catch {
    return null
  }
})()

/**
 * Locks the screen to landscape and resolves to a function that restores the previous lock, or
 * to null when the screen can't be locked.
 */
export async function lockLandscape(): Promise<(() => void) | null> {
  if (!screenOrientation) return null

  try {
    const previous = await screenOrientation.getOrientationLockAsync()

    await screenOrientation.lockAsync(screenOrientation.OrientationLock.LANDSCAPE)

    return () => void screenOrientation.lockAsync(previous).catch(() => {})
  } catch {
    return null
  }
}
