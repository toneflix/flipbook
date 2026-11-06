import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  COVER_DESIGNS,
  COVER_THEMES,
  DEFAULT_GRIP,
  DEFAULT_PHYSICS,
  FRAME_STYLES,
  BookLookProvider,
  Flipbook,
  PAGE_LAYOUTS,
  PageView,
  PAPER_COLORS,
  coverHasText,
  type CoverDesign,
  type CoverTheme,
  type FlipbookBook,
  type FlipbookHandle,
  type FlipbookPage,
  type FlipbookProps,
  type FrameStyle,
  type GripOptions,
  type PageLayout,
  type PaperColor,
  type PhotoPosition,
  type TurnPhysics,
} from '@toneflix/flipbook-react'
import { demoBook, demoPages, photos } from './book'

type ViewerOptions = Required<
  Pick<
    FlipbookProps,
    | 'layout'
    | 'controls'
    | 'thumbnails'
    | 'soundButton'
    | 'sound'
    | 'fullscreenButton'
    | 'fullscreenPrompt'
    | 'landscape'
    | 'stiffCovers'
    | 'shading'
  >
> & { autoHide: number; keyboard: 'focus' | 'global' | 'off'; startPage: number; background: string }

const DEFAULT_VIEWER: ViewerOptions = {
  layout: 'auto',
  controls: true,
  autoHide: 3200,
  thumbnails: true,
  soundButton: true,
  sound: false,
  fullscreenButton: true,
  fullscreenPrompt: false,
  landscape: true,
  keyboard: 'focus',
  stiffCovers: true,
  shading: 1,
  startPage: 0,
  background: '',
}

const PHYSICS_RANGES: Record<keyof TurnPhysics, { label: string; min: number; max: number; step: number; hint: string }> = {
  fall: { label: 'Fall spring', min: 0.002, max: 0.02, step: 0.0005, hint: 'How fast a released page drops' },
  auto: { label: 'Auto-turn spring', min: 0.002, max: 0.02, step: 0.0005, hint: 'Speed of button, key and tap turns' },
  peek: { label: 'Peek spring', min: 0.005, max: 0.05, step: 0.001, hint: 'How quickly a hovered corner lifts' },
  flick: { label: 'Flick look-ahead (ms)', min: 0, max: 400, step: 10, hint: 'How far a flick carries the page' },
  lift: { label: 'Lift', min: 0, max: 0.4, step: 0.01, hint: 'How high a falling page arcs off the paper' },
}

const options = <T extends string>(record: Record<T, { label: string }>) =>
  (Object.keys(record) as T[]).map((value) => (
    <option key={value} value={value}>
      {record[value].label}
    </option>
  ))

