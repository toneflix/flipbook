import type { CSSProperties, DragEvent } from 'react'
import { measurePadding, shapeClass } from '@toneflix/flipbook'
import {
  PhotoCrop,
  pageSize,
  panoramaView,
  photoFrame,
  placedLayout,
  type FlipbookBook,
  type FlipbookPage,
  type FlipbookPhoto,
  type PageBox,
  type PageHalf,
  type PhotoPosition,
} from '@toneflix/flipbook-core'
import { useBookLook } from './BookLook'
import { PrintedPhoto } from './PrintedPhoto'
import { usePhotoPositioner } from './positioner'

/** Drag-and-drop data type carrying a photo id onto a page slot in an editor. */
export const PHOTO_DRAG_TYPE = 'application/x-flipbook-photo'

type Side = 'left' | 'right'

/** The paper and shape classes of a page. */
const usePaper = () => {
  const { paper, shape } = useBookLook()

  return `fb-paper fb-paper-${paper} ${shapeClass(shape)}`
}

const boxStyle = ({ x, y, width, height, rotate }: PageBox): CSSProperties => ({
  left: `${x}cqmin`,
  top: `${y}cqmin`,
  width: `${width}cqmin`,
  height: `${height}cqmin`,
  transform: rotate ? `rotate(${rotate}deg)` : undefined,
})

export interface PageViewProps {
  page: FlipbookPage
  /** Printed in the outer bottom corner. */
  number?: number
  /** Which side of a spread the page sits on, for the curve into the spine. */
  side?: Side
  /** The half of a panorama on this page. Left out, the whole panorama is set on the page. */
  half?: PageHalf
  /** False draws placeholders instead of loading images. */
  showImages?: boolean
  /** Editor: makes each photo slot clickable. */
  onSlotClick?: (slot: number) => void
  /** Editor: a photo id (as `PHOTO_DRAG_TYPE` data) was dropped on a slot. */
  onSlotDrop?: (slot: number, photoId: string) => void
  activeSlot?: number | null
  /** Editor: lets people move and zoom the photo in the active slot. */
  onPhotoPosition?: (slot: number, position: PhotoPosition) => void
}

/**
 * The inside of one book page. Sizes use container units (cqmin), so the same page looks right as
 * a thumbnail and as a full-screen spread. The parent must have `container-type: size`.
 */
