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

## Positioning photos

Pass a position handler and the photo in the active slot can be moved where it sits: drag it to choose which part shows, and pinch or scroll to zoom. On the web the arrow keys move it too, + and − zoom, and 0 centres it again. The handler gets the new `position` when a gesture ends; store it on the photo and pass the page back.

::: code-group

```tsx [React]
<PageView
  page={page}
  activeSlot={slot}
  onSlotClick={setSlot}
  onPhotoPosition={(index, position) => {
    const photos = page.photos.map((photo, i) => (i === index && photo ? { ...photo, position } : photo))

    onChange({ ...page, photos })
  }}
/>
```

```vue [Vue]
<PageView :page="page" :active-slot="slot" editable positioning @slot-click="(i) => (slot = i)" @photo-position="setPosition" />
```

```ts [Vanilla]
renderPage(page, look, { activeSlot: slot, onSlotClick: select, onPhotoPosition: (index, position) => save(index, position) })

// Or on any element that holds a photo's <img>, such as a cover:
const positioner = new PhotoPositioner(element, { position: photo.position, onChange: save })
```

```tsx [React Native]
const [moving, setMoving] = useState(false)

<ScrollView scrollEnabled={!moving}>
  <PageView
    page={page}
    width={320}
    activeSlot={slot}
    onSlotPress={setSlot}
    onPhotoPosition={(index, position) => save(index, position)}
    onPositionGesture={setMoving}
  />
</ScrollView>
```

:::

For a control of your own, such as a zoom slider, `PhotoCrop` from the core does the sums every renderer uses:

```ts
import { PhotoCrop } from '@toneflix/flipbook-react'

const crop = PhotoCrop.of(photo.position)

crop.zoomTo(2).toJSON() // { x: 50, y: 50, zoom: 2 }
crop.pan(dx, dy, box, { width: photo.width, height: photo.height }) // after a drag of dx, dy pixels in a box
crop.rect(box, image) // where the photo is drawn so it covers the box
crop.css // { objectPosition, transform, transformOrigin } for an <img> with object-fit: cover
```

## Choosing looks

The core exports every option with a label for pickers:

```ts
import { PAGE_LAYOUTS, COVER_THEMES, PAPER_COLORS, FRAME_STYLES } from '@toneflix/flipbook-react'

Object.entries(FRAME_STYLES).map(([value, { label, description }]) => ({ value, label, description }))
```
