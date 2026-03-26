import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  STORAGE_PALETTE,
  STORAGE_SCHEME,
  getThemeCssVars,
  readStoredPaletteId,
  readStoredSchemePreference,
  resolveScheme,
  PALETTE_IDS,
} from '@/utils/themeColors'

/** @typedef {import('@/utils/themeColors').PaletteId} PaletteId */
/** @typedef {import('@/utils/themeColors').ColorScheme} ColorScheme */

const ThemeContext = createContext(null)

function applyCssVars(vars) {
  const root = document.documentElement
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v)
  }
}

export function ThemeProvider({ children }) {
  const [schemePreference, setSchemePreferenceState] = useState(() => readStoredSchemePreference())
  const [paletteId, setPaletteIdState] = useState(() => readStoredPaletteId())
  /** Bumps when custom Brand colors are saved so CSS vars re-apply while palette stays `brand`. */
  const [brandThemeRevision, setBrandThemeRevision] = useState(0)
  const [, osThemeBump] = useState(0)

  const resolvedScheme = useMemo(
    () => resolveScheme(schemePreference),
    [schemePreference, osThemeBump]
  )

  useEffect(() => {
    if (schemePreference != null) return undefined
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => osThemeBump((n) => n + 1)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [schemePreference])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedScheme === 'dark')
    document.documentElement.dataset.palette = paletteId
    applyCssVars(getThemeCssVars(paletteId, resolvedScheme))
  }, [resolvedScheme, paletteId, brandThemeRevision])

  const setScheme = useCallback((/** @type {'light' | 'dark'} */ next) => {
    try {
      localStorage.setItem(STORAGE_SCHEME, next)
    } catch {
      /* ignore */
    }
    setSchemePreferenceState(next)
  }, [])

  const setPalette = useCallback((/** @type {PaletteId} */ id) => {
    const next = PALETTE_IDS.includes(id) ? id : 'default'
    try {
      localStorage.setItem(STORAGE_PALETTE, next)
    } catch {
      /* ignore */
    }
    setPaletteIdState(next)
  }, [])

  const bumpBrandTheme = useCallback(() => {
    setBrandThemeRevision((n) => n + 1)
  }, [])

  const value = useMemo(
    () => ({
      /** Resolved light/dark (includes OS when user has not chosen). */
      resolvedScheme,
      /** User choice: null means follow OS (no "System" label in UI). */
      schemePreference,
      paletteId,
      setScheme,
      setPalette,
      bumpBrandTheme,
      brandThemeRevision,
    }),
    [resolvedScheme, schemePreference, paletteId, setScheme, setPalette, bumpBrandTheme, brandThemeRevision]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
