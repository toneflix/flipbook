/**
 * A page as drawing instructions, in page units: 1 unit is 1% of the page width, so a 3:4 page is 100 × 133⅓.
 * Scenes are plain data, so any renderer that can fill shapes, draw images and set text can draw a page.
 */

export interface Point {
  x: number
  y: number
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** A 2D affine transform in CSS `matrix(a, b, c, d, e, f)` order. */
export type Matrix = [number, number, number, number, number, number]

/** A CSS colour: hex or `rgba()`. */
export type Color = string

export interface GradientStop {
  offset: number
  color: Color
}

export type Paint =
  | Color
  /** With `repeat`, the stops repeat every `from`–`to` across the whole shape, like CSS `repeating-linear-gradient`. */
  | { type: 'linear'; from: Point; to: Point; stops: GradientStop[]; repeat?: boolean }
  /**
   * An elliptical gradient: `radius` gives the ellipse's half width and half height. With `repeat`, the
   * stops repeat every radius out to the shape's edges, like CSS `repeating-radial-gradient`.
   */
  | { type: 'radial'; center: Point; radius: Point; stops: GradientStop[]; repeat?: boolean }
  /** One of the library's texture tiles, repeated from the page's top left corner `size` units square. */
  | { type: 'texture'; texture: TextureName; size: number }
  /** A tile of other nodes, `width` × `height` units, repeated from `origin` and turned `rotate` degrees about it. */
  | { type: 'tile'; width: number; height: number; origin: Point; rotate?: number; nodes: SceneNode[] }

export type TextureName = 'paper-fine' | 'paper-kraft' | 'paper-charcoal' | 'grain-fine' | 'grain-kraft' | 'grain-charcoal'

export type Shape =
  | { type: 'rect'; box: Box }
  | { type: 'ellipse'; box: Box }
  /** A rectangle with rounded corners: radii top left, top right, bottom right, bottom left. */
  | { type: 'roundrect'; box: Box; radii: [number, number, number, number] }
  | { type: 'circle'; center: Point; radius: number }
  | { type: 'polygon'; points: Point[] }
  /** A band between two rectangles, filled even-odd. */
  | { type: 'ring'; outer: Box; inner: Box }
  /** SVG path data, mapped onto the page by `transform`. */
  | { type: 'path'; d: string; transform: Matrix }
  /** The part of `outer` outside `inner`. */
  | { type: 'cutout'; outer: Shape; inner: Shape }
  /** Several shapes filled as one, so overlaps don't print twice. */
  | { type: 'union'; shapes: Shape[] }

export type Blend = 'normal' | 'multiply' | 'screen' | 'soft-light' | 'overlay'

/** How a photo is toned to look printed on the paper, as CSS filter amounts. */
export interface PhotoTone {
  sepia: number
  saturate: number
  contrast: number
  brightness: number
}

export interface FontSpec {
  family: 'serif' | 'sans'
  style: 'normal' | 'italic'
  weight: number
  size: number
  /** Extra space after each letter, in page units. */
  letterSpacing?: number
}

/** One line of text with its baseline: `x` is the left edge, the centre or the right edge for its alignment. */
export interface TextLine {
  text: string
  x: number
  y: number
  align: 'left' | 'center' | 'right'
}

export interface PhotoSource {
  src: string
  width?: number | null
  height?: number | null
}

interface Layer {
  opacity?: number
  blend?: Blend
}

export interface FillNode extends Layer {
  kind: 'fill'
  shape: Shape
  paint: Paint
}

export interface StrokeNode extends Layer {
  kind: 'stroke'
  shape: Shape
  color: Color
  width: number
  cap?: 'butt' | 'round'
  join?: 'miter' | 'round'
}

export interface PhotoNode extends Layer {
  kind: 'photo'
  photo: PhotoSource
  /** The box the photo covers, cropped to it. */
  box: Box
  /** Where the photo sits in its box, as `PhotoCrop` x, y and zoom. */
  position: { x: number; y: number; zoom: number }
  clip?: 'rect' | 'ellipse'
  tone?: PhotoTone
  /** Fades the photo into the paper over this share of each edge, from 0 to 0.5. */
  fade?: number
}

/** A shadow cast by a shape or by text: `blur` is a CSS blur radius. */
export interface Shadow {
  offset: Point
  blur: number
  color: Color
}

export interface TextNode extends Layer {
  kind: 'text'
  font: FontSpec
  color: Color
  lines: TextLine[]
  /** Drawn under the text, the first on top, like CSS `text-shadow`. */
  shadows?: Shadow[]
}

/** A CSS box shadow on its own: outside the shape, or with `inset` inside it. */
export interface ShadowNode extends Layer, Shadow {
  kind: 'shadow'
  shape: Shape
  inset?: boolean
  /** Grows (or with a negative value shrinks) a rectangle before it casts. */
  spread?: number
}

/**
 * Nodes drawn together. A group with an opacity or a shadow is drawn as one layer; a blend mode alone
 * blends each child into what is under the group.
 */
export interface GroupNode extends Layer {
  kind: 'group'
  children: SceneNode[]
  /** Turns the group `angle` degrees about `origin`. */
  rotate?: { angle: number; origin: Point }
  clip?: Shape
  /** A drop shadow under the group as a whole. */
  shadow?: Shadow
}

export type SceneNode = FillNode | StrokeNode | PhotoNode | TextNode | ShadowNode | GroupNode

export interface Scene {
  width: number
  height: number
  nodes: SceneNode[]
}

/** Text metrics in page units, from the renderer that will draw the text. */
export interface TextMetrics {
  width: number
  ascent: number
  descent: number
}

/** Measures text the way the renderer will draw it, so scenes wrap lines exactly where the renderer would. */
export interface TextMeasure {
  measure(text: string, font: FontSpec): TextMetrics
}
