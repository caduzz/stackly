import { nativeImage, net } from 'electron'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { imageThemeResultSchema, type ImageThemeResult } from '../../shared/contracts/browser'

type Rgb = { r: number; g: number; b: number }
type Hsl = { h: number; s: number; l: number }

export async function generateThemeFromImage(source: string): Promise<ImageThemeResult> {
  const image = nativeImage.createFromBuffer(await loadImageBuffer(source.trim())).resize({ width: 96, height: 96, quality: 'good' })
  if (image.isEmpty()) throw new Error('Could not read this image.')

  const size = image.getSize()
  const bitmap = image.toBitmap()
  const pixels: Rgb[] = []
  const buckets = new Map<string, { color: Rgb; count: number; saturation: number }>()

  for (let index = 0; index < bitmap.length; index += 4) {
    const b = bitmap[index] ?? 0
    const g = bitmap[index + 1] ?? 0
    const r = bitmap[index + 2] ?? 0
    const alpha = bitmap[index + 3] ?? 255
    if (alpha < 180) continue
    const color = { r, g, b }
    const { s, l } = rgbToHsl(color)
    if (l < 0.04 || l > 0.96) continue
    pixels.push(color)
    const key = `${Math.round(r / 24)}:${Math.round(g / 24)}:${Math.round(b / 24)}`
    const bucket = buckets.get(key)
    if (bucket) bucket.count += 1
    else buckets.set(key, { color, count: 1, saturation: s })
  }

  if (pixels.length < Math.max(24, Math.floor((size.width * size.height) / 20))) throw new Error('The image did not contain enough readable color data.')

  const sorted = [...buckets.values()].sort((a, b) => (b.count * (0.45 + b.saturation)) - (a.count * (0.45 + a.saturation)))
  const base = average(pixels)
  const accent = sorted.find((bucket) => {
    const { s, l } = rgbToHsl(bucket.color)
    return s > 0.22 && l > 0.18 && l < 0.82
  })?.color ?? sorted[0]?.color ?? base
  const baseHsl = rgbToHsl(base)
  const accentHsl = rgbToHsl(accent)
  const baseS = clamp(baseHsl.s * 0.45, 0.08, 0.26)
  const accentS = clamp(accentHsl.s * 0.9, 0.34, 0.72)
  const swatches = uniqueHex(sorted.map((bucket) => rgbToHex(bucket.color))).slice(0, 8)

  return imageThemeResultSchema.parse({
    colors: {
      bgPrimary: hslToHex({ h: baseHsl.h, s: baseS, l: 0.13 }),
      bgSecondary: hslToHex({ h: baseHsl.h, s: baseS, l: 0.17 }),
      surface: hslToHex({ h: baseHsl.h, s: clamp(baseS + 0.04, 0.1, 0.3), l: 0.24 }),
      textPrimary: '#eee8f4',
      textMuted: hslToHex({ h: baseHsl.h, s: 0.12, l: 0.72 }),
      accent: hslToHex({ h: accentHsl.h, s: accentS, l: 0.68 }),
      selection: hslToHex({ h: accentHsl.h, s: clamp(accentS * 0.62, 0.22, 0.52), l: 0.42 }),
      border: hslToHex({ h: baseHsl.h, s: clamp(baseS + 0.08, 0.16, 0.34), l: 0.36 })
    },
    swatches
  })
}

async function loadImageBuffer(source: string): Promise<Buffer> {
  if (source.startsWith('data:image/')) return Buffer.from(source.split(',')[1] ?? '', 'base64')
  if (/^file:\/\//i.test(source)) return readFile(fileURLToPath(source))
  if (/^[A-Za-z]:[\\/]/.test(source) || source.startsWith('\\\\')) return readFile(source)
  const url = new URL(source)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only local files, data URLs, HTTP, and HTTPS images are supported.')
  const response = await net.fetch(url.href)
  if (!response.ok) throw new Error(`Image request failed with ${response.status}.`)
  return Buffer.from(await response.arrayBuffer())
}

function average(colors: Rgb[]): Rgb {
  const total = colors.reduce((next, color) => ({ r: next.r + color.r, g: next.g + color.g, b: next.b + color.b }), { r: 0, g: 0, b: 0 })
  return { r: Math.round(total.r / colors.length), g: Math.round(total.g / colors.length), b: Math.round(total.b / colors.length) }
}

function uniqueHex(values: string[]): string[] {
  return [...new Set(values)]
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const delta = max - min
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  const h = max === rn
    ? ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6
    : max === gn
      ? ((bn - rn) / delta + 2) / 6
      : ((rn - gn) / delta + 4) / 6
  return { h, s, l }
}

function hslToHex({ h, s, l }: Hsl): string {
  if (s === 0) {
    const value = Math.round(l * 255)
    return rgbToHex({ r: value, g: value, b: value })
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return rgbToHex({
    r: hueToRgb(p, q, h + 1 / 3) * 255,
    g: hueToRgb(p, q, h) * 255,
    b: hueToRgb(p, q, h - 1 / 3) * 255
  })
}

function hueToRgb(p: number, q: number, t: number): number {
  let next = t
  if (next < 0) next += 1
  if (next > 1) next -= 1
  if (next < 1 / 6) return p + (q - p) * 6 * next
  if (next < 1 / 2) return q
  if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6
  return p
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
