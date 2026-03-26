/**
 * App color themes — primary / secondary / tertiary swatches from `themeConstants.js` (ola-map StyleSwitcher),
 * expanded into full shadcn-style CSS variables (oklch) for light and dark modes.
 * @see ../utils/themeConstants.js
 */

import { STORAGE_PALETTE, STORAGE_SCHEME, THEME_PALETTES } from './themeConstants'
import {
  readBrandStripsFromStorage,
  buildBrandThemeCssVars,
  brandShellGradient,
} from './themeBrand'

export { STORAGE_PALETTE, STORAGE_SCHEME, THEME_PALETTES }

/** @typedef {'light' | 'dark'} ColorScheme */

/** Preview strips + labels — keyed by palette id (picker UI). */
export const THEME_SWATCHES = Object.fromEntries(
  THEME_PALETTES.map((p) => [
    p.id,
    { label: p.label, category: p.category, light: p.light, dark: p.dark },
  ])
)

export const PALETTE_IDS = /** @type {const} */ (THEME_PALETTES.map((p) => p.id))

/** @typedef {(typeof PALETTE_IDS)[number]} PaletteId */

const DEFAULT_PALETTE_ID = 'default'

/**
 * Extra tokens derived from the three strip colors + base semantic vars (tertiary surfaces, glass overlays).
 * @param {string} paletteId
 * @param {ColorScheme} mode
 * @returns {Record<string, string>}
 */
function semanticStripVars(paletteId, mode) {
  const meta =
    paletteId === 'brand'
      ? (() => {
          const s = readBrandStripsFromStorage()
          return { light: s.light, dark: s.dark }
        })()
      : THEME_SWATCHES[paletteId]
  if (!meta) return {}
  const dark = mode === 'dark'
  const [pHex, sHex, tHex] = dark ? meta.dark : meta.light
  return {
    '--palette-strip-primary': pHex,
    '--palette-strip-secondary': sHex,
    '--palette-strip-tertiary': tHex,
    '--tertiary': `color-mix(in srgb, ${tHex} 36%, var(--background))`,
    '--tertiary-foreground': `color-mix(in srgb, var(--foreground) 88%, ${tHex})`,
    '--secondary-tint': `color-mix(in srgb, ${sHex} 28%, var(--background))`,
    '--primary-tint': `color-mix(in srgb, ${pHex} 22%, var(--background))`,
    '--surface-glass': dark
      ? 'color-mix(in oklch, var(--card) 86%, transparent)'
      : 'color-mix(in oklch, var(--card) 88%, transparent)',
    '--surface-glass-border': 'color-mix(in oklch, var(--border) 62%, transparent)',
    '--surface-glass-text': 'var(--foreground)',
    '--surface-glass-muted': 'color-mix(in oklch, var(--muted-foreground) 88%, transparent)',
  }
}

/**
 * Full CSS variable maps for document.documentElement.
 * Keys match src/index.css :root / shadcn token names.
 * @param {PaletteId} paletteId
 * @param {ColorScheme} mode
 * @returns {Record<string, string>}
 */
export function getThemeCssVars(paletteId, mode) {
  const id = PALETTE_IDS.includes(paletteId) ? paletteId : DEFAULT_PALETTE_ID
  const dark = mode === 'dark'
  const scheme = dark ? 'dark' : 'light'

  if (id === 'brand') {
    const strips = readBrandStripsFromStorage()
    const base = buildBrandThemeCssVars(strips, scheme)
    const g = brandShellGradient(strips, scheme)
    return {
      ...base,
      '--shell-gradient-from': g.from,
      '--shell-gradient-to': g.to,
      'color-scheme': scheme,
      ...semanticStripVars('brand', scheme),
    }
  }

  const themes = THEME_CSS
  const key = `${id}-${dark ? 'dark' : 'light'}`
  const base = themes[key] ?? themes[`${DEFAULT_PALETTE_ID}-${dark ? 'dark' : 'light'}`]
  const g = SHELL_GRADIENTS[key] ?? SHELL_GRADIENTS[`default-${dark ? 'dark' : 'light'}`]
  return {
    ...base,
    '--shell-gradient-from': g.from,
    '--shell-gradient-to': g.to,
    'color-scheme': scheme,
    ...semanticStripVars(id, scheme),
  }
}

