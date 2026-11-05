/**
 * Paints the demo photos used by the docs: layered landscapes drawn as SVG, then saved as JPEG
 * with Playwright. Run with `node scripts/demo-photos.mjs` from the docs folder.
 */
import { writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

/** A small seeded random generator, so every run paints the same photos. */
class Random {
  constructor(seed) {
    this.seed = seed
  }

  next() {
    this.seed = (this.seed * 16807) % 2147483647
    return (this.seed - 1) / 2147483646
  }

  between(min, max) {
    return min + this.next() * (max - min)
  }
}

/** A ridge line across the frame, filled down to the bottom. */
function ridge(random, width, height, base, rough, smooth = 6) {
  const steps = smooth + Math.floor(random.next() * 4)
  const points = Array.from({ length: steps + 1 }, (_, i) => [(i / steps) * width, base + random.between(-rough, rough)])
  let d = `M0 ${height} L${points[0][0]} ${points[0][1]}`

  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const mid = (x0 + x1) / 2

    d += ` C${mid} ${y0}, ${mid} ${y1}, ${x1} ${y1}`
  }

  return `${d} L${width} ${height} Z`
}

const scenes = [
  {
    name: 'dawn-lake',
    sky: ['#7d98c4', '#e9b9a8'],
    sun: { x: 0.32, y: 0.55, r: 40, color: '#fff3df', glow: 0.7 },
    hills: ['#56688a', '#3e4d6b'],
    water: true,
  },
  {
    name: 'snow-peaks',
    sky: ['#9fb8d8', '#e6edf5'],
    sun: { x: 0.78, y: 0.2, r: 34, color: '#fbf8ea', glow: 0.4 },
    hills: ['#eef1f6', '#c4ccdb', '#9aa6bd'],
    rough: 1.6,
  },
  {
    name: 'night-moon',
    sky: ['#14162e', '#3a3460'],
    sun: { x: 0.7, y: 0.28, r: 26, color: '#f4f0dc', glow: 0.9 },
    hills: ['#26223f', '#17142a'],
    stars: true,
  },
  {
    name: 'desert-dunes',
    sky: ['#f2c58c', '#f7e3c0'],
    sun: { x: 0.25, y: 0.3, r: 46, color: '#fff2d6', glow: 0.6 },
    hills: ['#e2a565', '#c9844a', '#a8643a'],
    rough: 0.7,
  },
  {
    name: 'green-valley',
    sky: ['#8ec6e6', '#e3f1f4'],
    sun: { x: 0.82, y: 0.18, r: 30, color: '#fffbe8', glow: 0.4 },
    hills: ['#9cc38a', '#6f9e64', '#4b7a4c', '#2f5a39'],
  },
  {
    name: 'ocean-sunset',
    sky: ['#3c3a73', '#f08a5d'],
    sun: { x: 0.5, y: 0.6, r: 52, color: '#ffd59a', glow: 1 },
    hills: ['#2a2d55'],
    water: true,
    flat: true,
  },
  { name: 'misty-forest', sky: ['#b9c3c0', '#e7ebe6'], hills: ['#a5b2ab', '#7f9188', '#5c6f66', '#3d4f47'], trees: true },
  {
    name: 'autumn-hills',
    sky: ['#d9a07a', '#f4dcc0'],
    sun: { x: 0.6, y: 0.35, r: 38, color: '#fff0d8', glow: 0.5 },
    hills: ['#c98a52', '#a85f3a', '#7d3f2c', '#4f2a22'],
  },
  { name: 'blue-hour', sky: ['#1f3b63', '#6e93b8'], hills: ['#2c4a6b', '#1d3350', '#112235'], water: true, stars: true },
  {
    name: 'meadow-morning',
    sky: ['#f6d8b8', '#fdf2e2'],
    sun: { x: 0.18, y: 0.42, r: 44, color: '#fffaf0', glow: 0.8 },
    hills: ['#c5cf96', '#9fb070', '#7a8f52'],
  },
  { name: 'canyon', sky: ['#87b5d9', '#f1e6d6'], hills: ['#d48a5e', '#b36440', '#8a452d'], rough: 2.2 },
  { name: 'aurora', sky: ['#081a24', '#174452'], hills: ['#0f2a30', '#06161a'], aurora: true, stars: true },
]

