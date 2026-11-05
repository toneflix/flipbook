# Building an editor

The page components that the viewer prints are exported, so an editor can show pages exactly as they'll be read and let people fill them.

A page's `layout` decides how many photo slots it has (`PAGE_LAYOUTS[layout].slots`). Pass a slot handler and each slot becomes a target. Empty slots show a placeholder.

::: code-group

```tsx [React]
import { useState } from 'react'
import { BookLookProvider, PageView, PHOTO_DRAG_TYPE, PAGE_LAYOUTS } from '@toneflix/flipbook-react'

function PageEditor({ book, page, onChange, library }) {
  const [slot, setSlot] = useState<number | null>(null)

  const place = (index: number, photo) => {
    const photos = [...page.photos]

    photos[index] = photo
    onChange({ ...page, photos })
  }

  return (
    <BookLookProvider paper={book.paper} frame={book.frame}>
      <div style={{ containerType: 'size', aspectRatio: '3 / 4', width: 360 }}>
        <PageView
          page={page}
          activeSlot={slot}
          onSlotClick={setSlot}
          onSlotDrop={(index, id) =>
            place(
              index,
              library.find((p) => p.id === id),
            )
          }
        />
      </div>
      {/* Library thumbnails set the drag data: */}
      {library.map((photo) => (
        <img key={photo.id} src={photo.src} draggable onDragStart={(e) => e.dataTransfer.setData(PHOTO_DRAG_TYPE, photo.id)} />
      ))}
    </BookLookProvider>
  )
}
```

```vue [Vue]
<PageView :page="page" :paper="book.paper" :frame="book.frame" :active-slot="slot" editable @slot-click="(i) => (slot = i)" />
```

```tsx [React Native]
<BookLookProvider paper={book.paper} frame={book.frame}>
  <PageView page={page} width={320} activeSlot={slot} onSlotPress={setSlot} accent="#1d6fd8" />
</BookLookProvider>
```

:::

When the edits are saved, hand the updated book to the viewer. It keeps the reader on the same spread.

## Choosing looks

The core exports every option with a label for pickers:

```ts
import { PAGE_LAYOUTS, COVER_THEMES, PAPER_COLORS, FRAME_STYLES } from '@toneflix/flipbook-react'

Object.entries(FRAME_STYLES).map(([value, { label, description }]) => ({ value, label, description }))
```
