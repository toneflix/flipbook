# @toneflix/flipbook-native

A photo book for React Native and Expo. Pages peel, fold and fall with real physics, photos are printed into textured paper, and the book reads sideways like the real thing.

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
