import {
  BANDED_FRAMES,
  PhotoCrop,
  pageSize,
  panoramaView,
  photoFrame,
  placedLayout,
  type Face,
  type FlipbookBook,
  type FlipbookPage,
  type FlipbookPhoto,
  type FrameStyle,
  type PageBox,
  type PageHalf,
  type PageShape,
  type PaperColor,
  type PhotoPosition,
} from '@toneflix/flipbook-core'
import { h, svg } from './dom'
import { renderBackCover, renderCover } from './cover'
import { PhotoPositioner } from './positioner'

export type Side = 'left' | 'right'

export interface PageLook {
  paper: PaperColor
  frame: FrameStyle
  /** Defaults to `portrait`. */
  shape?: PageShape
}

/** The classes a page or cover of this shape carries: its shape, and `is-across` when it is wider than tall. */
export function shapeClass(shape: PageShape = 'portrait') {
  const { width, height } = pageSize(shape)

  return `fb-shape-${shape}${width > height ? ' is-across' : ''}`
}

/** Side padding that keeps centred writing to a portrait page's measure, with `inset` units at each side. */
export const measurePadding = (inset: number) => `calc(50cqw - ${50 - inset}cqmin)`

export interface PageOptions {
  /** Printed in the outer bottom corner. */
  number?: number
  side?: Side
  /** The half of a panorama on this page. Left out, the whole panorama is set on the page. */
  half?: PageHalf
  /** False draws placeholders instead of loading images. */
  showImages?: boolean
  /** Editor: makes each photo slot clickable. */
  onSlotClick?: (slot: number) => void
  activeSlot?: number | null
  /** Editor: lets people move and zoom the photo in the active slot. */
  onPhotoPosition?: (slot: number, position: PhotoPosition) => void
}

const LEAVES = [14, 24, 34, 44, 54, 64, 74].map((x, i) => ({ x, angle: i % 2 ? 38 : -38, length: 26 - i * 2 }))

const sprig = (corner: string) =>
  svg(`<svg viewBox="0 0 100 40" class="fb-print-frame-sprig is-${corner}" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true">
    <path d="M4 20 Q 50 17, 92 20" stroke-width="1.2"/>
    ${LEAVES.map(
      ({ x, angle, length }) =>
        `<g transform="translate(${x} 20) rotate(${angle}) scale(${length / 20})"><path d="M0 0 C 5 -5, 14 -5, 20 0 C 14 5, 5 5, 0 0 Z" stroke-width="1"/><path d="M2 0 L 16 0" stroke-width="0.6"/></g>`,
    ).join('')}
  </svg>`)

export const ornament = () =>
  svg(`<svg viewBox="0 0 40 40" class="fb-ornament" aria-hidden="true">
    <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" stroke-opacity="0.6"/>
    <path d="M20 9 L 27 20 L 20 31 L 13 20 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
    <circle cx="20" cy="20" r="2.2" fill="currentColor"/>
  </svg>`)

export const image = (photo: FlipbookPhoto, className: string) =>
  h('img', {
    src: photo.src,
    alt: photo.alt ?? '',
    draggable: 'false',
    decoding: 'async',
    width: photo.width ?? undefined,
    height: photo.height ?? undefined,
    class: className,
    style: PhotoCrop.of(photo.position).css,
  })

export const boxStyle = ({ x, y, width, height, rotate }: PageBox): Record<string, string> => ({
  left: `${x}cqmin`,
  top: `${y}cqmin`,
  width: `${width}cqmin`,
  height: `${height}cqmin`,
  ...(rotate ? { transform: `rotate(${rotate}deg)` } : {}),
})

/** Light and grain over a whole page, with the curve into the spine on a spread. */
const surface = (side?: Side) =>
  h(
    'div',
    { class: `fb-page-surface ${side ? `is-${side}` : ''}`, 'aria-hidden': 'true' },
    h('div', { class: 'fb-page-surface-grain' }),
    side && h('div', { class: 'fb-page-surface-gutter' }),
    side && h('div', { class: 'fb-page-surface-sheen' }),
  )

const serif = (text: string, style: Record<string, string>, italic = true, center = true) =>
  h('p', { class: `fb-serif ${italic ? 'fb-italic' : ''} ${center ? 'fb-center' : ''}`, style }, text)

