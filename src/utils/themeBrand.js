/**
 * Custom "Brand" palette: user-defined primary / secondary / tertiary (light + dark strips).
 * Stored in localStorage as hex strings.
 */

import { STORAGE_PALETTE } from './themeConstants'

export const STORAGE_BRAND_STRIPS = 'weather-app-brand-color-strips'

/** @typedef {{ light: [string, string, string], dark: [string, string, string] }} BrandStrips */

const DEFAULT_BRAND = /** @type {BrandStrips} */ ({
  light: ['#2563eb', '#93c5fd', '#1e3a8a'],
  dark: ['#60a5fa', '#1e40af', '#dbeafe'],
})

function normalizeHex(h) {
  if (h == null || typeof h !== 'string') return null
  let s = h.trim()
  if (!s) return null
  if (!s.startsWith('#')) s = `#${s}`
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) return null
  if (s.length === 4) {
    const r = s[1]
    const g = s[2]
    const b = s[3]
    s = `#${r}${r}${g}${g}${b}${b}`
  }
  return s.toLowerCase()
}

function hexToRgb(hex) {
  const h = normalizeHex(hex)
  if (!h) return null
  const n = parseInt(h.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Relative luminance 0–1 (sRGB). */
function luminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0.5
  const lin = (c) => {
    const x = c / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  const r = lin(rgb.r)
  const g = lin(rgb.g)
  const b = lin(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Text on top of a solid `hex` background. */
export function pickContrastFg(hex) {
  return luminance(hex) > 0.45 ? '#0a0a0a' : '#fafafa'
}

export function readBrandStripsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_BRAND_STRIPS)
    if (!raw) return { ...DEFAULT_BRAND }
    const j = JSON.parse(raw)
    const light = [
      normalizeHex(j?.light?.[0]) || DEFAULT_BRAND.light[0],
      normalizeHex(j?.light?.[1]) || DEFAULT_BRAND.light[1],
      normalizeHex(j?.light?.[2]) || DEFAULT_BRAND.light[2],
    ]
    const dark = [
      normalizeHex(j?.dark?.[0]) || DEFAULT_BRAND.dark[0],
      normalizeHex(j?.dark?.[1]) || DEFAULT_BRAND.dark[1],
      normalizeHex(j?.dark?.[2]) || DEFAULT_BRAND.dark[2],
    ]
    return { light, dark }
  } catch {
    return { ...DEFAULT_BRAND }
  }
}

/**
 * @param {BrandStrips} strips
 */
export function writeBrandStripsToStorage(strips) {
  const payload = {
    light: strips.light.map((x) => normalizeHex(x) || DEFAULT_BRAND.light[0]),
    dark: strips.dark.map((x) => normalizeHex(x) || DEFAULT_BRAND.dark[0]),
  }
  localStorage.setItem(STORAGE_BRAND_STRIPS, JSON.stringify(payload))
  try {
    localStorage.setItem(STORAGE_PALETTE, 'brand')
  } catch {
    /* ignore */
  }
}

/**
 * Full shadcn-style CSS variables for Brand palette (hex-friendly for MapLibre + browsers).
 * @param {BrandStrips} strips
 * @param {'light' | 'dark'} mode
 * @returns {Record<string, string>}
 */
export function buildBrandThemeCssVars(strips, mode) {
  const dark = mode === 'dark'
  const [p, s, t] = dark ? strips.dark : strips.light
  const bgBase = dark ? '#0c0c0f' : '#ffffff'
  const cardBase = dark ? '#141418' : '#fafafa'
  const mutedFg = dark ? '#a1a1aa' : '#64748b'

  return {
    '--background': dark ? `color-mix(in srgb, ${p} 14%, ${bgBase})` : `color-mix(in srgb, ${p} 6%, ${bgBase})`,
    '--foreground': dark ? '#f4f4f5' : '#0f172a',
    '--card': dark ? `color-mix(in srgb, ${p} 10%, ${cardBase})` : `color-mix(in srgb, ${s} 5%, ${cardBase})`,
    '--card-foreground': dark ? '#f4f4f5' : '#0f172a',
    '--popover': dark ? `color-mix(in srgb, ${p} 10%, ${cardBase})` : '#ffffff',
    '--popover-foreground': dark ? '#f4f4f5' : '#0f172a',
    '--primary': p,
    '--primary-foreground': pickContrastFg(p),
    '--secondary': dark ? `color-mix(in srgb, ${s} 35%, #1a1a1e)` : `color-mix(in srgb, ${s} 28%, #ffffff)`,
    '--secondary-foreground': dark ? '#f4f4f5' : '#0f172a',
    '--muted': dark ? `color-mix(in srgb, ${s} 12%, #18181b)` : `color-mix(in srgb, ${s} 12%, #f4f4f5)`,
    '--muted-foreground': mutedFg,
    '--accent': dark ? `color-mix(in srgb, ${t} 22%, #18181b)` : `color-mix(in srgb, ${t} 18%, #f8fafc)`,
    '--accent-foreground': dark ? '#f4f4f5' : '#0f172a',
    '--destructive': 'oklch(0.577 0.245 27.325)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': dark ? `color-mix(in srgb, ${t} 22%, #27272a)` : `color-mix(in srgb, ${s} 25%, #e2e8f0)`,
    '--input': dark ? `color-mix(in srgb, ${t} 22%, #27272a)` : `color-mix(in srgb, ${s} 25%, #e2e8f0)`,
    '--ring': t,
    '--sidebar': dark ? `color-mix(in srgb, ${p} 12%, #09090b)` : `color-mix(in srgb, ${p} 8%, #f4f4f5)`,
    '--sidebar-foreground': dark ? '#f4f4f5' : '#0f172a',
    '--sidebar-primary': p,
    '--sidebar-primary-foreground': pickContrastFg(p),
    '--sidebar-accent': dark ? `color-mix(in srgb, ${s} 15%, #18181b)` : `color-mix(in srgb, ${s} 12%, #e4e4e7)`,
    '--sidebar-accent-foreground': dark ? '#f4f4f5' : '#0f172a',
    '--sidebar-border': dark ? `color-mix(in srgb, ${t} 18%, #27272a)` : `color-mix(in srgb, ${s} 20%, #e4e4e7)`,
    '--sidebar-ring': t,
  }
}

export function brandShellGradient(strips, mode) {
  const [a, , c] = mode === 'dark' ? strips.dark : strips.light
  return { from: a, to: c }
}

export { DEFAULT_BRAND }
