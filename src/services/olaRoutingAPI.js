/**
 * Ola Maps Routing APIs — directions, distance matrix, route optimizer, nearest roads.
 * Uses the same 429 retry + timeout pattern as olaPlacesAPI.js.
 */
import {
  getOlaApiKey,
  getOlaRoutingDirectionsBasicUrl,
  getOlaRoutingDirectionsUrl,
  getOlaRoutingDistanceMatrixBasicUrl,
  getOlaRoutingDistanceMatrixUrl,
  getOlaRoutingNearestRoadsUrl,
  getOlaRoutingRouteOptimizerUrl,
} from './olaMapsConfig'

const REQUEST_TIMEOUT_MS = 15000
const CACHE_TTL_MS = 45 * 1000
const MAX_429_RETRIES = 3

const cache = new Map()
const inflight = new Map()

function requestId() {
  return `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function toCoordString(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return `${lat},${lon}`
}

/** Pipe-separated lat,lon|lat,lon for matrix / optimizer. */
export function encodeCoordList(points) {
  if (!Array.isArray(points) || points.length === 0) return ''
  return points
    .map((p) => toCoordString(p.lat ?? p.latitude, p.lon ?? p.longitude ?? p.lng))
    .filter(Boolean)
    .join('|')
}

/** Extract meters from API distance fields (numbers, strings, Google-style { text, value }). */
function numericDistanceMeters(v, depth = 0) {
  if (v == null || depth > 4) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t) return null
    const plain = Number(t.replace(/,/g, ''))
    if (Number.isFinite(plain)) return plain
    const km = t.match(/(\d+(?:\.\d+)?)\s*km\b/i)
    if (km) return parseFloat(km[1]) * 1000
    const mi = t.match(/(\d+(?:\.\d+)?)\s*mi(le)?s?\b/i)
    if (mi) return parseFloat(mi[1]) * 1609.34
    const m = t.match(/(\d+(?:\.\d+)?)\s*m\b/i)
    if (m) return parseFloat(m[1])
    return null
  }
  if (typeof v === 'object') {
    const valNum = typeof v.value === 'number' && Number.isFinite(v.value) ? v.value : null
    const fromText =
      typeof v.text === 'string' ? numericDistanceMeters(v.text, depth + 1) : null
    /**
     * Prefer numeric `value` when it’s clearly in metres (Ola’s route total matches the map).
     * Use `text` when `value` is tiny (e.g. km accidentally as 8.8) so we don’t show 8.8 m.
     */
    if (fromText != null && valNum != null && valNum >= 80) return valNum
    if (fromText != null && (valNum == null || valNum < 80)) return fromText
    if (valNum != null) return valNum
    const nested =
      numericDistanceMeters(v.distance, depth + 1) ??
      numericDistanceMeters(v.distanceMeters, depth + 1) ??
      numericDistanceMeters(v.distance_in_meters, depth + 1)
    if (nested != null) return nested
    if (typeof v.value === 'string') return numericDistanceMeters(v.value, depth + 1)
    if (typeof v.meters === 'number' && Number.isFinite(v.meters)) return v.meters
    if (typeof v.metres === 'number' && Number.isFinite(v.metres)) return v.metres
  }
  return null
}

function numericDurationSeconds(v) {
  if (v == null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'object') {
    if (typeof v.value === 'number' && Number.isFinite(v.value)) return v.value
    if (typeof v.value === 'string' && /^\d+(\.\d+)?$/.test(v.value.trim())) return Math.round(Number(v.value))
    const nested = numericDurationSeconds(v.duration)
    if (nested != null) return nested
  }
  if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim())) return Math.round(Number(v))
  return null
}

/** Sum distance (m) / duration (s) across all legs; returns nulls if nothing usable. */
function aggregateLegsMetrics(legs) {
  if (!Array.isArray(legs) || legs.length === 0) return { distanceMeters: null, durationSeconds: null }
  let distanceMeters = 0
  let durationSeconds = 0
  let anyD = false
  let anyT = false
  for (const leg of legs) {
    const dm = numericDistanceMeters(leg?.distance)
    const ds =
      numericDurationSeconds(leg?.duration_in_traffic) ??
      numericDurationSeconds(leg?.duration)
    if (dm != null && Number.isFinite(dm)) {
      distanceMeters += dm
      anyD = true
    }
    if (ds != null && Number.isFinite(ds)) {
      durationSeconds += ds
      anyT = true
    }
  }
  return {
    distanceMeters: anyD ? distanceMeters : null,
    durationSeconds: anyT ? durationSeconds : null,
  }
}

/**
 * Normalize Directions / Directions Basic JSON to meters + seconds + optional encoded polyline.
 */
export function normalizeDirectionsResponse(json) {
  if (!json || typeof json !== 'object') return null
  // Route optimizer responses sometimes use `trips` instead of `routes` (OSRM-style).
  const route =
    json.routes?.[0] ??
    json.data?.routes?.[0] ??
    json.trips?.[0] ??
    json.data?.trips?.[0] ??
    json.route ??
    (Array.isArray(json.routes) ? null : json)
  if (!route || typeof route !== 'object') return null

  const legs = Array.isArray(route.legs) ? route.legs : null
  const fromLegs =
    legs && legs.length > 0
      ? aggregateLegsMetrics(legs)
      : { distanceMeters: null, durationSeconds: null }
  const leg0 = legs?.[0] ?? route
  const distanceMeters =
    fromLegs.distanceMeters ??
    numericDistanceMeters(leg0?.distance) ??
    numericDistanceMeters(route.distance) ??
    numericDistanceMeters(json.distance)
  const durationSeconds =
    fromLegs.durationSeconds ??
    numericDurationSeconds(leg0?.duration_in_traffic) ??
    numericDurationSeconds(leg0?.duration) ??
    numericDurationSeconds(route.duration) ??
    numericDurationSeconds(json.duration)

  const polyline =
    route.overview_polyline?.points ??
    // Ola often returns overview_polyline as an encoded string (see ola-map reference app).
    (typeof route.overview_polyline === 'string' ? route.overview_polyline : null) ??
    // Some optimizer/OSRM-style payloads use `geometry` as an encoded polyline string.
    route.overviewPolyline?.points ??
    (typeof route.overviewPolyline === 'string' ? route.overviewPolyline : null) ??
    route.polyline?.points ??
    route.polyline ??
    route.geometry?.polyline ??
    route.geometry?.points ??
    (typeof route.geometry === 'string' ? route.geometry : null) ??
    json.overview_polyline?.points ??
    (typeof json.overview_polyline === 'string' ? json.overview_polyline : null) ??
    json.polyline ??
    null

  // Some Ola responses include GeoJSON/OSRM-style geometry instead of encoded polyline.
  const rawCoords =
    route.geometry?.coordinates ??
    legs?.[0]?.geometry?.coordinates ??
    route.overview?.coordinates ??
    route.route?.geometry?.coordinates ??
    // OSRM trip objects can have `geometry.coordinates`
    route?.geometry?.coordinates ??
    json.geometry?.coordinates ??
    null
  let coordinates = null
  if (Array.isArray(rawCoords) && rawCoords.length) {
    const first = rawCoords[0]
    // Case A: [[lon,lat], ...] or [[lat,lon], ...]
    if (Array.isArray(first)) {
      coordinates = rawCoords
        .map((pair) => {
          if (!Array.isArray(pair) || pair.length < 2) return null
          const lon = Number(pair[0])
          const lat = Number(pair[1])
          if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
          // Ola geometry follows GeoJSON ordering: [lon, lat]
          return [lon, lat]
        })
        .filter(Boolean)
    }
    // Case B: [{ lat, lon } ...] or [{ latitude, longitude } ...]
    else if (first && typeof first === 'object') {
      coordinates = rawCoords
        .map((p) => {
          const lat = Number(p.lat ?? p.latitude)
          const lon = Number(p.lon ?? p.lng ?? p.longitude)
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
          return [lon, lat]
        })
        .filter(Boolean)
    }
  }

  // Ola SDK can sometimes return encoded polyline in `route.geometry` (string).
  // Decode it directly to MapLibre coordinates ([lon,lat]) without applying flip heuristics.
  if (!coordinates?.length && typeof route.geometry === 'string' && route.geometry) {
    const dec = decodePolyline(route.geometry)
    if (dec.length) coordinates = dec
  }

  // Fallback: build coordinates from step polylines/geometries (Google/OSRM mixed shapes).
  let stepCoords = null
  if (!coordinates?.length) {
    const steps = Array.isArray(legs?.[0]?.steps) ? legs[0].steps : null
    if (steps?.length) {
      const acc = []
      for (const s of steps) {
        const sp =
          s?.polyline?.points ??
          s?.polyline ??
          s?.overview_polyline?.points ??
          null
        if (typeof sp === 'string' && sp) {
          const dec = decodePolyline(sp)
          if (dec.length) acc.push(...dec)
          continue
        }
        const sg = s?.geometry?.coordinates
        if (Array.isArray(sg) && sg.length) {
          for (const pair of sg) {
            if (!Array.isArray(pair) || pair.length < 2) continue
            const lon = Number(pair[0])
            const lat = Number(pair[1])
            if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
            acc.push([lon, lat])
          }
        }
      }
      if (acc.length) stepCoords = acc
    }
  }

  const finalCoords = coordinates?.length ? coordinates : stepCoords

  if (distanceMeters == null && durationSeconds == null && !polyline && !finalCoords?.length) return null

  const readableDistance =
    leg0?.readable_distance ??
    route?.readable_distance ??
    json?.readable_distance ??
    null
  const readableDuration =
    leg0?.readable_duration ??
    route?.readable_duration ??
    json?.readable_duration ??
    null

  return {
    distanceMeters: distanceMeters ?? null,
    durationSeconds: durationSeconds ?? null,
    readableDistance: typeof readableDistance === 'string' ? readableDistance : null,
    readableDuration: typeof readableDuration === 'string' ? readableDuration : null,
    polyline: typeof polyline === 'string' ? polyline : null,
    coordinates: finalCoords?.length ? finalCoords : null,
    raw: route,
  }
}

// Google polyline algorithm decoder.
// Returns array of [lon, lat] pairs (MapLibre format).
export function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return []
  let index = 0
  let lat = 0
  let lon = 0
  const coordinates = []
  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let b
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1)
    lat += dlat

    result = 0
    shift = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlon = (result & 1) ? ~(result >> 1) : (result >> 1)
    lon += dlon

    coordinates.push([lon / 1e5, lat / 1e5])
  }
  return coordinates
}

/**
 * Normalize Distance Matrix response to array of { distanceMeters, durationSeconds } per destination column.
 */
export function normalizeDistanceMatrixResponse(json) {
  const rows =
    json?.rows ??
    json?.data?.rows ??
    json?.result?.rows ??
    (Array.isArray(json?.data) ? json.data : null)
  if (!Array.isArray(rows) || rows.length === 0) return null
  const row0 = rows[0]
  const elements =
    row0?.elements ??
    row0?.element ??
    (Array.isArray(row0) ? row0 : null)
  if (!Array.isArray(elements)) return null

  return elements.map((el) => {
    if (!el || el.status === 'ZERO_RESULTS' || el.status === 'NOT_FOUND') {
      return { distanceMeters: null, durationSeconds: null, status: el?.status ?? 'UNKNOWN' }
    }
    const dm =
      numericDistanceMeters(el.distance) ??
      numericDistanceMeters(el.distanceMeters) ??
      numericDistanceMeters(el.distance_in_meters) ??
      numericDistanceMeters(el.meters)
    const dur =
      numericDurationSeconds(el.duration) ??
      numericDurationSeconds(el.duration_in_traffic) ??
      numericDurationSeconds(el.durationSeconds)
    return {
      distanceMeters: dm,
      durationSeconds: dur,
      status: el.status ?? 'OK',
    }
  })
}

async function routingFetch(urlString, { method = 'GET', body = undefined, skipCache = false } = {}) {
  const apiKey = getOlaApiKey()
  if (!apiKey) throw new Error('VITE_OLA_MAPS_API_KEY is required for Ola Routing APIs')

  const u = new URL(urlString)
  if (!u.searchParams.has('api_key')) u.searchParams.set('api_key', apiKey)

  const cacheKey = `${method}:${u.toString()}:${body || ''}`
  if (!skipCache && method === 'GET') {
    const now = Date.now()
    const cached = cache.get(cacheKey)
    if (cached && now < cached.expiresAt) return cached.data
  }
  const running = inflight.get(cacheKey)
  if (running) return running

  const execute = async () => {
    let attempt = 0
    while (attempt <= MAX_429_RETRIES) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      try {
        const res = await fetch(u.toString(), {
          method,
          headers: {
            'X-Request-Id': requestId(),
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })
        if (res.status === 429 && attempt < MAX_429_RETRIES) {
          const retryAfter = Number(res.headers.get('retry-after')) || 0
          const backoffMs = retryAfter > 0 ? retryAfter * 1000 : 500 * (2 ** attempt) + Math.floor(Math.random() * 300)
          await new Promise((r) => setTimeout(r, backoffMs))
          attempt += 1
          continue
        }
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`Ola Routing ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
        }
        const data = await res.json()
        if (!skipCache && method === 'GET') {
          cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS })
        }
        return data
      } finally {
        clearTimeout(timeoutId)
      }
    }
    throw new Error('Ola Routing 429')
  }

  const promise = execute().finally(() => inflight.delete(cacheKey))
  inflight.set(cacheKey, promise)
  return promise
}

