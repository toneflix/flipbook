# Toneflix Flipbook

A photo book you can hold. Pages peel, fold and fall with real physics, photos are printed into textured paper, and phones read the book sideways like the real thing.

**[Documentation, live demo and playground](https://toneflix.github.io/flipbook/)**

| Package                                        | For                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| [`@toneflix/flipbook`](packages/vanilla)       | Any web page, no framework. Also a `<script>` tag build.          |
| [`@toneflix/flipbook-react`](packages/react)   | React 18 and up, including server rendering.                      |
| [`@toneflix/flipbook-vue`](packages/vue)       | Vue 3.                                                            |
| [`@toneflix/flipbook-native`](packages/native) | React Native and Expo.                                            |
| [`@toneflix/flipbook-core`](packages/core)     | Page-turn physics and the book model, to build your own renderer. |

```tsx
import { Flipbook } from '@toneflix/flipbook-react'
import '@toneflix/flipbook-react/style.css'

;<div style={{ height: '100vh' }}>
  <Flipbook book={{ title: 'Places We Wandered', pages: [{ layout: 'single', photos: [{ src: '/lake.jpg' }] }] }} />
</div>
```

## Development

```bash
pnpm install
pnpm build       # all packages
pnpm test        # core physics and layout tests
pnpm docs:dev    # docs site at http://localhost:5173/flipbook/
```

Built for [Toneflix Photos](https://github.com/toneflix/photos). Released under the [MIT License](LICENSE).
