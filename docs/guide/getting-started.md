# Getting started

Toneflix Flipbook is an expressive flipbook for creating personalised and interactive reading and photo viewing experiences: albums, stories, portfolios and keepsakes that people turn through rather than scroll past.

You describe a book as plain data. The same data looks and turns the same in every package, because they all share one framework-free core.

| Package                                                                                | For                                                      |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`@toneflix/flipbook`](https://www.npmjs.com/package/@toneflix/flipbook)               | Any web page, no framework. Also a `<script>` tag build. |
| [`@toneflix/flipbook-react`](https://www.npmjs.com/package/@toneflix/flipbook-react)   | React 18 and up, including server rendering.             |
| [`@toneflix/flipbook-vue`](https://www.npmjs.com/package/@toneflix/flipbook-vue)       | Vue 3.                                                   |
| [`@toneflix/flipbook-native`](https://www.npmjs.com/package/@toneflix/flipbook-native) | React Native and Expo.                                   |
| [`@toneflix/flipbook-core`](https://www.npmjs.com/package/@toneflix/flipbook-core)     | The physics and book model, to build your own renderer.  |

Every package re-exports the core, so you only install one.

## Install

::: code-group

```bash [React]
npm install @toneflix/flipbook-react
```

```bash [Vue]
npm install @toneflix/flipbook-vue
```

```bash [Vanilla]
npm install @toneflix/flipbook
```

```bash [React Native]
npx expo install @toneflix/flipbook-native react-native-svg expo-screen-orientation
```

:::

## Show a book

The viewer fills its parent, so give the parent a height. Web packages need their stylesheet once.

::: code-group

```tsx [React]
import { Flipbook } from '@toneflix/flipbook-react'
import '@toneflix/flipbook-react/style.css'

export function Book({ book }) {
  return (
    <div style={{ height: '100vh' }}>
      <Flipbook book={book} />
    </div>
  )
}
```

```vue [Vue]
<script setup>
import { Flipbook } from '@toneflix/flipbook-vue'
import '@toneflix/flipbook-vue/style.css'

defineProps(['book'])
</script>

<template>
  <div style="height: 100vh">
    <Flipbook :book="book" />
  </div>
</template>
```

```js [Vanilla]
import { Flipbook } from '@toneflix/flipbook'
import '@toneflix/flipbook/style.css'

const flipbook = new Flipbook(document.querySelector('#book'), { book })
```

```html [CDN]
<link rel="stylesheet" href="https://unpkg.com/@toneflix/flipbook/dist/style.css" />
<div id="book" style="height: 100vh"></div>
<script src="https://unpkg.com/@toneflix/flipbook"></script>
<script>
  new Flipbook.Flipbook(document.querySelector('#book'), { book })
</script>
```

```tsx [React Native]
import { View } from 'react-native'
import { Flipbook } from '@toneflix/flipbook-native'

export function Book({ book }) {
  return (
    <View style={{ flex: 1 }}>
      <Flipbook book={book} />
    </View>
  )
}
```

:::

## A first book

A book is plain data: a title, a few looks, and pages of photos.

```ts
import type { FlipbookBook } from '@toneflix/flipbook-react'

const book: FlipbookBook = {
  title: 'Places We Wandered',
  author: 'Ada',
  year: 2026,
  cover: { src: '/photos/lake.jpg' },
  theme: 'classic',
  paper: 'ivory',
  frame: 'mat',
  pages: [
    { layout: 'single', photos: [{ src: '/photos/lake.jpg' }], caption: 'First light' },
    { layout: 'pair', photos: [{ src: '/photos/dunes.jpg' }, { src: '/photos/moon.jpg' }] },
  ],
}
```

[Books and pages](./books) covers every field. To try options without installing anything, open the [playground](/playground).

## Fonts

Book text uses the Fraunces serif when it's available and falls back to Georgia. Load Fraunces from [Google Fonts](https://fonts.google.com/specimen/Fraunces) to match these docs, or set your own face with the `--fb-serif` custom property on the web and the `fonts` prop on React Native.
