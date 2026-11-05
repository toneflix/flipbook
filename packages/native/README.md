# @toneflix/flipbook-native

Turn any set of photos into an album that bends, settles and feels like paper, in React Native and Expo, with page turns drawn by native views. A page folds exactly where a finger bends it, photos sink into the paper's grain, and phones open the book sideways across two pages.

```bash
npx expo install @toneflix/flipbook-native react-native-svg expo-screen-orientation
```

`expo-screen-orientation` is optional: with it, the screen locks to landscape while the book is open; without it, phones held upright are asked to turn sideways.

```tsx
import { View } from 'react-native'
import { Flipbook } from '@toneflix/flipbook-native'

export function Book({ book }) {
  return (
    <View style={{ flex: 1 }}>
      <Flipbook book={book} fonts={{ serif: 'Fraunces_400Regular', serifItalic: 'Fraunces_400Regular_Italic' }} />
    </View>
  )
}
```

See the [documentation](https://toneflix.github.io/flipbook/guide/react-native).
