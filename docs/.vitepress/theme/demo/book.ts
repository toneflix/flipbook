import type { FlipbookBook, FlipbookPage, FlipbookPhoto, FrameStyle, PageLayout } from '@toneflix/flipbook-react'
import manifest from '../../../public/demo/photos.json'

/** The demo photos, painted by `scripts/demo-photos.mjs`. */
export const photos: FlipbookPhoto[] = manifest.map(({ name, width, height }) => ({
  src: `${import.meta.env.BASE_URL}demo/${name}.jpg`,
  alt: name.replace('-', ' '),
  width,
  height,
}))

const captions = [
  'First light over the lake',
  'Snow on the high pass',
  'The moon kept us company',
  'Dunes at the end of the road',
  'The valley after rain',
  'Our last evening by the sea',
  'Mist in the pines',
  'October on the ridge',
  'Blue hour, coming home',
  'A slow morning in the meadow',
  'Red rock and long shadows',
  'The sky lit up at midnight',
]

const plan: [PageLayout, number[], string | null, FrameStyle?][] = [
  ['single', [0], captions[0]],
  ['framed', [1], captions[1]],
  ['pair', [2, 3], null],
  ['grid', [4, 5, 6, 7], 'Four days on foot'],
  ['text', [], 'We packed light and took the long way, stopping wherever the light was good.'],
  ['collage', [8, 9, 10], null],
  ['framed', [11], captions[11]],
  ['scatter', [2, 6, 9], 'Prints from the road'],
  [
    'story',
    [3],
    'The dunes went on for miles. We walked until the wind filled our footprints behind us, then sat at the top and watched the light go.',
  ],
  ['mosaic', [10, 4, 7], null, 'hairline'],
  ['single', [5], captions[5]],
]

/** Builds pages that cycle through the demo layouts. */
export function demoPages(count = plan.length): FlipbookPage[] {
  return Array.from({ length: count }, (_, i) => {
    const [layout, slots, caption, frame] = plan[i % plan.length]
    const pick = (s: number, slot: number) => {
      const photo = photos[(s + Math.floor(i / plan.length)) % photos.length]

      return frame && slot > 0 ? { ...photo, frame } : photo
    }

    return { layout, photos: slots.map(pick), caption }
  })
}

export const demoBook: FlipbookBook = {
  title: 'Places We Wandered',
  subtitle: 'A year of walking somewhere new',
  author: 'Toneflix',
  year: 2026,
  kicker: 'A photo book',
  cover: photos[0],
  theme: 'classic',
  coverDesign: 'gilt',
  paper: 'ivory',
  frame: 'mat',
  colophon: 'Preserved for all time.',
  imprint: 'Toneflix Flipbook',
  pages: demoPages(),
}
