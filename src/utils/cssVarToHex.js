/**
 * Resolve a CSS variable (e.g. `--primary`) to `#rrggbb` for MapLibre / canvas APIs that need hex/rgb.
 */
export function cssVarToHex(varName) {
  if (typeof document === 'undefined') return '#2563eb'
  const el = document.createElement('div')
  el.style.color = `var(${varName})`
  el.style.position = 'absolute'
  el.style.visibility = 'hidden'
  el.style.pointerEvents = 'none'
  document.body.appendChild(el)
  const rgb = getComputedStyle(el).color
  document.body.removeChild(el)
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!m) return '#2563eb'
  const r = Number(m[1])
  const g = Number(m[2])
  const b = Number(m[3])
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}
