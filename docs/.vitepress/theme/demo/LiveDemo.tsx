import { Flipbook } from '@toneflix/flipbook-react'
import { demoBook } from './book'

/** The book on the landing page. */
export function LiveDemo() {
  return (
    <div className="demo-frame">
      <Flipbook book={demoBook} fullscreenButton landscape={false} />
    </div>
  )
}
