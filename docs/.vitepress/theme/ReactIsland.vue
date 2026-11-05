<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/** Mounts one of the React demos on the client only. */
const props = defineProps<{ name: 'demo' | 'playground' }>()
const el = ref<HTMLElement>()
let unmount: (() => void) | undefined

onMounted(async () => {
  const { mount } = await import('./demo/mount')

  if (el.value) unmount = mount(el.value, props.name)
})

onBeforeUnmount(() => unmount?.())
</script>

<template>
  <div ref="el" :class="['vp-raw', 'react-island', `react-island-${props.name}`]" />
</template>
