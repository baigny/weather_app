import { getOlaReverseGeocodeUrl } from './olaMapsConfig'
import { autocompletePlaces } from './olaPlacesAPI'

const API_KEY = import.meta.env.VITE_WEATHER_API_KEY
const _base = import.meta.env.VITE_BASE_URL ?? 'https://api.openweathermap.org/data/2.5/weather'
const BASE_URL = typeof _base === 'string' && _base.includes('/data/3.0/')
  ? 'https://api.openweathermap.org/data/2.5/weather'
  : _base
const GEO_URL =
  import.meta.env.VITE_GEO_URL ?? 'https://api.openweathermap.org/geo/1.0/direct'
const REVERSE_GEO_URL =
  import.meta.env.VITE_REVERSE_GEO_URL ?? 'https://api.openweathermap.org/geo/1.0/reverse'
const OPEN_METEO_GEO_URL =
  import.meta.env.VITE_OPEN_METEO_GEO_URL ??
  'https://geocoding-api.open-meteo.com/v1/search'

export const fetchWeatherByCoords = async (lat, lon) => {
  const res = await fetch(
    `${BASE_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
  )
  if (!res.ok) throw new Error('Failed to fetch weather data')
  return res.json()
}

export const fetchWeatherByCity = async (city) => {
  const res = await fetch(
    `${BASE_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`
  )
  if (!res.ok) throw new Error('City not found')
  return res.json()
}

const dedupePlaces = (places) => {
  const seen = new Set()
  const out = []
  for (const p of places || []) {
    const lat = typeof p.lat === 'number' ? p.lat : Number(p.lat)
    const lon = typeof p.lon === 'number' ? p.lon : Number(p.lon)
    const key = [
      (p.name || '').toLowerCase().trim(),
      (p.state || '').toLowerCase().trim(),
      (p.country || '').toLowerCase().trim(),
      Number.isFinite(lat) ? lat.toFixed(4) : '',
      Number.isFinite(lon) ? lon.toFixed(4) : '',
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...p, lat, lon })
  }
  return out
}

/** Prefer autocomplete rows whose label contains more of the user's words (e.g. colony vs whole city). */
function scorePlaceQueryRelevance(row, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return 0
  const label = (row.label || row.name || '').toLowerCase()
  const words = q.split(/[\s,]+/).filter((w) => w.length > 1)
  let s = 0
  for (const w of words) {
    if (label.includes(w)) s += 4
  }
  if (q.length > 4 && label.includes(q)) s += 10
  return s
}

function sortPlacesForQuery(places, query, center) {
  const q = (query || '').trim()
  const list = [...places]
  list.sort((a, b) => {
    const ra = scorePlaceQueryRelevance(a, q)
    const rb = scorePlaceQueryRelevance(b, q)
    if (rb !== ra) return rb - ra
    if (center?.lat != null && center?.lon != null) {
      const da = Math.abs(a.lat - center.lat) + Math.abs(a.lon - center.lon)
      const db = Math.abs(b.lat - center.lat) + Math.abs(b.lon - center.lon)
      return da - db
    }
    return 0
  })
  return list
}

export const searchCities = async (query, options = {}) => {
  if (!query || query.length < 2) return []
  const center = options?.center ?? null

  try {
    const rows = await autocompletePlaces(query, center)
    if (rows.length > 0) {
      const places = dedupePlaces(rows.map((r) => ({
        name: r.name,
        country: r.country,
        state: r.state,
        lat: r.lat,
        lon: r.lon,
        label: r.label || [r.name, r.state, r.country].filter(Boolean).join(', '),
      })))
      return sortPlacesForQuery(places, query, center)
    }
  } catch {
    // ignore and fallback
  }

  // Fallback to OpenWeather direct geocoding (requires API key).
  const res = await fetch(
    `${GEO_URL}?q=${encodeURIComponent(query)}&limit=15&appid=${API_KEY}`
  )
  if (!res.ok) return []
  const data = await res.json()
  const fallback = dedupePlaces(data.map((c) => ({
    name: c.name,
    country: c.country,
    state: c.state,
    lat: c.lat,
    lon: c.lon,
    label: [c.name, c.state, c.country].filter(Boolean).join(', '),
  })))
  return sortPlacesForQuery(fallback, query, center)
}

const REVERSE_GEOCODE_MAX_429_RETRIES = 3

function labelFromOlaReverseGeocodeJson(data) {
  if (!data || typeof data !== 'object') return null
  const firstResult = Array.isArray(data?.results) ? data.results[0] : null
  const a = data?.address || data?.result?.address || firstResult?.address_components || {}
  const directLabel =
    data?.formatted_address ||
    data?.result?.formatted_address ||
    firstResult?.formatted_address ||
    firstResult?.description ||
    null
  const neighbourhood =
    a.neighbourhood ||
    a.suburb ||
    a.quarter ||
    a.city_district ||
    null
  const parts = [
    neighbourhood,
    a.city || a.town || a.state_district || a.county,
    a.state,
    a.country_code?.toUpperCase() || a.country,
  ].filter(Boolean)
  const seen = new Set()
  const unique = parts.filter((p) => {
    if (seen.has(p)) return false
    seen.add(p)
    return true
  })
  return unique.join(', ') || directLabel || data?.display_name || null
}

/**
 * Reverse geocode lat/lon to a short display label in English (e.g. "Attapur, Hyderabad, IN").
 * Retries on HTTP 429 (Ola) with Retry-After / exponential backoff to reduce rate-limit failures.
 */
export async function reverseGeocode(lat, lon) {
  const url = getOlaReverseGeocodeUrl(lat, lon)
  try {
    if (url) {
      let attempt = 0
      while (attempt <= REVERSE_GEOCODE_MAX_429_RETRIES) {
        const res = await fetch(url, { headers: { Accept: 'application/json', 'Accept-Language': 'en' } })
        if (res.status === 429 && attempt < REVERSE_GEOCODE_MAX_429_RETRIES) {
          const retryAfter = Number(res.headers.get('retry-after')) || 0
          const backoffMs =
            retryAfter > 0
              ? retryAfter * 1000
              : 500 * 2 ** attempt + Math.floor(Math.random() * 250)
          await new Promise((r) => setTimeout(r, backoffMs))
          attempt += 1
          continue
        }
        if (res.ok) {
          const data = await res.json()
          const label = labelFromOlaReverseGeocodeJson(data)
          if (label) return label
        }
        break
      }
    }
  } catch {
    // fallback below
  }

  // Fallback: OpenWeather reverse geocoding for location names.
  if (!API_KEY) return null
  try {
    const res = await fetch(
      `${REVERSE_GEO_URL}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&limit=1&appid=${API_KEY}`
    )
    if (!res.ok) return null
    const rows = await res.json()
    const first = Array.isArray(rows) ? rows[0] : null
    if (!first) return null
    return [first.name, first.state, first.country].filter(Boolean).join(', ') || null
  } catch {
    return null
  }
}

export const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject)
  })

const DEFAULT_LAT = 17.385
const DEFAULT_LON = 78.4867

export const fetchLocalWeather = async () => {
  let lat = DEFAULT_LAT
  let lon = DEFAULT_LON
  try {
    const { coords } = await getCurrentPosition()
    lat = coords.latitude
    lon = coords.longitude
  } catch {
    // Use default coords when location is denied or unavailable
  }
  try {
    return await fetchWeatherByCoords(lat, lon)
  } catch (err) {
    throw new Error('Unable to load weather. Please check your connection and try again.')
  }
}