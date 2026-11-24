/**
 * The shape of a book's pages.
 * - portrait: 3:4, taller than wide.
 * - landscape: 4:3, wider than tall.
 * - wide: 3:2, the shape of most printed photo books.
 * - square: 1:1.
 */
export type PageShape = 'portrait' | 'landscape' | 'wide' | 'square'

export const PAGE_SHAPES: Record<PageShape, { label: string; ratio: string; width: number; height: number }> = {
  portrait: { label: 'Portrait', ratio: '3:4', width: 3, height: 4 },
  landscape: { label: 'Landscape', ratio: '4:3', width: 4, height: 3 },
  wide: { label: 'Wide', ratio: '3:2', width: 3, height: 2 },
  square: { label: 'Square', ratio: '1:1', width: 1, height: 1 },
}

/**
 * A page's size in page units. One unit is 1% of the page's short side, so type and frames are the
 * same size on every shape: a portrait page is 100 × 133⅓ and a wide one 150 × 100.
 */
export interface PageSize {
  width: number
  height: number
}

const shapeOf = (shape?: PageShape | null) => PAGE_SHAPES[shape ?? 'portrait'] ?? PAGE_SHAPES.portrait

/** The size of a page of this shape in page units. */
export function pageSize(shape?: PageShape | null): PageSize {
  const { width, height } = shapeOf(shape)
  const short = Math.min(width, height)

  return { width: (100 * width) / short, height: (100 * height) / short }
}

/** Page width over page height. */
export function pageAspect(shape?: PageShape | null): number {
  const { width, height } = shapeOf(shape)

  return width / height
}

/** The size of a page of this shape in millimetres, given its short side. */
export function pageMillimetres(shape?: PageShape | null, short = 210): PageSize {
  const { width, height } = pageSize(shape)

  return { width: Math.round(width * short) / 100, height: Math.round(height * short) / 100 }
}
