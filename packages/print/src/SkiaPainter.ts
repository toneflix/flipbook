import { createRequire } from 'node:module'
import {
  PhotoCrop,
  type Blend,
  type Box,
  type FillNode,
  type GradientStop,
  type GroupNode,
  type Paint,
  type PhotoNode,
  type PhotoTone,
  type Point,
  type Scene,
  type SceneNode,
  type Shadow,
  type ShadowNode,
  type Shape,
  type StrokeNode,
  type TextNode,
  type TextureName,
} from '@toneflix/flipbook-core'
import { Canvas, DOMMatrix, Image, Path2D, loadImage, type CanvasRenderingContext2D } from 'skia-canvas'
import type { PrintFonts } from './fonts'

/** Where a photo's bytes come from: a file path, a URL, or the bytes themselves. */
export type PhotoLoader = (src: string) => Promise<string | Buffer>

const require = createRequire(import.meta.url)

/** Pixels per page unit for pattern tiles, sharper than 300 DPI on a 210 mm page. */
const TILE_SCALE = 40

/** The least pixels per page unit for layers drawn off the page: 300 DPI on a 210 mm page. */
const LAYER_SCALE = 24.8

/** How far past the page a layer may reach, in page units. */
const BLEED = 10

const grow = (box: Box, by: number): Box => ({ x: box.x - by, y: box.y - by, width: box.width + 2 * by, height: box.height + 2 * by })

const evenOdd = (shape: Shape): CanvasFillRule => (shape.type === 'ring' || shape.type === 'cutout' ? 'evenodd' : 'nonzero')

const COMPOSITE: Record<Blend, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  'soft-light': 'soft-light',
  overlay: 'overlay',
}

const toneFilter = ({ sepia, saturate, contrast, brightness }: PhotoTone) =>
  `sepia(${sepia}) saturate(${saturate}) contrast(${contrast}) brightness(${brightness})`

/**
 * Draws page scenes with Skia. The same painter draws raster pages for images and vector pages for a
 * PDF: `scale` is output units (pixels or points) per page unit.
 */
export class SkiaPainter {
  private readonly images = new Map<string, Image>()
  private readonly textures = new Map<TextureName, Image>()

  constructor(
    readonly fonts: PrintFonts,
    readonly load: PhotoLoader = async (src) => src,
  ) {}

  /** Loads every photo and texture a scene draws, so drawing never waits. */
  async prepare(scene: Scene): Promise<void> {
    const photos = new Set<string>()
    const textures = new Set<TextureName>()
    const visit = (node: SceneNode) => {
      if (node.kind === 'photo') photos.add(node.photo.src)
      if (node.kind === 'fill') this.paints(node.paint).forEach((texture) => textures.add(texture))
      if (node.kind === 'group') node.children.forEach(visit)
    }

    scene.nodes.forEach(visit)
    await Promise.all([
      ...[...photos].filter((src) => !this.images.has(src)).map(async (src) => this.images.set(src, await loadImage(await this.load(src)))),
      ...[...textures]
        .filter((name) => !this.textures.has(name))
        .map(async (name) => this.textures.set(name, await loadImage(require.resolve(`@toneflix/flipbook-core/textures/${name}.webp`)))),
    ])
  }

  /** Lets go of the photos loaded so far. */
  release() {
    this.images.clear()
  }

  async paint(ctx: CanvasRenderingContext2D, scene: Scene, scale: number): Promise<void> {
    await this.prepare(scene)
    ctx.imageSmoothingQuality = 'high'
    this.nodes(ctx, scene.nodes, scale)
  }

  private paints(paint: Paint): TextureName[] {
    if (typeof paint === 'string') return []
    if (paint.type === 'texture') return [paint.texture]
    if (paint.type === 'tile') return paint.nodes.flatMap((node) => (node.kind === 'fill' ? this.paints(node.paint) : []))

    return []
  }