/** A photo printed on a page inside its frame. */
export function printedPhoto(photo: FlipbookPhoto | null, frame: FrameStyle, fit: 'cover' | 'contain' = 'cover', show = true, scale = 1) {
  const ratio = photo?.width && photo.height ? photo.width / photo.height : 4 / 3
  const box = h('div', { class: 'fb-print-frame-box', style: { fontSize: `${scale}cqmin` } })
  const print = h('div', { class: `fb-print-frame fb-frame-${frame} ${fit === 'contain' ? 'is-contained' : ''}` })

  if (fit === 'contain') print.style.setProperty('--ratio', String(ratio))
  if (BANDED_FRAMES[frame]) print.append(h('span', { class: 'fb-print-frame-band', 'aria-hidden': 'true' }))
  if (frame === 'film' || frame === 'deco') print.append(h('span', { class: `fb-print-frame-${frame}`, 'aria-hidden': 'true' }))
  print.append(
    photo && show
      ? h('div', { class: 'fb-print-photo fb-print-frame-photo' }, image(photo, 'fb-photo'))
      : h('div', { class: 'fb-print-frame-photo fb-placeholder' }),
  )
  if (frame === 'corners')
    for (const c of ['tl', 'tr', 'bl', 'br']) print.append(h('span', { class: `fb-print-frame-corner is-${c}`, 'aria-hidden': 'true' }))
  if (frame === 'botanical') print.append(sprig('tl'), sprig('br'))
  if (frame === 'tape')
    for (const c of ['tl', 'tr']) print.append(h('span', { class: `fb-print-frame-tape is-${c}`, 'aria-hidden': 'true' }))
  box.append(print)

  return box
}

/** The inside of one book page. The parent must have `container-type: size`. */
export function renderPage(page: FlipbookPage, look: PageLook, options: PageOptions = {}) {
  const { layout, caption, photos } = page
  const { number, side, half, showImages = true, onSlotClick, activeSlot, onPhotoPosition } = options
  const size = pageSize(look.shape)
  const across = size.width > size.height
  const placed = placedLayout(layout, size)
  const root = h('div', { class: `fb-paper fb-paper-${look.paper} fb-page ${shapeClass(look.shape)}` })

  const slot = (index: number, className = '', framed = false, style?: Record<string, string>) => {
    const photo = photos[index] ?? null
    const frame = photoFrame(page, photo, look.frame)
    const el = h('div', {
      class: ['fb-slot', className, framed && 'is-framed', onSlotClick && 'is-editable', onSlotClick && activeSlot === index && 'is-active']
        .filter(Boolean)
        .join(' '),
      role: onSlotClick ? 'button' : undefined,
      'aria-label': onSlotClick ? `Photo slot ${index + 1}` : undefined,
      style,
    })

    if (onSlotClick) el.addEventListener('click', () => onSlotClick(index))
    el.append(
      photo
        ? printedPhoto(photo, frame, framed ? 'contain' : 'cover', showImages)
        : h('div', { class: 'fb-slot-empty' }, onSlotClick ? 'Add a photo' : ''),
    )
    if (photo && showImages && onPhotoPosition && activeSlot === index)
      new PhotoPositioner(el, { position: photo.position, onChange: (position) => onPhotoPosition(index, position) })

    return el
  }

  const column = (style: Record<string, string>, ...children: (Node | null | false | '' | undefined)[]) =>
    h('div', { class: 'fb-column', style }, ...children)
  const small = caption ? serif(caption, { fontSize: '3.8cqmin' }) : null

  switch (layout) {
    case 'single':
      root.append(slot(0, 'fb-bleed'))
      if (caption) root.append(h('div', { class: 'fb-caption-over' }, caption))
      break
    case 'panorama': {
      const view = panoramaView(half, size)
      const shade = view.caption === 'shade'

      root.append(h('div', { class: 'fb-panorama' }, slot(0, 'fb-placed', false, boxStyle(view.photo))))
      if (caption && typeof view.caption !== 'string')
        root.append(h('p', { class: 'fb-placed-caption fb-serif fb-italic', style: boxStyle(view.caption) }, caption))
      else if (caption)
        root.append(h('div', { class: `fb-caption-over ${shade ? 'is-shade' : ''}`, 'aria-hidden': shade ? 'true' : undefined }, caption))
      break
    }
    case 'framed':
      root.append(
        column(
          { padding: '10cqmin 9cqmin 6cqmin' },
          h('div', { class: 'fb-grow' }, slot(0, 'fb-fill', true)),
          serif(caption ?? '', { marginTop: '5cqmin', fontSize: '4.2cqmin', minHeight: '6cqmin', lineHeight: '1.35' }),
        ),
      )
      break
    case 'pair':
      root.append(
        across
          ? column(
              { padding: '7cqmin', gap: '4cqmin' },
              h('div', { class: 'fb-row fb-grow', style: { gap: '4cqmin' } }, slot(0, 'fb-grow'), slot(1, 'fb-grow')),
              small,
            )
          : column({ padding: '7cqmin', gap: '4cqmin' }, slot(0, 'fb-grow'), slot(1, 'fb-grow'), small),
      )
      break
    case 'grid':
      root.append(
        column(
          { padding: '7cqmin', gap: '3cqmin' },
          h('div', { class: 'fb-grid fb-grow', style: { gap: '3cqmin' } }, ...[0, 1, 2, 3].map((i) => slot(i))),
          small,
        ),
      )
      break
    case 'collage':
      root.append(
        across
          ? column(
              { padding: '7cqmin', gap: '3cqmin' },
              h(
                'div',
                { class: 'fb-row fb-grow', style: { gap: '3cqmin' } },
                slot(0, 'fb-grow-large'),
                h('div', { class: 'fb-column fb-grow', style: { gap: '3cqmin' } }, slot(1, 'fb-grow'), slot(2, 'fb-grow')),
              ),
              small,
            )
          : column(
              { padding: '7cqmin', gap: '3cqmin' },
              slot(0, 'fb-grow-large'),
              h('div', { class: 'fb-row fb-grow', style: { gap: '3cqmin' } }, slot(1, 'fb-grow'), slot(2, 'fb-grow')),
              small,
            ),
      )
      break
    case 'text':
      root.append(
        h(
          'div',
          {
            class: 'fb-column fb-center',
            style: { alignItems: 'center', justifyContent: 'center', padding: `14cqmin ${measurePadding(12)}` },
          },
          h('span', { class: 'fb-serif', style: { fontSize: '18cqmin', lineHeight: '0.6', opacity: '0.3' }, 'aria-hidden': 'true' }, '“'),
          serif(
            caption || (onSlotClick ? 'Write something in the caption box below.' : ''),
            { marginTop: '4cqmin', fontSize: '6cqmin', lineHeight: '1.4', textWrap: 'balance' },
            true,
            false,
          ),
        ),
      )
      break
  }

  if (placed) {
    root.append(...placed.slots.map((box, i) => slot(i, `fb-placed ${placed.loose ? 'is-loose' : ''}`, false, boxStyle(box))))
    if (caption)
      root.append(
        h(
          'p',
          { class: `fb-placed-caption fb-serif ${placed.prose ? 'is-prose' : 'fb-italic'}`, style: boxStyle(placed.caption) },
          caption,
        ),
      )
  }

  if (number !== undefined && layout !== 'single' && layout !== 'panorama')
    root.append(h('span', { class: 'fb-page-number', style: side === 'left' ? { left: '0' } : { right: '0' } }, String(number)))
  root.append(surface(side))

  return root
}

