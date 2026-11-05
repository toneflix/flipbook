# Toneflix Flipbook

**Photos deserve a book.** Toneflix Flipbook turns any set of photos into an album that bends, settles and feels like paper.

- **A page that answers your hand.** It folds exactly where a finger bends it and drifts open or shut with the weight of the flick.
- **Printed, not pasted.** Photos take on the paper's ink and grain, with fourteen frames, twelve layouts and four paper stocks.
- **Opens like a book on phones.** Turn the phone sideways and the album lies open across two pages.
- **One book, every screen.** The same book data and physics in plain JavaScript, Vue, React and React Native.

## Why this exists

For years, [turn.js](https://github.com/blasten/turn.js) was how the web turned pages. It showed what a flipbook in the browser could feel like, and then it stopped moving: no maintenance, no touch-first rethink, and no React or React Native.

When I needed a flipbook for Toneflix Photos, I tried the modern route and asked coding agents to build one. Agents are good at plumbing and poor at craft. Prompted by a junior developer, or anyone who doesn't already know what a good page turn looks like, they produce a page that slides instead of folds, a shadow in the wrong place, photos pasted on top of the paper, a book that falls apart on a phone held upright. Getting from there to something that feels like a real album is hundreds of small decisions, and nobody should have to make them again.

So this library makes them once. Pass it a list of photos and you get the fold, the spring, the printed paper and the sideways phone layout, whether you're a person or an agent writing the integration. Everyone, and every agent, should be able to build something beautiful with a flipbook in it, without sweating the details.

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

## Releasing

All packages share one version. Publishing a GitHub release tagged `v1.2.3` publishes them to npm, or run the **Publish** workflow by hand with a version. Pre-releases (`1.2.3-beta.1`) go out under the `next` tag. The workflow needs an `NPM_TOKEN` repository secret.
