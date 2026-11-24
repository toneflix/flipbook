import { createRequire } from 'node:module'
import {
  PhotoCrop,
  type Blend,
  type Box,
  type FillNode,
  type GroupNode,
  type Paint,
  type PhotoNode,
  type PhotoTone,
  type Scene,
  type SceneNode,
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

/** Pixels per page unit for tiles and layers drawn off the page, sharper than 300 DPI on a 210 mm page. */
const OFFSCREEN_SCALE = 40

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

  private path(shape: Shape, scale: number, path = new Path2D()): Path2D {
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
        this.path({ type: 'rect', box: shape.outer }, scale, path)
        this.path({ type: 'rect', box: shape.inner }, scale, path)
        break
      case 'path': {
        const [a, b, c, d, e, f] = shape.transform

        path.addPath(new Path2D(shape.d), new DOMMatrix([a * scale, b * scale, c * scale, d * scale, e * scale, f * scale]))
        break
      }
      case 'union':
        shape.shapes.forEach((part) => this.path(part, scale, path))
        break
    }

    return path
  }

  private fill(ctx: CanvasRenderingContext2D, { shape, paint }: FillNode, scale: number) {
    const path = this.path(shape, scale)
    const rule = shape.type === 'ring' ? 'evenodd' : 'nonzero'

    if (typeof paint === 'string') {
      ctx.fillStyle = paint

      return ctx.fill(path, rule)
    }

    switch (paint.type) {
      case 'linear': {
        const gradient = ctx.createLinearGradient(paint.from.x * scale, paint.from.y * scale, paint.to.x * scale, paint.to.y * scale)

        paint.stops.forEach(({ offset, color }) => gradient.addColorStop(offset, color))
        ctx.fillStyle = gradient

        return ctx.fill(path, rule)
      }
      case 'radial': {
        const rx = paint.radius.x * scale
        const ry = paint.radius.y * scale
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)

        paint.stops.forEach(({ offset, color }) => gradient.addColorStop(offset, color))
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
        const canvas = new Canvas(Math.ceil(paint.width * OFFSCREEN_SCALE), Math.ceil(paint.height * OFFSCREEN_SCALE))

        this.nodes(canvas.getContext('2d'), paint.nodes, OFFSCREEN_SCALE)

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
    ctx.stroke(this.path(shape, scale))
  }

  private photo(ctx: CanvasRenderingContext2D, node: PhotoNode, scale: number) {
    const image = this.images.get(node.photo.src)

    if (!image) return

    const box = { x: node.box.x * scale, y: node.box.y * scale, width: node.box.width * scale, height: node.box.height * scale }
    const crop = new PhotoCrop(node.position.x, node.position.y, node.position.zoom)

    if (!node.fade) {
      ctx.clip(this.path({ type: node.clip ?? 'rect', box: node.box } as Shape, scale))
      if (node.tone) ctx.filter = toneFilter(node.tone)

      return this.drawCropped(ctx, image, crop, box)
    }

    const layer = new Canvas(Math.ceil(node.box.width * OFFSCREEN_SCALE), Math.ceil(node.box.height * OFFSCREEN_SCALE))
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

  private text(ctx: CanvasRenderingContext2D, { font, color, lines }: TextNode, scale: number) {
    ctx.font = this.fonts.font(font, scale)
    ctx.fontVariationSettings = this.fonts.variations(font)
    ctx.letterSpacing = `${(font.letterSpacing ?? 0) * scale}px`
    ctx.fillStyle = color
    ctx.textBaseline = 'alphabetic'

    for (const line of lines) {
      ctx.textAlign = line.align
      ctx.fillText(line.text, line.x * scale, line.y * scale)
    }
  }

  /** A box shadow outside its box: the box, offset and blurred. A CSS blur radius is twice the blur's standard deviation. */
  private shadow(ctx: CanvasRenderingContext2D, { box, color, offset, blur, spread = 0 }: ShadowNode, scale: number) {
    const outside = new Path2D()

    outside.rect(-1e5, -1e5, 2e5, 2e5)
    outside.rect(box.x * scale, box.y * scale, box.width * scale, box.height * scale)
    ctx.clip(outside, 'evenodd')
    ctx.filter = `blur(${(blur / 2) * scale}px)`
    ctx.fillStyle = color
    ctx.fillRect(
      (box.x - spread + offset.x) * scale,
      (box.y - spread + offset.y) * scale,
      (box.width + 2 * spread) * scale,
      (box.height + 2 * spread) * scale,
    )
  }

  private group(ctx: CanvasRenderingContext2D, node: GroupNode, scale: number) {
    if (node.rotate) {
      const { angle, origin } = node.rotate

      ctx.translate(origin.x * scale, origin.y * scale)
      ctx.rotate((angle * Math.PI) / 180)
      ctx.translate(-origin.x * scale, -origin.y * scale)
    }
    if (node.clip) ctx.clip(this.path(node.clip, scale), node.clip.type === 'ring' ? 'evenodd' : 'nonzero')

    const isolated = (node.opacity !== undefined || !!node.blend) && node.children.length > 1

    if (!isolated) return this.nodes(ctx, node.children, scale)

    // Opacity and blending apply to the group as one layer, so the children are drawn together first.
    const bounds = SkiaPainter.bounds(node.children)
    const layer = new Canvas(Math.ceil(bounds.width * OFFSCREEN_SCALE), Math.ceil(bounds.height * OFFSCREEN_SCALE))
    const at = layer.getContext('2d')

    at.translate(-bounds.x * OFFSCREEN_SCALE, -bounds.y * OFFSCREEN_SCALE)
    this.nodes(at, node.children, OFFSCREEN_SCALE)
    ctx.drawImage(layer, bounds.x * scale, bounds.y * scale, bounds.width * scale, bounds.height * scale)
  }

  /** The box around shapes, for the layer a group is drawn in. */
  static bounds(nodes: SceneNode[]): Box {
    const boxes = nodes.flatMap((node): Box[] => {
      if (node.kind === 'fill' || node.kind === 'stroke') {
        const box = SkiaPainter.shapeBounds(node.shape)
        const grow = node.kind === 'stroke' ? node.width / 2 : 0

        return [{ x: box.x - grow, y: box.y - grow, width: box.width + grow * 2, height: box.height + grow * 2 }]
      }
      if (node.kind === 'photo' || node.kind === 'shadow') return [node.box]
      if (node.kind === 'group') return [SkiaPainter.bounds(node.children)]

      return []
    })
    const x = Math.min(...boxes.map((b) => b.x))
    const y = Math.min(...boxes.map((b) => b.y))

    return {
      x,
      y,
      width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
      height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
    }
  }

  private static shapeBounds(shape: Shape): Box {
    switch (shape.type) {
      case 'rect':
      case 'ellipse':
        return shape.box
      case 'ring':
        return shape.outer
      case 'circle':
        return { x: shape.center.x - shape.radius, y: shape.center.y - shape.radius, width: shape.radius * 2, height: shape.radius * 2 }
      case 'polygon': {
        const xs = shape.points.map((p) => p.x)
        const ys = shape.points.map((p) => p.y)

        return {
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        }
      }
      case 'union':
        return SkiaPainter.bounds(shape.shapes.map((part) => ({ kind: 'fill', shape: part, paint: '#000' })))
      case 'path':
        return { x: -1e3, y: -1e3, width: 2e3, height: 2e3 }
    }
  }
}
