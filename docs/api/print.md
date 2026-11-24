# Print

`@toneflix/flipbook-print` draws a book's pages in Node.js with Skia, without a browser. See [Printing on a server](/guide/printing#printing-on-a-server).

## BookPrinter

```ts
const printer = new BookPrinter(book, { shortSide: 210, dpi: 300, load: (src) => readFile(src) })
```

| Member         |                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `faces`        | The faces printed, in reading order.                                                                                                                                   |
| `names`        | A file name for each face: `cover`, `title`, `page-1`, …, `colophon`, `back`. Panoramas are `page-2-left` and `page-2-right`, blanks before them `blank-1`, `blank-2`. |
| `scene(face)`  | The face's scene from core.                                                                                                                                            |
| `png(face)`    | One page as a PNG at `dpi`.                                                                                                                                            |
| `pixels(face)` | One page as `{ data, width, height }`, RGBA.                                                                                                                           |
| `canvas(face)` | One page on a Skia canvas.                                                                                                                                             |
| `pdf()`        | The whole book as one PDF, each page `width` × `height` millimetres.                                                                                                   |

## SkiaPainter

Draws any scene on a Skia canvas: `paint(ctx, scene, scale)`, where `scale` is pixels or points per page unit. Use it to draw scenes of your own, such as thumbnails.

## Page scenes

Scenes come from `PageScene` in core, and the covers from its `CoverScene`. A scene is plain data: fills, strokes, photos, text and groups in page units, where 1 unit is 1% of the page's short side. Any renderer that can fill shapes, draw images and set text can draw one. `PageScene` takes a `TextMeasure` from the renderer, so lines break where that renderer will draw them.

```ts
import { PageScene } from '@toneflix/flipbook-core'

const scenes = new PageScene(book, measure)
const scene = scenes.page(book.pages[0], { number: 1, side: 'right' })
```
