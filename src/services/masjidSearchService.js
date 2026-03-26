/**
 * Masjid search using Ola Places only.
 * "masjid near me", "masjid near [location]", "masjid within 2km/5km/10km", keyword filter.
 * Results include mosques and islamic institutions.
 */
import { haversineMeters } from './geo'
import { fetchNearbyIslamicInstitutions } from './olaPlacesAPI'
import { getCurrentPosition } from './weatherAPI'
import { searchCities } from './weatherAPI'

/** Default search radius when query does not specify one (matches Ola default cap context). */
export const DEFAULT_SEARCH_RADIUS_KM = 5
/** Ola nearby API allows up to 50 km (see fetchNearbyIslamicInstitutions). */
export const MAX_SEARCH_RADIUS_KM = 50
export const MIN_SEARCH_RADIUS_KM = 1

export function clampMasjidRadiusKm(km) {
  const n = Number(km)
  if (!Number.isFinite(n)) return DEFAULT_SEARCH_RADIUS_KM
  return Math.min(MAX_SEARCH_RADIUS_KM, Math.max(MIN_SEARCH_RADIUS_KM, n))
}

/**
 * Parse search query into intent.
 */
export function parseSearchQuery(query) {
  const q = (query || '').trim()
  const lower = q.toLowerCase()

  if (/masjid\s+near\s+me$/i.test(q) || lower === 'masjid near me') {
    return { type: 'near_me' }
  }

  const nearMatch = q.match(/masjid\s+near\s+(.+)/i)
  if (nearMatch && nearMatch[1].trim()) {
    return { type: 'near_place', place: nearMatch[1].trim() }
  }

  const withinMatch = q.match(/masjid\s+within\s+(\d+(?:\.\d+)?)\s*km/i)
  if (withinMatch) {
    const km = parseFloat(withinMatch[1])
    return { type: 'within', radiusKm: clampMasjidRadiusKm(km) }
  }

  return { type: 'keyword', keyword: q }
}

const DEFAULT_RADIUS_M = DEFAULT_SEARCH_RADIUS_KM * 1000

/**
 * Radius (km) for this request: explicit options (Home tab) beat parsed "within X km", else default 5.
 */
function resolveSearchRadiusKm(intent, options) {
  if (options.radiusKm != null && Number.isFinite(options.radiusKm)) {
    return clampMasjidRadiusKm(options.radiusKm)
  }
  if (intent.type === 'within' && intent.radiusKm != null) {
    return clampMasjidRadiusKm(intent.radiusKm)
  }
  return DEFAULT_SEARCH_RADIUS_KM
}

/**
 * Strict straight-line filter from the search center so results never exceed the chosen radius
 * (fixes API slippage and keeps 2 / 5 / 10 km accurate for current location, map pick, near me).
 */
function clampToRadiusFromCenter(list, center, radiusM) {
  if (!list?.length) return []
  if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lon)) return []
  const out = []
  for (const m of list) {
    if (!Number.isFinite(m.lat) || !Number.isFinite(m.lon)) continue
    const d = haversineMeters(center.lat, center.lon, m.lat, m.lon)
    if (d <= radiusM) out.push({ ...m, distance: d })
  }
  return out.sort((a, b) => a.distance - b.distance)
}

/**
 * Run search using Ola Places only.
 * @returns {Promise<{ masjids: Array, searchIntent: object, center?: { lat, lon } }>}
 */
export async function searchMasjids(query, options = {}) {
  const intent = parseSearchQuery(query)

  if (intent.type === 'near_me') {
    let center
    try {
      const { coords } = await getCurrentPosition()
      center = { lat: coords.latitude, lon: coords.longitude }
    } catch (err) {
      console.error('searchMasjids near_me:', err)
      return { masjids: [], searchIntent: intent, radiusKm: resolveSearchRadiusKm(intent, options) }
    }
    const radiusKm = resolveSearchRadiusKm(intent, options)
    const radiusM = radiusKm * 1000
    const list = await fetchNearbyIslamicInstitutions(center, { radius: radiusM })
    const masjids = clampToRadiusFromCenter(list, center, radiusM)
    return { masjids, searchIntent: intent, center, radiusKm }
  }

  if (intent.type === 'near_place') {
    let places = []
    try {
      places = await searchCities(intent.place)
    } catch (err) {
      console.error('searchMasjids near_place:', err)
    }
    const first = places?.[0]
    if (!first?.lat || !first?.lon) {
      return { masjids: [], searchIntent: intent, center: null, radiusKm: resolveSearchRadiusKm(intent, options) }
    }
    const center = { lat: first.lat, lon: first.lon }
    const radiusKm = resolveSearchRadiusKm(intent, options)
    const radiusM = radiusKm * 1000
    const list = await fetchNearbyIslamicInstitutions(center, { radius: radiusM })
    const masjids = clampToRadiusFromCenter(list, center, radiusM)
    return { masjids, searchIntent: intent, center, radiusKm }
  }

  if (intent.type === 'within') {
    let center = options.lastNearCenter
    if (!center) {
      try {
        const { coords } = await getCurrentPosition()
        center = { lat: coords.latitude, lon: coords.longitude }
      } catch (err) {
        console.error('searchMasjids within:', err)
        return {
          masjids: [],
          searchIntent: intent,
          radiusKm: resolveSearchRadiusKm(intent, options),
        }
      }
    }
    const radiusKm = resolveSearchRadiusKm(intent, options)
    const radiusM = radiusKm * 1000
    const list = await fetchNearbyIslamicInstitutions(center, { radius: radiusM })
    const masjids = clampToRadiusFromCenter(list, center, radiusM)
    return { masjids, searchIntent: intent, center, radiusKm }
  }

  if (intent.type === 'keyword') {
    const k = (intent.keyword || '').toLowerCase()
    const defaultCenter = options.lastNearCenter || { lat: 17.4, lon: 78.5 }
    const radiusKm = resolveSearchRadiusKm(intent, options)
    const radiusM = radiusKm * 1000
    const list = await fetchNearbyIslamicInstitutions(defaultCenter, { radius: radiusM })
    let masjids = clampToRadiusFromCenter(list, defaultCenter, radiusM)
    if (k) {
      masjids = masjids.filter((m) => {
        const name = (m.name || '').toLowerCase()
        const address = (m.address || '').toLowerCase()
        return name.includes(k) || address.includes(k)
      })
    }
    return {
      masjids,
      searchIntent: intent,
      center: defaultCenter,
      radiusKm,
    }
  }

  const fallbackCenter = options.lastNearCenter || { lat: 17.4, lon: 78.5 }
  const radiusKm = resolveSearchRadiusKm(intent, options)
  const radiusM = radiusKm * 1000
  const list = await fetchNearbyIslamicInstitutions(fallbackCenter, { radius: radiusM })
  const masjids = clampToRadiusFromCenter(list, fallbackCenter, radiusM)
  return {
    masjids,
    searchIntent: intent,
    center: fallbackCenter,
    radiusKm,
  }
}
