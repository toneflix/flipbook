# Paper, frames and covers

Photos aren't pasted on top of the page. They take on the paper's ink, sit under its grain, and curve with it into the spine, so a page looks printed.

## Paper

| `paper`    |                                                   |
| ---------- | ------------------------------------------------- |
| `ivory`    | Warm, lightly textured. The default.              |
| `white`    | Bright and clean.                                 |
| `kraft`    | Brown, fibrous, photos warmed toward sepia.       |
| `charcoal` | Dark board with pale ink, photos slightly dimmed. |

`PAPER_COLORS` lists them with a swatch colour for pickers.

## Frames

Every frame is printed into the paper: rules, tints, a pressed plate, never a raised border. A photo's `frame` wins over its page's, a page's wins over the book's, and full-bleed pages are never framed. `photoFrame(page, photo, book.frame)` gives the frame a photo ends up with.

| `frame`      |                                                 |
| ------------ | ----------------------------------------------- |
| `none`       | The photo printed straight onto the page.       |
| `hairline`   | A fine printed rule.                            |
| `double`     | Two rules, like a classic album keyline.        |
| `mat`        | A wide printed mat with a thin frame line.      |
| `corners`    | Printed album corners.                          |
| `deckle`     | A vintage print with a scalloped border.        |
| `plate`      | A plate pressed into the paper.                 |
| `feather`    | The photo fades into the paper.                 |
| `oval`       | An oval cameo inside a fine ring.               |
| `botanical`  | Line-drawn sprigs of leaves around a fine rule. |
| `watercolor` | A wash of soft colour around a mat.             |
| `arcs`       | A border of little rainbow arcs.                |
| `gilt`       | An engraved border in gold ink.                 |
| `woodgrain`  | A printed woodgrain border.                     |

`FRAME_STYLES` has a label and a one-line description for each.

## Covers

`coverDesign` sets how the front board is made. Every design is printed into the cloth you pick, with the same grain, sheen and hinge, so any design suits any book.

| Design    |                                                                                |
| --------- | ------------------------------------------------------------------------------ |
| `classic` | A ruled panel with the title over an inset photo. The default.                 |
| `gilt`    | Gold rules and corner flourishes around an oval portrait.                      |
| `window`  | The photo set into a window pressed into the board, the title stamped below.   |
| `label`   | A print held by photo corners over a paper title label.                        |
| `deco`    | Gold rays rising to an arched photo.                                           |
| `image`   | Your `cover` photo across the whole board, finished and tinted like the cloth. |

The `image` design is for a cover that is all picture. It carries no text unless you ask for it with `coverText: true`, which lays the title over the foot of the image. Any other design prints its title by default, and `coverText: false` leaves it off.

```ts
const book = {
  title: 'Amaka & Tobi',
  cover: { src: '/wedding/portrait.jpg' },
  coverDesign: 'image',
  theme: 'midnight',
  // ...
}
```

`theme` picks the cloth: `classic` (oxblood with gold ink), `linen` (natural with brown ink), `midnight` (navy with silver ink), `leather` (tan with gold ink), `sage` (green with cream ink) or `blush` (rose with plum ink). The stage behind the book is tinted to match unless you pass `background`.

`COVER_DESIGNS` and `COVER_THEMES` have a label for each, for building a picker. `coverHasText(book)` tells you whether a book's cover will carry its title.

## Restyling on the web

All classes start with `fb-`. These custom properties can be set on `.fb-root` or any parent:

| Property         |                                         |
| ---------------- | --------------------------------------- |
| `--fb-serif`     | The book face, Fraunces by default.     |
| `--fb-sans`      | The viewer's controls.                  |
| `--fb-accent`    | The highlighted slot in an editor.      |
| `--fb-highlight` | The current thumbnail and drop targets. |

The paper textures ship next to the stylesheet. Bundlers like Vite and webpack pick them up from the CSS on their own.

## Printing a book

`FlipbookPrint` lays a whole book flat, one sheet per page, so it can be printed or saved as a PDF from the browser's print dialog. The sheets are drawn by the same renderers as the viewer: front cover, title page, every page, colophon and back cover, each with its paper, frames and captions. The light and spine curve of a turning page are left off, since the bound book makes its own.

```js
import { FlipbookPrint } from '@toneflix/flipbook'
import '@toneflix/flipbook/style.css'

const print = new FlipbookPrint(document.querySelector('#print'), book, { width: 210 })

await print.print()
```

| Option   |                                                                                |
| -------- | ------------------------------------------------------------------------------ |
| `width`  | Page width in millimetres. The height follows the 3:4 page. Defaults to `210`. |
| `covers` | Include the front and back covers. Defaults to `true`.                         |

`ready()` resolves once fonts and photos have loaded, `print()` waits for it and opens the print dialog, and `destroy()` removes the sheets. The print page size is set to match the sheets with no margins. In a headless browser, call `ready()` and then save the page as a PDF with the page's own size.
