# @toneflix/flipbook-vue

An expressive flipbook for creating personalised and interactive reading and photo viewing experiences, for Vue.

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
