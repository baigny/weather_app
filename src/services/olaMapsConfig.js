const OLA_API_KEY = import.meta.env.VITE_OLA_MAPS_API_KEY

export function getOlaApiKey() {
  return OLA_API_KEY
}

export function getOlaTileUrl() {
  // Replace with your Ola tiles URL template if different.
  // Must include {z}/{x}/{y} and api key.
  const fromEnv = import.meta.env.VITE_OLA_TILES_URL_TEMPLATE
  if (fromEnv) {
    return fromEnv.replace('{api_key}', OLA_API_KEY || '')
  }
  return `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/{z}/{x}/{y}.png?api_key=${OLA_API_KEY || ''}`
}

export function getOlaStyleJsonUrl() {
  return (
    import.meta.env.VITE_OLA_STYLE_JSON_URL ||
    'https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json'
  )
}

export async function fetchOlaStyleJson({ strip3dModels = true } = {}) {
  const apiKey = getOlaApiKey()
  const rawUrl = getOlaStyleJsonUrl()
  let url = rawUrl
  try {
    const u = new URL(rawUrl)
    if (apiKey && !u.searchParams.has('api_key')) {
      u.searchParams.set('api_key', apiKey)
    }
    url = u.toString()
  } catch {
    // If it's not a valid URL string, just fall back to raw.
    url = rawUrl
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Style ${res.status}`)
  const style = await res.json()
  if (!strip3dModels || !style || typeof style !== 'object') return style

  // Ola style sometimes references 3D model source-layers that aren't present in the vectordata source,
  // causing MapLibre validation errors like:
  // "Source layer '3d_model' does not exist on source 'vectordata' as specified by style layer '3d_model_data'."
  const layers = Array.isArray(style.layers) ? style.layers : []
  style.layers = layers.filter((l) => {
    const id = String(l?.id || '')
    const sourceLayer = String(l?.['source-layer'] || '')
    if (id.includes('3d_model')) return false
    if (sourceLayer === '3d_model') return false
    return true
  })
  return style
}

export function getOlaTileAttribution() {
  return import.meta.env.VITE_OLA_TILES_ATTRIBUTION || '&copy; Ola Maps'
}

export function getOlaPlacesSearchUrl() {
  return import.meta.env.VITE_OLA_PLACES_TEXTSEARCH_URL || 'https://api.olamaps.io/places/v1/textsearch'
}

export function getOlaAutocompleteUrl() {
  return import.meta.env.VITE_OLA_PLACES_AUTOCOMPLETE_URL || 'https://api.olamaps.io/places/v1/autocomplete'
}

export function getOlaNearbyAdvancedUrl() {
  return import.meta.env.VITE_OLA_PLACES_NEARBY_ADVANCED_URL || 'https://api.olamaps.io/places/v1/nearbysearch/advanced'
}

export function getOlaAdvancedDetailsUrl() {
  return import.meta.env.VITE_OLA_PLACES_DETAILS_ADVANCED_URL || 'https://api.olamaps.io/places/v1/details/advanced'
}

export function getOlaDetailsUrl() {
  return import.meta.env.VITE_OLA_PLACES_DETAILS_URL || 'https://api.olamaps.io/places/v1/details'
}

export function getOlaPhotoUrl() {
  return import.meta.env.VITE_OLA_PLACES_PHOTO_URL || 'https://api.olamaps.io/places/v1/photo'
}

export function getOlaAddressValidationUrl() {
  return import.meta.env.VITE_OLA_ADDRESS_VALIDATION_URL || 'https://api.olamaps.io/places/v1/addressvalidation'
}

export function buildOlaDirectionsUrl(lat, lon) {
  const template = import.meta.env.VITE_OLA_DIRECTIONS_URL_TEMPLATE || 'https://www.olamaps.io/?destination={lat},{lon}'
  return template
    .replace('{lat}', String(lat))
    .replace('{lon}', String(lon))
}

/** Routing API base (traffic-aware directions / matrix). Override full URL if Ola changes paths. */
export function getOlaRoutingDirectionsUrl() {
  return import.meta.env.VITE_OLA_ROUTING_DIRECTIONS_URL || 'https://api.olamaps.io/routing/v1/directions'
}

export function getOlaRoutingDirectionsBasicUrl() {
  return import.meta.env.VITE_OLA_ROUTING_DIRECTIONS_BASIC_URL || 'https://api.olamaps.io/routing/v1/directions/basic'
}

export function getOlaRoutingDistanceMatrixUrl() {
  return import.meta.env.VITE_OLA_ROUTING_DISTANCE_MATRIX_URL || 'https://api.olamaps.io/routing/v1/distanceMatrix'
}

export function getOlaRoutingDistanceMatrixBasicUrl() {
  return import.meta.env.VITE_OLA_ROUTING_DISTANCE_MATRIX_BASIC_URL || 'https://api.olamaps.io/routing/v1/distanceMatrix/basic'
}

export function getOlaRoutingRouteOptimizerUrl() {
  return import.meta.env.VITE_OLA_ROUTING_ROUTE_OPTIMIZER_URL || 'https://api.olamaps.io/routing/v1/routeOptimizer'
}

export function getOlaRoutingNearestRoadsUrl() {
  return import.meta.env.VITE_OLA_ROUTING_NEAREST_ROADS_URL || 'https://api.olamaps.io/routing/v1/nearestRoads'
}

export function getOlaReverseGeocodeUrl(lat, lon) {
  const template = import.meta.env.VITE_OLA_REVERSE_GEOCODE_URL
  if (!template) {
    return `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lon}&api_key=${encodeURIComponent(OLA_API_KEY || '')}`
  }
  return template
    .replace('{lat}', String(lat))
    .replace('{lon}', String(lon))
}
