# Books and pages

## The book

| Field         | Type                                          |                                                                                       |
| ------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `title`       | `string`                                      | On the cover, the title page and the viewer's top bar.                                |
| `subtitle`    | `string`                                      | Under the title on the title page, and on the cover when there is no cover photo.     |
| `author`      | `string`                                      | Credited on the title page and in the top bar.                                        |
| `year`        | `number \| string`                            | Printed beside the author on the title page.                                          |
| `cover`       | `FlipbookPhoto`                               | The photo set into the front cover.                                                   |
| `theme`       | `CoverTheme`                                  | The cover cloth, which also tints the stage.                                          |
| `coverDesign` | `CoverDesign`                                 | How the front cover is made, `classic` by default. See [covers](./printing#covers).   |
| `coverText`   | `boolean`                                     | Whether the title is printed on the cover. On by default, off for the `image` design. |
| `paper`       | `'ivory' \| 'white' \| 'kraft' \| 'charcoal'` | The paper of every page.                                                              |
| `frame`       | `FrameStyle`                                  | How photos are framed on pages that don't choose their own.                           |
| `pages`       | `FlipbookPage[]`                              | The pages, in order.                                                                  |
| `kicker`      | `string`                                      | Small capitals above the title on the cover, like "A photo book".                     |
| `colophon`    | `string`                                      | A closing line inside the back cover.                                                 |
| `imprint`     | `string`                                      | The name printed on the back cover.                                                   |

The viewer adds the cover, a title page, a blank page when a spread needs one, the colophon and the back cover around your pages.

## Photos

```ts
interface FlipbookPhoto {
  src: string
  frame?: FrameStyle
  alt?: string
  width?: number
  height?: number
  position?: { x?: number; y?: number; zoom?: number }
}
```

Give `width` and `height` when you know them: framed pages use them to keep the photo's shape. A photo's `frame` sets its own frame, so one page can mix an oval cameo with plain prints.

A photo's `position` chooses which part of it shows when its slot crops it. `x` and `y` run from 0 to 100 and work like CSS `object-position`: `{ x: 0 }` keeps the left edge in view, `{ y: 100 }` the bottom. `zoom` enlarges the photo past filling its slot, from 1 to 4, around that same point. Left out, a photo is centred at no zoom. The same position is used on pages, on covers and by every renderer. See [Positioning photos](/guide/editor#positioning-photos) to let people choose it.

## Pages

```ts
interface FlipbookPage {
  layout: PageLayout
  photos: (FlipbookPhoto | null)[]
  caption?: string
  frame?: FrameStyle
}
```

| Layout     | Photos |                                                                 |
| ---------- | ------ | --------------------------------------------------------------- |
| `single`   | 1      | Printed to the edges, the caption over it. Never framed.        |
| `framed`   | 1      | On a mat with its caption below, keeping its shape.             |
| `pair`     | 2      | Stacked.                                                        |
| `grid`     | 4      | Two by two.                                                     |
| `collage`  | 3      | One large over two small.                                       |
| `text`     | 0      | The caption set as a page of writing.                           |
| `triptych` | 3      | Three tall photos side by side.                                 |
| `mosaic`   | 3      | One tall photo beside two smaller ones.                         |
| `strip`    | 3      | Three wide photos stacked like a film strip.                    |
| `contact`  | 6      | A contact sheet, two across and three down.                     |
| `scatter`  | 3      | Loose prints dropped on the page at an angle, casting a shadow. |
| `story`    | 1      | A photo over a paragraph of writing from the caption.           |

`PAGE_LAYOUTS` lists them with their labels and slot counts, handy for a layout picker. A `null` photo leaves its slot blank.

The newer layouts are drawn from fixed boxes in `PLACED_LAYOUTS`, measured in page units (1 unit is 1% of the page width, so a page is 100 × 133⅓). Every renderer places them the same way, and a custom renderer can read them too.

## Opening at a page

`startPage` opens the book at a page (1-based) instead of the cover, for example from a link to one photo.
