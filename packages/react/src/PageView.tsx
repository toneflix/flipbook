import type { DragEvent } from 'react'
import { frameOf, type CoverTheme, type FlipbookBook, type FlipbookPage, type FlipbookPhoto } from '@toneflix/flipbook-core'
import { useBookLook } from './BookLook'
import { PrintedPhoto } from './PrintedPhoto'

/** Drag-and-drop data type carrying a photo id onto a page slot in an editor. */
export const PHOTO_DRAG_TYPE = 'application/x-flipbook-photo'

type Side = 'left' | 'right'

const usePaper = () => `fb-paper fb-paper-${useBookLook().paper}`

export interface PageViewProps {
  page: FlipbookPage
  /** Printed in the outer bottom corner. */
  number?: number
  /** Which side of a spread the page sits on, for the curve into the spine. */
  side?: Side
  /** False draws placeholders instead of loading images. */
  showImages?: boolean
  /** Editor: makes each photo slot clickable. */
  onSlotClick?: (slot: number) => void
  /** Editor: a photo id (as `PHOTO_DRAG_TYPE` data) was dropped on a slot. */
  onSlotDrop?: (slot: number, photoId: string) => void
  activeSlot?: number | null
}

/**
 * The inside of one book page. Sizes use container units (cqw), so the same page looks right as
 * a thumbnail and as a full-screen spread. The parent must have `container-type: size`.
 */
export function PageView({ page, number, side, showImages = true, onSlotClick, onSlotDrop, activeSlot }: PageViewProps) {
  const { layout, caption, photos } = page
  const paper = usePaper()
  const frame = frameOf(page, useBookLook().frame)
  const editable = !!onSlotClick

  const dropHandlers = (index: number) =>
    onSlotDrop && {
      onDragOver: (e: DragEvent<HTMLDivElement>) => {
        if (!e.dataTransfer.types.includes(PHOTO_DRAG_TYPE)) return

        e.preventDefault()
        e.currentTarget.dataset.over = 'true'
      },
      onDragLeave: (e: DragEvent<HTMLDivElement>) => delete e.currentTarget.dataset.over,
      onDrop: (e: DragEvent<HTMLDivElement>) => {
        const id = e.dataTransfer.getData(PHOTO_DRAG_TYPE)

        delete e.currentTarget.dataset.over
        if (!id) return

        e.preventDefault()
        onSlotDrop(index, id)
      },
    }

  const slot = (index: number, className = '', framed = false) => {
    const photo = photos[index] ?? null
    const classes = [
      'fb-slot',
      className,
      framed && 'is-framed',
      editable && 'is-editable',
      editable && activeSlot === index && 'is-active',
    ]

    return (
      <div
        key={index}
        className={classes.filter(Boolean).join(' ')}
        onClick={editable ? () => onSlotClick(index) : undefined}
        role={editable ? 'button' : undefined}
        aria-label={editable ? `Photo slot ${index + 1}` : undefined}
        {...dropHandlers(index)}
      >
        {photo ? (
          <PrintedPhoto photo={photo} frame={frame} fit={framed ? 'contain' : 'cover'} show={showImages} />
        ) : (
          <div className="fb-slot-empty">{editable ? 'Add a photo' : ''}</div>
        )}
      </div>
    )
  }

  const smallCaption = caption && (
    <p className="fb-serif fb-italic fb-center" style={{ fontSize: '3.8cqw' }}>
      {caption}
    </p>
  )

  return (
    <div className={`${paper} fb-page`}>
      {layout === 'single' && (
        <>
          {slot(0, 'fb-bleed')}
          {caption && <div className="fb-caption-over">{caption}</div>}
        </>
      )}

      {layout === 'framed' && (
        <div className="fb-column" style={{ padding: '10cqw 9cqw 6cqw' }}>
          <div className="fb-grow">{slot(0, 'fb-fill', true)}</div>
          <p
            className="fb-serif fb-italic fb-center"
            style={{ marginTop: '5cqw', fontSize: '4.2cqw', minHeight: '6cqw', lineHeight: 1.35 }}
          >
            {caption}
          </p>
        </div>
      )}

      {layout === 'pair' && (
        <div className="fb-column" style={{ padding: '7cqw', gap: '4cqw' }}>
          {slot(0, 'fb-grow')}
          {slot(1, 'fb-grow')}
          {smallCaption}
        </div>
      )}

      {layout === 'grid' && (
        <div className="fb-column" style={{ padding: '7cqw', gap: '3cqw' }}>
          <div className="fb-grid fb-grow" style={{ gap: '3cqw' }}>
            {[0, 1, 2, 3].map((i) => slot(i))}
          </div>
          {smallCaption}
        </div>
      )}

      {layout === 'collage' && (
        <div className="fb-column" style={{ padding: '7cqw', gap: '3cqw' }}>
          {slot(0, 'fb-grow-large')}
          <div className="fb-row fb-grow" style={{ gap: '3cqw' }}>
            {slot(1, 'fb-grow')}
            {slot(2, 'fb-grow')}
          </div>
          {smallCaption}
        </div>
      )}

      {layout === 'text' && (
        <div className="fb-column fb-center" style={{ alignItems: 'center', justifyContent: 'center', padding: '14cqw 12cqw' }}>
          <span className="fb-serif" style={{ fontSize: '18cqw', lineHeight: 0.6, opacity: 0.3 }} aria-hidden>
            “
          </span>
          <p className="fb-serif fb-italic" style={{ marginTop: '4cqw', fontSize: '6cqw', lineHeight: 1.4, textWrap: 'balance' }}>
            {caption || (editable ? 'Write something in the caption box below.' : '')}
          </p>
        </div>
      )}

      {number !== undefined && layout !== 'single' && (
        <span className="fb-page-number" style={side === 'left' ? { left: 0 } : { right: 0 }}>
          {number}
        </span>
      )}

      <PageSurface side={side} />
    </div>
  )
}

