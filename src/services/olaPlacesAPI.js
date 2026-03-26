import { haversineMeters } from './geo'
import {
  getOlaAddressValidationUrl,
  getOlaAdvancedDetailsUrl,
  getOlaApiKey,
  getOlaAutocompleteUrl,
  getOlaDetailsUrl,
  getOlaNearbyAdvancedUrl,
  getOlaPhotoUrl,
  getOlaPlacesSearchUrl,
} from './olaMapsConfig'

const REQUEST_TIMEOUT_MS = 9000
const CACHE_TTL_MS = 30 * 1000
const MAX_429_RETRIES = 3
const MAX_DETAILS_ENRICH = 8
const NEARBY_PAGE_SIZE = 45
/** Text search supplements venue nearby — catches POIs missing from typed venue layers. */
const TEXT_SEARCH_TERMS = ['mosque', 'masjid', 'islamic']
const ALLOWED_NEARBY_TYPES = new Set(['mosque', 'place_of_worship', 'religious_organization'])
const ISLAMIC_TYPES_FROM_ENV = (import.meta.env.VITE_OLA_ISLAMIC_TYPES || 'mosque,place_of_worship,islamic_center,madrasa')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean)
const ISLAMIC_TYPES = ISLAMIC_TYPES_FROM_ENV
  .map((x) => x.toLowerCase())
  .filter((x) => ALLOWED_NEARBY_TYPES.has(x))
if (ISLAMIC_TYPES.length === 0) {
  ISLAMIC_TYPES.push('mosque', 'place_of_worship')
}
const cache = new Map()
const inflight = new Map()
const detailsCache = new Map()

