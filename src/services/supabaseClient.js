import { createClient } from '@supabase/supabase-js'

const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

let supabaseUrl = null
if (rawUrl) {
  try {
    const withProto = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
    const u = new URL(withProto.replace(/\/+$/, ''))
    if (
      (u.protocol === 'https:' || u.protocol === 'http:') &&
      (u.hostname.endsWith('.supabase.co') || u.hostname === 'supabase.co')
    ) {
      supabaseUrl = u.origin
    }
  } catch {
    supabaseUrl = null
  }
}
const hasValidConfig = supabaseUrl !== null && supabaseAnonKey.length > 0

if (!hasValidConfig) {
  console.warn('Supabase env vars (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) not set or invalid. Admin and masjid data will be unavailable.')
}

export const supabase = hasValidConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
