import { createRequire } from 'node:module'
import path from 'node:path'
import type { FontSpec } from '@toneflix/flipbook-core'
import { FontLibrary } from 'skia-canvas'

export interface PrintFontOptions {
  /** Font files for the book's sans text, such as the title page credit. Left out, it is set in the serif. */
  sans?: string[]
}

const require = createRequire(import.meta.url)

/**
 * The faces pages are set in: Fraunces, as the web reader uses, with its optical size set from the
 * type size the way a browser sets it.
 */
export class PrintFonts {
  /** CSS pixels per page unit on a 210 mm page, which sets the optical size of each type size. */
  static readonly CSS_PX_PER_UNIT = 7.937

  private static registered = false

  readonly sans: boolean

  constructor({ sans }: PrintFontOptions = {}) {
    PrintFonts.register()
    this.sans = !!sans?.length
    if (sans?.length) FontLibrary.use('Flipbook Sans', sans)
  }

  /** The serif's files, from the bundled Fraunces. Latin first, then the extended set for accents. */
  static files(): Record<string, string[]> {
    const directory = path.join(path.dirname(require.resolve('@fontsource-variable/fraunces')), 'files')
    const file = (subset: string, style: string) => path.join(directory, `fraunces-${subset}-opsz-${style}.woff2`)

    return {
      'Flipbook Serif': [file('latin', 'normal'), file('latin', 'italic')],
      'Flipbook Serif Extended': [file('latin-ext', 'normal'), file('latin-ext', 'italic')],
    }
  }

  private static register() {
    if (PrintFonts.registered) return

    for (const [family, files] of Object.entries(PrintFonts.files())) FontLibrary.use(family, files)
    PrintFonts.registered = true
  }

  /** The canvas `font` for a spec drawn `scale` pixels per page unit. */
  font(spec: FontSpec, scale: number): string {
    const family = spec.family === 'sans' && this.sans ? '"Flipbook Sans"' : '"Flipbook Serif", "Flipbook Serif Extended"'

    return `${spec.style} ${spec.weight} ${spec.size * scale}px ${family}`
  }

  /** The variable axes for a spec: optical size follows the type size in CSS pixels. */
  variations(spec: FontSpec): Record<string, number> {
    return { opsz: Math.min(144, Math.max(9, spec.size * PrintFonts.CSS_PX_PER_UNIT)), wght: spec.weight }
  }
}