function requestId() {
  return `df-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function olaFetchJson(url, { method = 'GET', headers = {}, body } = {}) {
  const apiKey = getOlaApiKey()
  if (!apiKey) throw new Error('VITE_OLA_MAPS_API_KEY is required for Ola Places APIs')
  const finalUrl = url.includes('api_key=') ? url : `${url}${url.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(apiKey)}`
  const cacheKey = `${method}:${finalUrl}:${body || ''}`
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && now < cached.expiresAt) return cached.data
  const running = inflight.get(cacheKey)
  if (running) return running

  const execute = async () => {
    let attempt = 0
    while (attempt <= MAX_429_RETRIES) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      try {
        const res = await fetch(finalUrl, {
          method,
          headers: {
            'X-Request-Id': requestId(),
            ...headers,
          },
          body,
          signal: controller.signal,
        })
        if (res.status === 429 && attempt < MAX_429_RETRIES) {
          const retryAfter = Number(res.headers.get('retry-after')) || 0
          const backoffMs = retryAfter > 0 ? retryAfter * 1000 : 500 * (2 ** attempt) + Math.floor(Math.random() * 250)
          await new Promise((r) => setTimeout(r, backoffMs))
          attempt += 1
          continue
        }
        if (!res.ok) throw new Error(`Ola Places ${res.status}`)
        const data = await res.json()
        cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS })
        return data
      } finally {
        clearTimeout(timeoutId)
      }
    }
    throw new Error('Ola Places 429')
  }

  const promise = execute().finally(() => inflight.delete(cacheKey))
  inflight.set(cacheKey, promise)
  return promise
}

function normalizeOlaPlace(place, center) {
  const lat =
    place?.lat ??
    place?.location?.lat ??
    place?.location?.latitude ??
    place?.geometry?.location?.lat ??
    place?.geometry?.location?.latitude
  const lon =
    place?.lng ??
    place?.lon ??
    place?.location?.lng ??
    place?.location?.longitude ??
    place?.geometry?.location?.lng ??
    place?.geometry?.location?.longitude
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  const name =
    place?.name ||
    place?.display_name ||
    place?.title ||
    place?.structured_formatting?.main_text ||
    'Masjid'
  const address =
    place?.address ||
    place?.formatted_address ||
    place?.display_address ||
    place?.description ||
    place?.vicinity ||
    ''
  const srcId = place?.id || place?.place_id || place?.reference
  const id = `ola/${srcId || `${lat},${lon},${name}`}`
  const distance = haversineMeters(center.lat, center.lon, lat, lon)
  return {
    id,
    name,
    address,
    lat,
    lon,
    distance,
    tags: {
      source: 'ola',
      placeId: srcId || null,
      types: Array.isArray(place?.types) ? place.types : [],
      rating: place?.rating ?? null,
      userRatingsTotal: place?.user_ratings_total ?? null,
      openingHours: place?.opening_hours ?? null,
      phone: place?.formatted_phone_number || place?.international_phone_number || null,
      website: place?.website || null,
    },
  }
}

function normalizeAmenityPlace(place, center, typeId = null) {
  const clean = (v) => {
    const s = String(v ?? '').trim()
    if (!s) return ''
    const low = s.toLowerCase()
    if (low === 'na' || low === 'n/a') return ''
    return s
  }
  const lat =
    place?.lat ??
    place?.location?.lat ??
    place?.location?.latitude ??
    place?.geometry?.location?.lat ??
    place?.geometry?.location?.latitude
  const lon =
    place?.lng ??
    place?.lon ??
    place?.location?.lng ??
    place?.location?.longitude ??
    place?.geometry?.location?.lng ??
    place?.geometry?.location?.longitude
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const name =
    place?.name ||
    place?.title ||
    place?.display_name ||
    place?.structured_formatting?.main_text ||
    'Place'
  const address = (
    clean(place?.vicinity) ||
    clean(place?.formatted_address) ||
    clean(place?.formattedAddress) ||
    clean(place?.address) ||
    clean(place?.description) ||
    clean(place?.structured_formatting?.secondary_text) ||
    ''
  )
  const srcId = place?.id || place?.place_id || place?.reference
  // Always include coords to avoid duplicate ids from Ola platform.
  const id = `olaAmenity/${srcId || 'noid'}:${Number(lat).toFixed(6)},${Number(lon).toFixed(6)}`
  const distance = center ? haversineMeters(center.lat, center.lon, lat, lon) : null
  return {
    id,
    name,
    address,
    lat: Number(lat),
    lon: Number(lon),
    distance: distance ?? null,
    tags: {
      source: 'ola',
      placeId: srcId || null,
      types: Array.isArray(place?.types) ? place.types : [],
      amenityType: typeId,
    },
  }
}

function dedupe(list) {
  const seen = new Set()
  const out = []
  for (const p of list) {
    const key = `${Math.round(p.lat * 10000)}:${Math.round(p.lon * 10000)}:${String(p.name).toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

function dedupeAmenityPlaces(list) {
  const seen = new Set()
  const out = []
  for (const p of list) {
    if (!p) continue
    const key = `${Math.round(p.lat * 10000)}:${Math.round(p.lon * 10000)}:${String(p.name || '').toLowerCase()}:${String(p.tags?.amenityType || '')}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

function isIslamicWorshipPlace(place) {
  const types = Array.isArray(place?.types) ? place.types.map((t) => String(t).toLowerCase()) : []
  const name = String(
    place?.name ||
    place?.display_name ||
    place?.title ||
    place?.structured_formatting?.main_text ||
    place?.description ||
    ''
  ).toLowerCase()
  if (types.some((t) => t === 'mosque' || t === 'masjid' || t === 'islamic_center')) return true
  if (types.includes('place_of_worship') || types.includes('religious_organization')) {
    return /masjid|mosque|islamic|madrasa|dargah|jama/.test(name)
  }
  return /masjid|mosque|islamic|madrasa|dargah|jama/.test(name)
}

async function searchOlaByTerm(center, radiusM, term) {
  const params = new URLSearchParams({ input: term })
  if (center && Number.isFinite(center.lat) && Number.isFinite(center.lon)) {
    params.set('location', `${center.lat},${center.lon}`)
    params.set('radius', String(Math.min(50000, Math.max(100, Math.round(radiusM)))))
  }
  const json = await olaFetchJson(`${getOlaPlacesSearchUrl()}?${params.toString()}`)
  const places =
    Array.isArray(json?.predictions) ? json.predictions : Array.isArray(json?.results) ? json.results : Array.isArray(json?.places) ? json.places : []
  const enriched = await enrichPredictionsWithDetails(places)
  return enriched
    .filter(isIslamicWorshipPlace)
    .map((p) => normalizeOlaPlace(p, center))
    .filter((p) => p && p.distance <= radiusM)
}

async function nearbyByType(center, radiusM, type) {
  const params = new URLSearchParams({
    layers: 'venue',
    types: type,
    location: `${center.lat},${center.lon}`,
    radius: String(radiusM),
  })
  const json = await olaFetchJson(`${getOlaNearbyAdvancedUrl()}?${params.toString()}`)
  const places =
    Array.isArray(json?.predictions) ? json.predictions : Array.isArray(json?.results) ? json.results : Array.isArray(json?.places) ? json.places : []
  const enriched = await enrichPredictionsWithDetails(places)
  return enriched
    .filter(isIslamicWorshipPlace)
    .map((p) => normalizeOlaPlace(p, center))
    .filter((p) => p && p.distance <= radiusM)
}

export async function fetchNearbyAmenities(center, { radiusM = 2000, type = null } = {}) {
  if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lon)) return []
  const rm = Number(radiusM)
  const safeRadiusM = Number.isFinite(rm) && rm > 0 ? Math.min(50000, Math.max(100, Math.round(rm))) : 2000
  if (!type) return []
  const params = new URLSearchParams({
    layers: 'venue',
    types: String(type),
    location: `${center.lat},${center.lon}`,
    radius: String(safeRadiusM),
  })
  const json = await olaFetchJson(`${getOlaNearbyAdvancedUrl()}?${params.toString()}`)
  const places =
    Array.isArray(json?.predictions) ? json.predictions : Array.isArray(json?.results) ? json.results : Array.isArray(json?.places) ? json.places : []
  const enriched = await enrichPredictionsWithDetails(places)
  const normalized = dedupeAmenityPlaces(enriched
    .map((p) => normalizeAmenityPlace(p, center, type))
    .filter(Boolean)
    .filter((p) => p.distance == null || p.distance <= safeRadiusM)
  ).sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))

  // Ensure stable-unique ids even if Ola returns duplicates.
  const seen = new Map()
  return normalized.map((p) => {
    const base = p.id
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    if (n === 1) return p
    return { ...p, id: `${base}#${n}` }
  })
}

export async function fetchNearbyIslamicInstitutions(center, options = {}) {
  const raw = Number(options.radius)
  const radiusM = Number.isFinite(raw) && raw > 0
    ? Math.min(50000, Math.max(100, raw))
    : 5000
  const nearbyTasks = ISLAMIC_TYPES.map((t) => nearbyByType(center, radiusM, t))
  const textTasks = TEXT_SEARCH_TERMS.map((term) => searchOlaByTerm(center, radiusM, term))
  const settled = await Promise.allSettled([...nearbyTasks, ...textTasks])
  const rows = settled
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value)
  const hadFailure = settled.some((r) => r.status === 'rejected')
  if (hadFailure && rows.length === 0) {
    const firstRejected = settled.find((r) => r.status === 'rejected')
    const message = String(firstRejected?.reason?.message || 'Ola Places request failed')
    throw new Error(message)
  }
  return dedupe(rows)
    .filter((x) => x.distance <= radiusM)
    .sort((a, b) => a.distance - b.distance)
}

