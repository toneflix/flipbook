/**
 * Which part of a photo shows when a box crops it.
 * - x, y: 0 to 100. The point of the photo lined up with the same point of the box, like CSS
 *   `object-position`: 0 shows the left (or top) edge, 50 the middle, 100 the right (or bottom) edge.
 * - zoom: how far the photo is enlarged past just covering the box, from 1 to `PHOTO_ZOOM.max`.
 */
export interface PhotoPosition {
  x: number
  y: number
  zoom: number
}

export interface Size {
  width: number
  height: number
}

export interface Rect extends Size {
  left: number
  top: number
}

export const PHOTO_ZOOM = { min: 1, max: 4 }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places

/** A photo's position in its box, with the maths every renderer and editor shares. */
export class PhotoCrop implements PhotoPosition {
  static readonly CENTRE = new PhotoCrop()

  readonly x: number
  readonly y: number
  readonly zoom: number

  constructor(x = 50, y = 50, zoom = 1) {
    this.x = clamp(Number.isFinite(x) ? x : 50, 0, 100)
    this.y = clamp(Number.isFinite(y) ? y : 50, 0, 100)
    this.zoom = clamp(Number.isFinite(zoom) ? zoom : 1, PHOTO_ZOOM.min, PHOTO_ZOOM.max)
  }

  /** A position from stored data. Missing values fall back to the centre at no zoom. */
  static of(position?: Partial<PhotoPosition> | null): PhotoCrop {
    if (!position) return PhotoCrop.CENTRE

    return new PhotoCrop(position.x, position.y, position.zoom)
  }

  /** Centred with no zoom, which is how photos are set when nobody has moved them. */
  get isCentred(): boolean {
    return this.x === 50 && this.y === 50 && this.zoom === 1
  }

  /**
   * Where the photo is drawn, relative to the box's top left corner, so that it covers the box.
   * Without the photo's own size it is taken to have the box's shape.
   */
  rect(box: Size, image?: Size | null): Rect {
    const ratio = image?.width && image.height ? image.width / image.height : box.width / (box.height || 1)
    const cover = Math.max(box.width / ratio, box.height)
    const height = cover * this.zoom
    const width = height * ratio

    return { left: ((box.width - width) * this.x) / 100, top: ((box.height - height) * this.y) / 100, width, height }
  }

  /** The position after dragging the photo by `dx`, `dy` (in the box's units). */
  pan(dx: number, dy: number, box: Size, image?: Size | null): PhotoCrop {
    const { width, height } = this.rect(box, image)
    const spareX = width - box.width
    const spareY = height - box.height
    const x = spareX > 0 ? this.x - (dx / spareX) * 100 : this.x
    const y = spareY > 0 ? this.y - (dy / spareY) * 100 : this.y

    return new PhotoCrop(x, y, this.zoom)
  }

  /** The position at another zoom. The point lined up by x and y stays where it is. */
  zoomTo(zoom: number): PhotoCrop {
    return new PhotoCrop(this.x, this.y, zoom)
  }

  /** Whether the photo can move along each axis in a box, which is false where it only just covers it. */
  movable(box: Size, image?: Size | null): { x: boolean; y: boolean } {
    const { width, height } = this.rect(box, image)

    return { x: width - box.width > 0.5, y: height - box.height > 0.5 }
  }

  /** Styles for an `<img>` with `object-fit: cover` that fills a box which clips it. */
  get css(): { objectPosition: string; transform: string; transformOrigin: string } {
    const at = `${this.x}% ${this.y}%`

    return { objectPosition: at, transform: this.zoom === 1 ? '' : `scale(${this.zoom})`, transformOrigin: at }
  }

  equals(other: Partial<PhotoPosition> | null | undefined): boolean {
    const that = PhotoCrop.of(other)

    return this.x === that.x && this.y === that.y && this.zoom === that.zoom
  }

  /** Plain data to store: whole-ish percentages and a zoom to two places. */
  toJSON(): PhotoPosition {
    return { x: round(this.x, 1), y: round(this.y, 1), zoom: round(this.zoom, 2) }
  }
}
