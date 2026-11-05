# Vanilla JS

`@toneflix/flipbook` needs no framework. It is also what the Vue package is built on.

<VanillaDemo />

## With a bundler

```bash
npm install @toneflix/flipbook
```

```js
import { Flipbook } from '@toneflix/flipbook'
import '@toneflix/flipbook/style.css'

const flipbook = new Flipbook(document.querySelector('#book'), {
  book,
  stiffCovers: true,
  onPageChange: (place) => (document.title = place.label),
})

document.querySelector('#next').addEventListener('click', () => flipbook.next())
```

## From a CDN

The script build puts everything on a global `Flipbook` object.

```html
<link rel="stylesheet" href="https://unpkg.com/@toneflix/flipbook/dist/style.css" />

<div id="book" style="height: 100vh"></div>

<script src="https://unpkg.com/@toneflix/flipbook/dist/flipbook.iife.js"></script>
<script>
  const flipbook = new Flipbook.Flipbook(document.querySelector('#book'), { book })
</script>
```

## The instance

| Member             |                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `update(options)`  | Change any [option](/api/options), e.g. a new book or paper. Unchanged options keep their values. |
| `next()`, `prev()` | Turn one page.                                                                                    |
| `goToPage(page)`   | Open at a page (1-based).                                                                         |
| `go(flipped)`      | Open with this many leaves on the left.                                                           |
| `reader`           | The [reader](/api/core#flipbookreader) driving the book.                                          |
| `destroy()`        | Remove the viewer and its listeners.                                                              |

## Pages outside the viewer

`renderPage`, `renderCover`, `renderTitlePage`, `renderColophon` and `renderBackCover` return plain elements for thumbnails or an [editor](/guide/editor). `renderFace(face, book)` renders any face from a [`BookLayout`](/api/core#booklayout).
