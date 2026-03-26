import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OlaMaps } from 'olamaps-web-sdk'
import { getCurrentPosition } from '../../services/weatherAPI'
import { haversineMeters } from '../../services/geo'
import { fetchOlaStyleJson, getOlaApiKey, getOlaStyleJsonUrl } from '../../services/olaMapsConfig'
import { cn, shortenLocationLabel } from '@/lib/utils'
import { useTheme } from '@/theme/ThemeProvider'
import { cssVarToHex } from '@/utils/cssVarToHex'

// South Asia: zoom on Telangana & Andhra Pradesh (no world map initially)
const DEFAULT_CENTER = { lat: 17.0, lon: 79.0 }
const DEFAULT_ZOOM = 6

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function colonyLine(m) {
  const t = m?.tags || {}
  return (
    t['addr:suburb'] ||
    t['addr:neighbourhood'] ||
    t['addr:locality'] ||
    m?.address ||
    ''
  )
}

function cleanAddress(value) {
  const s = String(value || '').trim()
  if (!s) return ''
  if (s.toLowerCase() === 'na' || s.toLowerCase() === 'n/a') return ''
  return s
}

function computeBounds(points) {
  if (!points?.length) return null
  let minLat = points[0].lat
  let maxLat = points[0].lat
  let minLon = points[0].lon
  let maxLon = points[0].lon
  for (const p of points) {
    minLat = Math.min(minLat, p.lat)
    maxLat = Math.max(maxLat, p.lat)
    minLon = Math.min(minLon, p.lon)
    maxLon = Math.max(maxLon, p.lon)
  }
  return [[minLon, minLat], [maxLon, maxLat]]
}

