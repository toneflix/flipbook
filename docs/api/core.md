# Core

`@toneflix/flipbook-core` holds everything that isn't drawing: the book model, the page-turn spring and the reader that turns pointers into turns. Every package re-exports it. Use it directly to render a book somewhere new, such as a canvas or another UI framework.

## Book model

| Export                                                 |                                                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `FlipbookBook`, `FlipbookPage`, `FlipbookPhoto`        | The data types. See [Books and pages](/guide/books).                                     |
| `PageLayout`, `CoverTheme`, `PaperColor`, `FrameStyle` | Option unions.                                                                           |
| `PAGE_LAYOUTS`                                         | `{ label, slots }` per layout.                                                           |
| `COVER_THEMES`                                         | `{ label, cloth, ink, stage }` per theme.                                                |
| `PAPER_COLORS`                                         | `{ label, swatch }` per paper.                                                           |
| `FRAME_STYLES`                                         | `{ label, description }` per frame.                                                      |
| `frameOf(page, book.frame)`                            | The frame a page is printed with.                                                        |
| `PhotoPosition`, `PhotoCrop`, `PHOTO_ZOOM`             | Which part of a photo shows. See [Positioning photos](/guide/editor#positioning-photos). |

## BookLayout

The physical leaves of a book: cover, title page, pages, colophon and back cover.

```ts
const layout = new BookLayout(book.pages.length, { spread: true, stiffCovers: true })
```

| Member                   |                                                          |
| ------------------------ | -------------------------------------------------------- |
| `leaves`                 | Each leaf's `front` and `back` face.                     |
| `length`                 | The number of leaves.                                    |
| `visible(flipped)`       | Faces showing when `flipped` leaves lie on the left.     |
| `stops()`                | Every resting place, for thumbnails.                     |
| `label(flipped)`         | "Cover", "Pages 2–3", and so on.                         |
| `flippedForPage(page)`   | Where a page (1-based) is visible.                       |
| `convert(flipped, from)` | The same place in another layout, e.g. spread to single. |
| `isStiff(leaf)`          | Whether a leaf is a board cover.                         |

A `Face` has a `kind` of `'cover'`, `'title'`, `'page'`, `'blank'`, `'colophon'` or `'back'`; page faces also carry their `index` in `book.pages`.

## FlipbookReader

The shared state machine every viewer runs on. It knows which leaf is open, which one is turning and why, and turns pointer, button and key input into turns. Positions are book pixels from the top of the spine (in single-page mode, from the page's left edge).

```ts
const reader = new FlipbookReader(
  layout,
  {
    frame(frame, turn) {
      /* paint turn.leaf folded at frame.point */
    },
    change() {
      /* re-render from reader.flipped and reader.active */
    },
    flip() {
      /* play a sound */
    },
  },
  { physics, grip, flipped: 0 },
)

reader.configure({ width: 600, height: 800 }) // one page's size in pixels
```

| Member                                                |                                                          |
| ----------------------------------------------------- | -------------------------------------------------------- |
| `flipped`                                             | Leaves lying on the left.                                |
| `active`                                              | The turning leaf: `{ leaf, dir, stiff, peek }`, or null. |
| `label`, `atStart`, `atEnd`, `settled`                |                                                          |
| `next()`, `prev()`, `go(flipped)`                     | Animated turns.                                          |
| `layout`, `width`, `height`, `grip`, `engine`         | Current settings and the [`PageTurn`](#pageturn).        |
| `down(p, id)`, `move(p, id)`, `up(p, id)`, `cancel()` | Pointer input. `up` returns `'tap'`, `'turn'` or null.   |
| `hover(p)`, `leave()`                                 | Mouse hover, for corner peeks.                           |
| `configure({ layout, width, height })`                | New book size or layout, keeping the place.              |
| `destroy()`                                           | Stop any animation.                                      |

## Fold geometry

`Fold` turns a page corner position into everything needed to draw it.

```ts
const fold = new Fold(width, height, origin, point)

fold.flap // polygon of the turning part of the page
fold.reflection // polygon of the page under it
fold.flapMatrix(1) // CSS matrix that mirrors the back of the flap into place
fold.shade // 0..1, how far the page has turned, for lighting
```

`Affine` is a small 2D matrix with `after`, `invert`, `apply` and `place()`, which splits a matrix into a position, angle and mirror for platforms without matrix transforms (this is how React Native draws folds).

## PageTurn

The spring behind one leaf. `FlipbookReader` drives it for you.

```ts
const turn = new PageTurn({ frame, settle }, { physics, scheduler, reducedMotion })

turn.grab(origin, point, size, stiff)
turn.drag(point)
turn.release() // falls open or shut using the release speed
```

Pass a `Scheduler` (`now`, `request`, `cancel`) to run it without `requestAnimationFrame`, e.g. in tests.
