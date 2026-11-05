# @toneflix/flipbook-vue

Turn any set of photos into an album that bends, settles and feels like paper, as a Vue 3 component. A page folds exactly where a finger bends it, photos sink into the paper's grain, and phones open the book sideways across two pages.

```bash
npm install @toneflix/flipbook-vue
```

```vue
<script setup>
import { Flipbook } from '@toneflix/flipbook-vue'
import '@toneflix/flipbook-vue/style.css'

defineProps(['book'])
</script>

<template>
  <div style="height: 100vh">
    <Flipbook :book="book" @page-change="(place) => console.log(place.label)" />
  </div>
</template>
```

See the [documentation](https://toneflix.github.io/flipbook/) and the [playground](https://toneflix.github.io/flipbook/playground).