function buildDirectionsUrl(
  baseUrl,
  {
    origin,
    destination,
    waypoints,
    overview,
    mode,
    alternatives = false,
    steps = true,
    language = 'en',
    traffic_metadata = false,
  } = {}
) {
  const u = new URL(baseUrl)
  const o = typeof origin === 'string' ? origin : toCoordString(origin.lat, origin.lon)
  const d = typeof destination === 'string' ? destination : toCoordString(destination.lat, destination.lon)
  if (!o || !d) throw new Error('Directions: origin and destination required')
  u.searchParams.set('origin', o)
  u.searchParams.set('destination', d)
  // Align with Ola's common public endpoint shape.
  u.searchParams.set('alternatives', alternatives ? 'true' : 'false')
  u.searchParams.set('steps', steps ? 'true' : 'false')
  if (language) u.searchParams.set('language', String(language))
  u.searchParams.set('traffic_metadata', traffic_metadata ? 'true' : 'false')
  if (waypoints?.length) {
    const wp = encodeCoordList(waypoints)
    if (wp) u.searchParams.set('waypoints', wp)
  }
  if (overview != null && overview !== '') u.searchParams.set('overview', String(overview))
  // Ola map SDK supports { mode: "driving" | "walking" }. Mirror that here.
  if (mode === 'driving' || mode === 'walking') u.searchParams.set('mode', mode)
  return u.toString()
}

