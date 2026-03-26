import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/** Human-readable place line: drop duplicate road segments, then keep last 6 comma parts (area → pin). */
export function shortenLocationLabel(label) {
  if (!label || label === '—') return label
  const raw = String(label)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  const parts = []
  for (const p of raw) {
    const low = p.toLowerCase()
    if (parts.length && parts[parts.length - 1].toLowerCase() === low) continue
    parts.push(p)
  }
  if (parts.length <= 6) return parts.join(', ')
  return parts.slice(-6).join(', ')
}
