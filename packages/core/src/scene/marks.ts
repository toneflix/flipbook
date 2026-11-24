import type { CoverArt } from '../cover-art'
import type { Box, Color, Matrix, SceneNode } from './types'

/** The book's ornament in `box`: a ring around a diamond with a dot at its heart. */
export function ornament(box: Box, ink: Color): SceneNode[] {
  const scale = box.width / 40
  const at = (x: number, y: number) => ({ x: box.x + x * scale, y: box.y + y * scale })

  return [
    { kind: 'stroke', shape: { type: 'circle', center: at(20, 20), radius: 18.5 * scale }, color: ink, width: scale, opacity: 0.6 },
    {
      kind: 'stroke',
      shape: { type: 'polygon', points: [at(20, 9), at(27, 20), at(20, 31), at(13, 20)] },
      color: ink,
      width: 1.4 * scale,
      join: 'round',
    },
    { kind: 'fill', shape: { type: 'circle', center: at(20, 20), radius: 2.2 * scale }, paint: ink },
  ]
}

/** Cover line art stretched over `box`, mirrored across it when asked. */
export function coverArt(art: CoverArt, box: Box, ink: Color, mirror: { x?: boolean; y?: boolean } = {}): SceneNode[] {
  const [, , width, height] = art.viewBox.split(/\s+/).map(Number)
  const sx = box.width / width
  const sy = box.height / height
  const transform: Matrix = [
    mirror.x ? -sx : sx,
    0,
    0,
    mirror.y ? -sy : sy,
    mirror.x ? box.x + box.width : box.x,
    mirror.y ? box.y + box.height : box.y,
  ]
  const weight = Math.sqrt(sx * sy)

  return [
    ...art.strokes.map(({ d, width: stroke, opacity }): SceneNode => ({
      kind: 'stroke',
      shape: { type: 'path', d, transform },
      color: ink,
      width: stroke * weight,
      ...(opacity !== undefined ? { opacity } : {}),
    })),
    ...art.fills.map((d): SceneNode => ({ kind: 'fill', shape: { type: 'path', d, transform }, paint: ink })),
  ]
}
