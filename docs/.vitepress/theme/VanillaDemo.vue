<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Flipbook } from '@toneflix/flipbook'
import '@toneflix/flipbook/style.css'
import { demoBook } from './demo/book'

/** The framework-free package, mounted into a plain element. */
const el = ref<HTMLElement>()
let destroy: (() => void) | undefined

onMounted(() => {
  const flipbook = new Flipbook(el.value!, { book: { ...demoBook, theme: 'midnight', paper: 'charcoal', frame: 'gilt' }, landscape: false })

  destroy = () => flipbook.destroy()
})

onBeforeUnmount(() => destroy?.())
</script>

<template>
  <div class="vp-raw inline-demo">
    <div ref="el" class="demo-frame" />
  </div>
</template>
