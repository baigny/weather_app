import { cn } from '@/lib/utils'

/** Glass-style controls used on hero + tools sheet (reads CSS vars from theme). */
export const toolsPanelMutedClass = 'text-[var(--surface-glass-muted)]'
export const toolsPanelTextClass = 'text-[var(--surface-glass-text)]'

export function toolsOutlineButtonClass(className) {
  return cn(
    'border-[var(--surface-glass-border)] bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] text-[var(--surface-glass-text)] hover:bg-[color-mix(in_oklch,var(--foreground)_14%,transparent)]',
    className
  )
}