/** @type {Record<string, { from: string; to: string }>} */
const SHELL_GRADIENTS = {
  'default-light': { from: '#f8f9fa', to: '#ced4da' },
  'default-dark': { from: '#1a1a2e', to: '#0f3460' },
  'eclipse-light': { from: '#fdf6e3', to: '#eee8d5' },
  'eclipse-dark': { from: '#002b36', to: '#073642' },
  'bolt-light': { from: '#fff8e7', to: '#ffd166' },
  'bolt-dark': { from: '#1a1a2e', to: '#3d1f2e' },
  'vintage-light': { from: '#fdf5e6', to: '#deb887' },
  'vintage-dark': { from: '#2c1810', to: '#5c3317' },
  'satellite-light': { from: '#e8f5e9', to: '#a5d6a7' },
  'satellite-dark': { from: '#1b4332', to: '#40916c' },
  'earth-light': { from: '#e8e0d4', to: '#c4b69c' },
  'earth-dark': { from: '#2a2419', to: '#6b5b4a' },
  'positron-light': { from: '#e8f0e4', to: '#9ccc65' },
  'positron-dark': { from: '#1b2e16', to: '#558b2f' },
  'osmBright-light': { from: '#f5f3ed', to: '#aad3df' },
  'osmBright-dark': { from: '#1e2a33', to: '#3d5c72' },
  'darkMatter-light': { from: '#eceff1', to: '#90a4ae' },
  'darkMatter-dark': { from: '#0d0d0d', to: '#424242' },
}

/**
 * Precomputed oklch tokens per palette × mode.
 * @type {Record<string, Record<string, string>>}
 */