function paint(scene, index, width, height) {
  const random = new Random(index * 7919 + 13)
  const [top, bottom] = scene.sky
  const horizon = scene.water ? height * 0.62 : height
  const layers = []

  if (scene.stars) {
    for (let i = 0; i < 140; i++) {
      layers.push(
        `<circle cx="${random.between(0, width)}" cy="${random.between(0, height * 0.6)}" r="${random.between(0.4, 1.6)}" fill="#fff" opacity="${random.between(0.2, 0.9)}"/>`,
      )
    }
  }

  if (scene.aurora) {
    layers.push(
      `<path d="M-50 ${height * 0.45} C${width * 0.3} ${height * 0.1}, ${width * 0.6} ${height * 0.55}, ${width + 50} ${height * 0.2}" stroke="url(#aurora)" stroke-width="${height * 0.18}" fill="none" opacity="0.7" filter="url(#blur)"/>`,
    )
  }

  if (scene.sun) {
    const { x, y, r, color, glow } = scene.sun

    layers.push(`<circle cx="${x * width}" cy="${y * height}" r="${r * 4}" fill="url(#glow)" opacity="${glow}"/>`)
    layers.push(`<circle cx="${x * width}" cy="${y * height}" r="${r}" fill="${color}"/>`)
  }

  scene.hills.forEach((color, i) => {
    const depth = (i + 1) / scene.hills.length
    const base = scene.flat ? horizon - 6 : horizon * (0.45 + depth * 0.3) - (scene.water ? horizon * 0.1 : 0)
    const rough = scene.flat ? 4 : height * 0.09 * (scene.rough ?? 1) * (1 - depth * 0.4)

    layers.push(`<path d="${ridge(random, width, scene.water ? horizon : height, base, rough)}" fill="${color}"/>`)

    if (scene.trees && i > 0) {
      for (let t = 0; t < 26; t++) {
        const tx = random.between(0, width)
        const ty = base + random.between(-rough * 0.5, rough * 0.8)
        const th = random.between(30, 70) * depth

        layers.push(`<path d="M${tx} ${ty - th} L${tx + th * 0.28} ${ty} L${tx - th * 0.28} ${ty} Z" fill="${color}"/>`)
      }
    }
  })

  if (scene.water) {
    layers.push(`<rect x="0" y="${horizon}" width="${width}" height="${height - horizon}" fill="url(#water)"/>`)
    layers.push(
      `<g transform="translate(0 ${horizon * 2}) scale(1 -1)" opacity="0.35">${layers.slice(-1 - scene.hills.length, -1).join('')}</g>`,
    )

    for (let i = 0; i < 40; i++) {
      const y = random.between(horizon + 4, height)

      layers.push(
        `<rect x="${random.between(0, width)}" y="${y}" width="${random.between(20, 120)}" height="1.2" fill="#fff" opacity="${random.between(0.05, 0.25)}"/>`,
      )
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bottom}" stop-opacity="0.85"/><stop offset="1" stop-color="${top}"/></linearGradient>
<radialGradient id="glow"><stop offset="0" stop-color="#fff" stop-opacity="0.8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="aurora" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3cf0a0"/><stop offset="0.6" stop-color="#4fd1c5"/><stop offset="1" stop-color="#8b6cf0"/></linearGradient>
<filter id="blur"><feGaussianBlur stdDeviation="30"/></filter>
<filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.06 0"/></filter>
</defs>
<rect width="100%" height="100%" fill="url(#sky)"/>
${layers.join('\n')}
<rect width="100%" height="100%" filter="url(#noise)"/>
</svg>`
}

const browser = await chromium.launch()
const page = await browser.newPage()
const manifest = []

for (const [index, scene] of scenes.entries()) {
  const portrait = index % 4 === 1
  const width = portrait ? 900 : 1200
  const height = portrait ? 1200 : 800

  await page.setViewportSize({ width, height })
  await page.setContent(`<body style="margin:0">${paint(scene, index, width, height)}</body>`)
  await page.screenshot({ path: `public/demo/${scene.name}.jpg`, type: 'jpeg', quality: 82 })
  manifest.push({ name: scene.name, width, height })
}

writeFileSync('public/demo/photos.json', JSON.stringify(manifest, null, 2) + '\n')
await browser.close()
