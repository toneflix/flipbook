import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  deps: { neverBundle: ['react', 'react-dom', 'react/jsx-runtime', '@toneflix/flipbook-core', '@toneflix/flipbook'] },
})
