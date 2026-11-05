# @toneflix/flipbook

An expressive flipbook for creating personalised and interactive reading and photo viewing experiences, for any web page, no framework needed.

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
