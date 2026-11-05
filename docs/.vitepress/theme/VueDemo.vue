<script setup lang="ts">
import { ref } from 'vue'
import { Flipbook } from '@toneflix/flipbook-vue'
import '@toneflix/flipbook-vue/style.css'
import { demoBook } from './demo/book'

/** The Vue package, running natively inside this Vue-powered site. */
const paper = ref<'ivory' | 'kraft' | 'charcoal'>('kraft')
const place = ref('Cover')
</script>

<template>
  <div class="vp-raw inline-demo">
    <ClientOnly>
      <div class="demo-frame">
        <Flipbook
          :book="{ ...demoBook, paper, frame: 'deckle', theme: 'linen' }"
          :landscape="false"
          @page-change="(p) => (place = p.label)"
        />
      </div>
    </ClientOnly>
    <div class="inline-demo-bar">
      <span>{{ place }}</span>
      <select v-model="paper" aria-label="Paper">
        <option value="ivory">Ivory</option>
        <option value="kraft">Kraft</option>
        <option value="charcoal">Charcoal</option>
      </select>
    </div>
  </div>
</template>