export function PageView({
  page,
  number,
  side,
  half,
  showImages = true,
  onSlotClick,
  onSlotDrop,
  activeSlot,
  onPhotoPosition,
}: PageViewProps) {
  const { layout, caption, photos } = page
  const paper = usePaper()
  const { frame: bookFrame, shape } = useBookLook()
  const size = pageSize(shape)
  const across = size.width > size.height
  const placed = placedLayout(layout, size)
  const panorama = layout === 'panorama' ? panoramaView(half, size) : null
  const editable = !!onSlotClick
  const positioning = activeSlot != null && showImages && onPhotoPosition && photos[activeSlot] ? activeSlot : null
  const positioner = usePhotoPositioner(
    positioning === null ? null : photos[positioning]?.position,
    positioning === null ? undefined : (position) => onPhotoPosition?.(positioning, position),
  )

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

  const slot = (index: number, className = '', framed = false, style?: CSSProperties) => {
    const photo = photos[index] ?? null
    const frame = photoFrame(page, photo, bookFrame)
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
        style={style}
        ref={index === positioning ? positioner : undefined}
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
    <p className="fb-serif fb-italic fb-center" style={{ fontSize: '3.8cqmin' }}>
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

      {panorama && (
        <>
          <div className="fb-panorama">{slot(0, 'fb-placed', false, boxStyle(panorama.photo))}</div>
          {caption && typeof panorama.caption !== 'string' && (
            <p className="fb-placed-caption fb-serif fb-italic" style={boxStyle(panorama.caption)}>
              {caption}
            </p>
          )}
          {caption && typeof panorama.caption === 'string' && (
            <div className={`fb-caption-over ${panorama.caption === 'shade' ? 'is-shade' : ''}`} aria-hidden={panorama.caption === 'shade'}>
              {caption}
            </div>
          )}
        </>
      )}

      {layout === 'framed' && (
        <div className="fb-column" style={{ padding: '10cqmin 9cqmin 6cqmin' }}>
          <div className="fb-grow">{slot(0, 'fb-fill', true)}</div>
          <p
            className="fb-serif fb-italic fb-center"
            style={{ marginTop: '5cqmin', fontSize: '4.2cqmin', minHeight: '6cqmin', lineHeight: 1.35 }}
          >
            {caption}
          </p>
        </div>
      )}

      {layout === 'pair' && (
        <div className="fb-column" style={{ padding: '7cqmin', gap: '4cqmin' }}>
          {across ? (
            <div className="fb-row fb-grow" style={{ gap: '4cqmin' }}>
              {slot(0, 'fb-grow')}
              {slot(1, 'fb-grow')}
            </div>
          ) : (
            <>
              {slot(0, 'fb-grow')}
              {slot(1, 'fb-grow')}
            </>
          )}
          {smallCaption}
        </div>
      )}

      {layout === 'grid' && (
        <div className="fb-column" style={{ padding: '7cqmin', gap: '3cqmin' }}>
          <div className="fb-grid fb-grow" style={{ gap: '3cqmin' }}>
            {[0, 1, 2, 3].map((i) => slot(i))}
          </div>
          {smallCaption}
        </div>
      )}

      {layout === 'collage' && (
        <div className="fb-column" style={{ padding: '7cqmin', gap: '3cqmin' }}>
          {across ? (
            <div className="fb-row fb-grow" style={{ gap: '3cqmin' }}>
              {slot(0, 'fb-grow-large')}
              <div className="fb-column fb-grow" style={{ gap: '3cqmin' }}>
                {slot(1, 'fb-grow')}
                {slot(2, 'fb-grow')}
              </div>
            </div>
          ) : (
            <>
              {slot(0, 'fb-grow-large')}
              <div className="fb-row fb-grow" style={{ gap: '3cqmin' }}>
                {slot(1, 'fb-grow')}
                {slot(2, 'fb-grow')}
              </div>
            </>
          )}
          {smallCaption}
        </div>
      )}

      {placed && (
        <>
          {placed.slots.map((box, i) => slot(i, `fb-placed ${placed.loose ? 'is-loose' : ''}`, false, boxStyle(box)))}
          {caption && (
            <p className={`fb-placed-caption fb-serif ${placed.prose ? 'is-prose' : 'fb-italic'}`} style={boxStyle(placed.caption)}>
              {caption}
            </p>
          )}
        </>
      )}

      {layout === 'text' && (
        <div
          className="fb-column fb-center"
          style={{ alignItems: 'center', justifyContent: 'center', padding: `14cqmin ${measurePadding(12)}` }}
        >
          <span className="fb-serif" style={{ fontSize: '18cqmin', lineHeight: 0.6, opacity: 0.3 }} aria-hidden>
            “
          </span>
          <p className="fb-serif fb-italic" style={{ marginTop: '4cqmin', fontSize: '6cqmin', lineHeight: 1.4, textWrap: 'balance' }}>
            {caption || (editable ? 'Write something in the caption box below.' : '')}
          </p>
        </div>
      )}

      {number !== undefined && layout !== 'single' && !panorama && (
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
      style={PhotoCrop.of(photo.position).css}
    />
  )
}

/** Inside the front cover: a title page. */
export function TitlePageView({ book, side }: { book: Pick<FlipbookBook, 'title' | 'subtitle' | 'author' | 'year'>; side?: Side }) {
  const credit = [book.author, book.year].filter(Boolean).join(' · ')

  return (
    <div
      className={`${usePaper()} fb-page fb-center`}
      style={{ alignItems: 'center', justifyContent: 'center', padding: `12cqmin ${measurePadding(12)}` }}
    >
      <Ornament />
      <h2 className="fb-serif" style={{ marginTop: '6cqmin', fontSize: '7.5cqmin', fontWeight: 400, lineHeight: 1.1, textWrap: 'balance' }}>
        {book.title}
      </h2>
      {book.subtitle && (
        <p className="fb-serif fb-italic" style={{ marginTop: '4cqmin', fontSize: '4cqmin', lineHeight: 1.45 }}>
          {book.subtitle}
        </p>
      )}
      <div style={{ marginTop: '7cqmin', height: 1, width: '20cqmin', background: 'currentColor', opacity: 0.3 }} />
      {credit && <p style={{ margin: '5cqmin 0 0', fontSize: '2.6cqmin', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{credit}</p>}
      <PageSurface side={side} />
    </div>
  )
}

/** Inside the back cover, with the book's closing line. */
export function ColophonView({ book, side }: { book: Pick<FlipbookBook, 'colophon'>; side?: Side }) {
  return (
    <div
      className={`${usePaper()} fb-page fb-center`}
      style={{ alignItems: 'center', justifyContent: 'flex-end', padding: `12cqmin ${measurePadding(12)}`, opacity: 0.9 }}
    >
      {book.colophon && (
        <p className="fb-serif fb-italic" style={{ fontSize: '3.6cqmin' }}>
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
export function Ornament() {
  return (
    <svg viewBox="0 0 40 40" className="fb-ornament" aria-hidden>
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeOpacity="0.6" />
      <path d="M20 9 L 27 20 L 20 31 L 13 20 Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="20" cy="20" r="2.2" fill="currentColor" />
    </svg>
  )
}