export interface PhotoImageProps {
  photo: FlipbookPhoto
  show?: boolean
}

/** A plain photo filling its parent, e.g. set into a cover. */
export function PhotoImage({ photo, show = true }: PhotoImageProps) {
  if (!show) return <div className="fb-placeholder" />

  return (
    <img
      src={photo.src}
      alt={photo.alt ?? ''}
      draggable={false}
      decoding="async"
      width={photo.width ?? undefined}
      height={photo.height ?? undefined}
      className="fb-photo"
    />
  )
}

const coverClass = (theme?: CoverTheme) => `fb-cover fb-cover-${theme ?? 'classic'}`

export interface CoverViewProps {
  book: Pick<FlipbookBook, 'title' | 'subtitle' | 'theme' | 'cover' | 'kicker'>
  showImages?: boolean
}

/** The front cover: cloth with the title and an inset photo. */
export function CoverView({ book, showImages = true }: CoverViewProps) {
  return (
    <div className={coverClass(book.theme)}>
      <div className="fb-hinge is-left" />
      <div className="fb-cover-panel">
        {book.kicker && <p className="fb-kicker">{book.kicker}</p>}
        <h1 className="fb-serif" style={{ marginTop: '5cqw', fontSize: '9cqw', fontWeight: 500, lineHeight: 1.05, textWrap: 'balance' }}>
          {book.title}
        </h1>
        {book.cover && (
          <div className="fb-cover-photo">
            <PhotoImage photo={book.cover} show={showImages} />
          </div>
        )}
        {!book.cover && book.subtitle && (
          <p className="fb-serif fb-italic" style={{ marginTop: '6cqw', fontSize: '4cqw', opacity: 0.8 }}>
            {book.subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

/** The back cover, with the imprint if the book has one. */
export function BackCoverView({ book }: { book: Pick<FlipbookBook, 'theme' | 'imprint'> }) {
  return (
    <div className={coverClass(book.theme)}>
      <div className="fb-hinge is-right" />
      <div className="fb-imprint">
        <Ornament />
        {book.imprint && (
          <p className="fb-kicker" style={{ marginTop: '2cqw', fontSize: '2.4cqw', opacity: 0.6 }}>
            {book.imprint}
          </p>
        )}
      </div>
    </div>
  )
}

/** Inside the front cover: a title page. */
export function TitlePageView({ book, side }: { book: Pick<FlipbookBook, 'title' | 'subtitle' | 'author' | 'year'>; side?: Side }) {
  const credit = [book.author, book.year].filter(Boolean).join(' · ')

  return (
    <div className={`${usePaper()} fb-page fb-center`} style={{ alignItems: 'center', justifyContent: 'center', padding: '12cqw' }}>
      <Ornament />
      <h2 className="fb-serif" style={{ marginTop: '6cqw', fontSize: '7.5cqw', fontWeight: 400, lineHeight: 1.1, textWrap: 'balance' }}>
        {book.title}
      </h2>
      {book.subtitle && (
        <p className="fb-serif fb-italic" style={{ marginTop: '4cqw', fontSize: '4cqw', lineHeight: 1.45 }}>
          {book.subtitle}
        </p>
      )}
      <div style={{ marginTop: '7cqw', height: 1, width: '20cqw', background: 'currentColor', opacity: 0.3 }} />
      {credit && <p style={{ margin: '5cqw 0 0', fontSize: '2.6cqw', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{credit}</p>}
      <PageSurface side={side} />
    </div>
  )
}

/** Inside the back cover, with the book's closing line. */
export function ColophonView({ book, side }: { book: Pick<FlipbookBook, 'colophon'>; side?: Side }) {
  return (
    <div
      className={`${usePaper()} fb-page fb-center`}
      style={{ alignItems: 'center', justifyContent: 'flex-end', padding: '12cqw', opacity: 0.9 }}
    >
      {book.colophon && (
        <p className="fb-serif fb-italic" style={{ fontSize: '3.6cqw' }}>
          {book.colophon}
        </p>
      )}
      <PageSurface side={side} />
    </div>
  )
}

export function BlankPageView({ side }: { side?: Side }) {
  return (
    <div className={`${usePaper()} fb-page`}>
      <PageSurface side={side} />
    </div>
  )
}

/**
 * Light and grain laid over everything on a page, photos included, so prints sit in the paper.
 * On a spread, `side` adds the curve into the spine.
 */
function PageSurface({ side }: { side?: Side }) {
  return (
    <div className={`fb-page-surface ${side ? `is-${side}` : ''}`} aria-hidden>
      <div className="fb-page-surface-grain" />
      {side && <div className="fb-page-surface-gutter" />}
      {side && <div className="fb-page-surface-sheen" />}
    </div>
  )
}

/** A small printer's ornament for the title page and back cover. */
function Ornament() {
  return (
    <svg viewBox="0 0 40 40" className="fb-ornament" aria-hidden>
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeOpacity="0.6" />
      <path d="M20 9 L 27 20 L 20 31 L 13 20 Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="20" cy="20" r="2.2" fill="currentColor" />
    </svg>
  )
}
