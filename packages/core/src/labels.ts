/** Words shown by the viewers, for translation. */
export interface FlipbookLabels {
  previous: string
  next: string
  soundOn: string
  soundOff: string
  fullscreen: string
  exitFullscreen: string
  byline: (author: string) => string
  rotateTitle: string
  rotateBody: string
  rotateFullscreen: string
  rotateSingle: string
}

export const DEFAULT_LABELS: FlipbookLabels = {
  previous: 'Previous page',
  next: 'Next page',
  soundOn: 'Turn page sound on',
  soundOff: 'Turn page sound off',
  fullscreen: 'Full screen',
  exitFullscreen: 'Exit full screen',
  byline: (author) => `by ${author}`,
  rotateTitle: 'Turn your phone sideways',
  rotateBody: 'Photo books open across two pages, just like the real thing.',
  rotateFullscreen: 'Open full screen',
  rotateSingle: 'Read one page at a time',
}
