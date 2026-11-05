# Viewer options

The React, Vue and vanilla viewers share these options. React and Vue take them as props; the vanilla `Flipbook` takes them as its second argument and in `update()`.

| Option             | Type                             | Default    |                                                                          |
| ------------------ | -------------------------------- | ---------- | ------------------------------------------------------------------------ |
| `book`             | `FlipbookBook`                   | required   | The [book](/guide/books).                                                |
| `startPage`        | `number`                         |            | Open at this page (1-based) instead of the cover.                        |
| `layout`           | `'auto' \| 'spread' \| 'single'` | `'auto'`   | Two pages, one page, or whichever fits the box.                          |
| `controls`         | `boolean`                        | `true`     | Show the top and bottom bars.                                            |
| `autoHide`         | `number \| false`                | `3200`     | Hide the bars after this many ms without movement.                       |
| `thumbnails`       | `boolean`                        | `true`     | Page thumbnails in the bottom bar.                                       |
| `sound`            | `boolean`                        | `false`    | Play a paper sound on each turn.                                         |
| `soundButton`      | `boolean`                        | `true`     | Let readers switch the sound. Their choice is remembered.                |
| `fullscreenButton` | `boolean`                        | `true`     |                                                                          |
| `landscape`        | `boolean`                        | `true`     | Ask phones held upright to [turn sideways](/guide/landscape).            |
| `keyboard`         | `boolean \| 'global'`            | `true`     | Arrow, Page and Home/End keys while the book has focus, or anywhere.     |
| `stiffCovers`      | `boolean`                        | `true`     | Covers swing like board instead of curling.                              |
| `physics`          | `Partial<TurnPhysics>`           |            | [Spring tuning](/guide/turning#physics).                                 |
| `grip`             | `Partial<GripOptions>`           |            | [Where pages can be grabbed](/guide/turning#physics).                    |
| `shading`          | `number`                         | `1`        | Strength of the light and shadow around a turning page.                  |
| `background`       | `string`                         | cover glow | Any CSS background behind the book.                                      |
| `labels`           | `Partial<FlipbookLabels>`        | English    | Button and status text, for translation.                                 |
| `onPageChange`     | `(place) => void`                |            | `place` is `{ flipped, label, faces }`. In Vue, the `page-change` event. |
| `onFlip`           | `() => void`                     |            | A page started to turn over. In Vue, the `flip` event.                   |

React also takes `topLeft`, `topRight` (extra top-bar content), `className` and `style`.

## React Native

The native viewer takes the same options except `sound`, `soundButton`, `fullscreenButton` and `keyboard`, and adds:

| Prop                  | Type                              |                                             |
| --------------------- | --------------------------------- | ------------------------------------------- |
| `fonts`               | `{ serif?, serifItalic?, sans? }` | Loaded font family names for book text.     |
| `topLeft`, `topRight` | `ReactNode`                       | Extra top-bar content, e.g. a close button. |
| `style`               | `StyleProp<ViewStyle>`            |                                             |

`landscape` locks the screen to landscape when `expo-screen-orientation` is installed.

## Handle

React and React Native refs, Vue's exposed methods, and the vanilla instance all have:

|                    |                                                                           |
| ------------------ | ------------------------------------------------------------------------- |
| `next()`, `prev()` | Turn one page.                                                            |
| `goToPage(page)`   | Open at a page (1-based).                                                 |
| `go(flipped)`      | Open with this many leaves on the left. 0 is the closed front cover.      |
| `reader`           | The [`FlipbookReader`](./core#flipbookreader). In Vue, `instance.reader`. |

## Labels

`DEFAULT_LABELS` holds the English text. Override any of it:

```tsx
<Flipbook book={book} labels={{ next: 'Page suivante', previous: 'Page précédente', byline: (author) => `par ${author}` }} />
```

## CSS custom properties

Set these on the viewer or any ancestor (web only).

| Property         |                                                                 |
| ---------------- | --------------------------------------------------------------- |
| `--fb-serif`     | Book text face. Defaults to Fraunces, then Georgia.             |
| `--fb-sans`      | Controls and captions.                                          |
| `--fb-accent`    | The selected slot in editors.                                   |
| `--fb-highlight` | The current thumbnail, and a slot with a photo dragged over it. |