export default function MasjidMap({
  masjids: masjidsProp = [],
  onSelectMasjid,
  onUserLocation,
  searchCenter = null,
  searchCenterLabel = '',
  onSearchCenterChange,
  pickSearchCenter = false,
  showSearchCenterMarker = true,
  showUserLocationMarker = true,
  showErrorBanner = true,
  routeLine = null,
  activeRouteLine = null,
  routeOrigin = null,
  routeDestination = null,
  routeSummary = null,
  routeStops = null,
  routeStepPoints = null,
  showRouteStepMarkers = false,
  extraPlaces = null,
  extraLines = null,
  focusedExtraPlaceId = null,
  onSelectExtraPlace = null,
  selectedMasjidId = null,
  initialCenter = null,
  initialZoom = null,
  className = '',
}) {
  const [location, setLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  /** Style + tiles ready — flyTo/fitBounds are unreliable before this. */
  const [mapReady, setMapReady] = useState(false)
  const { paletteId, resolvedScheme, brandThemeRevision } = useTheme()
  const mapThemeKey = `${paletteId}-${resolvedScheme}-${brandThemeRevision}`
  const mapThemeKeyRef = useRef(mapThemeKey)
  const userMarkerThemeKeyRef = useRef(mapThemeKey)
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const olaRef = useRef(null)
  const centerMarkerRef = useRef(null)
  const userMarkerRef = useRef(null)
  const routeOriginMarkerRef = useRef(null)
  const routeDestMarkerRef = useRef(null)
  const popupRef = useRef(null)
  const masjidMarkersRef = useRef([])
  const routeStopMarkersRef = useRef([])
  const routeStepMarkersRef = useRef([])
  const moveEmitRef = useRef(null)
  const suppressMoveRef = useRef(false)
  const userInteractedRef = useRef(false)
  const lastAutoFitKeyRef = useRef('')
  const movedByUserRef = useRef(false)
  const firstFitDoneRef = useRef(false)
  const onUserLocationRef = useRef(onUserLocation)
  const onSearchCenterChangeRef = useRef(onSearchCenterChange)
  const pickSearchCenterRef = useRef(pickSearchCenter)
  const mapReadyRef = useRef(false)
  const routeLayerIdsRef = useRef({ sourceId: 'route-line', outlineId: 'route-outline', lineId: 'route' })
  const activeRouteLayerIdsRef = useRef({ sourceId: 'route-active-line', lineId: 'route-active' })
  const extrasLayerIdsRef = useRef({ places: [], lineSourceId: 'extra-lines', lineLayerId: 'extra-lines-layer' })
  /** Capture once: re-running map init when searchCenter/location changes destroys the map and causes zoom loops. */
  const initialMapConfigRef = useRef(null)

  const masjids = Array.isArray(masjidsProp) ? masjidsProp : []
  const centerFromProps = initialCenter && typeof initialCenter.lat === 'number' && typeof initialCenter.lon === 'number'
    ? initialCenter
    : null
  const zoomFromProps = typeof initialZoom === 'number' ? initialZoom : null

  const masjidsWithDistance = useMemo(() => {
    const ref = searchCenter || location
    if (!ref || !masjids.length) return masjids
    return masjids.map((m) => ({
      ...m,
      distance: haversineMeters(ref.lat, ref.lon, m.lat, m.lon),
    }))
  }, [searchCenter, location, masjids])

  /** When filtered result set or search anchor changes, allow auto fitBounds again. */
  const masjidResultSetKey = useMemo(
    () => masjids.map((m) => String(m.id)).sort().join('\n'),
    [masjids]
  )
  const mapSyncEpochKey = useMemo(
    () =>
      `${masjidResultSetKey}\x1e${searchCenter ? `${Number(searchCenter.lat).toFixed(5)},${Number(searchCenter.lon).toFixed(5)}` : '-'}`,
    [masjidResultSetKey, searchCenter?.lat, searchCenter?.lon]
  )

  /** Stable while selection + coords unchanged — avoids duplicate camera moves on parent re-renders. */
  const selectedFlyKey = useMemo(() => {
    if (selectedMasjidId == null || selectedMasjidId === '') return ''
    const sid = String(selectedMasjidId)
    const m = masjids.find((x) => String(x?.id) === sid)
    const lat = Number(m?.lat)
    const lon = Number(m?.lon)
    if (!m || !Number.isFinite(lat) || !Number.isFinite(lon)) return ''
    return `${sid}\x1f${lat}\x1f${lon}`
  }, [selectedMasjidId, masjids])

  useEffect(() => {
    onUserLocationRef.current = onUserLocation
    onSearchCenterChangeRef.current = onSearchCenterChange
  }, [onUserLocation, onSearchCenterChange])

  useEffect(() => {
    pickSearchCenterRef.current = pickSearchCenter
  }, [pickSearchCenter])

  const upsertRouteLayers = useCallback(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const { sourceId, outlineId, lineId } = routeLayerIdsRef.current
    const { sourceId: activeSourceId, lineId: activeLineId } = activeRouteLayerIdsRef.current
    const removeRoute = () => {
      try { if (map.getLayer?.(lineId)) map.removeLayer(lineId) } catch {}
      try { if (map.getLayer?.(outlineId)) map.removeLayer(outlineId) } catch {}
      try { if (map.getSource?.(sourceId)) map.removeSource(sourceId) } catch {}
    }
    const removeActive = () => {
      try { if (map.getLayer?.(activeLineId)) map.removeLayer(activeLineId) } catch {}
      try { if (map.getSource?.(activeSourceId)) map.removeSource(activeSourceId) } catch {}
    }

    if (!routeLine?.geometry?.coordinates?.length) {
      removeRoute()
      removeActive()
      return
    }

    // Upsert source (avoid failures from remove+add ordering).
    try {
      const src = map.getSource?.(sourceId)
      if (src && typeof src.setData === 'function') {
        src.setData(routeLine)
      } else {
        try { if (map.getSource?.(sourceId)) map.removeSource(sourceId) } catch {}
        map.addSource(sourceId, { type: 'geojson', data: routeLine })
      }
    } catch {
      // Style may not be ready yet; caller will retry via styledata/idle.
      return
    }
    const outlineCol = cssVarToHex('--foreground')
    const lineCol = cssVarToHex('--primary')
    try {
      if (!map.getLayer?.(outlineId)) {
        map.addLayer({
          id: outlineId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': outlineCol, 'line-width': 7, 'line-opacity': 0.22 },
        })
      }
      if (!map.getLayer?.(lineId)) {
        map.addLayer({
          id: lineId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': lineCol, 'line-width': 4, 'line-opacity': 0.95 },
        })
      }
    } catch {
      // Will retry when style is ready.
      return
    }

    // Active segment highlight (optional)
    if (activeRouteLine?.geometry?.coordinates?.length) {
      try {
        const src = map.getSource?.(activeSourceId)
        if (src && typeof src.setData === 'function') {
          src.setData(activeRouteLine)
        } else {
          try { if (map.getSource?.(activeSourceId)) map.removeSource(activeSourceId) } catch {}
          map.addSource(activeSourceId, { type: 'geojson', data: activeRouteLine })
        }
        if (!map.getLayer?.(activeLineId)) {
          map.addLayer({
            id: activeLineId,
            type: 'line',
            source: activeSourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': cssVarToHex('--ring'), 'line-width': 6, 'line-opacity': 0.95 },
          })
        }
      } catch {
        // retry later
      }
    } else {
      removeActive()
    }

    // Fit bounds to the route.
    const coords = activeRouteLine?.geometry?.coordinates?.length
      ? activeRouteLine.geometry.coordinates
      : routeLine.geometry.coordinates
    if (coords.length >= 2 && typeof map.fitBounds === 'function') {
      let minLon = coords[0][0], maxLon = coords[0][0]
      let minLat = coords[0][1], maxLat = coords[0][1]
      for (const [lon, lat] of coords) {
        minLon = Math.min(minLon, lon)
        maxLon = Math.max(maxLon, lon)
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
      }
      map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 60, maxZoom: 16, duration: 300 })
    }
  }, [routeLine, activeRouteLine, mapReady, mapThemeKey])

  useEffect(() => {
    try {
      upsertRouteLayers()
    } catch {
      // If the style isn't ready yet, listeners below will retry.
    }
  }, [upsertRouteLayers])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const onStyleData = () => { try { upsertRouteLayers() } catch {} }
    const onIdle = () => { try { upsertRouteLayers() } catch {} }
    map.on?.('styledata', onStyleData)
    map.on?.('idle', onIdle)
    return () => {
      map.off?.('styledata', onStyleData)
      map.off?.('idle', onIdle)
    }
  }, [mapReady, upsertRouteLayers])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clear old extra markers.
    for (const m of extrasLayerIdsRef.current.places) {
      try { if (m?.cleanup) m.cleanup() } catch {}
      try { m?.marker?.remove?.() } catch {}
    }
    extrasLayerIdsRef.current.places = []

    const rows = Array.isArray(extraPlaces) ? extraPlaces : []
    for (const p of rows.slice(0, 60)) {
      if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lon)) continue
      const isFocused = focusedExtraPlaceId != null && String(p.id) === String(focusedExtraPlaceId)
      const marker = new OlaMaps.Marker({
        color: isFocused ? cssVarToHex('--ring') : cssVarToHex('--primary'),
      })
        .setLngLat([p.lon, p.lat])
        .addTo(map)
      const el = marker.getElement?.()
      if (el) {
        el.style.cursor = 'pointer'
        el.style.pointerEvents = 'auto'
      }
      const title = escapeHtml(String(p.name || '').trim() || 'Place')
      const addrRaw = cleanAddress(p.address) || cleanAddress(p.vicinity) || cleanAddress(p.formatted_address) || cleanAddress(p.description) || ''
      const addr = escapeHtml(addrRaw || 'Address unavailable')
      const popupFg = cssVarToHex('--foreground')
      const onPointerDown = (e) => {
        e?.stopPropagation?.()
      }
      const onClick = (e) => {
        e?.stopPropagation?.()
        onSelectExtraPlace?.(p)
        const mapInst = mapRef.current
        if (!mapInst) return
        if (!popupRef.current) {
          popupRef.current = new OlaMaps.Popup({ closeButton: true, closeOnClick: true })
        }
        popupRef.current.remove?.()
        popupRef.current
          .setLngLat([p.lon, p.lat])
          .setHTML(
            `<div style="font-size:12px;line-height:1.35;color:${popupFg};"><strong>${title}</strong><br/>${addr}</div>`
          )
          .addTo(mapInst)
      }
      el?.addEventListener?.('mousedown', onPointerDown)
      el?.addEventListener?.('click', onClick)
      extrasLayerIdsRef.current.places.push({
        marker,
        cleanup: () => {
          el?.removeEventListener?.('mousedown', onPointerDown)
          el?.removeEventListener?.('click', onClick)
        },
      })
    }

    // Dashed distance lines from center -> each place.
    const sourceId = extrasLayerIdsRef.current.lineSourceId
    const layerId = extrasLayerIdsRef.current.lineLayerId
    try { if (map.getLayer?.(layerId)) map.removeLayer(layerId) } catch {}
    try { if (map.getSource?.(sourceId)) map.removeSource(sourceId) } catch {}
    if (extraLines?.features?.length) {
      try {
        map.addSource(sourceId, { type: 'geojson', data: extraLines })
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': cssVarToHex('--primary'),
            'line-width': 2,
            'line-opacity': 0.45,
            'line-dasharray': [2, 2],
          },
        })
      } catch {
        // style not ready yet
      }
    }

    return () => {
      for (const m of extrasLayerIdsRef.current.places) {
        try { if (m?.cleanup) m.cleanup() } catch {}
        try { m?.marker?.remove?.() } catch {}
      }
      extrasLayerIdsRef.current.places = []
      try { if (map.getLayer?.(layerId)) map.removeLayer(layerId) } catch {}
      try { if (map.getSource?.(sourceId)) map.removeSource(sourceId) } catch {}
    }
  }, [extraPlaces, extraLines?.features?.length, mapThemeKey, focusedExtraPlaceId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (Array.isArray(routeStops) && routeStops.length > 0) return
    const o = routeOrigin
    if (!o || !Number.isFinite(o?.lat) || !Number.isFinite(o?.lon)) {
      if (routeOriginMarkerRef.current) {
        routeOriginMarkerRef.current.remove()
        routeOriginMarkerRef.current = null
      }
      return
    }
    if (routeOriginMarkerRef.current) {
      routeOriginMarkerRef.current.remove()
      routeOriginMarkerRef.current = null
    }
    routeOriginMarkerRef.current = new OlaMaps.Marker({ color: cssVarToHex('--primary') })
      .setLngLat([o.lon, o.lat])
      .addTo(map)
    const popupFg = cssVarToHex('--foreground')
    const title = escapeHtml(String(o?.label || 'Route origin'))
    const card = `<div style="font-size:12px;line-height:1.35;color:${popupFg};"><strong>${title}</strong><br/>Latitude: ${Number(o.lat).toFixed(5)} Longitude: ${Number(o.lon).toFixed(5)}</div>`
    const popup = new OlaMaps.Popup({ closeButton: true, closeOnClick: true }).setHTML(card)
    routeOriginMarkerRef.current.setPopup?.(popup)
  }, [routeOrigin?.lat, routeOrigin?.lon, mapThemeKey, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (Array.isArray(routeStops) && routeStops.length > 0) return
    const d = routeDestination
    if (!d || !Number.isFinite(d?.lat) || !Number.isFinite(d?.lon)) {
      if (routeDestMarkerRef.current) {
        routeDestMarkerRef.current.remove()
        routeDestMarkerRef.current = null
      }
      return
    }
    if (routeDestMarkerRef.current) {
      routeDestMarkerRef.current.remove()
      routeDestMarkerRef.current = null
    }
    routeDestMarkerRef.current = new OlaMaps.Marker({ color: cssVarToHex('--destructive') })
      .setLngLat([d.lon, d.lat])
      .addTo(map)
    const popupFg = cssVarToHex('--foreground')
    const title = escapeHtml(String(d?.label || 'Route destination'))
    const card = `<div style="font-size:12px;line-height:1.35;color:${popupFg};"><strong>${title}</strong><br/>Latitude: ${Number(d.lat).toFixed(5)} Longitude: ${Number(d.lon).toFixed(5)}</div>`
    const popup = new OlaMaps.Popup({ closeButton: true, closeOnClick: true }).setHTML(card)
    routeDestMarkerRef.current.setPopup?.(popup)
  }, [routeDestination?.lat, routeDestination?.lon, mapThemeKey, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    for (const mk of routeStepMarkersRef.current) {
      try { mk.remove?.() } catch {}
    }
    routeStepMarkersRef.current = []
    if (!showRouteStepMarkers) return
    if (Array.isArray(routeStops) && routeStops.length > 0) return // optimizer already has stop markers
    const rows = Array.isArray(routeStepPoints) ? routeStepPoints : []
    if (!rows.length) return
    const popupFg = cssVarToHex('--foreground')
    rows.slice(0, 30).forEach((p, idx) => {
      if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lon)) return
      const marker = new OlaMaps.Marker({ color: '#64748b' })
        .setLngLat([p.lon, p.lat])
        .addTo(map)
      const el = marker.getElement?.()
      if (el) {
        el.style.transform = 'scale(0.8)'
        el.style.opacity = '0.9'
      }
      const title = escapeHtml(String(p?.label || `Step ${idx + 1}`))
      const card = `<div style="font-size:12px;line-height:1.35;color:${popupFg};"><strong>${title}</strong></div>`
      marker.setPopup?.(new OlaMaps.Popup({ closeButton: true, closeOnClick: true }).setHTML(card))
      routeStepMarkersRef.current.push(marker)
    })
  }, [routeStepPoints, showRouteStepMarkers, routeStops, mapThemeKey, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    for (const mk of routeStopMarkersRef.current) {
      try { mk.remove?.() } catch {}
    }
    routeStopMarkersRef.current = []
    const rows = Array.isArray(routeStops) ? routeStops : []
    if (!rows.length) return
    const midColors = ['#f59e0b', '#a855f7', '#0ea5e9', '#84cc16', '#f97316', '#06b6d4']
    const popupFg = cssVarToHex('--foreground')
    rows.forEach((s, idx) => {
      if (!Number.isFinite(s?.lat) || !Number.isFinite(s?.lon)) return
      const isStart = idx === 0
      const isEnd = idx === rows.length - 1
      const color = isStart ? '#2563eb' : isEnd ? '#ef4444' : midColors[(idx - 1) % midColors.length]
      const marker = new OlaMaps.Marker({ color })
        .setLngLat([s.lon, s.lat])
        .addTo(map)
      const title = escapeHtml(String(s?.label || `Stop ${idx + 1}`))
      const card = `<div style="font-size:12px;line-height:1.35;color:${popupFg};"><strong>${title}</strong><br/>Latitude: ${Number(s.lat).toFixed(5)} Longitude: ${Number(s.lon).toFixed(5)}</div>`
      marker.setPopup?.(new OlaMaps.Popup({ closeButton: true, closeOnClick: true }).setHTML(card))
      routeStopMarkersRef.current.push(marker)
    })
  }, [routeStops, mapThemeKey, mapReady])

  useEffect(() => {
    if (!mapReady || focusedExtraPlaceId == null) return
    const rows = Array.isArray(extraPlaces) ? extraPlaces : []
    const p = rows.find((x) => String(x?.id) === String(focusedExtraPlaceId))
    if (!p || !Number.isFinite(p?.lat) || !Number.isFinite(p?.lon)) return
    const map = mapRef.current
    if (!map) return
    suppressMoveRef.current = true
    map.stop?.()
    map.easeTo?.({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom?.() ?? 14, 15), duration: 400 })
    setTimeout(() => { suppressMoveRef.current = false }, 500)
  }, [focusedExtraPlaceId, mapReady, extraPlaces])

  useEffect(() => {
    mapReadyRef.current = mapReady
  }, [mapReady])

  /** Ola/MapLibre: prefer easeTo (same path as search-center pan); flyTo can be absent or no-op on some Ola builds. */
  const moveCameraToMasjid = useCallback((map, lat, lon) => {
    if (!map || !Number.isFinite(lat) || !Number.isFinite(lon)) return
    const z = Math.max(typeof map.getZoom === 'function' ? map.getZoom() : 14, 16)
    userInteractedRef.current = false
    suppressMoveRef.current = true
    map.stop?.()
    if (typeof map.easeTo === 'function') {
      map.easeTo({
        center: [lon, lat],
        zoom: z,
        duration: 750,
      })
    } else if (typeof map.flyTo === 'function') {
      map.flyTo({ center: [lon, lat], zoom: z, speed: 1.2 })
    } else if (typeof map.jumpTo === 'function') {
      map.jumpTo({ center: [lon, lat], zoom: z })
    }
    setTimeout(() => {
      suppressMoveRef.current = false
    }, 850)
  }, [])

  if (initialMapConfigRef.current === null) {
    const c = centerFromProps || searchCenter || (masjids[0] ? { lat: masjids[0].lat, lon: masjids[0].lon } : DEFAULT_CENTER)
    initialMapConfigRef.current = {
      center: c,
      zoom: zoomFromProps ?? DEFAULT_ZOOM,
    }
  }

  useEffect(() => {
    let mounted = true
    let dismissPopupOnBackgroundClick = null
    const apiKey = getOlaApiKey()
    if (!apiKey || !containerRef.current || mapRef.current) return undefined

    olaRef.current = new OlaMaps({ apiKey })
    const { center: c, zoom: initZoom } = initialMapConfigRef.current

    ;(async () => {
      try {
        // OlaMaps Web SDK expects `style` to be a URL string (it calls `.includes()` internally).
        // Passing a parsed style JSON object can crash with: "e.style?.includes is not a function".
        const rawStyleUrl = getOlaStyleJsonUrl()
        let styleUrl = rawStyleUrl
        try {
          const u = new URL(
            rawStyleUrl,
            typeof window !== 'undefined' && window.location?.origin ? window.location.origin : undefined
          )
          if (apiKey && !u.searchParams.has('api_key')) u.searchParams.set('api_key', apiKey)
          styleUrl = u.toString()
        } catch {
          // If URL parsing fails, fall back to the raw string.
          // (Relative URLs like "/api/ola/…" will still work.)
          styleUrl = rawStyleUrl
        }
        const map = await olaRef.current.init({
          style: styleUrl,
          container: containerRef.current,
          center: [c.lon, c.lat],
          zoom: initZoom,
        })
        if (!mounted) return
        mapRef.current = map

        const mapContainer = map.getContainer?.()
        if (mapContainer) {
          dismissPopupOnBackgroundClick = (ev) => {
            const t = ev.target
            if (!(t instanceof Element)) return
            if (t.closest('.maplibregl-popup')) return
            if (t.closest('.maplibregl-marker')) return
            if (t.closest('.maplibregl-ctrl')) return
            popupRef.current?.remove?.()
          }
          mapContainer.addEventListener('click', dismissPopupOnBackgroundClick, true)
        }

        let loadHandled = false
        const onMapLoad = () => {
          if (loadHandled) return
          loadHandled = true
          setMapReady(true)
          map.addControl(
            new OlaMaps.NavigationControl({
              showCompass: true,
              showZoom: true,
              visualizePitch: false,
            }),
            'top-right'
          )
          const geolocate = new OlaMaps.GeolocateControl({
            positionOptions: {
              enableHighAccuracy: true,
            },
            trackUserLocation: true,
          })
          map.addControl(geolocate, 'top-right')
          geolocate.on('geolocate', (e) => {
            const lat = e?.coords?.latitude
            const lon = e?.coords?.longitude
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
              onUserLocationRef.current?.({ lat, lon })
            }
          })
        }
        if (typeof map.loaded === 'function' && map.loaded()) {
          onMapLoad()
        } else if (typeof map.once === 'function') {
          map.once('load', onMapLoad)
        } else if (typeof map.on === 'function') {
          map.on('load', onMapLoad)
        } else {
          setMapReady(true)
        }

        map.on('moveend', () => {
          // After first manual interaction, do not auto-fit again unless result set changes.
          if (!suppressMoveRef.current) {
            userInteractedRef.current = true
            movedByUserRef.current = true
          }
          if (!searchCenter || !onSearchCenterChange) return
          if (suppressMoveRef.current) return
          const c2 = map.getCenter()
          const next = { lat: c2.lat, lon: c2.lng }
          const prev = moveEmitRef.current
          if (prev && Math.abs(prev.lat - next.lat) < 0.0003 && Math.abs(prev.lon - next.lon) < 0.0003) return
          moveEmitRef.current = next
          onSearchCenterChangeRef.current?.(next)
        })

        // ola-map style: click map to pick a new search center.
        const handlePickClick = (e) => {
          if (!pickSearchCenterRef.current) return
          const lat = e?.lngLat?.lat
          const lon = e?.lngLat?.lng
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
          onSearchCenterChangeRef.current?.({ lat, lon })
        }
        map.on('click', handlePickClick)
      } catch (err) {
        const msg = String(err?.message || err || '')
        if (mounted) setLocationError(msg ? `Unable to load map right now: ${msg}` : 'Unable to load map right now')
      }
    })()

    return () => {
      mounted = false
      const m = mapRef.current
      if (m) {
        const mc = m.getContainer?.()
        if (mc && dismissPopupOnBackgroundClick) {
          mc.removeEventListener('click', dismissPopupOnBackgroundClick, true)
        }
        m.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    userInteractedRef.current = false
    lastAutoFitKeyRef.current = ''
    firstFitDoneRef.current = false
  }, [mapSyncEpochKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    for (const item of masjidMarkersRef.current) {
      if (item?.cleanup) item.cleanup()
      item?.marker?.remove?.()
    }
    masjidMarkersRef.current = []

    for (const m of masjidsWithDistance) {
      if (!Number.isFinite(m?.lat) || !Number.isFinite(m?.lon)) continue
      const marker = new OlaMaps.Marker({
        color:
          String(selectedMasjidId) === String(m.id)
            ? cssVarToHex('--ring')
            : cssVarToHex('--primary'),
      })
        .setLngLat([m.lon, m.lat])
        .addTo(map)

      const el = marker.getElement?.()
      if (el) {
        el.style.cursor = 'pointer'
        el.style.pointerEvents = 'auto'
      }
      const title = escapeHtml(String(m.name || '').trim() || 'Masjid')
      const addr = escapeHtml(String(colonyLine(m) || '').trim() || 'Address unavailable')
      const popupFg = cssVarToHex('--foreground')
      const onPointerDown = (e) => {
        e?.stopPropagation?.()
      }
      const onClick = (e) => {
        e?.stopPropagation?.()
        onSelectMasjid?.(m)
        const mapInst = mapRef.current
        if (mapInst && mapReadyRef.current) {
          moveCameraToMasjid(mapInst, Number(m.lat), Number(m.lon))
        }
        if (!popupRef.current) {
          popupRef.current = new OlaMaps.Popup({
            closeButton: true,
            closeOnClick: true,
          })
        }
        popupRef.current.remove?.()
        popupRef.current
          .setLngLat([m.lon, m.lat])
          .setHTML(
            `<div style="font-size:12px;line-height:1.3;color:${popupFg};"><strong>${title}</strong><br/>${addr}</div>`
          )
          .addTo(map)
      }
      el?.addEventListener?.('mousedown', onPointerDown)
      el?.addEventListener?.('click', onClick)
      masjidMarkersRef.current.push({
        marker,
        cleanup: () => {
          el?.removeEventListener?.('mousedown', onPointerDown)
          el?.removeEventListener?.('click', onClick)
        },
      })
    }

    return () => {
      for (const item of masjidMarkersRef.current) {
        if (item?.cleanup) item.cleanup()
        item?.marker?.remove?.()
      }
      masjidMarkersRef.current = []
    }
  }, [masjidsWithDistance, moveCameraToMasjid, onSelectMasjid, selectedMasjidId, mapThemeKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !searchCenter) return
    if (!showSearchCenterMarker) {
      if (centerMarkerRef.current) {
        centerMarkerRef.current.remove()
        centerMarkerRef.current = null
      }
      return
    }
    // Hide search-radius pin while a masjid is selected — same amber as selected pin read as a duplicate marker.
    if (selectedMasjidId) {
      if (centerMarkerRef.current) {
        centerMarkerRef.current.remove()
        centerMarkerRef.current = null
      }
      return
    }
    const canDragCenter = typeof onSearchCenterChange === 'function'
    if (mapThemeKeyRef.current !== mapThemeKey && centerMarkerRef.current) {
      centerMarkerRef.current.remove()
      centerMarkerRef.current = null
    }
    mapThemeKeyRef.current = mapThemeKey

    if (!centerMarkerRef.current) {
      centerMarkerRef.current = new OlaMaps.Marker({
        color: cssVarToHex('--ring'),
        draggable: canDragCenter,
      })
        .setLngLat([searchCenter.lon, searchCenter.lat])
        .addTo(map)
      if (canDragCenter) {
        centerMarkerRef.current.on('dragend', () => {
          const c = centerMarkerRef.current.getLngLat()
          onSearchCenterChange({ lat: c.lat, lon: c.lng })
        })
      }
    } else {
      centerMarkerRef.current.setLngLat([searchCenter.lon, searchCenter.lat])
    }
  }, [searchCenter?.lat, searchCenter?.lon, onSearchCenterChange, selectedMasjidId, mapThemeKey, showSearchCenterMarker])

  useEffect(() => {
    if (!searchCenter && centerMarkerRef.current) {
      centerMarkerRef.current.remove()
      centerMarkerRef.current = null
    }
  }, [Boolean(searchCenter)])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !location) return
    if (!showUserLocationMarker) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove()
        userMarkerRef.current = null
      }
      return
    }
    if (userMarkerThemeKeyRef.current !== mapThemeKey && userMarkerRef.current) {
      userMarkerRef.current.remove()
      userMarkerRef.current = null
    }
    userMarkerThemeKeyRef.current = mapThemeKey

    if (!userMarkerRef.current) {
      userMarkerRef.current = new OlaMaps.Marker({ color: cssVarToHex('--primary') })
        .setLngLat([location.lon, location.lat])
        .addTo(map)
    } else {
      userMarkerRef.current.setLngLat([location.lon, location.lat])
    }
  }, [location?.lat, location?.lon, mapThemeKey, showUserLocationMarker])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const target = searchCenter || location
    if (!target) return
    // Do not "snap back" after user pans/zooms; this center change already came from map move.
    if (movedByUserRef.current) {
      movedByUserRef.current = false
      return
    }
    suppressMoveRef.current = true
    // When center changes from search/list intent, move to that place but keep/raise zoom.
    map.easeTo({
      center: [target.lon, target.lat],
      zoom: Math.max(map.getZoom(), 13),
      duration: 350,
    })
    setTimeout(() => { suppressMoveRef.current = false }, 450)
  }, [searchCenter?.lat, searchCenter?.lon])

  useEffect(() => {
    if (!mapReady || !selectedFlyKey) return
    const parts = selectedFlyKey.split('\x1f')
    const lat = Number(parts[1])
    const lon = Number(parts[2])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
    let cancelled = false
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return
        const map = mapRef.current
        if (!map) return
        moveCameraToMasjid(map, lat, lon)
      })
    })
    return () => {
      cancelled = true
    }
  }, [selectedFlyKey, mapReady, moveCameraToMasjid])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    // If user selected a place, never auto-fit to all points (prevents zoom-out).
    if (selectedMasjidId) return
    // After user interaction, do not auto-fit repeatedly.
    if (userInteractedRef.current) return
    if (!masjidsWithDistance.length) return
    const anchorPart = searchCenter
      ? `${Number(searchCenter.lat).toFixed(4)}:${Number(searchCenter.lon).toFixed(4)}|`
      : ''
    const fitKey =
      anchorPart +
      masjidsWithDistance.map((p) => `${Number(p.lat).toFixed(4)}:${Number(p.lon).toFixed(4)}`).join('|')
    if (lastAutoFitKeyRef.current === fitKey && firstFitDoneRef.current) return
    const points = [...masjidsWithDistance]
    if (searchCenter) points.push(searchCenter)
    else if (location) points.push(location)
    if (points.length < 2) return
    const b = computeBounds(points)
    if (!b) return
    suppressMoveRef.current = true
    lastAutoFitKeyRef.current = fitKey
    firstFitDoneRef.current = true
    map.fitBounds(b, { padding: 40, maxZoom: 15, duration: 250 })
    setTimeout(() => { suppressMoveRef.current = false }, 350)
  }, [masjidsWithDistance, searchCenter?.lat, searchCenter?.lon, location?.lat, location?.lon, selectedMasjidId])

  useEffect(() => {
    if (searchCenter) return
    let cancelled = false
    getCurrentPosition()
      .then(({ coords }) => {
        if (cancelled) return
        const pos = { lat: coords.latitude, lon: coords.longitude }
        setLocation(pos)
        onUserLocation?.(pos)
      })
      .catch((err) => {
        if (!cancelled) setLocationError(err?.message || 'Location failed')
      })
    return () => { cancelled = true }
  }, [onUserLocation, searchCenter])

  return (
    <div
      className={cn(
        'relative w-full h-full min-h-[300px] sm:min-h-[400px] rounded-xl overflow-hidden flex-1',
        className
      )}
    >
      {showErrorBanner && locationError && (
        <div className="absolute top-2 left-2 right-2 z-50 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {locationError}
        </div>
      )}
      <div ref={containerRef} className="h-full w-full min-h-[240px] sm:min-h-[280px]" />
      {searchCenter && showSearchCenterMarker && (
        <div className="absolute bottom-2 left-2 z-40 rounded-md border border-border bg-card/95 px-2 py-1 text-[11px] text-card-foreground shadow-sm">
          {searchCenterLabel && searchCenterLabel !== '—'
            ? shortenLocationLabel(searchCenterLabel)
            : `${searchCenter.lat.toFixed(5)}, ${searchCenter.lon.toFixed(5)}`}
        </div>
      )}
    </div>
  )
}

export { DEFAULT_CENTER, DEFAULT_ZOOM }
