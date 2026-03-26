/** WGS84 mean Earth radius (m) — standard for great-circle (“as the crow flies”) distance. */
const EARTH_RADIUS_M = 6371008.771

/**
 * Haversine (great-circle) distance in meters between two WGS84 lat/lon points.
 */
export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = EARTH_RADIUS_M
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Format straight-line distance for UI: metres when close, kilometres with precision that scales with range.
 * Accepts numbers or numeric strings (some APIs return distance as string).
 */
/** Driving/matrix distances below this are treated as missing (snap / API noise / literal 0). */
export const MIN_MEANINGFUL_ROAD_DISTANCE_M = 12

/**
 * Road-network distance suitable for display and radius checks; excludes 0 and tiny junk values.
 */
export function meaningfulRoadDistanceMeters(meters) {
  if (meters == null || meters === '') return null
  const n = typeof meters === 'number' ? meters : Number(meters)
  if (!Number.isFinite(n) || n < MIN_MEANINGFUL_ROAD_DISTANCE_M) return null
  return n
}

export function formatDistanceMeters(meters) {
  if (meters == null || meters === '') return null
  const n = typeof meters === 'number' ? meters : Number(meters)
  if (!Number.isFinite(n)) return null
  const m = Math.max(0, n)
  if (m < 1) return null
  if (m < 1000) return `${Math.round(m)} m`
  const km = m / 1000
  if (km < 10) return `${km.toFixed(2)} km`
  if (km < 100) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}
