# React Native

```bash
npx expo install @toneflix/flipbook-native react-native-svg expo-screen-orientation
```

`expo-screen-orientation` is optional. With it, the book [locks the screen to landscape](/guide/landscape) while it's open.

```tsx
import { View } from 'react-native'
import { Flipbook } from '@toneflix/flipbook-native'

export default function Reader({ book }) {
  return (
    <View style={{ flex: 1 }}>
      <Flipbook book={book} fonts={{ serif: 'Fraunces_400Regular', serifItalic: 'Fraunces_400Regular_Italic' }} />
    </View>
  )
}
```

The native viewer uses the same [reader](/api/core#flipbookreader) and spring as the web, so a page grabbed by its corner folds along the same line and falls with the same weight. Each turning page is drawn with native views (a rotated window clipped along the fold), so it runs on the UI thread without a canvas.

## Differences from the web

- **Fonts**: pass loaded font family names through `fonts` (`serif`, `serifItalic`, `sans`). It defaults to Georgia on iOS and the system serif on Android.
- **Sound**: there's no built-in sound. Play your own in `onFlip`, e.g. with `expo-audio`.
- **No keyboard or hover peek**: touches drag, and taps on the outer half of a page turn it.
- **Textures** ship as images inside the package and need no setup.

## Pages outside the viewer

`PageView`, `CoverView`, `TitlePageView`, `ColophonView`, `BackCoverView`, `BlankPageView` and `PrintedPhoto` take a `width` and keep the 3:4 page shape (`PAGE_RATIO`). Wrap them in `BookLookProvider` to set the paper and frame.

```tsx
import { BookLookProvider, PageView } from '@toneflix/flipbook-native'

;<BookLookProvider paper="kraft" frame="mat">
  <PageView page={book.pages[0]} width={160} number={1} onSlotPress={(slot) => pick(slot)} />
</BookLookProvider>
```

All props are listed under [Viewer options](/api/options#react-native).
