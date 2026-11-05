# @toneflix/flipbook

Turn any set of photos into an album that bends, settles and feels like paper, on any web page, with no framework or from a single script tag. A page folds exactly where a finger bends it, photos sink into the paper's grain, and phones open the book sideways across two pages.

```bash
npm install @toneflix/flipbook
```

```js
import { Flipbook } from '@toneflix/flipbook'
import '@toneflix/flipbook/style.css'

const flipbook = new Flipbook(document.querySelector('#book'), { book })

flipbook.next()
flipbook.update({ layout: 'single' })
flipbook.destroy()
```

Or straight from a CDN, with the `Flipbook` global:

```html
<link rel="stylesheet" href="https://unpkg.com/@toneflix/flipbook/dist/style.css" />
<script src="https://unpkg.com/@toneflix/flipbook"></script>
<script>
  new Flipbook.Flipbook(document.querySelector('#book'), { book })
</script>
```

See the [documentation](https://toneflix.github.io/flipbook/) and the [playground](https://toneflix.github.io/flipbook/playground).
