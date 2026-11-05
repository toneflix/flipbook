# @toneflix/flipbook-react

Turn any set of photos into an album that bends, settles and feels like paper, as a React component that also renders on the server. A page folds exactly where a finger bends it, photos sink into the paper's grain, and phones open the book sideways across two pages.

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
