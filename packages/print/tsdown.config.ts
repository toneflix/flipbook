import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  deps: { neverBundle: ['@toneflix/flipbook-core', 'skia-canvas', '@fontsource-variable/fraunces'] },
})
