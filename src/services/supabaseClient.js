import { createClient } from '@supabase/supabase-js'

const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

function normalizeSupabaseUrl(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (!u.hostname.endsWith('.supabase.co') && u.hostname !== 'supabase.co') return null
    return u.origin
  } catch {
    return null
  }
}

const supabaseUrl = normalizeSupabaseUrl(rawUrl)
const hasValidConfig = supabaseUrl !== null && supabaseAnonKey.length > 0

if (!hasValidConfig) {
  console.warn('Supabase env vars (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) not set or invalid. Admin and masjid data will be unavailable.')
}

export const supabase = hasValidConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
