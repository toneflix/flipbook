# Turning pages

<ClientOnly><ReactIsland name="demo" /></ClientOnly>

## How readers turn pages

- **Drag** any corner or edge. The page folds along the line between where you grabbed it and your pointer, and stays bound to the spine.
- **Swipe** across the middle of a page; it's held at its outer edge.
- **Flick**: let go and the page lands open or shut depending on where it is and how fast it was moving.
- **Tap** the outer thirds of the stage.
- **Buttons**, the **page strip**, and the arrow, Page Up/Down, Space, Home and End **keys**.
- **Hover** near a corner with a mouse and it lifts a little, as a hint.

Covers are stiff: they swing on the spine instead of curling. Set `stiffCovers` to false for a soft-cover book.

## Physics

Released pages move on critically damped springs, so they settle without bouncing. Tune them with `physics`:

| Option  | Default  |                                                                           |
| ------- | -------- | ------------------------------------------------------------------------- |
| `fall`  | `0.0075` | Spring that drops a page after a drag. Higher is snappier.                |
| `auto`  | `0.0055` | Spring for turns started by a button, key or tap.                         |
| `peek`  | `0.02`   | Spring that lifts a corner under the mouse.                               |
| `flick` | `170`    | How far ahead (ms) a flick carries the page when deciding where it lands. |
| `lift`  | `0.12`   | How high a falling page arcs off the paper, as a share of its height.     |

`grip` sets where a press grabs the page:

| Option  | Default |                                                                          |
| ------- | ------- | ------------------------------------------------------------------------ |
| `edgeX` | `0.15`  | Share of the page width along the outer edge that grabs the edge itself. |
| `edgeY` | `0.08`  | Share of the height at the top and bottom that grabs a corner.           |
| `peek`  | `true`  | Lift corners under the mouse.                                            |

`shading` scales the light and shadow around the fold, from `0` (flat) up.

People who ask their system for reduced motion get pages that land at once.

## Following along

`onPageChange` (Vue: `@page-change`) tells you where the reader is: the number of leaves turned (`flipped`), a label like "Pages 3–4 of 12", and the faces showing. `onFlip` fires as a page starts to turn, which is a good place for analytics or your own sound.

## Turning from code

::: code-group

```tsx [React]
const flipbook = useRef<FlipbookHandle>(null)

<Flipbook ref={flipbook} book={book} />

flipbook.current?.next()
flipbook.current?.goToPage(5)
```

```vue [Vue]
<Flipbook ref="flipbook" :book="book" />

flipbook.value.next() flipbook.value.goToPage(5)
```

```js [Vanilla]
const flipbook = new Flipbook(el, { book })

flipbook.next()
flipbook.goToPage(5)
flipbook.update({ shading: 0.5 })
flipbook.destroy()
```

:::

`go(flipped)` jumps to a number of turned leaves: `0` is the closed front cover.
