# @toneflix/flipbook-print

Print-ready pages for Toneflix Flipbook, an expressive flipbook for creating personalised and interactive reading and photo viewing experiences. Draws a book's pages in Node.js with Skia, as one PDF or one image per page, without a browser.

```ts
import { BookPrinter } from '@toneflix/flipbook-print'

const pdf = await new BookPrinter(book, { width: 210 }).pdf()
```

See the [documentation](https://toneflix.github.io/flipbook/guide/printing#printing-on-a-server) for the full guide.