  private nodes(ctx: CanvasRenderingContext2D, nodes: SceneNode[], scale: number) {
    for (const node of nodes) {
      ctx.save()
      if (node.opacity !== undefined) ctx.globalAlpha *= node.opacity
      if (node.blend) ctx.globalCompositeOperation = COMPOSITE[node.blend]
      this.node(ctx, node, scale)
      ctx.restore()
    }
  }

  private node(ctx: CanvasRenderingContext2D, node: SceneNode, scale: number) {
    switch (node.kind) {
      case 'fill':
        return this.fill(ctx, node, scale)
      case 'stroke':
        return this.stroke(ctx, node, scale)
      case 'photo':
        return this.photo(ctx, node, scale)
      case 'text':
        return this.text(ctx, node, scale)
      case 'shadow':
        return this.shadow(ctx, node, scale)
      case 'group':
        return this.group(ctx, node, scale)
    }
  }

  /** A shape as a Skia path, `scale` units per page unit. */
  static path(shape: Shape, scale: number, path = new Path2D()): Path2D {
    switch (shape.type) {
      case 'rect':
        path.rect(shape.box.x * scale, shape.box.y * scale, shape.box.width * scale, shape.box.height * scale)
        break
      case 'ellipse': {
        const { x, y, width, height } = shape.box

        path.moveTo((x + width) * scale, (y + height / 2) * scale)
        path.ellipse((x + width / 2) * scale, (y + height / 2) * scale, (width / 2) * scale, (height / 2) * scale, 0, 0, Math.PI * 2)
        path.closePath()
        break
      }
      case 'roundrect': {
        const { x, y, width, height } = shape.box

        path.roundRect(
          x * scale,
          y * scale,
          width * scale,
          height * scale,
          shape.radii.map((r) => r * scale),
        )
        break
      }
      case 'circle':
        path.moveTo((shape.center.x + shape.radius) * scale, shape.center.y * scale)
        path.arc(shape.center.x * scale, shape.center.y * scale, shape.radius * scale, 0, Math.PI * 2)
        path.closePath()
        break
      case 'polygon':
        shape.points.forEach(({ x, y }, i) => (i ? path.lineTo(x * scale, y * scale) : path.moveTo(x * scale, y * scale)))
        path.closePath()
        break
      case 'ring':
        SkiaPainter.path({ type: 'rect', box: shape.outer }, scale, path)
        SkiaPainter.path({ type: 'rect', box: shape.inner }, scale, path)
        break
      case 'path': {
        const [a, b, c, d, e, f] = shape.transform

        path.addPath(new Path2D(shape.d), new DOMMatrix([a * scale, b * scale, c * scale, d * scale, e * scale, f * scale]))
        break
      }
      case 'cutout':
        SkiaPainter.path(shape.outer, scale, path)
        SkiaPainter.path(shape.inner, scale, path)
        break
      case 'union':
        shape.shapes.forEach((part) => SkiaPainter.path(part, scale, path))
        break
    }

    return path
  }