/**
 * Traffic-aware directions (POST).
 * @param {{ lat, lon }} origin
 * @param {{ lat, lon }} destination
 * @param {Array<{lat,lon}>} [waypoints]
 * @param {string} [overview] quality-of-service / detail level if supported
 */
export async function fetchDirections(origin, destination, waypoints = null, overview = null, { mode = null } = {}) {
  const url = buildDirectionsUrl(getOlaRoutingDirectionsUrl(), {
    origin,
    destination,
    waypoints,
    overview,
    mode,
    alternatives: false,
    steps: true,
    language: 'en',
    traffic_metadata: false,
  })
  try {
    const json = await routingFetch(url, { method: 'GET' })
    const norm = normalizeDirectionsResponse(json)
    if (norm) return norm
  } catch {
    // Some Ola plans/regions may require POST; fallback below.
  }
  const json = await routingFetch(url, { method: 'POST' })
  return normalizeDirectionsResponse(json)
}

/**
 * Directions Basic — no live traffic, still routable distance + ETA (POST).
 */
export async function fetchDirectionsBasic(origin, destination, waypoints = null, { mode = null } = {}) {
  const url = buildDirectionsUrl(getOlaRoutingDirectionsBasicUrl(), {
    origin,
    destination,
    waypoints,
    mode,
    alternatives: false,
    steps: true,
    language: 'en',
    traffic_metadata: false,
  })
  try {
    const json = await routingFetch(url, { method: 'GET' })
    const norm = normalizeDirectionsResponse(json)
    if (norm) return norm
  } catch {
    // Fallback: POST (some plans only allow POST).
  }
  const json = await routingFetch(url, { method: 'POST' })
  return normalizeDirectionsResponse(json)
}

