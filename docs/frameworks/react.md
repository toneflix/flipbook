# React

```bash
npm install @toneflix/flipbook-react
```

```tsx
import { useRef } from 'react'
import { Flipbook, type FlipbookHandle } from '@toneflix/flipbook-react'
import '@toneflix/flipbook-react/style.css'

export function Reader({ book }) {
  const ref = useRef<FlipbookHandle>(null)

  return (
    <div style={{ height: '100vh' }}>
      <Flipbook ref={ref} book={book} sound topLeft={<a href="/">Close</a>} onPageChange={(place) => console.log(place.label)} />
    </div>
  )
}
```

The viewer renders on the server too. Pages paint on the client once the viewer knows its size, so put it in a box with a height.

## Controls

The ref exposes `next()`, `prev()`, `goToPage(page)` and `go(flipped)`, plus the underlying [`reader`](/api/core#flipbookreader). `topLeft` and `topRight` add your own buttons to the top bar.

## Pages outside the viewer

`PageView`, `CoverView`, `TitlePageView`, `ColophonView`, `BackCoverView` and `PrintedPhoto` render the same printed pages anywhere: thumbnails, a print preview or an [editor](/guide/editor). They size themselves with container units, so the parent needs `container-type: size` and a page-shaped box.

```tsx
import { PageView, BookLookProvider } from '@toneflix/flipbook-react'

;<BookLookProvider paper="kraft" frame="mat">
  <div style={{ containerType: 'size', aspectRatio: '3 / 4', width: 240 }}>
    <PageView page={book.pages[0]} number={1} />
  </div>
</BookLookProvider>
```

All options are listed under [Viewer options](/api/options).