  private fill(ctx: CanvasRenderingContext2D, { shape, paint }: FillNode, scale: number) {
    const path = SkiaPainter.path(shape, scale)
    const rule = evenOdd(shape)

    if (typeof paint === 'string') {
      ctx.fillStyle = paint

      return ctx.fill(path, rule)
    }

    switch (paint.type) {
      case 'linear': {
        const { from, to, stops } = paint.repeat ? SkiaPainter.repeatLinear(paint, SkiaPainter.shapeBounds(shape)) : paint
        const gradient = ctx.createLinearGradient(from.x * scale, from.y * scale, to.x * scale, to.y * scale)

        stops.forEach(({ offset, color }) => gradient.addColorStop(offset, color))
        ctx.fillStyle = gradient

        return ctx.fill(path, rule)
      }
      case 'radial': {
        const { radius, stops } = paint.repeat ? SkiaPainter.repeatRadial(paint, SkiaPainter.shapeBounds(shape)) : paint
        const rx = radius.x * scale
        const ry = radius.y * scale
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)

        stops.forEach(({ offset, color }) => gradient.addColorStop(offset, color))
        ctx.clip(path, rule)
        ctx.translate(paint.center.x * scale, paint.center.y * scale)
        ctx.scale(1, ry / rx)
        ctx.fillStyle = gradient

        return ctx.fillRect(-rx * 4, -rx * 4, rx * 8, rx * 8)
      }
      case 'texture': {
        const tile = this.textures.get(paint.texture)!
        const pattern = ctx.createPattern(tile, 'repeat')!

        pattern.setTransform(new DOMMatrix().scale((paint.size * scale) / tile.width, (paint.size * scale) / tile.height))
        ctx.fillStyle = pattern

        return ctx.fill(path, rule)
      }
      case 'tile': {
        const canvas = new Canvas(Math.ceil(paint.width * TILE_SCALE), Math.ceil(paint.height * TILE_SCALE))

        this.nodes(canvas.getContext('2d'), paint.nodes, TILE_SCALE)

        const pattern = ctx.createPattern(canvas, 'repeat')!
        const fx = (paint.width * scale) / canvas.width
        const fy = (paint.height * scale) / canvas.height

        pattern.setTransform(
          new DOMMatrix()
            .translate(paint.origin.x * scale, paint.origin.y * scale)
            .rotate(paint.rotate ?? 0)
            .scale(fx, fy),
        )
        ctx.fillStyle = pattern

        return ctx.fill(path, rule)
      }
    }
  }

  private stroke(ctx: CanvasRenderingContext2D, { shape, color, width, cap = 'butt', join = 'miter' }: StrokeNode, scale: number) {
    ctx.strokeStyle = color
    ctx.lineWidth = width * scale
    ctx.lineCap = cap
    ctx.lineJoin = join
    ctx.stroke(SkiaPainter.path(shape, scale))
  }

  private photo(ctx: CanvasRenderingContext2D, node: PhotoNode, scale: number) {
    const image = this.images.get(node.photo.src)

    if (!image) return

    const box = { x: node.box.x * scale, y: node.box.y * scale, width: node.box.width * scale, height: node.box.height * scale }
    const crop = new PhotoCrop(node.position.x, node.position.y, node.position.zoom)

    if (!node.fade) {
      ctx.clip(SkiaPainter.path({ type: node.clip ?? 'rect', box: node.box } as Shape, scale))
      if (node.tone) ctx.filter = toneFilter(node.tone)

      return this.drawCropped(ctx, image, crop, box)
    }

    const layer = new Canvas(Math.ceil(node.box.width * TILE_SCALE), Math.ceil(node.box.height * TILE_SCALE))
    const at = layer.getContext('2d')
    const fade = (x1: number, y1: number) => {
      const gradient = at.createLinearGradient(0, 0, x1, y1)

      gradient.addColorStop(0, 'rgba(0,0,0,0)')
      gradient.addColorStop(node.fade!, '#000')
      gradient.addColorStop(1 - node.fade!, '#000')
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      at.globalCompositeOperation = 'destination-in'
      at.fillStyle = gradient
      at.fillRect(0, 0, layer.width, layer.height)
    }

    at.imageSmoothingQuality = 'high'
    if (node.tone) at.filter = toneFilter(node.tone)
    this.drawCropped(at, image, crop, { x: 0, y: 0, width: layer.width, height: layer.height })
    at.filter = 'none'
    fade(layer.width, 0)
    fade(0, layer.height)
    ctx.drawImage(layer, box.x, box.y, box.width, box.height)
  }

  private drawCropped(ctx: CanvasRenderingContext2D, image: Image, crop: PhotoCrop, box: Box) {
    const drawn = crop.rect(box, { width: image.width, height: image.height })

    ctx.drawImage(image, box.x + drawn.left, box.y + drawn.top, drawn.width, drawn.height)
  }

  private text(ctx: CanvasRenderingContext2D, { font, color, lines, shadows = [] }: TextNode, scale: number) {
    ctx.font = this.fonts.font(font, scale)
    ctx.fontVariationSettings = this.fonts.variations(font)
    ctx.letterSpacing = `${(font.letterSpacing ?? 0) * scale}px`
    ctx.fillStyle = color
    ctx.textBaseline = 'alphabetic'

    const draw = () =>
      lines.forEach((line) => {
        ctx.textAlign = line.align
        ctx.fillText(line.text, line.x * scale, line.y * scale)
      })

    // Each shadow is cast by drawing the text with it, the last first, so the first lands on top.
    for (const shadow of [...shadows].reverse()) {
      ctx.save()
      this.castShadow(ctx, shadow, scale)
      draw()
      ctx.restore()
    }
    draw()
  }

  /** A CSS blur radius is twice the standard deviation, as is a canvas shadow blur. */
  private castShadow(ctx: CanvasRenderingContext2D, { offset, blur, color }: Shadow, scale: number) {
    ctx.shadowColor = color
    ctx.shadowBlur = blur * scale
    ctx.shadowOffsetX = offset.x * scale
    ctx.shadowOffsetY = offset.y * scale
  }

  /**
   * A CSS box shadow: outside the shape, cast by the shape moved by its offset, or with `inset` inside
   * it, cast by everything around the moved shape. A CSS blur radius is twice the standard deviation.
   */
  private shadow(ctx: CanvasRenderingContext2D, { shape, inset, color, offset, blur, spread = 0 }: ShadowNode, scale: number) {
    const cast = spread && shape.type === 'rect' ? ({ type: 'rect', box: grow(shape.box, inset ? -spread : spread) } as Shape) : shape
    const moved = new Path2D()
    const everywhere = new Path2D()

    moved.addPath(SkiaPainter.path(cast, scale), new DOMMatrix().translate(offset.x * scale, offset.y * scale))
    everywhere.rect(-1e5, -1e5, 2e5, 2e5)

    const around = new Path2D(everywhere)

    around.addPath(SkiaPainter.path(shape, scale))
    ctx.clip(inset ? SkiaPainter.path(shape, scale) : around, inset ? evenOdd(shape) : 'evenodd')
    if (blur) ctx.filter = `blur(${(blur / 2) * scale}px)`
    ctx.fillStyle = color

    if (!inset) return ctx.fill(moved, evenOdd(shape))

    everywhere.addPath(moved)
    ctx.fill(everywhere, 'evenodd')
  }

  private group(ctx: CanvasRenderingContext2D, node: GroupNode, scale: number) {
    if (node.rotate) {
      const { angle, origin } = node.rotate

      ctx.translate(origin.x * scale, origin.y * scale)
      ctx.rotate((angle * Math.PI) / 180)
      ctx.translate(-origin.x * scale, -origin.y * scale)
    }
    if (node.clip) ctx.clip(SkiaPainter.path(node.clip, scale), evenOdd(node.clip))

    const isolated = !!node.shadow || (node.opacity !== undefined && node.children.length > 1)

    if (!isolated) return this.nodes(ctx, node.children, scale)

    // Opacity and shadows apply to the group as one layer, so the children are drawn together first.
    const bounds = this.bounds(node.children)
    const at = Math.max(scale, LAYER_SCALE)
    const layer = new Canvas(Math.max(1, Math.ceil(bounds.width * at)), Math.max(1, Math.ceil(bounds.height * at)))
    const layerCtx = layer.getContext('2d')

    layerCtx.imageSmoothingQuality = 'high'
    layerCtx.translate(-bounds.x * at, -bounds.y * at)
    this.nodes(layerCtx, node.children, at)
    if (node.shadow) this.castShadow(ctx, node.shadow, scale)
    ctx.drawImage(layer, bounds.x * scale, bounds.y * scale, layer.width * (scale / at), layer.height * (scale / at))
  }

  /** The box around nodes, for the layer a group is drawn in, kept to the page and a little past it. */
  private bounds(nodes: SceneNode[]): Box {
    const boxes = nodes.flatMap((node): Box[] => {
      switch (node.kind) {
        case 'fill':
          return [SkiaPainter.shapeBounds(node.shape)]
        case 'stroke':
          return [grow(SkiaPainter.shapeBounds(node.shape), node.width / 2)]
        case 'shadow':
          return [grow(SkiaPainter.shapeBounds(node.shape), node.blur * 2 + Math.abs(node.offset.x) + Math.abs(node.offset.y))]
        case 'photo':
          return [node.box]
        case 'group':
          return [node.clip ? SkiaPainter.shapeBounds(node.clip) : this.bounds(node.children)]
        default:
          return [{ x: -BLEED, y: -BLEED, width: 100 + 2 * BLEED, height: 400 / 3 + 2 * BLEED }]
      }
    })
    const x = Math.max(-BLEED, Math.min(...boxes.map((b) => b.x)))
    const y = Math.max(-BLEED, Math.min(...boxes.map((b) => b.y)))
    const right = Math.min(100 + BLEED, Math.max(...boxes.map((b) => b.x + b.width)))
    const bottom = Math.min(400 / 3 + BLEED, Math.max(...boxes.map((b) => b.y + b.height)))

    return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) }
  }

  /** The box around a shape, in page units. */
  static shapeBounds(shape: Shape): Box {
    switch (shape.type) {
      case 'rect':
      case 'ellipse':
      case 'roundrect':
        return shape.box
      case 'ring':
        return shape.outer
      case 'cutout':
        return SkiaPainter.shapeBounds(shape.outer)
      default: {
        const { left, top, right, bottom } = SkiaPainter.path(shape, 1).bounds

        return { x: left, y: top, width: right - left, height: bottom - top }
      }
    }
  }

  /** A repeating linear gradient as one gradient whose stops repeat across `box`. */
  static repeatLinear({ from, to, stops }: { from: Point; to: Point; stops: GradientStop[] }, box: Box) {
    const step = { x: to.x - from.x, y: to.y - from.y }
    const length = step.x * step.x + step.y * step.y
    const along = [box.x, box.x + box.width].flatMap((x) =>
      [box.y, box.y + box.height].map((y) => ((x - from.x) * step.x + (y - from.y) * step.y) / length),
    )
    const first = Math.floor(Math.min(...along))
    const count = Math.max(1, Math.ceil(Math.max(...along)) - first)

    return {
      from: { x: from.x + step.x * first, y: from.y + step.y * first },
      to: { x: from.x + step.x * (first + count), y: from.y + step.y * (first + count) },
      stops: SkiaPainter.repeatStops(stops, count),
    }
  }

  /** A repeating radial gradient as one gradient whose stops repeat out to the corners of `box`. */
  static repeatRadial({ center, radius, stops }: { center: Point; radius: Point; stops: GradientStop[] }, box: Box) {
    const reach = Math.max(
      ...[box.x, box.x + box.width].flatMap((x) =>
        [box.y, box.y + box.height].map((y) => Math.hypot(x - center.x, ((y - center.y) * radius.x) / radius.y)),
      ),
    )
    const count = Math.max(1, Math.ceil(reach / radius.x))

    return { radius: { x: radius.x * count, y: radius.y * count }, stops: SkiaPainter.repeatStops(stops, count) }
  }

  private static repeatStops(stops: GradientStop[], count: number): GradientStop[] {
    return Array.from({ length: count }, (_, k) => stops.map(({ offset, color }) => ({ offset: (k + offset) / count, color }))).flat()
  }
}
