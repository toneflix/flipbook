import type { CSSProperties } from 'react'
import { BANDED_FRAMES, type FlipbookPhoto, type FrameStyle } from '@toneflix/flipbook-core'

export interface PrintedPhotoProps {
  photo: FlipbookPhoto | null
  frame: FrameStyle
  /** `cover` fills the parent; `contain` keeps the photo's shape and centres it. */
  fit?: 'cover' | 'contain'
  /** False draws a placeholder instead of loading the image. */
  show?: boolean
  /** Multiplies frame sizes, which otherwise follow the page width. */
  scale?: number
}

/** A photo printed on a page inside its frame. The parent must be positioned. */
export function PrintedPhoto({ photo, frame, fit = 'cover', show = true, scale = 1 }: PrintedPhotoProps) {
  const ratio = photo?.width && photo.height ? photo.width / photo.height : 4 / 3
  const style = fit === 'contain' ? ({ '--ratio': ratio } as CSSProperties) : undefined

  return (
    <div className="fb-print-frame-box" style={{ fontSize: `${scale}cqw` }}>
      <div className={`fb-print-frame fb-frame-${frame} ${fit === 'contain' ? 'is-contained' : ''}`} style={style}>
        {BANDED_FRAMES[frame] && <span className="fb-print-frame-band" aria-hidden />}
        {photo && show ? (
          <img
            src={photo.src}
            alt={photo.alt ?? ''}
            draggable={false}
            decoding="async"
            width={photo.width ?? undefined}
            height={photo.height ?? undefined}
            className="fb-print-photo fb-print-frame-photo"
          />
        ) : (
          <div className="fb-print-frame-photo fb-placeholder" />
        )}
        {frame === 'corners' &&
          ['tl', 'tr', 'bl', 'br'].map((corner) => <span key={corner} className={`fb-print-frame-corner is-${corner}`} aria-hidden />)}
        {frame === 'botanical' && ['tl', 'br'].map((corner) => <Sprig key={corner} corner={corner} />)}
      </div>
    </div>
  )
}

/** Leaves along a stem, alternating sides and shrinking toward the tip. */
const LEAVES = [14, 24, 34, 44, 54, 64, 74].map((x, i) => ({ x, angle: i % 2 ? 38 : -38, length: 26 - i * 2 }))

/** A sprig of leaves drawn in ink like a pen sketch, its stem along the frame rule. */
function Sprig({ corner }: { corner: string }) {
  return (
    <svg
      viewBox="0 0 100 40"
      className={`fb-print-frame-sprig is-${corner}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 20 Q 50 17, 92 20" strokeWidth="1.2" />
      {LEAVES.map(({ x, angle, length }) => (
        <g key={x} transform={`translate(${x} 20) rotate(${angle}) scale(${length / 20})`}>
          <path d="M0 0 C 5 -5, 14 -5, 20 0 C 14 5, 5 5, 0 0 Z" strokeWidth="1" />
          <path d="M2 0 L 16 0" strokeWidth="0.6" />
        </g>
      ))}
    </svg>
  )
}
