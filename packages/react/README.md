# @toneflix/flipbook-react

A photo book for React. Pages peel, fold and fall with real physics, photos are printed into textured paper, and phones read the book sideways.

```bash
npm install @toneflix/flipbook-react
```

```tsx
import { Flipbook } from '@toneflix/flipbook-react'
import '@toneflix/flipbook-react/style.css'

export function Book({ book }) {
  return (
    <div style={{ height: '100vh' }}>
      <Flipbook book={book} />
    </div>
  )
}
```

See the [documentation](https://toneflix.github.io/flipbook/) and the [playground](https://toneflix.github.io/flipbook/playground).
