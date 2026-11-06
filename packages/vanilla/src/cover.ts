import { DECO, FLEURON, coverHasText, type CoverArt, type FlipbookBook } from '@toneflix/flipbook-core'
import { h, svg } from './dom'
import { image, ornament } from './pages'

type Corner = 'tl' | 'tr' | 'bl' | 'br'

const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br']

/** SVG markup for a piece of cover line art, drawn in the current ink. */
export function coverArtMarkup(art: CoverArt, className: string) {
  const strokes = art.strokes
    .map(
      ({ d, width, opacity = 1 }) =>
        `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-opacity="${opacity}"/>`,
    )
    .join('')
  const fills = art.fills.map((d) => `<path d="${d}" fill="currentColor"/>`).join('')

  return `<svg viewBox="${art.viewBox}" class="${className}" preserveAspectRatio="none" aria-hidden="true">${strokes}${fills}</svg>`
}

const fleurons = () => CORNERS.map((corner) => svg(coverArtMarkup(FLEURON, `fb-fleuron is-${corner}`)))

const photo = (book: FlipbookBook, className: string, showImages: boolean) =>
  book.cover && h('div', { class: className }, showImages ? image(book.cover, 'fb-photo') : h('div', { class: 'fb-placeholder' }))

const title = (book: FlipbookBook) => h('h1', { class: 'fb-serif fb-cover-title' }, book.title)
const kicker = (book: FlipbookBook) => book.kicker && h('p', { class: 'fb-kicker' }, book.kicker)
const subtitle = (book: FlipbookBook) => book.subtitle && h('p', { class: 'fb-serif fb-italic fb-cover-subtitle' }, book.subtitle)

/** The design's own layout, between the hinge and the finish. */
function design(book: FlipbookBook, showImages: boolean): (Node | null | undefined | false | '')[] {
  const text = coverHasText(book)

  switch (book.coverDesign ?? 'classic') {
    case 'gilt':
      return [
        h('div', { class: 'fb-cover-frame' }),
        ...fleurons(),
        h(
          'div',
          { class: 'fb-cover-stack' },
          text && kicker(book),
          text && title(book),
          photo(book, 'fb-cover-photo is-oval', showImages),
          text && subtitle(book),
        ),
      ]
    case 'window':
      return [
        photo(book, 'fb-cover-window', showImages) || h('div', { class: 'fb-cover-window is-empty' }, ornament()),
        text && h('div', { class: 'fb-cover-stamp' }, kicker(book), title(book), subtitle(book)),
      ]
    case 'label':
      return [
        book.cover &&
          h(
            'div',
            { class: 'fb-cover-print' },
            photo(book, 'fb-cover-print-photo', showImages),
            ...CORNERS.map((corner) => h('span', { class: `fb-print-frame-corner is-${corner}`, 'aria-hidden': 'true' })),
          ),
        text && h('div', { class: `fb-cover-label ${book.cover ? '' : 'is-alone'}` }, kicker(book), title(book), subtitle(book)),
      ]
    case 'deco':
      return [
        svg(coverArtMarkup(DECO, 'fb-cover-rays')),
        h(
          'div',
          { class: 'fb-cover-stack is-deco' },
          text && kicker(book),
          photo(book, 'fb-cover-photo is-arch', showImages),
          text && title(book),
          text && subtitle(book),
        ),
      ]
    case 'image':
      return [
        book.cover &&
          h('div', { class: 'fb-cover-art' }, showImages ? image(book.cover, 'fb-photo') : h('div', { class: 'fb-placeholder' })),
        book.cover && h('div', { class: 'fb-cover-tint' }),
        text && h('div', { class: `fb-cover-caption ${book.cover ? '' : 'is-plain'}` }, kicker(book), title(book), subtitle(book)),
      ]
    default:
      return [
        h(
          'div',
          { class: 'fb-cover-panel' },
          text && kicker(book),
          text && title(book),
          photo(book, 'fb-cover-photo', showImages) || (text && subtitle(book)),
        ),
      ]
  }
}

const shell = (book: FlipbookBook, hinge: 'left' | 'right', ...children: (Node | null | undefined | false | '')[]) =>
  h(
    'div',
    { class: `fb-cover fb-cover-${book.theme ?? 'classic'} fb-design-${book.coverDesign ?? 'classic'}` },
    ...children,
    h('div', { class: `fb-hinge is-${hinge}` }),
    h('div', { class: 'fb-cover-finish', 'aria-hidden': 'true' }),
  )

/** The front cover, laid out by the book's `coverDesign`. */
export function renderCover(book: FlipbookBook, showImages = true) {
  return shell(book, 'left', ...design(book, showImages))
}

/** The back cover: the same board, with the brand and imprint. */
export function renderBackCover(book: FlipbookBook) {
  const gilt = book.coverDesign === 'gilt'

  return shell(
    book,
    'right',
    gilt && h('div', { class: 'fb-cover-frame' }),
    ...(gilt ? fleurons() : []),
    h(
      'div',
      { class: 'fb-imprint' },
      ornament(),
      book.brand && h('p', { class: 'fb-kicker', style: { marginTop: '2cqw', fontSize: '3cqw' } }, book.brand),
      book.imprint && h('p', { class: 'fb-kicker', style: { marginTop: '2cqw', fontSize: '2.4cqw', opacity: '0.6' } }, book.imprint),
    ),
  )
}
