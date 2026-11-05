# Toneflix Flipbook

An expressive flipbook for creating personalised and interactive reading and photo viewing experiences. Toneflix Flipbook brings the same book to the web, Vue, React and React Native.

## Why this exists

For years, [turn.js](https://github.com/blasten/turn.js) was how the web turned pages. It showed what a flipbook in the browser could feel like, and then it stopped moving: no maintenance, no touch-first rethink, and no React or React Native.

When I needed a flipbook for [Toneflix Photos](https://photos.toneflix.net), I tried the modern route and asked coding agents to build one. Agents are good at plumbing and poor at craft. Prompted by a junior developer, or anyone who doesn't already know what a good page turn looks like, they produce a page that slides instead of folds, a shadow in the wrong place, photos pasted on top of the paper, a book that falls apart on a phone held upright. Getting from there to something that feels like a real album is hundreds of small decisions, and nobody should have to make them again.

So this library makes them once. Pass it a list of photos and you get the fold, the spring, the printed paper and the sideways phone layout, whether you're a person or an agent writing the integration. Everyone, and every agent, should be able to build something beautiful with a flipbook in it, without sweating the details.

**[Documentation, live demo and playground](https://toneflix.github.io/flipbook/)**

| Package                                        | For                                                               | npm                                                                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [`@toneflix/flipbook`](packages/vanilla)       | Any web page, no framework. Also a `<script>` tag build.          | [![npm](https://img.shields.io/npm/v/@toneflix/flipbook.svg)](https://www.npmjs.com/package/@toneflix/flipbook)               |
| [`@toneflix/flipbook-react`](packages/react)   | React 18 and up, including server rendering.                      | [![npm](https://img.shields.io/npm/v/@toneflix/flipbook-react.svg)](https://www.npmjs.com/package/@toneflix/flipbook-react)   |
| [`@toneflix/flipbook-vue`](packages/vue)       | Vue 3.                                                            | [![npm](https://img.shields.io/npm/v/@toneflix/flipbook-vue.svg)](https://www.npmjs.com/package/@toneflix/flipbook-vue)       |
| [`@toneflix/flipbook-native`](packages/native) | React Native and Expo.                                            | [![npm](https://img.shields.io/npm/v/@toneflix/flipbook-native.svg)](https://www.npmjs.com/package/@toneflix/flipbook-native) |
| [`@toneflix/flipbook-core`](packages/core)     | Page-turn physics and the book model, to build your own renderer. | [![npm](https://img.shields.io/npm/v/@toneflix/flipbook-core.svg)](https://www.npmjs.com/package/@toneflix/flipbook-core)     |

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

Built for [Toneflix Photos](https://photos.toneflix.net). Released under the [MIT License](LICENSE).

## Releasing

All packages share one version. Publishing a GitHub release tagged `v1.2.3` publishes them to npm, or run the **Publish** workflow by hand with a version. Pre-releases (`1.2.3-beta.1`) go out under the `next` tag. The workflow needs an `NPM_TOKEN` repository secret.
