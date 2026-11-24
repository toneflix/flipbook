import type { CSSProperties, ReactNode } from 'react'
import { shapeClass } from '@toneflix/flipbook'
import { FLEURON, coverHasText, decoArt, pageSize, printBeside, type CoverArt, type FlipbookBook } from '@toneflix/flipbook-core'
import { Ornament, PhotoImage } from './PageView'

const CORNERS = ['tl', 'tr', 'bl', 'br'] as const

function Art({ art, className }: { art: CoverArt; className: string }) {
  return (
    <svg viewBox={art.viewBox} className={className} preserveAspectRatio="none" aria-hidden>
      {art.strokes.map(({ d, width, opacity = 1 }) => (
        <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth={width} strokeOpacity={opacity} />
      ))}
      {art.fills.map((d) => (
        <path key={d} d={d} fill="currentColor" />
      ))}
    </svg>
  )
}

const Fleurons = () => CORNERS.map((corner) => <Art key={corner} art={FLEURON} className={`fb-fleuron is-${corner}`} />)

type CoverBook = Pick<FlipbookBook, 'title' | 'subtitle' | 'theme' | 'cover' | 'kicker' | 'coverDesign' | 'coverText' | 'pageShape'>

function Board({
  book,
  hinge,
  children,
}: {
  book: Pick<FlipbookBook, 'theme' | 'coverDesign' | 'pageShape'>
  hinge: 'left' | 'right'
  children: ReactNode
}) {
  return (
    <div
      className={`fb-cover fb-cover-${book.theme ?? 'classic'} fb-design-${book.coverDesign ?? 'classic'} ${shapeClass(book.pageShape)}`}
    >
      {children}
      <div className={`fb-hinge is-${hinge}`} />
      <div className="fb-cover-finish" aria-hidden />
    </div>
  )
}

export interface CoverViewProps {
  book: CoverBook
  showImages?: boolean
}

/** The front cover, laid out by the book's `coverDesign`. */
export function CoverView({ book, showImages = true }: CoverViewProps) {
  const text = coverHasText(book)
  const size = pageSize(book.pageShape)
  const across = size.width > size.height
  const beside = across && !!book.cover && text
  const kicker = book.kicker && <p className="fb-kicker">{book.kicker}</p>
  const title = <h1 className="fb-serif fb-cover-title">{book.title}</h1>
  const subtitle = book.subtitle && <p className="fb-serif fb-italic fb-cover-subtitle">{book.subtitle}</p>
  const photo = (className: string) =>
    book.cover && (
      <div className={className}>
        <PhotoImage photo={book.cover} show={showImages} />
      </div>
    )
  const words = (
    <div className="fb-cover-words">
      {kicker}
      {title}
      {subtitle}
    </div>
  )
  const print = (style?: CSSProperties) =>
    book.cover && (
      <div className="fb-cover-print" style={style}>
        {photo('fb-cover-print-photo')}
        {CORNERS.map((corner) => (
          <span key={corner} className={`fb-print-frame-corner is-${corner}`} aria-hidden />
        ))}
      </div>
    )
  const label = text && (
    <div className={`fb-cover-label ${book.cover ? '' : 'is-alone'}`}>
      {kicker}
      {title}
      {subtitle}
    </div>
  )
  const labelBeside = () => {
    const place = printBeside(size, text)
    const { x, y, width, height } = place.print

    return (
      <>
        {print({ left: `${x}cqmin`, top: `${y}cqmin`, width: `${width}cqmin`, height: `${height}cqmin`, right: 'auto' })}
        {text && (
          <div className="fb-cover-label is-beside" style={{ left: `${place.label.x}cqmin`, width: `${place.label.width}cqmin` }}>
            {kicker}
            {title}
            {subtitle}
          </div>
        )}
      </>
    )
  }

  const designs = {
    classic: () =>
      beside ? (
        <div className="fb-cover-panel is-beside">
          {words}
          {photo('fb-cover-photo')}
        </div>
      ) : (
        <div className="fb-cover-panel">
          {text && kicker}
          {text && title}
          {photo('fb-cover-photo') || (text && subtitle)}
        </div>
      ),
    gilt: () => (
      <>
        <div className="fb-cover-frame" />
        <Fleurons />
        {beside ? (
          <div className="fb-cover-stack is-beside">
            <div className="fb-cover-side">{photo('fb-cover-photo is-oval')}</div>
            {words}
          </div>
        ) : (
          <div className="fb-cover-stack">
            {text && kicker}
            {text && title}
            {photo('fb-cover-photo is-oval')}
            {text && subtitle}
          </div>
        )}
      </>
    ),
    window: () => (
      <>
        {photo('fb-cover-window') || (
          <div className="fb-cover-window is-empty">
            <Ornament />
          </div>
        )}
        {text && (
          <div className="fb-cover-stamp">
            {kicker}
            {title}
            {subtitle}
          </div>
        )}
      </>
    ),
    label: () => {
      if (book.cover && across) return labelBeside()
      if (book.cover && size.width === size.height)
        return (
          <div className="fb-cover-mount">
            {print()}
            {label}
          </div>
        )

      return (
        <>
          {print()}
          {label}
        </>
      )
    },
    deco: () => (
      <>
        <Art art={decoArt(size)} className="fb-cover-rays" />
        <div className="fb-cover-stack is-deco">
          {text && kicker}
          {photo('fb-cover-photo is-arch')}
          {text && title}
          {text && subtitle}
        </div>
      </>
    ),
    image: () => (
      <>
        {photo('fb-cover-art')}
        {book.cover && <div className="fb-cover-tint" />}
        {text && (
          <div className={`fb-cover-caption ${book.cover ? '' : 'is-plain'}`}>
            {kicker}
            {title}
            {subtitle}
          </div>
        )}
      </>
    ),
  }

  return (
    <Board book={book} hinge="left">
      {designs[book.coverDesign ?? 'classic']()}
    </Board>
  )
}

/** The back cover: the same board, with the brand and imprint. */
export function BackCoverView({ book }: { book: Pick<FlipbookBook, 'theme' | 'imprint' | 'brand' | 'coverDesign' | 'pageShape'> }) {
  const gilt = book.coverDesign === 'gilt'

  return (
    <Board book={book} hinge="right">
      {gilt && <div className="fb-cover-frame" />}
      {gilt && <Fleurons />}
      <div className="fb-imprint">
        <Ornament />
        {book.brand && (
          <p className="fb-kicker" style={{ marginTop: '2cqmin', fontSize: '3cqmin' }}>
            {book.brand}
          </p>
        )}
        {book.imprint && (
          <p className="fb-kicker" style={{ marginTop: '2cqmin', fontSize: '2.4cqmin', opacity: 0.6 }}>
            {book.imprint}
          </p>
        )}
      </div>
    </Board>
  )
}