export async function autocompletePlaces(input, center = null, { enrich = true } = {}) {
  if (!input || input.trim().length < 2) return []
  const params = new URLSearchParams({ input: input.trim() })
  if (center?.lat != null && center?.lon != null) {
    params.set('location', `${center.lat},${center.lon}`)
  }
  const json = await olaFetchJson(`${getOlaAutocompleteUrl()}?${params.toString()}`)
  const rows = Array.isArray(json?.predictions) ? json.predictions : Array.isArray(json?.results) ? json.results : []
  const baseRows = enrich ? await enrichPredictionsWithDetails(rows) : rows
  return baseRows.map((p) => {
    const lat =
      p?.position?.lat ??
      p?.lat ??
      p?.location?.lat ??
      p?.location?.latitude ??
      p?.geometry?.location?.lat ??
      p?.geometry?.location?.latitude
    const lon =
      p?.position?.lng ??
      p?.lng ??
      p?.lon ??
      p?.location?.lng ??
      p?.location?.longitude ??
      p?.geometry?.location?.lng ??
      p?.geometry?.location?.longitude
    const name = p?.name || p?.title || p?.display_name || p?.description || ''
    const address = p?.address || p?.formatted_address || p?.description || ''
    return {
      id: p?.id || `${name}:${lat}:${lon}`,
      name,
      label: [name, address].filter(Boolean).join(', '),
      address,
      country: p?.country || p?.country_code || '',
      state: p?.state || p?.region || '',
      lat: Number(lat),
      lon: Number(lon),
    }
  }).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon))
}

export async function fetchAdvancedPlaceDetails(placeId) {
  if (!placeId) return null
  const params = new URLSearchParams({ place_id: placeId })
  const json = await olaFetchJson(`${getOlaAdvancedDetailsUrl()}?${params.toString()}`)
  return json?.result || json?.data || json || null
}

export async function fetchPlaceDetails(placeId) {
  if (!placeId) return null
  const params = new URLSearchParams({ place_id: placeId })
  const json = await olaFetchJson(`${getOlaDetailsUrl()}?${params.toString()}`)
  return json?.result || json?.data || json || null
}

function predictionPlaceId(p) {
  return p?.place_id || p?.reference || p?.id || null
}

async function enrichPredictionsWithDetails(predictions) {
  const rows = Array.isArray(predictions) ? predictions : []
  let remaining = MAX_DETAILS_ENRICH
  const tasks = rows.map(async (p) => {
    const hasCoords =
      Number.isFinite(p?.lat) ||
      Number.isFinite(p?.lng) ||
      Number.isFinite(p?.lon) ||
      Number.isFinite(p?.location?.lat) ||
      Number.isFinite(p?.location?.latitude)
    if (hasCoords) return p
    const pid = predictionPlaceId(p)
    if (!pid) return p
    if (detailsCache.has(pid)) return { ...p, ...detailsCache.get(pid) }
    if (remaining <= 0) return p
    remaining -= 1
    try {
      const details = await fetchAdvancedPlaceDetails(pid)
      if (details) detailsCache.set(pid, details)
      return { ...p, ...details }
    } catch {
      return p
    }
  })
  return Promise.all(tasks)
}

export function buildPlacePhotoUrl(photoReference) {
  if (!photoReference) return null
  const apiKey = getOlaApiKey()
  const params = new URLSearchParams({ photo_reference: photoReference, api_key: apiKey || '' })
  return `${getOlaPhotoUrl()}?${params.toString()}`
}

export async function validateAddress(address) {
  if (!address || !address.trim()) return null
  const params = new URLSearchParams({ address: address.trim() })
  const json = await olaFetchJson(`${getOlaAddressValidationUrl()}?${params.toString()}`)
  return json?.result || json?.data || json || null
}