function buildDistanceMatrixUrl(baseUrl, originsEncoded, destinationsEncoded) {
  const u = new URL(baseUrl)
  u.searchParams.set('origins', originsEncoded)
  u.searchParams.set('destinations', destinationsEncoded)
  return u.toString()
}

/**
 * Distance matrix (GET) — traffic-aware where supported.
 * @param {string} originsPipe e.g. "lat,lon|lat,lon"
 * @param {string} destinationsPipe
 */
export async function fetchDistanceMatrix(originsPipe, destinationsPipe) {
  const url = buildDistanceMatrixUrl(getOlaRoutingDistanceMatrixUrl(), originsPipe, destinationsPipe)
  const json = await routingFetch(url, { method: 'GET' })
  return normalizeDistanceMatrixResponse(json)
}

/**
 * Distance Matrix Basic (GET).
 */
export async function fetchDistanceMatrixBasic(originsPipe, destinationsPipe) {
  const url = buildDistanceMatrixUrl(getOlaRoutingDistanceMatrixBasicUrl(), originsPipe, destinationsPipe)
  const json = await routingFetch(url, { method: 'GET' })
  return normalizeDistanceMatrixResponse(json)
}

/**
 * One origin → many destinations; returns Map of destination index → leg (aligned with destinations array order).
 */
