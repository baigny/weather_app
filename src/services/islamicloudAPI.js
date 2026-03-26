/**
 * IslamiCloud API – prayer times and nearby mosques.
 * In dev we use Vite proxy (/api/islamicloud) to avoid CORS; in production same path can be proxied by your host.
 * Auth: Authorization: Bearer YOUR_API_KEY
 * @see https://islamicloud.com/docs
 */
const BASE =
  typeof import.meta.env?.DEV !== 'undefined' && import.meta.env.DEV
    ? '/api/islamicloud/api'
    : 'https://api.islamicloud.com/api'
const API_KEY = (import.meta.env.VITE_ISLAMICLOUD_API_KEY ?? '').trim()

function headers(extra = {}) {
  const h = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Accept-Language': 'en',
    ...extra,
  }
  if (API_KEY) h.Authorization = `Bearer ${API_KEY}`
  return h
}

export const hasIslamiCloudKey = () => !!API_KEY

/** Format date as YYYY-MM-DD for IslamiCloud timings API */
function formatDateYYYYMMDD(date) {
  const d = date || new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Prayer times for a date at lat/lon.
 * GET /timings/{date}?latitude=&longitude=&lang=en  (date = DD-MM-YYYY)
 * @returns Promise<{ timings: { Fajr, Dhuhr, Asr, Maghrib, Isha }, date }>
 */
export async function fetchPrayerTimes(lat, lon, date = null) {
  const d = formatDateYYYYMMDD(date)
  const url = `${BASE}/timings/${d}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&lang=en`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`IslamiCloud prayer times: ${res.status}`)
  const json = await res.json()
  const data = json?.data ?? json
  const timings = data?.timings ?? {}
  const strip = (t) => (t != null ? String(t).trim().split(' ')[0] : '')
  return {
    timings: {
      Fajr: strip(timings.Fajr),
      Sunrise: strip(timings.Sunrise),
      Dhuhr: strip(timings.Dhuhr),
      Asr: strip(timings.Asr),
      Maghrib: strip(timings.Maghrib),
      Isha: strip(timings.Isha),
    },
    date: data?.date ?? d,
  }
}

/**
 * Find mosques near a location.
 * GET /mosques?latitude=&longitude=&radius= (radius in meters, default 3000)
 */
export async function fetchNearbyMosques(lat, lon, radiusM = 3000) {
  if (!API_KEY) return []
  const url = `${BASE}/mosques?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&radius=${Math.round(radiusM)}`
  try {
    const res = await fetch(url, { headers: headers() })
    if (!res.ok) return []
    const json = await res.json()
    const list = json?.data ?? json?.mosques ?? json?.results ?? (Array.isArray(json) ? json : [])
    return (Array.isArray(list) ? list : []).map((m, i) => {
      const addrParts = [m.tags?.['addr:street'], m.tags?.['addr:city'], m.tags?.['addr:country']].filter(Boolean)
      const address = m.address || m.full_address || (addrParts.length ? addrParts.join(', ') : '')
      return {
        id: m.id ?? m.osm_id ?? m.masjid_id ?? `ic-${i}`,
        name: m.name ?? m.masjid_name ?? m.tags?.name ?? 'Masjid',
        address,
        lat: Number(m.lat ?? m.latitude ?? m.geometry?.coordinates?.[1] ?? m.center?.lat),
        lon: Number(m.lon ?? m.longitude ?? m.geometry?.coordinates?.[0] ?? m.center?.lon),
        distance: m.distance != null ? Number(m.distance) : null,
        timings: m.timings ?? m.prayer_times ?? null,
      }
    })
  } catch {
    return []
  }
}
