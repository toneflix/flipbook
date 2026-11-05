# Vue

```bash
npm install @toneflix/flipbook-vue
```

The Vue package wraps the framework-free viewer, so it turns exactly like the React one. Here it is running inside these docs, which are a Vue app:

<VueDemo />

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Flipbook, type FlipbookExposed } from '@toneflix/flipbook-vue'
import '@toneflix/flipbook-vue/style.css'

const props = defineProps(['book'])
const flipbook = ref<FlipbookExposed>()
const label = ref('Cover')
</script>

<template>
  <div style="height: 100vh">
    <Flipbook ref="flipbook" :book="book" sound @page-change="(place) => (label = place.label)" />
  </div>
  <button @click="flipbook?.next()">Next</button>
</template>
```

Every [viewer option](/api/options) is a prop, in camelCase or kebab-case (`start-page`, `stiff-covers`). Props are watched deeply, so editing the book updates the viewer in place.

## Events

| Event         | Payload                      |
| ------------- | ---------------------------- |
| `page-change` | `{ flipped, label, faces }`  |
| `flip`        | A page started to turn over. |

## Exposed methods

`next()`, `prev()`, `goToPage(page)`, `go(flipped)`, and `instance`, the underlying [vanilla `Flipbook`](./vanilla).

## Pages outside the viewer

`PageView` and `CoverView` render single printed pages, for thumbnails or an [editor](/guide/editor). Give the parent a page-shaped box.

```vue
<div style="aspect-ratio: 3 / 4; width: 240px">
  <PageView :page="book.pages[0]" paper="kraft" frame="mat" :number="1" editable @slot-click="pick" />
</div>
```