export async function fetchDrivingLegsFromOrigin(origin, destinations, { basic = true } = {}) {
  const out = new Map()
  if (!origin || !destinations?.length) return out
  const o = toCoordString(origin.lat, origin.lon)
  if (!o) return out
  const destStr = encodeCoordList(destinations)
  if (!destStr) return out
  try {
    const rows = basic
      ? await fetchDistanceMatrixBasic(o, destStr)
      : await fetchDistanceMatrix(o, destStr)
    if (!rows) return out
    destinations.forEach((_, i) => {
      const leg = rows[i]
      if (leg?.distanceMeters != null || leg?.durationSeconds != null) out.set(i, leg)
    })
  } catch {
    /* caller may fall back */
  }
  return out
}

/**
 * Driving distance/duration per list index using Ola **Directions** (same family as olamaps.io: traffic-aware when available).
 * Use `basic: true` only if you need to avoid traffic / lower quota.
 * @param {number} [options.concurrency] parallel requests (default 2) to limit 429s on POST directions
 */
async function fetchDirectionsOrBasic(o, d, { mode = null } = {}) {
  try {
    const leg = await fetchDirections(o, d, null, null, { mode })
    if (leg?.distanceMeters != null || leg?.durationSeconds != null) return leg
  } catch {
    /* plan may only allow Basic */
  }
  return fetchDirectionsBasic(o, d, null, { mode })
}

export async function fetchDrivingLegsFromDirections(origin, destinations, { concurrency = 2, basic = false, mode = null } = {}) {
  const out = new Map()
  if (!origin || !destinations?.length) return out
  const n = Math.max(1, Math.min(5, Math.floor(concurrency)))
  const fetchLeg = basic ? (o, d) => fetchDirectionsBasic(o, d, null, { mode }) : (o, d) => fetchDirectionsOrBasic(o, d, { mode })
  for (let i = 0; i < destinations.length; i += n) {
    const chunk = []
    for (let k = 0; k < n && i + k < destinations.length; k += 1) {
      const idx = i + k
      const m = destinations[idx]
      if (!Number.isFinite(m?.lat) || !Number.isFinite(m?.lon)) continue
      chunk.push(
        fetchLeg(origin, { lat: m.lat, lon: m.lon })
          .then((leg) => ({ idx, leg }))
          .catch(() => ({ idx, leg: null }))
      )
    }
    const settled = await Promise.all(chunk)
    for (const { idx, leg } of settled) {
      if (!leg || (leg.distanceMeters == null && leg.durationSeconds == null)) continue
      out.set(idx, {
        distanceMeters: leg.distanceMeters,
        durationSeconds: leg.durationSeconds,
      })
    }
  }
  return out
}

/** @deprecated Use {@link fetchDrivingLegsFromDirections} with default `basic: false` for parity with Ola Maps. */
export async function fetchDrivingLegsFromDirectionsBasic(origin, destinations, opts) {
  return fetchDrivingLegsFromDirections(origin, destinations, { ...opts, basic: true })
}

/**
 * Route Optimizer (POST) — locations pipe-separated lat,lon|lat,lon
 */
export async function fetchRouteOptimizer(locationsPipe) {
  const u = new URL(getOlaRoutingRouteOptimizerUrl())
  u.searchParams.set('locations', locationsPipe)
  const json = await routingFetch(u.toString(), { method: 'POST' })
  return json
}

/**
 * Nearest Roads (GET) — points=lat,lon&radius= (meters)
 */
export async function fetchNearestRoads(pointsPipe, radiusM = 100) {
  const u = new URL(getOlaRoutingNearestRoadsUrl())
  u.searchParams.set('points', pointsPipe)
  u.searchParams.set('radius', String(Math.max(1, Math.round(radiusM))))
  const json = await routingFetch(u.toString(), { method: 'GET' })
  return json
}

/**
 * Snap a single lat/lon to nearest road segment (wrapper around nearestRoads).
 */
export async function snapPointToNearestRoad(lat, lon, radiusM = 80) {
  const p = toCoordString(lat, lon)
  if (!p) return null
  return fetchNearestRoads(p, radiusM)
}
