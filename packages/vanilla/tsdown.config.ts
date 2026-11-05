import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    deps: { neverBundle: ['@toneflix/flipbook-core'] },
  },
  {
    entry: { flipbook: 'src/index.ts' },
    format: 'iife',
    globalName: 'Flipbook',
    deps: { alwaysBundle: ['@toneflix/flipbook-core'] },
    minify: true,
  },
])