const THEME_CSS = {
  'default-light': {
    '--background': 'oklch(0.99 0 0)',
    '--foreground': 'oklch(0.22 0.02 264)',
    '--card': 'oklch(1 0 0)',
    '--card-foreground': 'oklch(0.22 0.02 264)',
    '--popover': 'oklch(1 0 0)',
    '--popover-foreground': 'oklch(0.22 0.02 264)',
    '--primary': 'oklch(0.38 0.12 264)',
    '--primary-foreground': 'oklch(0.99 0 0)',
    '--secondary': 'oklch(0.95 0.01 264)',
    '--secondary-foreground': 'oklch(0.28 0.04 264)',
    '--muted': 'oklch(0.96 0.005 264)',
    '--muted-foreground': 'oklch(0.45 0.02 264)',
    '--accent': 'oklch(0.94 0.02 264)',
    '--accent-foreground': 'oklch(0.28 0.05 264)',
    '--destructive': 'oklch(0.577 0.245 27.325)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.90 0.01 264)',
    '--input': 'oklch(0.90 0.01 264)',
    '--ring': 'oklch(0.55 0.12 264)',
    '--sidebar': 'hsl(0 0% 0% / 0.20)',
    '--sidebar-foreground': 'hsl(0 0% 100% / 0.90)',
    '--sidebar-primary': 'oklch(0.38 0.12 264)',
    '--sidebar-primary-foreground': 'oklch(0.99 0 0)',
    '--sidebar-accent': 'hsl(0 0% 0% / 0.30)',
    '--sidebar-accent-foreground': 'hsl(0 0% 100% / 0.95)',
    '--sidebar-border': 'hsl(0 0% 100% / 0.15)',
    '--sidebar-ring': 'hsl(217.2 91.2% 59.8%)',
  },
  'default-dark': {
    '--background': 'oklch(0.20 0.04 264)',
    '--foreground': 'oklch(0.97 0.01 264)',
    '--card': 'oklch(0.24 0.045 264)',
    '--card-foreground': 'oklch(0.97 0.01 264)',
    '--popover': 'oklch(0.24 0.045 264)',
    '--popover-foreground': 'oklch(0.97 0.01 264)',
    '--primary': 'oklch(0.62 0.14 264)',
    '--primary-foreground': 'oklch(0.15 0.03 264)',
    '--secondary': 'oklch(0.30 0.05 264)',
    '--secondary-foreground': 'oklch(0.95 0.01 264)',
    '--muted': 'oklch(0.28 0.04 264)',
    '--muted-foreground': 'oklch(0.72 0.03 264)',
    '--accent': 'oklch(0.32 0.06 264)',
    '--accent-foreground': 'oklch(0.97 0.01 264)',
    '--destructive': 'oklch(0.55 0.22 25)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.34 0.05 264)',
    '--input': 'oklch(0.34 0.05 264)',
    '--ring': 'oklch(0.62 0.14 264)',
    '--sidebar': 'hsl(240 5.9% 10%)',
    '--sidebar-foreground': 'hsl(240 4.8% 95.9%)',
    '--sidebar-primary': 'oklch(0.62 0.14 264)',
    '--sidebar-primary-foreground': 'oklch(0.99 0 0)',
    '--sidebar-accent': 'hsl(240 3.7% 15.9%)',
    '--sidebar-accent-foreground': 'hsl(240 4.8% 95.9%)',
    '--sidebar-border': 'hsl(240 3.7% 15.9%)',
    '--sidebar-ring': 'hsl(217.2 91.2% 59.8%)',
  },
  'eclipse-light': {
    '--background': 'oklch(0.98 0.02 95)',
    '--foreground': 'oklch(0.35 0.04 220)',
    '--card': 'oklch(0.995 0.015 95)',
    '--card-foreground': 'oklch(0.35 0.04 220)',
    '--popover': 'oklch(0.995 0.015 95)',
    '--popover-foreground': 'oklch(0.35 0.04 220)',
    '--primary': 'oklch(0.45 0.06 200)',
    '--primary-foreground': 'oklch(0.99 0.01 95)',
    '--secondary': 'oklch(0.94 0.03 95)',
    '--secondary-foreground': 'oklch(0.38 0.04 200)',
    '--muted': 'oklch(0.93 0.025 95)',
    '--muted-foreground': 'oklch(0.50 0.03 200)',
    '--accent': 'oklch(0.92 0.04 95)',
    '--accent-foreground': 'oklch(0.35 0.05 200)',
    '--destructive': 'oklch(0.577 0.245 27.325)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.88 0.03 95)',
    '--input': 'oklch(0.88 0.03 95)',
    '--ring': 'oklch(0.55 0.08 200)',
    '--sidebar': 'hsl(0 0% 0% / 0.18)',
    '--sidebar-foreground': 'hsl(0 0% 100% / 0.90)',
    '--sidebar-primary': 'oklch(0.45 0.06 200)',
    '--sidebar-primary-foreground': 'oklch(0.99 0.01 95)',
    '--sidebar-accent': 'hsl(0 0% 0% / 0.28)',
    '--sidebar-accent-foreground': 'hsl(0 0% 100% / 0.95)',
    '--sidebar-border': 'hsl(0 0% 100% / 0.15)',
    '--sidebar-ring': 'oklch(0.55 0.08 200)',
  },
  'eclipse-dark': {
    '--background': 'oklch(0.22 0.04 220)',
    '--foreground': 'oklch(0.93 0.02 95)',
    '--card': 'oklch(0.26 0.045 220)',
    '--card-foreground': 'oklch(0.93 0.02 95)',
    '--popover': 'oklch(0.26 0.045 220)',
    '--popover-foreground': 'oklch(0.93 0.02 95)',
    '--primary': 'oklch(0.72 0.06 200)',
    '--primary-foreground': 'oklch(0.22 0.04 220)',
    '--secondary': 'oklch(0.32 0.05 220)',
    '--secondary-foreground': 'oklch(0.95 0.02 95)',
    '--muted': 'oklch(0.30 0.04 220)',
    '--muted-foreground': 'oklch(0.70 0.03 200)',
    '--accent': 'oklch(0.34 0.05 220)',
    '--accent-foreground': 'oklch(0.95 0.02 95)',
    '--destructive': 'oklch(0.55 0.22 25)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.38 0.05 220)',
    '--input': 'oklch(0.38 0.05 220)',
    '--ring': 'oklch(0.72 0.06 200)',
    '--sidebar': 'oklch(0.20 0.04 220)',
    '--sidebar-foreground': 'oklch(0.93 0.02 95)',
    '--sidebar-primary': 'oklch(0.72 0.06 200)',
    '--sidebar-primary-foreground': 'oklch(0.22 0.04 220)',
    '--sidebar-accent': 'oklch(0.30 0.05 220)',
    '--sidebar-accent-foreground': 'oklch(0.95 0.02 95)',
    '--sidebar-border': 'oklch(0.38 0.05 220)',
    '--sidebar-ring': 'oklch(0.72 0.06 200)',
  },
  'bolt-light': {
    '--background': 'oklch(0.99 0.01 95)',
    '--foreground': 'oklch(0.22 0.04 15)',
    '--card': 'oklch(1 0.01 95)',
    '--card-foreground': 'oklch(0.22 0.04 15)',
    '--popover': 'oklch(1 0.01 95)',
    '--popover-foreground': 'oklch(0.22 0.04 15)',
    '--primary': 'oklch(0.58 0.22 25)',
    '--primary-foreground': 'oklch(0.99 0 0)',
    '--secondary': 'oklch(0.92 0.12 90)',
    '--secondary-foreground': 'oklch(0.30 0.08 25)',
    '--muted': 'oklch(0.96 0.04 95)',
    '--muted-foreground': 'oklch(0.45 0.05 25)',
    '--accent': 'oklch(0.94 0.14 90)',
    '--accent-foreground': 'oklch(0.30 0.08 25)',
    '--destructive': 'oklch(0.577 0.245 27.325)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.90 0.06 95)',
    '--input': 'oklch(0.90 0.06 95)',
    '--ring': 'oklch(0.58 0.22 25)',
    '--sidebar': 'hsl(0 0% 0% / 0.22)',
    '--sidebar-foreground': 'hsl(0 0% 100% / 0.92)',
    '--sidebar-primary': 'oklch(0.58 0.22 25)',
    '--sidebar-primary-foreground': 'oklch(0.99 0 0)',
    '--sidebar-accent': 'hsl(0 0% 0% / 0.32)',
    '--sidebar-accent-foreground': 'hsl(0 0% 100% / 0.95)',
    '--sidebar-border': 'hsl(0 0% 100% / 0.15)',
    '--sidebar-ring': 'oklch(0.58 0.22 25)',
  },
  'bolt-dark': {
    '--background': 'oklch(0.20 0.04 264)',
    '--foreground': 'oklch(0.97 0.02 95)',
    '--card': 'oklch(0.24 0.05 264)',
    '--card-foreground': 'oklch(0.97 0.02 95)',
    '--popover': 'oklch(0.24 0.05 264)',
    '--popover-foreground': 'oklch(0.97 0.02 95)',
    '--primary': 'oklch(0.78 0.16 90)',
    '--primary-foreground': 'oklch(0.22 0.05 264)',
    '--secondary': 'oklch(0.58 0.22 25)',
    '--secondary-foreground': 'oklch(0.99 0 0)',
    '--muted': 'oklch(0.30 0.05 264)',
    '--muted-foreground': 'oklch(0.75 0.04 95)',
    '--accent': 'oklch(0.32 0.08 264)',
    '--accent-foreground': 'oklch(0.97 0.02 95)',
    '--destructive': 'oklch(0.55 0.22 25)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.36 0.06 264)',
    '--input': 'oklch(0.36 0.06 264)',
    '--ring': 'oklch(0.78 0.16 90)',
    '--sidebar': 'oklch(0.18 0.04 264)',
    '--sidebar-foreground': 'oklch(0.97 0.02 95)',
    '--sidebar-primary': 'oklch(0.78 0.16 90)',
    '--sidebar-primary-foreground': 'oklch(0.22 0.05 264)',
    '--sidebar-accent': 'oklch(0.28 0.06 264)',
    '--sidebar-accent-foreground': 'oklch(0.97 0.02 95)',
    '--sidebar-border': 'oklch(0.36 0.06 264)',
    '--sidebar-ring': 'oklch(0.78 0.16 90)',
  },
  'vintage-light': {
    '--background': 'oklch(0.98 0.03 75)',
    '--foreground': 'oklch(0.30 0.05 55)',
    '--card': 'oklch(0.995 0.025 75)',
    '--card-foreground': 'oklch(0.30 0.05 55)',
    '--popover': 'oklch(0.995 0.025 75)',
    '--popover-foreground': 'oklch(0.30 0.05 55)',
    '--primary': 'oklch(0.52 0.14 55)',
    '--primary-foreground': 'oklch(0.99 0.01 75)',
    '--secondary': 'oklch(0.90 0.06 75)',
    '--secondary-foreground': 'oklch(0.32 0.06 55)',
    '--muted': 'oklch(0.93 0.04 75)',
    '--muted-foreground': 'oklch(0.48 0.05 55)',
    '--accent': 'oklch(0.88 0.07 75)',
    '--accent-foreground': 'oklch(0.30 0.06 55)',
    '--destructive': 'oklch(0.577 0.245 27.325)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.86 0.06 75)',
    '--input': 'oklch(0.86 0.06 75)',
    '--ring': 'oklch(0.52 0.14 55)',
    '--sidebar': 'hsl(30 25% 15% / 0.35)',
    '--sidebar-foreground': 'hsl(40 30% 98%)',
    '--sidebar-primary': 'oklch(0.52 0.14 55)',
    '--sidebar-primary-foreground': 'oklch(0.99 0.01 75)',
    '--sidebar-accent': 'hsl(30 20% 10% / 0.45)',
    '--sidebar-accent-foreground': 'hsl(40 30% 98%)',
    '--sidebar-border': 'hsl(40 25% 95% / 0.2)',
    '--sidebar-ring': 'oklch(0.52 0.14 55)',
  },
  'vintage-dark': {
    '--background': 'oklch(0.22 0.04 55)',
    '--foreground': 'oklch(0.94 0.03 75)',
    '--card': 'oklch(0.26 0.05 55)',
    '--card-foreground': 'oklch(0.94 0.03 75)',
    '--popover': 'oklch(0.26 0.05 55)',
    '--popover-foreground': 'oklch(0.94 0.03 75)',
    '--primary': 'oklch(0.72 0.12 55)',
    '--primary-foreground': 'oklch(0.22 0.04 55)',
    '--secondary': 'oklch(0.38 0.06 55)',
    '--secondary-foreground': 'oklch(0.95 0.03 75)',
    '--muted': 'oklch(0.32 0.05 55)',
    '--muted-foreground': 'oklch(0.72 0.04 75)',
    '--accent': 'oklch(0.36 0.06 55)',
    '--accent-foreground': 'oklch(0.95 0.03 75)',
    '--destructive': 'oklch(0.55 0.22 25)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.40 0.06 55)',
    '--input': 'oklch(0.40 0.06 55)',
    '--ring': 'oklch(0.72 0.12 55)',
    '--sidebar': 'oklch(0.20 0.04 55)',
    '--sidebar-foreground': 'oklch(0.94 0.03 75)',
    '--sidebar-primary': 'oklch(0.72 0.12 55)',
    '--sidebar-primary-foreground': 'oklch(0.22 0.04 55)',
    '--sidebar-accent': 'oklch(0.32 0.05 55)',
    '--sidebar-accent-foreground': 'oklch(0.95 0.03 75)',
    '--sidebar-border': 'oklch(0.40 0.06 55)',
    '--sidebar-ring': 'oklch(0.72 0.12 55)',
  },
  'satellite-light': {
    '--background': 'oklch(0.985 0.02 145)',
    '--foreground': 'oklch(0.22 0.05 145)',
    '--card': 'oklch(1 0.015 145)',
    '--card-foreground': 'oklch(0.22 0.05 145)',
    '--popover': 'oklch(1 0.015 145)',
    '--popover-foreground': 'oklch(0.22 0.05 145)',
    '--primary': 'oklch(0.45 0.12 145)',
    '--primary-foreground': 'oklch(0.99 0.01 145)',
    '--secondary': 'oklch(0.94 0.03 145)',
    '--secondary-foreground': 'oklch(0.28 0.06 145)',
    '--muted': 'oklch(0.95 0.025 145)',
    '--muted-foreground': 'oklch(0.45 0.05 145)',
    '--accent': 'oklch(0.92 0.04 145)',
    '--accent-foreground': 'oklch(0.28 0.06 145)',
    '--destructive': 'oklch(0.577 0.245 27.325)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.88 0.04 145)',
    '--input': 'oklch(0.88 0.04 145)',
    '--ring': 'oklch(0.50 0.10 145)',
    '--sidebar': 'hsl(0 0% 0% / 0.20)',
    '--sidebar-foreground': 'hsl(0 0% 100% / 0.90)',
    '--sidebar-primary': 'oklch(0.45 0.12 145)',
    '--sidebar-primary-foreground': 'oklch(0.99 0.01 145)',
    '--sidebar-accent': 'hsl(0 0% 0% / 0.30)',
    '--sidebar-accent-foreground': 'hsl(0 0% 100% / 0.95)',
    '--sidebar-border': 'hsl(0 0% 100% / 0.15)',
    '--sidebar-ring': 'oklch(0.50 0.10 145)',
  },
  'satellite-dark': {
    '--background': 'oklch(0.22 0.05 150)',
    '--foreground': 'oklch(0.96 0.02 145)',
    '--card': 'oklch(0.26 0.06 150)',
    '--card-foreground': 'oklch(0.96 0.02 145)',
    '--popover': 'oklch(0.26 0.06 150)',
    '--popover-foreground': 'oklch(0.96 0.02 145)',
    '--primary': 'oklch(0.72 0.12 150)',
    '--primary-foreground': 'oklch(0.18 0.04 150)',
    '--secondary': 'oklch(0.32 0.06 150)',
    '--secondary-foreground': 'oklch(0.95 0.02 145)',
    '--muted': 'oklch(0.30 0.05 150)',
    '--muted-foreground': 'oklch(0.72 0.04 145)',
    '--accent': 'oklch(0.34 0.07 150)',
    '--accent-foreground': 'oklch(0.96 0.02 145)',
    '--destructive': 'oklch(0.55 0.22 25)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.38 0.06 150)',
    '--input': 'oklch(0.38 0.06 150)',
    '--ring': 'oklch(0.72 0.12 150)',
    '--sidebar': 'oklch(0.20 0.05 150)',
    '--sidebar-foreground': 'oklch(0.96 0.02 145)',
    '--sidebar-primary': 'oklch(0.72 0.12 150)',
    '--sidebar-primary-foreground': 'oklch(0.18 0.04 150)',
    '--sidebar-accent': 'oklch(0.30 0.05 150)',
    '--sidebar-accent-foreground': 'oklch(0.95 0.02 145)',
    '--sidebar-border': 'oklch(0.38 0.06 150)',
    '--sidebar-ring': 'oklch(0.72 0.12 150)',
  },
  'earth-light': {
    '--background': 'oklch(0.97 0.02 75)',
    '--foreground': 'oklch(0.28 0.04 55)',
    '--card': 'oklch(0.995 0.02 75)',
    '--card-foreground': 'oklch(0.28 0.04 55)',
    '--popover': 'oklch(0.995 0.02 75)',
    '--popover-foreground': 'oklch(0.28 0.04 55)',
    '--primary': 'oklch(0.48 0.10 55)',
    '--primary-foreground': 'oklch(0.99 0.01 75)',
    '--secondary': 'oklch(0.92 0.04 75)',
    '--secondary-foreground': 'oklch(0.32 0.05 55)',
    '--muted': 'oklch(0.93 0.03 75)',
    '--muted-foreground': 'oklch(0.48 0.04 55)',
    '--accent': 'oklch(0.90 0.05 75)',
    '--accent-foreground': 'oklch(0.30 0.05 55)',
    '--destructive': 'oklch(0.577 0.245 27.325)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.86 0.05 75)',
    '--input': 'oklch(0.86 0.05 75)',
    '--ring': 'oklch(0.48 0.10 55)',
    '--sidebar': 'hsl(30 25% 15% / 0.32)',
    '--sidebar-foreground': 'hsl(40 30% 98%)',
    '--sidebar-primary': 'oklch(0.48 0.10 55)',
    '--sidebar-primary-foreground': 'oklch(0.99 0.01 75)',
    '--sidebar-accent': 'hsl(30 20% 10% / 0.42)',
    '--sidebar-accent-foreground': 'hsl(40 30% 98%)',
    '--sidebar-border': 'hsl(40 25% 95% / 0.2)',
    '--sidebar-ring': 'oklch(0.48 0.10 55)',
  },
  'earth-dark': {
    '--background': 'oklch(0.22 0.04 55)',
    '--foreground': 'oklch(0.94 0.03 75)',
    '--card': 'oklch(0.26 0.05 55)',
    '--card-foreground': 'oklch(0.94 0.03 75)',
    '--popover': 'oklch(0.26 0.05 55)',
    '--popover-foreground': 'oklch(0.94 0.03 75)',
    '--primary': 'oklch(0.72 0.10 55)',
    '--primary-foreground': 'oklch(0.22 0.04 55)',
    '--secondary': 'oklch(0.36 0.06 55)',
    '--secondary-foreground': 'oklch(0.95 0.03 75)',
    '--muted': 'oklch(0.32 0.05 55)',
    '--muted-foreground': 'oklch(0.72 0.04 75)',
    '--accent': 'oklch(0.34 0.06 55)',
    '--accent-foreground': 'oklch(0.95 0.03 75)',
    '--destructive': 'oklch(0.55 0.22 25)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.40 0.06 55)',
    '--input': 'oklch(0.40 0.06 55)',
    '--ring': 'oklch(0.72 0.10 55)',
    '--sidebar': 'oklch(0.20 0.04 55)',
    '--sidebar-foreground': 'oklch(0.94 0.03 75)',
    '--sidebar-primary': 'oklch(0.72 0.10 55)',
    '--sidebar-primary-foreground': 'oklch(0.22 0.04 55)',
    '--sidebar-accent': 'oklch(0.32 0.05 55)',
    '--sidebar-accent-foreground': 'oklch(0.95 0.03 75)',
    '--sidebar-border': 'oklch(0.40 0.06 55)',
    '--sidebar-ring': 'oklch(0.72 0.10 55)',
  },
  'positron-light': {
    '--background': 'oklch(0.98 0.02 130)',
    '--foreground': 'oklch(0.22 0.04 130)',
    '--card': 'oklch(0.995 0.015 130)',
    '--card-foreground': 'oklch(0.22 0.04 130)',
    '--popover': 'oklch(0.995 0.015 130)',
    '--popover-foreground': 'oklch(0.22 0.04 130)',
    '--primary': 'oklch(0.48 0.14 130)',
    '--primary-foreground': 'oklch(0.99 0.01 130)',
    '--secondary': 'oklch(0.93 0.04 130)',
    '--secondary-foreground': 'oklch(0.28 0.06 130)',
    '--muted': 'oklch(0.95 0.03 130)',
    '--muted-foreground': 'oklch(0.45 0.05 130)',
    '--accent': 'oklch(0.92 0.05 130)',
    '--accent-foreground': 'oklch(0.28 0.06 130)',
    '--destructive': 'oklch(0.577 0.245 27.325)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.88 0.04 130)',
    '--input': 'oklch(0.88 0.04 130)',
    '--ring': 'oklch(0.52 0.12 130)',
    '--sidebar': 'hsl(0 0% 0% / 0.18)',
    '--sidebar-foreground': 'hsl(0 0% 100% / 0.90)',
    '--sidebar-primary': 'oklch(0.48 0.14 130)',
    '--sidebar-primary-foreground': 'oklch(0.99 0.01 130)',
    '--sidebar-accent': 'hsl(0 0% 0% / 0.28)',
    '--sidebar-accent-foreground': 'hsl(0 0% 100% / 0.95)',
    '--sidebar-border': 'hsl(0 0% 100% / 0.14)',
    '--sidebar-ring': 'oklch(0.52 0.12 130)',
  },
  'positron-dark': {
    '--background': 'oklch(0.19 0.04 130)',
    '--foreground': 'oklch(0.96 0.02 130)',
    '--card': 'oklch(0.23 0.045 130)',
    '--card-foreground': 'oklch(0.96 0.02 130)',
    '--popover': 'oklch(0.23 0.045 130)',
    '--popover-foreground': 'oklch(0.96 0.02 130)',
    '--primary': 'oklch(0.72 0.14 130)',
    '--primary-foreground': 'oklch(0.16 0.04 130)',
    '--secondary': 'oklch(0.30 0.06 130)',
    '--secondary-foreground': 'oklch(0.95 0.02 130)',
    '--muted': 'oklch(0.28 0.05 130)',
    '--muted-foreground': 'oklch(0.72 0.04 130)',
    '--accent': 'oklch(0.32 0.07 130)',
    '--accent-foreground': 'oklch(0.96 0.02 130)',
    '--destructive': 'oklch(0.55 0.22 25)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.34 0.06 130)',
    '--input': 'oklch(0.34 0.06 130)',
    '--ring': 'oklch(0.72 0.14 130)',
    '--sidebar': 'oklch(0.17 0.04 130)',
    '--sidebar-foreground': 'oklch(0.96 0.02 130)',
    '--sidebar-primary': 'oklch(0.72 0.14 130)',
    '--sidebar-primary-foreground': 'oklch(0.16 0.04 130)',
    '--sidebar-accent': 'oklch(0.28 0.05 130)',
    '--sidebar-accent-foreground': 'oklch(0.95 0.02 130)',
    '--sidebar-border': 'oklch(0.34 0.06 130)',
    '--sidebar-ring': 'oklch(0.72 0.14 130)',
  },
  'osmBright-light': {
    '--background': 'oklch(0.985 0.02 230)',
    '--foreground': 'oklch(0.25 0.04 240)',
    '--card': 'oklch(1 0.015 230)',
    '--card-foreground': 'oklch(0.25 0.04 240)',
    '--popover': 'oklch(1 0.015 230)',
    '--popover-foreground': 'oklch(0.25 0.04 240)',
    '--primary': 'oklch(0.48 0.10 240)',
    '--primary-foreground': 'oklch(0.99 0.01 230)',
    '--secondary': 'oklch(0.93 0.04 230)',
    '--secondary-foreground': 'oklch(0.30 0.06 240)',
    '--muted': 'oklch(0.94 0.03 230)',
    '--muted-foreground': 'oklch(0.48 0.05 240)',
    '--accent': 'oklch(0.91 0.05 230)',
    '--accent-foreground': 'oklch(0.30 0.06 240)',
    '--destructive': 'oklch(0.577 0.245 27.325)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.87 0.04 230)',
    '--input': 'oklch(0.87 0.04 230)',
    '--ring': 'oklch(0.52 0.10 240)',
    '--sidebar': 'hsl(0 0% 0% / 0.20)',
    '--sidebar-foreground': 'hsl(0 0% 100% / 0.90)',
    '--sidebar-primary': 'oklch(0.48 0.10 240)',
    '--sidebar-primary-foreground': 'oklch(0.99 0.01 230)',
    '--sidebar-accent': 'hsl(0 0% 0% / 0.30)',
    '--sidebar-accent-foreground': 'hsl(0 0% 100% / 0.95)',
    '--sidebar-border': 'hsl(0 0% 100% / 0.15)',
    '--sidebar-ring': 'oklch(0.52 0.10 240)',
  },
  'osmBright-dark': {
    '--background': 'oklch(0.22 0.04 240)',
    '--foreground': 'oklch(0.95 0.02 230)',
    '--card': 'oklch(0.26 0.05 240)',
    '--card-foreground': 'oklch(0.95 0.02 230)',
    '--popover': 'oklch(0.26 0.05 240)',
    '--popover-foreground': 'oklch(0.95 0.02 230)',
    '--primary': 'oklch(0.72 0.10 230)',
    '--primary-foreground': 'oklch(0.20 0.04 240)',
    '--secondary': 'oklch(0.34 0.06 240)',
    '--secondary-foreground': 'oklch(0.95 0.02 230)',
    '--muted': 'oklch(0.30 0.05 240)',
    '--muted-foreground': 'oklch(0.72 0.04 230)',
    '--accent': 'oklch(0.32 0.06 240)',
    '--accent-foreground': 'oklch(0.95 0.02 230)',
    '--destructive': 'oklch(0.55 0.22 25)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.38 0.06 240)',
    '--input': 'oklch(0.38 0.06 240)',
    '--ring': 'oklch(0.72 0.10 230)',
    '--sidebar': 'oklch(0.20 0.04 240)',
    '--sidebar-foreground': 'oklch(0.95 0.02 230)',
    '--sidebar-primary': 'oklch(0.72 0.10 230)',
    '--sidebar-primary-foreground': 'oklch(0.20 0.04 240)',
    '--sidebar-accent': 'oklch(0.30 0.05 240)',
    '--sidebar-accent-foreground': 'oklch(0.95 0.02 230)',
    '--sidebar-border': 'oklch(0.38 0.06 240)',
    '--sidebar-ring': 'oklch(0.72 0.10 230)',
  },
  'darkMatter-light': {
    '--background': 'oklch(0.97 0.01 240)',
    '--foreground': 'oklch(0.18 0.03 240)',
    '--card': 'oklch(0.99 0.008 240)',
    '--card-foreground': 'oklch(0.18 0.03 240)',
    '--popover': 'oklch(0.99 0.008 240)',
    '--popover-foreground': 'oklch(0.18 0.03 240)',
    '--primary': 'oklch(0.42 0.06 240)',
    '--primary-foreground': 'oklch(0.99 0.005 240)',
    '--secondary': 'oklch(0.93 0.02 240)',
    '--secondary-foreground': 'oklch(0.25 0.04 240)',
    '--muted': 'oklch(0.94 0.015 240)',
    '--muted-foreground': 'oklch(0.48 0.03 240)',
    '--accent': 'oklch(0.91 0.02 240)',
    '--accent-foreground': 'oklch(0.22 0.04 240)',
    '--destructive': 'oklch(0.577 0.245 27.325)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.87 0.02 240)',
    '--input': 'oklch(0.87 0.02 240)',
    '--ring': 'oklch(0.50 0.06 240)',
    '--sidebar': 'hsl(220 15% 12% / 0.88)',
    '--sidebar-foreground': 'hsl(210 20% 98%)',
    '--sidebar-primary': 'oklch(0.42 0.06 240)',
    '--sidebar-primary-foreground': 'oklch(0.99 0.005 240)',
    '--sidebar-accent': 'hsl(220 12% 16%)',
    '--sidebar-accent-foreground': 'hsl(210 20% 98%)',
    '--sidebar-border': 'hsl(220 12% 22%)',
    '--sidebar-ring': 'oklch(0.50 0.06 240)',
  },
  'darkMatter-dark': {
    '--background': 'oklch(0.14 0 0)',
    '--foreground': 'oklch(0.985 0 0)',
    '--card': 'oklch(0.18 0 0)',
    '--card-foreground': 'oklch(0.985 0 0)',
    '--popover': 'oklch(0.18 0 0)',
    '--popover-foreground': 'oklch(0.985 0 0)',
    '--primary': 'oklch(0.88 0 0)',
    '--primary-foreground': 'oklch(0.12 0 0)',
    '--secondary': 'oklch(0.28 0 0)',
    '--secondary-foreground': 'oklch(0.96 0 0)',
    '--muted': 'oklch(0.26 0 0)',
    '--muted-foreground': 'oklch(0.72 0 0)',
    '--accent': 'oklch(0.30 0 0)',
    '--accent-foreground': 'oklch(0.985 0 0)',
    '--destructive': 'oklch(0.55 0.22 25)',
    '--destructive-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(0.32 0 0)',
    '--input': 'oklch(0.32 0 0)',
    '--ring': 'oklch(0.72 0 0)',
    '--sidebar': 'oklch(0.12 0 0)',
    '--sidebar-foreground': 'oklch(0.985 0 0)',
    '--sidebar-primary': 'oklch(0.88 0 0)',
    '--sidebar-primary-foreground': 'oklch(0.12 0 0)',
    '--sidebar-accent': 'oklch(0.24 0 0)',
    '--sidebar-accent-foreground': 'oklch(0.96 0 0)',
    '--sidebar-border': 'oklch(0.32 0 0)',
    '--sidebar-ring': 'oklch(0.72 0 0)',
  },
}

export function readStoredPaletteId() {
  try {
    const v = localStorage.getItem(STORAGE_PALETTE)
    if (v === 'lite') return DEFAULT_PALETTE_ID
    if (v && PALETTE_IDS.includes(/** @type {PaletteId} */ (v))) return /** @type {PaletteId} */ (v)
  } catch {
    /* ignore */
  }
  return DEFAULT_PALETTE_ID
}

/**
 * @returns {'light' | 'dark' | null} null = follow OS preference (no explicit user choice)
 */
export function readStoredSchemePreference() {
  try {
    const v = localStorage.getItem(STORAGE_SCHEME)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return null
}

export function prefersDarkMediaQuery() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * @param {'light' | 'dark' | null} pref
 */
export function resolveScheme(pref) {
  if (pref === 'light' || pref === 'dark') return pref
  return prefersDarkMediaQuery() ? 'dark' : 'light'
}