/** Every option of the flipbook, live, with the code to reproduce it. */
export function Playground() {
  const flipbook = useRef<FlipbookHandle>(null)
  const [book, setBook] = useState<FlipbookBook>(demoBook)
  const [viewer, setViewer] = useState<ViewerOptions>(DEFAULT_VIEWER)
  const [physics, setPhysics] = useState<TurnPhysics>(DEFAULT_PHYSICS)
  const [grip, setGrip] = useState<GripOptions>(DEFAULT_GRIP)
  const [place, setPlace] = useState('Cover')
  const [tab, setTab] = useState<'book' | 'pages' | 'viewer' | 'physics' | 'code'>('book')
  const [copied, setCopied] = useState(false)
  const [positioning, setPositioning] = useState<{ page: number; slot: number } | null>(null)

  const setBookField = <K extends keyof FlipbookBook>(key: K, value: FlipbookBook[K]) => setBook((b) => ({ ...b, [key]: value }))
  const setViewerField = <K extends keyof ViewerOptions>(key: K, value: ViewerOptions[K]) => setViewer((v) => ({ ...v, [key]: value }))
  const setPage = (index: number, page: Partial<FlipbookPage>) =>
    setBook((b) => ({ ...b, pages: b.pages.map((p, i) => (i === index ? fitPhotos({ ...p, ...page }, index) : p)) }))

  const setPhotoFrame = (index: number, slot: number, frame: FrameStyle | null) =>
    setPage(index, { photos: book.pages[index].photos.map((photo, s) => (s === slot && photo ? { ...photo, frame } : photo)) })

  const setPhotoPosition = (index: number, slot: number, position: PhotoPosition) =>
    setPage(index, { photos: book.pages[index].photos.map((photo, s) => (s === slot && photo ? { ...photo, position } : photo)) })

  const setPageCount = (count: number) =>
    setBook((b) => ({
      ...b,
      pages: count <= b.pages.length ? b.pages.slice(0, count) : [...b.pages, ...demoPages(count).slice(b.pages.length)],
    }))

  const props: FlipbookProps = {
    book,
    layout: viewer.layout,
    controls: viewer.controls,
    autoHide: viewer.autoHide > 0 ? viewer.autoHide : false,
    thumbnails: viewer.thumbnails,
    soundButton: viewer.soundButton,
    sound: viewer.sound,
    fullscreenButton: viewer.fullscreenButton,
    fullscreenPrompt: viewer.fullscreenPrompt,
    landscape: viewer.landscape,
    keyboard: viewer.keyboard === 'off' ? false : viewer.keyboard === 'global' ? 'global' : true,
    stiffCovers: viewer.stiffCovers,
    shading: viewer.shading,
    physics,
    grip,
    background: viewer.background || undefined,
  }

  const [framework, setFramework] = useState<Framework>('react')
  const code = useMemo(() => snippet(framework, viewer, physics, grip), [framework, viewer, physics, grip])
  const bookJson = useMemo(() => JSON.stringify(book, null, 2), [book])

  const copy = async (text: string) => {
    await navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="pg">
      <div className="pg-stage">
        <Flipbook
          key={`${viewer.startPage}`}
          ref={flipbook}
          {...props}
          startPage={viewer.startPage || undefined}
          onPageChange={(p) => setPlace(p.label)}
        />
      </div>

      <div className="pg-status">
        <span>{place}</span>
        <div className="pg-status-actions">
          <button type="button" onClick={() => flipbook.current?.go(0)}>
            Close
          </button>
          <button type="button" onClick={() => flipbook.current?.prev()}>
            Previous
          </button>
          <button type="button" onClick={() => flipbook.current?.next()}>
            Next
          </button>
        </div>
      </div>

      <div className="pg-panel">
        <div className="pg-tabs" role="tablist">
          {(['book', 'pages', 'viewer', 'physics', 'code'] as const).map((name) => (
            <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>
              {name === 'physics' ? 'Physics & grip' : name[0].toUpperCase() + name.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'book' && (
          <div className="pg-grid">
            <Field label="Title">
              <input value={book.title} onChange={(e) => setBookField('title', e.target.value)} />
            </Field>
            <Field label="Subtitle">
              <input value={book.subtitle ?? ''} onChange={(e) => setBookField('subtitle', e.target.value || null)} />
            </Field>
            <Field label="Author">
              <input value={book.author ?? ''} onChange={(e) => setBookField('author', e.target.value || null)} />
            </Field>
            <Field label="Year">
              <input value={book.year ?? ''} onChange={(e) => setBookField('year', e.target.value || null)} />
            </Field>
            <Field label="Cover design" hint={COVER_DESIGNS[book.coverDesign ?? 'classic'].description}>
              <select value={book.coverDesign ?? 'classic'} onChange={(e) => setBookField('coverDesign', e.target.value as CoverDesign)}>
                {options(COVER_DESIGNS)}
              </select>
            </Field>
            <Field label="Cover text">
              <label className="pg-check">
                <input type="checkbox" checked={coverHasText(book)} onChange={(e) => setBookField('coverText', e.target.checked)} />
                Print the title on the cover
              </label>
            </Field>
            <Field label="Cover cloth">
              <select value={book.theme} onChange={(e) => setBookField('theme', e.target.value as CoverTheme)}>
                {options(COVER_THEMES)}
              </select>
            </Field>
            <Field label="Paper">
              <select value={book.paper} onChange={(e) => setBookField('paper', e.target.value as PaperColor)}>
                {options(PAPER_COLORS)}
              </select>
            </Field>
            <Field label="Frame" hint={FRAME_STYLES[book.frame ?? 'none'].description}>
              <select value={book.frame} onChange={(e) => setBookField('frame', e.target.value as FrameStyle)}>
                {options(FRAME_STYLES)}
              </select>
            </Field>
            <Field label="Cover photo">
              <select
                value={book.cover ? photos.indexOf(book.cover) : -1}
                onChange={(e) => setBookField('cover', Number(e.target.value) >= 0 ? photos[Number(e.target.value)] : null)}
              >
                <option value={-1}>None</option>
                {photos.map((photo, i) => (
                  <option key={photo.src} value={i}>
                    {photo.alt}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Kicker">
              <input value={book.kicker ?? ''} onChange={(e) => setBookField('kicker', e.target.value || null)} />
            </Field>
            <Field label="Colophon">
              <input value={book.colophon ?? ''} onChange={(e) => setBookField('colophon', e.target.value || null)} />
            </Field>
            <Field label="Imprint">
              <input value={book.imprint ?? ''} onChange={(e) => setBookField('imprint', e.target.value || null)} />
            </Field>
            <Field label={`Pages: ${book.pages.length}`}>
              <input type="range" min={1} max={40} value={book.pages.length} onChange={(e) => setPageCount(Number(e.target.value))} />
            </Field>
          </div>
        )}

        {tab === 'pages' && (
          <div className="pg-pages">
            {book.pages.map((page, i) => (
              <div key={i} className="pg-page">
                <strong>{i + 1}</strong>
                <select
                  value={page.layout}
                  onChange={(e) => setPage(i, { layout: e.target.value as PageLayout })}
                  aria-label={`Page ${i + 1} layout`}
                >
                  {options(PAGE_LAYOUTS)}
                </select>
                <select
                  value={page.frame ?? ''}
                  onChange={(e) => setPage(i, { frame: (e.target.value || null) as FrameStyle | null })}
                  aria-label={`Page ${i + 1} frame`}
                  disabled={page.layout === 'single' || page.layout === 'text'}
                >
                  <option value="">Book frame</option>
                  {options(FRAME_STYLES)}
                </select>
                <input
                  value={page.caption ?? ''}
                  placeholder="Caption"
                  onChange={(e) => setPage(i, { caption: e.target.value || null })}
                  aria-label={`Page ${i + 1} caption`}
                />
                {page.layout !== 'single' && page.photos.length > 0 && (
                  <div className="pg-photo-frames">
                    {page.photos.map((photo, s) => (
                      <select
                        key={s}
                        value={photo?.frame ?? ''}
                        onChange={(e) => setPhotoFrame(i, s, (e.target.value || null) as FrameStyle | null)}
                        aria-label={`Page ${i + 1} photo ${s + 1} frame`}
                      >
                        <option value="">Photo {s + 1}: page frame</option>
                        {options(FRAME_STYLES)}
                      </select>
                    ))}
                  </div>
                )}
                {page.photos.some(Boolean) && (
                  <button
                    type="button"
                    className="pg-position-toggle"
                    aria-expanded={positioning?.page === i}
                    onClick={() => setPositioning(positioning?.page === i ? null : { page: i, slot: 0 })}
                  >
                    {positioning?.page === i ? 'Done positioning' : 'Position photos'}
                  </button>
                )}
                {positioning?.page === i && (
                  <div className="pg-position">
                    <BookLookProvider paper={book.paper} frame={book.frame}>
                      <div className="pg-position-page">
                        <PageView
                          page={page}
                          activeSlot={positioning.slot}
                          onSlotClick={(slot) => setPositioning({ page: i, slot })}
                          onPhotoPosition={(slot, position) => setPhotoPosition(i, slot, position)}
                        />
                      </div>
                    </BookLookProvider>
                    <p className="pg-position-hint">
                      Click a photo, then drag it to choose what shows. Scroll or pinch to zoom, or use the arrow keys, + and −. Press 0 to
                      centre it again.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'viewer' && (
          <div className="pg-grid">
            <Field label="Layout">
              <select value={viewer.layout} onChange={(e) => setViewerField('layout', e.target.value as ViewerOptions['layout'])}>
                <option value="auto">Auto (spread when it fits)</option>
                <option value="spread">Always two pages</option>
                <option value="single">One page at a time</option>
              </select>
            </Field>
            <Field label="Keyboard">
              <select value={viewer.keyboard} onChange={(e) => setViewerField('keyboard', e.target.value as ViewerOptions['keyboard'])}>
                <option value="focus">When the book has focus</option>
                <option value="global">Anywhere on the page</option>
                <option value="off">Off</option>
              </select>
            </Field>
            <Field label={`Open at page: ${viewer.startPage || 'cover'}`}>
              <input
                type="range"
                min={0}
                max={book.pages.length}
                value={viewer.startPage}
                onChange={(e) => setViewerField('startPage', Number(e.target.value))}
              />
            </Field>
            <Field label={`Hide controls after: ${viewer.autoHide ? `${(viewer.autoHide / 1000).toFixed(1)}s` : 'never'}`}>
              <input
                type="range"
                min={0}
                max={8000}
                step={200}
                value={viewer.autoHide}
                onChange={(e) => setViewerField('autoHide', Number(e.target.value))}
              />
            </Field>
            <Field label={`Shading: ${viewer.shading.toFixed(2)}`}>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={viewer.shading}
                onChange={(e) => setViewerField('shading', Number(e.target.value))}
              />
            </Field>
            <Field label="Background" hint="Any CSS background. Empty uses a glow tinted by the cover.">
              <input value={viewer.background} placeholder="#111" onChange={(e) => setViewerField('background', e.target.value)} />
            </Field>
            {(
              [
                ['controls', 'Controls'],
                ['thumbnails', 'Page thumbnails'],
                ['soundButton', 'Sound button'],
                ['sound', 'Sound on'],
                ['fullscreenButton', 'Full screen button'],
                ['fullscreenPrompt', 'Ask to open full screen'],
                ['landscape', 'Ask phones to turn sideways'],
                ['stiffCovers', 'Stiff covers'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="pg-check">
                <input type="checkbox" checked={viewer[key]} onChange={(e) => setViewerField(key, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        )}

        {tab === 'physics' && (
          <div className="pg-grid">
            {(Object.keys(PHYSICS_RANGES) as (keyof TurnPhysics)[]).map((key) => {
              const range = PHYSICS_RANGES[key]

              return (
                <Field key={key} label={`${range.label}: ${physics[key]}`} hint={range.hint}>
                  <input
                    type="range"
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    value={physics[key]}
                    onChange={(e) => setPhysics((p) => ({ ...p, [key]: Number(e.target.value) }))}
                  />
                </Field>
              )
            })}
            <Field label={`Edge grip width: ${grip.edgeX}`} hint="Share of the page width along the outer edge that grabs the edge">
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.01}
                value={grip.edgeX}
                onChange={(e) => setGrip((g) => ({ ...g, edgeX: Number(e.target.value) }))}
              />
            </Field>
            <Field label={`Corner grip height: ${grip.edgeY}`} hint="Share of the page height at the top and bottom that grabs a corner">
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.01}
                value={grip.edgeY}
                onChange={(e) => setGrip((g) => ({ ...g, edgeY: Number(e.target.value) }))}
              />
            </Field>
            <label className="pg-check">
              <input type="checkbox" checked={grip.peek} onChange={(e) => setGrip((g) => ({ ...g, peek: e.target.checked }))} />
              Lift corners under the mouse
            </label>
            <div className="pg-actions">
              <button
                type="button"
                onClick={() => {
                  setPhysics(DEFAULT_PHYSICS)
                  setGrip(DEFAULT_GRIP)
                }}
              >
                Reset physics
              </button>
            </div>
          </div>
        )}

        {tab === 'code' && (
          <div className="pg-code">
            <div className="pg-code-head">
              <select value={framework} onChange={(e) => setFramework(e.target.value as Framework)} aria-label="Package">
                <option value="react">React</option>
                <option value="vue">Vue</option>
                <option value="vanilla">Vanilla JS</option>
                <option value="native">React Native</option>
              </select>
              <button type="button" onClick={() => copy(code)}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre>
              <code>{code}</code>
            </pre>
            <div className="pg-code-head">
              <span>book</span>
              <button type="button" onClick={() => copy(bookJson)}>
                Copy
              </button>
            </div>
            <pre className="pg-json">
              <code>{bookJson}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="pg-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

/** Gives a page as many photos as its layout has slots. */
function fitPhotos(page: FlipbookPage, index: number): FlipbookPage {
  const slots = PAGE_LAYOUTS[page.layout].slots
  const filled = Array.from({ length: slots }, (_, s) => page.photos[s] ?? photos[(index * 3 + s) % photos.length])

  return { ...page, photos: filled }
}

type Framework = 'react' | 'vue' | 'vanilla' | 'native'

/** Code reproducing the current options in each package, leaving out defaults. */
function snippet(framework: Framework, viewer: ViewerOptions, physics: TurnPhysics, grip: GripOptions) {
  const options: [string, string][] = []
  const changed = <T extends object>(value: T, defaults: T) =>
    (Object.keys(value) as (keyof T)[]).filter((k) => value[k] !== defaults[k]).map((k) => `${String(k)}: ${value[k]}`)

  if (viewer.startPage) options.push(['startPage', `${viewer.startPage}`])
  if (viewer.layout !== 'auto') options.push(['layout', `'${viewer.layout}'`])
  if (viewer.autoHide !== DEFAULT_VIEWER.autoHide) options.push(['autoHide', `${viewer.autoHide || false}`])
  if (viewer.keyboard !== 'focus' && framework !== 'native') options.push(['keyboard', viewer.keyboard === 'off' ? 'false' : "'global'"])
  if (viewer.shading !== 1) options.push(['shading', `${viewer.shading}`])
  if (viewer.background) options.push(['background', `'${viewer.background}'`])
  for (const key of ['controls', 'thumbnails', 'soundButton', 'fullscreenButton', 'landscape', 'stiffCovers'] as const) {
    if (framework === 'native' && (key === 'soundButton' || key === 'fullscreenButton')) continue
    if (!viewer[key]) options.push([key, 'false'])
  }
  if (viewer.sound && framework !== 'native') options.push(['sound', 'true'])
  if (viewer.fullscreenPrompt && framework !== 'native') options.push(['fullscreenPrompt', 'true'])

  const physicsChanged = changed(physics, DEFAULT_PHYSICS)
  const gripChanged = changed(grip, DEFAULT_GRIP)

  if (physicsChanged.length) options.push(['physics', `{ ${physicsChanged.join(', ')} }`])
  if (gripChanged.length) options.push(['grip', `{ ${gripChanged.join(', ')} }`])

  const jsx = (indent: string) => [`${indent}book={book}`, ...options.map(([k, v]) => `${indent}${k}={${v.replace(/^'(.*)'$/, '"$1"')}}`)]

  switch (framework) {
    case 'react':
      return [
        "import { Flipbook } from '@toneflix/flipbook-react'",
        "import '@toneflix/flipbook-react/style.css'",
        '',
        'export function Book({ book }) {',
        '  return (',
        "    <div style={{ height: '100vh' }}>",
        '      <Flipbook',
        ...jsx('        '),
        '      />',
        '    </div>',
        '  )',
        '}',
      ].join('\n')
    case 'native':
      return [
        "import { View } from 'react-native'",
        "import { Flipbook } from '@toneflix/flipbook-native'",
        '',
        'export function Book({ book }) {',
        '  return (',
        '    <View style={{ flex: 1 }}>',
        '      <Flipbook',
        ...jsx('        '),
        '      />',
        '    </View>',
        '  )',
        '}',
      ].join('\n')
    case 'vue': {
      const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
      const attrs = options.map(([k, v]) =>
        /^'.*'$/.test(v) ? `    ${kebab(k)}=${v.replace(/^'(.*)'$/, '"$1"')}` : `    :${kebab(k)}="${v.replace(/'/g, "\\'")}"`,
      )

      return [
        '<script setup>',
        "import { Flipbook } from '@toneflix/flipbook-vue'",
        "import '@toneflix/flipbook-vue/style.css'",
        '',
        "defineProps(['book'])",
        '</script>',
        '',
        '<template>',
        '  <div style="height: 100vh">',
        '    <Flipbook',
        '      :book="book"',
        ...attrs.map((a) => `  ${a}`),
        '    />',
        '  </div>',
        '</template>',
      ].join('\n')
    }
    case 'vanilla':
      return [
        "import { Flipbook } from '@toneflix/flipbook'",
        "import '@toneflix/flipbook/style.css'",
        '',
        "const flipbook = new Flipbook(document.querySelector('#book'), {",
        '  book,',
        ...options.map(([k, v]) => `  ${k}: ${v},`),
        '})',
      ].join('\n')
  }
}
