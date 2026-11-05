# @toneflix/flipbook-react

An expressive flipbook for creating personalised and interactive reading and photo viewing experiences, for React.

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
