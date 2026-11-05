import { createRoot } from 'react-dom/client'
import '@toneflix/flipbook-react/style.css'
import { LiveDemo } from './LiveDemo'
import { Playground } from './Playground'

const demos = { demo: LiveDemo, playground: Playground }

export function mount(el: HTMLElement, name: keyof typeof demos) {
  const root = createRoot(el)
  const Demo = demos[name]

  root.render(<Demo />)

  return () => root.unmount()
}