export function renderTitlePage(book: FlipbookBook, look: PageLook, side?: Side) {
  const credit = [book.author, book.year].filter(Boolean).join(' · ')

  return h(
    'div',
    {
      class: `fb-paper fb-paper-${look.paper} fb-page fb-center ${shapeClass(look.shape)}`,
      style: { alignItems: 'center', justifyContent: 'center', padding: `12cqmin ${measurePadding(12)}` },
    },
    ornament(),
    h(
      'h2',
      {
        class: 'fb-serif',
        style: { marginTop: '6cqmin', fontSize: '7.5cqmin', fontWeight: '400', lineHeight: '1.1', textWrap: 'balance' },
      },
      book.title,
    ),
    book.subtitle && serif(book.subtitle, { marginTop: '4cqmin', fontSize: '4cqmin', lineHeight: '1.45' }, true, false),
    h('div', { style: { marginTop: '7cqmin', height: '1px', width: '20cqmin', background: 'currentColor', opacity: '0.3' } }),
    credit && h('p', { style: { marginTop: '5cqmin', fontSize: '2.6cqmin', letterSpacing: '0.2em', textTransform: 'uppercase' } }, credit),
    surface(side),
  )
}

export function renderColophon(book: FlipbookBook, look: PageLook, side?: Side) {
  return h(
    'div',
    {
      class: `fb-paper fb-paper-${look.paper} fb-page fb-center ${shapeClass(look.shape)}`,
      style: { alignItems: 'center', justifyContent: 'flex-end', padding: `12cqmin ${measurePadding(12)}`, opacity: '0.9' },
    },
    book.colophon && serif(book.colophon, { fontSize: '3.6cqmin' }, true, false),
    surface(side),
  )
}

export function renderBlank(look: PageLook, side?: Side) {
  return h('div', { class: `fb-paper fb-paper-${look.paper} fb-page ${shapeClass(look.shape)}` }, surface(side))
}

/** Any face of a book. Page numbers and the spine curve need `side`. */
export function renderFace(face: Face, book: FlipbookBook, side?: Side, numbered = true) {
  const look: PageLook = { paper: book.paper ?? 'ivory', frame: book.frame ?? 'none', shape: book.pageShape }

  switch (face.kind) {
    case 'cover':
      return renderCover(book)
    case 'back':
      return renderBackCover(book)
    case 'title':
      return renderTitlePage(book, look, side)
    case 'colophon':
      return renderColophon(book, look, side)
    case 'blank':
      return renderBlank(look, side)
    case 'page':
      return renderPage(book.pages[face.index], look, { number: numbered ? face.index + 1 : undefined, side, half: face.half })
  }
}
