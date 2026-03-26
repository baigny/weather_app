/**
 * App theme palette definitions — aligned with ola-map `StyleSwitcher.jsx`:
 * each row is [primary, secondary, tertiary] preview strips for light and dark.
 * @see C:/Projects/Web_Apps/ola-map/src/components/StyleSwitcher.jsx
 */

export const STORAGE_SCHEME = 'weather-app-color-scheme'
export const STORAGE_PALETTE = 'weather-app-color-palette'

/**
 * @typedef {Object} ThemePaletteDef
 * @property {string} id Stable id for localStorage + CSS (`data-palette`).
 * @property {string} label Short label (picker).
 * @property {string} category Group heading (Default, Eclipse, OSM, …).
 * @property {[string, string, string]} light Primary / secondary / tertiary (hex).
 * @property {[string, string, string]} dark Primary / secondary / tertiary (hex).
 */

/** @type {ThemePaletteDef[]} */
export const THEME_PALETTES = [
  {
    id: 'default',
    label: 'Classic',
    category: 'Presets',
    light: ['#f8f9fa', '#e9ecef', '#dee2e6'],
    dark: ['#1a1a2e', '#16213e', '#0f3460'],
  },
  {
    id: 'satellite',
    label: 'Satellite',
    category: 'Presets',
    light: ['#e8f5e9', '#c8e6c9', '#81c784'],
    dark: ['#1b4332', '#2d6a4f', '#40916c'],
  },
  {
    id: 'eclipse',
    label: 'Eclipse',
    category: 'Presets',
    light: ['#fdf6e3', '#eee8d5', '#93a1a1'],
    dark: ['#002b36', '#073642', '#586e75'],
  },
  {
    id: 'bolt',
    label: 'Bolt',
    category: 'Presets',
    light: ['#f8f9fa', '#ffd166', '#ef476f'],
    dark: ['#1a1a2e', '#ffd166', '#ef476f'],
  },
  {
    id: 'vintage',
    label: 'Vintage',
    category: 'Presets',
    light: ['#fdf5e6', '#deb887', '#d2691e'],
    dark: ['#2c1810', '#5c3317', '#8b4513'],
  },
  {
    id: 'earth',
    label: 'Earth',
    category: 'Presets',
    light: ['#e8e0d4', '#c4b69c', '#8b7d6b'],
    dark: ['#2a2419', '#4a3f32', '#6b5b4a'],
  },
  {
    id: 'positron',
    label: 'Positron',
    category: 'OSM',
    /** Sage / green-gray — visually distinct from Classic greys. */
    light: ['#e8f0e4', '#9ccc65', '#33691e'],
    dark: ['#1b2e16', '#558b2f', '#aed581'],
  },
  {
    id: 'osmBright',
    label: 'OSM Bright',
    category: 'OSM',
    light: ['#f5f3ed', '#aad3df', '#e8e0d8'],
    dark: ['#1e2a33', '#2d4a5c', '#3d5c72'],
  },
  {
    id: 'darkMatter',
    label: 'Dark Matter',
    category: 'OSM',
    /** Cool slate preview for light UI — distinct from Classic warm greys. */
    light: ['#eceff1', '#90a4ae', '#37474f'],
    dark: ['#0d0d0d', '#212121', '#424242'],
  },
  {
    id: 'brand',
    label: 'Brand',
    category: 'Custom',
    light: ['#2563eb', '#93c5fd', '#1e3a8a'],
    dark: ['#60a5fa', '#1e40af', '#dbeafe'],
  },
]
