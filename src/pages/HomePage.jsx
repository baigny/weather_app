import { Suspense, useMemo, useState, useEffect, useTransition, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { List, LayoutGrid } from 'lucide-react'
import { fetchWeatherByCoords } from '../services/weatherAPI'
import { fetchPrayerTimesByCoords } from '../services/prayerAPI'
import { reverseGeocode, getCurrentPosition } from '../services/weatherAPI'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import WeatherCard from '../components/WeatherCard'
import OlaSearchBar from '../components/search/OlaSearchBar'
import PrayerTimesCard from '../components/PrayerTimesCard'
import LocationMapPicker from '../components/masjid/LocationMapPicker'
import MasjidMap from '../components/masjid/MasjidMap'
import Pagination from '../components/ui/Pagination'
import { cn, shortenLocationLabel } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import '../App.css'
import { formatDistanceMeters, meaningfulRoadDistanceMeters, haversineMeters } from '../services/geo'
import { clampMasjidRadiusKm, searchMasjids } from '../services/masjidSearchService'
import { buildPlacePhotoUrl, fetchAdvancedPlaceDetails, fetchPlaceDetails } from '../services/olaPlacesAPI'
import { decodePolyline, fetchDrivingLegsFromDirections, normalizeDirectionsResponse } from '../services/olaRoutingAPI'
import { getOlaSdkClient } from '../services/olaSdkClient'
import useTempUnit from '../hooks/useTempUnit'
import { fetchNearbyAmenities } from '../services/olaPlacesAPI'

const MASJID_PAGE_SIZE = 10

function cleanAddress(value) {
  const s = String(value || '').trim()
  if (!s) return ''
  if (s.toLowerCase() === 'na' || s.toLowerCase() === 'n/a') return ''
  return s
}

function bestPlaceAddress(p) {
  return (
    cleanAddress(p?.address) ||
    cleanAddress(p?.vicinity) ||
    cleanAddress(p?.formatted_address) ||
    cleanAddress(p?.formattedAddress) ||
    cleanAddress(p?.description) ||
    ''
  )
}

function colonyLabelFromTags(m) {
  const t = m?.tags || {}
  return (
    t['addr:suburb'] ||
    t['addr:neighbourhood'] ||
    t['addr:hamlet'] ||
    t['addr:locality'] ||
    t['is_in:neighbourhood'] ||
    t['is_in:suburb'] ||
    null
  )
}

function getDetailsPhotoUrl(details) {
  const photos = details?.photos
  if (!Array.isArray(photos) || photos.length === 0) return null
  const first = photos[0]
  const ref = first?.photo_reference || first?.photoReference || first?.reference || first?.name || null
  return buildPlacePhotoUrl(ref)
}

function MasjidResultCard({ masjid, selected, mode = 'list', imageUrl = null, onClick, asStatic = false }) {
  if (!masjid) return null
  const name = String(masjid?.name || '').trim() || 'Masjid'
  const address = String(masjid?.address || '').trim() || 'Address unavailable'
  const driving = masjid.drivingLeg
  /** Traffic-aware Ola Directions total (aligned with olamaps.io driving), not straight-line. */
  const roadM = meaningfulRoadDistanceMeters(driving?.distanceMeters)
  const driveDistLabel = roadM != null ? formatDistanceMeters(roadM) : null
  const hasDuration =
    driving?.durationSeconds != null && Number.isFinite(driving.durationSeconds)
  const durationMin = hasDuration ? Math.max(1, Math.round(driving.durationSeconds / 60)) : null
  const hasDriveRow = driveDistLabel != null || hasDuration
  const badgeLabel = driveDistLabel
  const badgeSub = driveDistLabel ? 'Ola Maps driving' : null

  const shellClass = cn(
    'w-full text-left rounded-xl border border-border bg-card text-card-foreground shadow-sm transition',
    selected ? 'ring-2 ring-primary/50 border-primary bg-accent' : 'hover:bg-accent/40'
  )
  const inner = (
    <>
      {mode === 'card' || mode === 'grid' ? (
        imageUrl ? (
          <img src={imageUrl} alt={name} className="h-24 w-full rounded-t-xl object-cover" loading="lazy" />
        ) : (
          <div className="h-24 w-full rounded-t-xl bg-linear-to-br from-muted/60 to-muted" />
        )
      ) : null}
      <div className={cn('p-3', mode === 'card' && 'p-4')}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground truncate leading-snug">{name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground leading-snug">
              <span className="block overflow-hidden text-ellipsis">{address}</span>
            </div>
            {hasDriveRow && (
              <div className="mt-1.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Drive (Ola Maps):</span>{' '}
                {driveDistLabel ?? '—'}
                {durationMin != null && <span> · {durationMin} min</span>}
              </div>
            )}
          </div>
          {(badgeLabel != null || (hasDuration && !badgeLabel)) && (
            <div className="shrink-0 text-right max-w-[42%] sm:max-w-none">
              {badgeLabel != null && (
                <>
                  <div className="text-xs font-semibold text-foreground whitespace-nowrap">{badgeLabel}</div>
                  {badgeSub != null && (
                    <div className="text-[10px] font-normal text-muted-foreground mt-0.5">{badgeSub}</div>
                  )}
                </>
              )}
              {badgeLabel == null && hasDuration && (
                <div className="text-xs font-semibold text-foreground whitespace-nowrap">
                  ~{durationMin} min
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
  if (asStatic) {
    return (
      <div className={shellClass} role="region" aria-label="Selected masjid">
        {inner}
      </div>
    )
  }
  return (
    <button type="button" onClick={onClick} className={shellClass}>
      {inner}
    </button>
  )
}

const HomePage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(null)
  const [coords, setCoords] = useState(null)
  const [weatherPromise, setWeatherPromise] = useState(null)
  const [prayerPromise, setPrayerPromise] = useState(null)
  const [locationLabel, setLocationLabel] = useState('—')
  const [locationMode, setLocationMode] = useState('auto')
  const [activeWidget, setActiveWidget] = useState('weather')
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [showPrayersInMasjidTab, setShowPrayersInMasjidTab] = useState(false)
  const [, startTransition] = useTransition()
  const { unit: tempUnit, toggle: toggleTempUnit, format: formatTemp } = useTempUnit('C')

  // Masjid tab state
  const [masjidCenter, setMasjidCenter] = useState(null)
  const [masjidCenterLabel, setMasjidCenterLabel] = useState('—')
  const [masjidRadiusKm, setMasjidRadiusKm] = useState(5)
  const [masjidResults, setMasjidResults] = useState([])
  const [masjidSearching, setMasjidSearching] = useState(false)
  const [masjidHasLoaded, setMasjidHasLoaded] = useState(false)
  const [masjidError, setMasjidError] = useState(null)
  const [masjidView, setMasjidView] = useState('list') // list | grid | card
  const [selectedMasjidId, setSelectedMasjidId] = useState(null)
  const [selectedMasjidDetails, setSelectedMasjidDetails] = useState(null)
  const [masjidPage, setMasjidPage] = useState(1)
  const [smartIntent, setSmartIntent] = useState('weather')
  const [smartMasjidFilters, setSmartMasjidFilters] = useState({ radiusKm: null, nearMe: false, locationText: null })
  /**
   * When false: masjid search, driving matrix, and map anchor use device GPS (`coords`) — same as "Near me" / "Use current location".
   * When true: user picked a place (smart search city, map picker, or resolved location) — search is centered there.
   */
  const [masjidFromPlacePick, setMasjidFromPlacePick] = useState(false)
  /** Shown in "N results near …" — stays on the user's search until they change location (map / picker / near me / new search). */
  const [masjidResultsContextLabel, setMasjidResultsContextLabel] = useState('—')
  const masjidLabelResolveTimer = useRef(null)
  /** When true, reverse-geocode of map center updates `masjidResultsContextLabel` (user panned the map). */
  const masjidSubtitleFollowsGeocodeRef = useRef(false)
  /** Ola Distance Matrix Basic — driving legs for current results page (see olaRoutingAPI). */
  const [drivingLegByMasjidId, setDrivingLegByMasjidId] = useState({})
  const [mapPickMode, setMapPickMode] = useState(false)
  const [routeMode, setRouteMode] = useState('driving') // driving | walking
  const [routeOrigin, setRouteOrigin] = useState(null) // {lat,lon,label}
  const [routeDestination, setRouteDestination] = useState(null) // {lat,lon,label}
  const [routeLine, setRouteLine] = useState(null) // GeoJSON LineString
  const [routeSummary, setRouteSummary] = useState(null) // {distanceMeters,durationSeconds}
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState(null)
  const [showRouteSteps, setShowRouteSteps] = useState(false)
  const [activeRouteSegmentIdx, setActiveRouteSegmentIdx] = useState(null) // null = all
  const [routeCompare, setRouteCompare] = useState({ driving: null, walking: null })
  const [routeCompareLoading, setRouteCompareLoading] = useState(false)
  const [explorePlaces, setExplorePlaces] = useState([])
  const [exploreAmenityType, setExploreAmenityType] = useState(null)
  const [exploreLines, setExploreLines] = useState(null) // FeatureCollection
  const [exploreFocusedPlaceId, setExploreFocusedPlaceId] = useState(null)
  const findMasjidTab = useMemo(() => {
    const sp = new URLSearchParams(location.search || '')
    return sp.get('masjidTab') === 'prayers' ? 'prayers' : 'masjids'
  }, [location.search])

  const setFindMasjidTab = useCallback((nextTab, { replace = true } = {}) => {
    const sp = new URLSearchParams(location.search || '')
    if (nextTab === 'prayers') sp.set('masjidTab', 'prayers')
    else sp.delete('masjidTab')
    navigate({ pathname: location.pathname, search: sp.toString() ? `?${sp.toString()}` : '' }, { replace })
  }, [location.pathname, location.search, navigate])

  const clearMapPickerQueryParam = useCallback(() => {
    const sp = new URLSearchParams(location.search || '')
    if (!sp.get('mapPicker')) return
    sp.delete('mapPicker')
    navigate({ pathname: location.pathname, search: sp.toString() ? `?${sp.toString()}` : '' }, { replace: true })
  }, [location.search, navigate])

  // Find Masjids tools (Sheet) -> main area state.
  useEffect(() => {
    if (
      location.pathname !== '/find-masjids' &&
      location.pathname !== '/explore-neighborhood' &&
      location.pathname !== '/directions'
    ) return
    const sp = new URLSearchParams(location.search || '')

    const rk = Number(sp.get('radiusKm'))
    if (Number.isFinite(rk)) setMasjidRadiusKm(clampMasjidRadiusKm(rk))

    if (sp.get('nearMe') === '1') {
      setMasjidFromPlacePick(false)
      handleMasjidUseCurrent()
    }

    setMapPickMode(sp.get('pickCenter') === '1')

    const m = sp.get('mode')
    setRouteMode(m === 'walking' ? 'walking' : 'driving')
    const fromLatRaw = sp.get('fromLat')
    const fromLonRaw = sp.get('fromLon')
    const fromLat = fromLatRaw == null || fromLatRaw === '' ? null : Number(fromLatRaw)
    const fromLon = fromLonRaw == null || fromLonRaw === '' ? null : Number(fromLonRaw)
    const fromLabel = sp.get('fromLabel') || null
    const fromAddr = sp.get('fromAddr') || null
    if (Number.isFinite(fromLat) && Number.isFinite(fromLon) && (fromLat !== 0 || fromLon !== 0)) {
      setRouteOrigin({ lat: fromLat, lon: fromLon, label: fromLabel, address: fromAddr })
    }
    else setRouteOrigin(null)

    const toLatRaw = sp.get('toLat')
    const toLonRaw = sp.get('toLon')
    const toLat = toLatRaw == null || toLatRaw === '' ? null : Number(toLatRaw)
    const toLon = toLonRaw == null || toLonRaw === '' ? null : Number(toLonRaw)
    const toLabel = sp.get('toLabel') || null
    const toAddr = sp.get('toAddr') || null
    if (Number.isFinite(toLat) && Number.isFinite(toLon) && (toLat !== 0 || toLon !== 0)) {
      setRouteDestination({ lat: toLat, lon: toLon, label: toLabel, address: toAddr })
    }
    else setRouteDestination(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search])

  // Fetch a single route polyline (Find Masjids + Explore Neighborhood) and render the line on the map.
  useEffect(() => {
    if (
      location.pathname !== '/find-masjids' &&
      location.pathname !== '/explore-neighborhood' &&
      location.pathname !== '/directions'
    ) {
      setRouteLine(null)
      setRouteSummary(null)
      setRouteLoading(false)
      setRouteError(null)
      return
    }
    const sp = new URLSearchParams(location.search || '')
    const routeEnabled = sp.get('route') === '1'
    if (!routeEnabled || !routeOrigin || !routeDestination) {
      setRouteLine(null)
      setRouteSummary(null)
      setShowRouteSteps(false)
      setActiveRouteSegmentIdx(null)
      setRouteLoading(false)
      setRouteError(null)
      return
    }
    let cancelled = false
    setRouteLoading(true)
    setRouteError(null)
    Promise.resolve()
      .then(async () => {
        const client = getOlaSdkClient()
        const routeKind = sp.get('routeKind') || 'directions'
        if (routeKind === 'optimizer') {
          const encodedStops = sp.get('optStops') || ''
          if (!encodedStops) throw new Error('Route optimizer: missing stops')
          const json = await client.routing.routeOptimizer(encodedStops, {
            source: 'first',
            destination: sp.get('optRoundTrip') === '1' ? 'first' : 'last',
            round_trip: sp.get('optRoundTrip') === '1',
            mode: routeMode,
            steps: true,
            overview: 'full',
          })
          const norm = normalizeDirectionsResponse(json)
          if (!norm) throw new Error('Route optimizer: empty response')
          return norm
        }
        const json = await client.routing.getDirections(
          { lat: routeOrigin.lat, lon: routeOrigin.lon },
          { lat: routeDestination.lat, lon: routeDestination.lon },
          { mode: routeMode, steps: true, overview: 'full', language: 'en', traffic_metadata: false }
        )
        const norm = normalizeDirectionsResponse(json)
        if (!norm) throw new Error('Directions: empty response')
        return norm
      })
      .then((res) => {
        if (cancelled) return
        let coords =
          Array.isArray(res?.coordinates) && res.coordinates.length
            ? res.coordinates
            : res?.polyline
              ? decodePolyline(res.polyline)
              : []
        // Ensure route geometry is in MapLibre order: [lon, lat].
        // Some Ola/OSRM shapes can come back as [lat, lon] which draws the route far away.
        if (
          coords.length >= 2 &&
          routeOrigin &&
          routeDestination &&
          Array.isArray(coords[0]) &&
          coords[0].length >= 2
        ) {
          const [c0a, c0b] = coords[0]
          const [c1a, c1b] = coords[coords.length - 1]
          const dNormal =
            haversineMeters(routeOrigin.lat, routeOrigin.lon, Number(c0b), Number(c0a)) +
            haversineMeters(routeDestination.lat, routeDestination.lon, Number(c1b), Number(c1a))
          const dSwapped =
            haversineMeters(routeOrigin.lat, routeOrigin.lon, Number(c0a), Number(c0b)) +
            haversineMeters(routeDestination.lat, routeDestination.lon, Number(c1a), Number(c1b))
          if (Number.isFinite(dNormal) && Number.isFinite(dSwapped) && dSwapped < dNormal / 4) {
            coords = coords.map((p) => (Array.isArray(p) && p.length >= 2 ? [p[1], p[0]] : p))
          }
        }
        if (!coords.length) {
          setRouteLine(null)
          setRouteSummary(null)
          setRouteError('No route polyline returned')
          setRouteLoading(false)
          return
        }
        setRouteLine({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: { mode: routeMode },
        })
        const legs = Array.isArray(res?.raw?.legs) ? res.raw.legs : []
        const allSteps = legs.flatMap((leg) => (Array.isArray(leg?.steps) ? leg.steps : []))
        const stepPoints = (() => {
          const points = []
          const pushPoint = (lat, lon, label) => {
            const la = Number(lat)
            const lo = Number(lon)
            if (!Number.isFinite(la) || !Number.isFinite(lo)) return
            points.push({ lat: la, lon: lo, label })
          }
          allSteps.forEach((s, idx) => {
            const st = s?.start_location || s?.startLocation || null
            const en = s?.end_location || s?.endLocation || null
            pushPoint(st?.lat ?? st?.latitude, st?.lon ?? st?.lng ?? st?.longitude, `Step ${idx + 1}`)
            if (idx === allSteps.length - 1) {
              pushPoint(en?.lat ?? en?.latitude, en?.lon ?? en?.lng ?? en?.longitude, 'End')
            }
          })
          // Fallback: sample polyline if Ola step coords absent.
          if (points.length < 2 && Array.isArray(coords) && coords.length >= 6) {
            const take = Math.min(12, Math.floor(coords.length / 10))
            for (let i = 1; i <= take; i += 1) {
              const at = Math.floor((i / (take + 1)) * coords.length)
              const p = coords[at]
              if (Array.isArray(p) && p.length >= 2) {
                pushPoint(Number(p[1]), Number(p[0]), `Step ${i}`)
              }
            }
          }
          return points
        })()
        const readableDistance = normalizeReadableDistance(res?.readableDistance, res?.distanceMeters ?? null)
        const readableDuration = normalizeReadableDuration(res?.readableDuration, res?.durationSeconds ?? null)

        setRouteSummary({
          distanceMeters: res?.distanceMeters ?? null,
          durationSeconds: res?.durationSeconds ?? null,
          readableDistance: readableDistance ?? null,
          readableDuration: readableDuration ?? null,
          legs: legs.map((leg) => {
            const extractLegCoords = () => {
              const raw = leg?.geometry?.coordinates
              if (Array.isArray(raw) && raw.length) {
                return raw
                  .map((pair) => {
                    if (!Array.isArray(pair) || pair.length < 2) return null
                    const a = Number(pair[0])
                    const b = Number(pair[1])
                    if (!Number.isFinite(a) || !Number.isFinite(b)) return null
                    // Assume GeoJSON order [lon,lat], but fix obvious swaps.
                    const lonLat = [a, b]
                    const latLon = [b, a]
                    const isLonLatValid = Math.abs(lonLat[0]) <= 180 && Math.abs(lonLat[1]) <= 90
                    const isLatLonValid = Math.abs(latLon[0]) <= 180 && Math.abs(latLon[1]) <= 90
                    if (isLonLatValid) return lonLat
                    if (isLatLonValid) return latLon
                    return lonLat
                  })
                  .filter(Boolean)
              }
              if (typeof leg?.geometry === 'string' && leg.geometry) {
                const dec = decodePolyline(leg.geometry)
                if (dec?.length) return dec
              }
              const steps = Array.isArray(leg?.steps) ? leg.steps : []
              if (!steps.length) return []
              const acc = []
              for (const s of steps) {
                const sp = s?.polyline?.points ?? s?.polyline ?? s?.overview_polyline?.points ?? null
                if (typeof sp === 'string' && sp) {
                  const dec = decodePolyline(sp)
                  if (dec?.length) acc.push(...dec)
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
              return acc
            }

            const legCoords = extractLegCoords()
            return {
            readableDistance: normalizeReadableDistance(
              leg?.readable_distance,
              Number.isFinite(Number(leg?.distance)) ? Number(leg.distance) : null
            ),
            readableDuration: normalizeReadableDuration(
              leg?.readable_duration,
              Number.isFinite(Number(leg?.duration_in_traffic ?? leg?.duration))
                ? Number(leg.duration_in_traffic ?? leg.duration)
                : null
            ),
            coordinates: Array.isArray(legCoords) && legCoords.length ? legCoords : null,
            steps: (Array.isArray(leg?.steps) ? leg.steps : []).map((s) => ({
              instruction: routeStepInstruction(s),
              distance: s?.readable_distance || (Number.isFinite(Number(s?.distance)) ? formatRouteDistance(Number(s.distance)) : ''),
              duration: s?.readable_duration || (Number.isFinite(Number(s?.duration_in_traffic ?? s?.duration)) ? formatRouteDuration(Number(s.duration_in_traffic ?? s.duration)) : ''),
            })),
          }
          }),
          steps: allSteps.map((s) => ({
            instruction: routeStepInstruction(s),
            distance: s?.readable_distance || (Number.isFinite(Number(s?.distance)) ? formatRouteDistance(Number(s.distance)) : ''),
            duration: s?.readable_duration || (Number.isFinite(Number(s?.duration_in_traffic ?? s?.duration)) ? formatRouteDuration(Number(s.duration_in_traffic ?? s.duration)) : ''),
          })),
          stepPoints,
        })
        setRouteLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setRouteLine(null)
        setRouteSummary(null)
        setRouteLoading(false)
        setRouteError(String(err?.message || 'Directions failed'))
      })
    return () => {
      cancelled = true
    }
  }, [
    location.pathname,
    location.search,
    routeOrigin?.lat,
    routeOrigin?.lon,
    routeDestination?.lat,
    routeDestination?.lon,
    routeMode,
  ])

  // Compare Drive vs Walk (show both durations/distances without switching).
  useEffect(() => {
    if (location.pathname !== '/directions') {
      setRouteCompare({ driving: null, walking: null })
      setRouteCompareLoading(false)
      return
    }
    const sp = new URLSearchParams(location.search || '')
    const routeEnabled = sp.get('route') === '1'
    const routeKind = sp.get('routeKind') || 'directions'
    if (!routeEnabled || routeKind !== 'directions' || !routeOrigin || !routeDestination) {
      setRouteCompare({ driving: null, walking: null })
      setRouteCompareLoading(false)
      return
    }
    let cancelled = false
    setRouteCompareLoading(true)
    Promise.resolve()
      .then(async () => {
        const client = getOlaSdkClient()
        const [driveJson, walkJson] = await Promise.all([
          client.routing.getDirections(
            { lat: routeOrigin.lat, lon: routeOrigin.lon },
            { lat: routeDestination.lat, lon: routeDestination.lon },
            { mode: 'driving', steps: false, overview: 'full', language: 'en', traffic_metadata: false }
          ),
          client.routing.getDirections(
            { lat: routeOrigin.lat, lon: routeOrigin.lon },
            { lat: routeDestination.lat, lon: routeDestination.lon },
            { mode: 'walking', steps: false, overview: 'full', language: 'en', traffic_metadata: false }
          ),
        ])
        const drive = normalizeDirectionsResponse(driveJson)
        const walk = normalizeDirectionsResponse(walkJson)
        return { drive, walk }
      })
      .then(({ drive, walk }) => {
        if (cancelled) return
        setRouteCompare({
          driving: drive
            ? {
              readableDistance: normalizeReadableDistance(drive.readableDistance, drive.distanceMeters ?? null) || '—',
              readableDuration: normalizeReadableDuration(drive.readableDuration, drive.durationSeconds ?? null) || '—',
            }
            : null,
          walking: walk
            ? {
              readableDistance: normalizeReadableDistance(walk.readableDistance, walk.distanceMeters ?? null) || '—',
              readableDuration: normalizeReadableDuration(walk.readableDuration, walk.durationSeconds ?? null) || '—',
            }
            : null,
        })
        setRouteCompareLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setRouteCompare({ driving: null, walking: null })
        setRouteCompareLoading(false)
      })
    return () => { cancelled = true }
  }, [
    location.pathname,
    location.search,
    routeOrigin?.lat,
    routeOrigin?.lon,
    routeDestination?.lat,
    routeDestination?.lon,
  ])

  const handleSearchCenterChange = useCallback(
    async (loc) => {
      if (!loc) return
      setMasjidFromPlacePick(true)
      masjidSubtitleFollowsGeocodeRef.current = false
      setMasjidCenter(loc)
      setSelectedMasjidId(null)
      await resolveMasjidCenterLabel(loc, { syncResultsSubtitle: true })

      // Exit pick mode by clearing query param.
      const sp = new URLSearchParams(location.search || '')
      if (sp.get('pickCenter') === '1') {
        sp.delete('pickCenter')
        navigate({ pathname: location.pathname, search: sp.toString() ? `?${sp.toString()}` : '' }, { replace: true })
      }
    },
    [location.pathname, location.search, navigate]
  )

  const selectedMasjid = useMemo(
    () => masjidResults.find((m) => m.id === selectedMasjidId) || null,
    [masjidResults, selectedMasjidId]
  )

  const masjidSearchOrigin = useMemo(() => {
    if (!masjidFromPlacePick && coords) return coords
    return masjidCenter || coords
  }, [masjidFromPlacePick, coords, masjidCenter])

  // Keep Explore Neighborhood center in URL for the panel (like ola-map: panel reads map center).
  useEffect(() => {
    if (location.pathname !== '/explore-neighborhood') return
    const c = masjidSearchOrigin
    if (!c) return
    const sp = new URLSearchParams(location.search || '')
    const curLat = Number(sp.get('centerLat'))
    const curLon = Number(sp.get('centerLon'))
    if (
      Number.isFinite(curLat) &&
      Number.isFinite(curLon) &&
      Math.abs(curLat - c.lat) < 1e-5 &&
      Math.abs(curLon - c.lon) < 1e-5
    ) {
      return
    }
    sp.set('centerLat', String(c.lat))
    sp.set('centerLon', String(c.lon))
    navigate({ pathname: location.pathname, search: `?${sp.toString()}` }, { replace: true })
  }, [location.pathname, location.search, masjidSearchOrigin?.lat, masjidSearchOrigin?.lon])

  // Keep Explore list in sync with map clicks: scroll focused place into view.
  useEffect(() => {
    if (location.pathname !== '/explore-neighborhood') return
    if (!exploreFocusedPlaceId) return
    const el = document.getElementById(`explore-place-${String(exploreFocusedPlaceId)}`)
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [location.pathname, exploreFocusedPlaceId])

  // Explore Neighborhood amenities (nearby) -> map markers + distance lines.
  useEffect(() => {
    if (location.pathname !== '/explore-neighborhood') {
      setExplorePlaces([])
      setExploreLines(null)
      setExploreAmenityType(null)
      setExploreFocusedPlaceId(null)
      return
    }
    const sp = new URLSearchParams(location.search || '')
    const amenity = sp.get('amenity')
    setExploreAmenityType(amenity || null)
    const focusId = sp.get('focusId')
    setExploreFocusedPlaceId(focusId || null)
    const radiusKm = Number(sp.get('radiusKm') || 2)
    const radiusM = Number.isFinite(radiusKm) ? Math.max(100, Math.min(50000, Math.round(radiusKm * 1000))) : 2000
    const centerLat = Number(sp.get('centerLat'))
    const centerLon = Number(sp.get('centerLon'))
    const center =
      Number.isFinite(centerLat) && Number.isFinite(centerLon) ? { lat: centerLat, lon: centerLon } : masjidSearchOrigin
    if (!center || !amenity) {
      setExplorePlaces([])
      setExploreLines(null)
      return
    }
    let cancelled = false
    fetchNearbyAmenities(center, { radiusM, type: amenity })
      .then((rows) => {
        if (cancelled) return
        const list = Array.isArray(rows) ? rows : []
        setExplorePlaces(list)
        // Do not draw center→all-points lines in Explore (keeps the map clean).
        setExploreLines(null)
      })
      .catch(() => {
        if (!cancelled) {
          setExplorePlaces([])
          setExploreLines(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [location.pathname, location.search, masjidSearchOrigin?.lat, masjidSearchOrigin?.lon])

  /** Keep map/search labels aligned with GPS when in user mode (Near me === Use current location). */
  useEffect(() => {
    if (activeWidget !== 'masjid' || masjidFromPlacePick || !coords) return
    setMasjidCenter((prev) => {
      if (prev && prev.lat === coords.lat && prev.lon === coords.lon) return prev
      return coords
    })
  }, [activeWidget, masjidFromPlacePick, coords?.lat, coords?.lon])

  useEffect(() => {
    if (!selectedMasjid) {
      setSelectedMasjidDetails(null)
      return
    }
    const pid = selectedMasjid?.tags?.placeId || selectedMasjid?.id?.replace(/^ola\//, '')
    if (!pid) {
      setSelectedMasjidDetails(null)
      return
    }
    let cancelled = false
    fetchPlaceDetails(pid)
      .then(async (d) => {
        if (cancelled) return
        if (d && (d.name || d.formatted_address)) {
          setSelectedMasjidDetails(d)
          return
        }
        try {
          const adv = await fetchAdvancedPlaceDetails(pid)
          if (!cancelled) setSelectedMasjidDetails(adv || d || null)
        } catch {
          if (!cancelled) setSelectedMasjidDetails(d || null)
        }
      })
      .catch(() => {
        if (!cancelled) setSelectedMasjidDetails(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedMasjid?.id])

  const resolvedLocationLabel = useMemo(() => {
    if (locationLabel && locationLabel !== '—') return locationLabel
    if (coords) return `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`
    return '—'
  }, [locationLabel, coords?.lat, coords?.lon])

  /** Map chip + top Location on Masjid tab: prefer the place the user searched until they move the map. */
  const masjidMapAreaLabelRaw = useMemo(() => {
    if (masjidResultsContextLabel && masjidResultsContextLabel !== '—') return masjidResultsContextLabel
    if (masjidCenterLabel && masjidCenterLabel !== '—') return masjidCenterLabel
    return '—'
  }, [masjidResultsContextLabel, masjidCenterLabel])

  const displayLocationLabel = useMemo(() => {
    if (activeWidget === 'masjid' || activeWidget === 'explore') {
      if (masjidMapAreaLabelRaw && masjidMapAreaLabelRaw !== '—') {
        return shortenLocationLabel(masjidMapAreaLabelRaw)
      }
      if (masjidCenter) return `${masjidCenter.lat.toFixed(5)}, ${masjidCenter.lon.toFixed(5)}`
    }
    return shortenLocationLabel(resolvedLocationLabel)
  }, [activeWidget, masjidMapAreaLabelRaw, masjidCenter?.lat, masjidCenter?.lon, resolvedLocationLabel])

  const pagedMasjidResults = useMemo(() => {
    const start = (masjidPage - 1) * MASJID_PAGE_SIZE
    return masjidResults.slice(start, start + MASJID_PAGE_SIZE)
  }, [masjidResults, masjidPage])

  useEffect(() => {
    if (activeWidget !== 'masjid') {
      setDrivingLegByMasjidId({})
      return
    }
    const origin = routeOrigin || masjidSearchOrigin
    if (!origin) {
      setDrivingLegByMasjidId({})
      return
    }
    const start = (masjidPage - 1) * MASJID_PAGE_SIZE
    const pageRows = masjidResults.slice(start, start + MASJID_PAGE_SIZE)
    const dests = pageRows.filter((m) => Number.isFinite(m?.lat) && Number.isFinite(m?.lon))
    if (dests.length === 0) {
      setDrivingLegByMasjidId({})
      return
    }
    let cancelled = false
    fetchDrivingLegsFromDirections(origin, dests, { concurrency: 2, basic: false, mode: routeMode }).then((idxMap) => {
      if (cancelled) return
      const next = {}
      dests.forEach((m, i) => {
        const leg = idxMap.get(i)
        if (!leg) return
        const dm = meaningfulRoadDistanceMeters(leg.distanceMeters)
        if (dm != null || leg.durationSeconds != null) {
          next[m.id] = dm != null ? { ...leg, distanceMeters: dm } : leg
        }
      })
      setDrivingLegByMasjidId(next)
    })
    return () => {
      cancelled = true
    }
  }, [activeWidget, masjidSearchOrigin?.lat, masjidSearchOrigin?.lon, routeOrigin?.lat, routeOrigin?.lon, routeMode, masjidPage, masjidResults])

  const masjidResultsSubtitle = useMemo(() => {
    const n = masjidResults.length
    const radius = `${masjidRadiusKm} km`
    const head = `${n} result${n === 1 ? '' : 's'}`
    if (!masjidFromPlacePick && coords) {
      const place =
        locationLabel && locationLabel !== '—'
          ? shortenLocationLabel(locationLabel)
          : 'your current location'
      return `${head} near ${place} (within ${radius})`
    }
    if (masjidResultsContextLabel && masjidResultsContextLabel !== '—') {
      const place = shortenLocationLabel(masjidResultsContextLabel)
      return `${head} in and around ${place} (within ${radius})`
    }
    return `${head} in and around this area (within ${radius})`
  }, [masjidResults.length, masjidFromPlacePick, coords?.lat, coords?.lon, locationLabel, masjidResultsContextLabel, masjidRadiusKm])

  const exploreSubtitle = useMemo(() => {
    const n = Array.isArray(explorePlaces) ? explorePlaces.length : 0
    const label = exploreAmenityType ? String(exploreAmenityType).replace(/_/g, ' ') : 'places'
    return `${n} ${label} found nearby`
  }, [explorePlaces, exploreAmenityType])

  const selectedMasjidImage = useMemo(
    () => getDetailsPhotoUrl(selectedMasjidDetails),
    [selectedMasjidDetails]
  )
  const selectedDisplayName = useMemo(() => {
    const fromList = String(selectedMasjid?.name || '').trim()
    const fromDetails = String(
      selectedMasjidDetails?.name ||
        selectedMasjidDetails?.display_name ||
        selectedMasjidDetails?.title ||
        ''
    ).trim()
    return fromList || fromDetails || 'Masjid'
  }, [selectedMasjid, selectedMasjidDetails])
  const selectedDisplayAddress = useMemo(
    () =>
      String(
        colonyLabelFromTags(selectedMasjid) ||
        selectedMasjid?.address ||
        selectedMasjidDetails?.formatted_address ||
        selectedMasjidDetails?.address ||
        selectedMasjidDetails?.vicinity ||
        ''
      ).trim() || 'Address unavailable',
    [selectedMasjid, selectedMasjidDetails]
  )

  useEffect(() => {
    if (!coords) return
    if (locationMode === 'auto') {
      reverseGeocode(coords.lat, coords.lon).then((label) => {
        if (label) setLocationLabel(label)
      })
    }
  }, [coords?.lat, coords?.lon, locationMode])

  // On first load, try to use the browser's current location once.
  useEffect(() => {
    handleUseCurrentLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleResolvedLocation = ({ coords: loc, label }) => {
    if (!loc) return
    setCoords(loc)
    setLocationLabel(label || '—')
    setLocationMode('manual')
    startTransition(() => {
      setWeatherPromise(fetchWeatherByCoords(loc.lat, loc.lon))
      setPrayerPromise(fetchPrayerTimesByCoords(loc.lat, loc.lon))
    })

    if (activeWidget === 'masjid' || smartIntent === 'masjid') {
      setActiveWidget('masjid')
      setMasjidFromPlacePick(true)
      masjidSubtitleFollowsGeocodeRef.current = false
      setMasjidCenter(loc)
      const resolved = label || '—'
      setMasjidCenterLabel(resolved)
      setMasjidResultsContextLabel(resolved)
      const rk = smartMasjidFilters.radiusKm
      if (rk != null && Number.isFinite(rk)) setMasjidRadiusKm(clampMasjidRadiusKm(rk))
    }
  }

  const handleLocationFromMap = async (loc) => {
    setCoords(loc)
    setWeatherPromise(fetchWeatherByCoords(loc.lat, loc.lon))
    setPrayerPromise(fetchPrayerTimesByCoords(loc.lat, loc.lon))
    setLocationMode('manual')
    setShowMapPicker(false)
    clearMapPickerQueryParam()
    const label = await reverseGeocode(loc.lat, loc.lon)
    setLocationLabel(label || `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`)
  }

  const handleUseCurrentLocation = () => {
    getCurrentPosition()
      .then(({ coords: c }) => {
        const loc = { lat: c.latitude, lon: c.longitude }
        setCoords(loc)
        setWeatherPromise(fetchWeatherByCoords(loc.lat, loc.lon))
        setPrayerPromise(fetchPrayerTimesByCoords(loc.lat, loc.lon))
        setLocationMode('auto')
        reverseGeocode(loc.lat, loc.lon).then((label) =>
          setLocationLabel(label || `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`)
        )
      })
      .catch(() => setLocationLabel('Location denied'))
  }

  const resolveMasjidCenterLabel = async (loc, { syncResultsSubtitle = false } = {}) => {
    if (!loc) return
    const label = await reverseGeocode(loc.lat, loc.lon).catch(() => null)
    const resolved = label || `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`
    setMasjidCenterLabel(resolved)
    if (syncResultsSubtitle) setMasjidResultsContextLabel(resolved)
  }

  const handleMasjidUseCurrent = () => {
    masjidSubtitleFollowsGeocodeRef.current = false
    if (coords) {
      setMasjidCenter(coords)
      const lbl =
        locationLabel && locationLabel !== '—'
          ? locationLabel
          : `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`
      setMasjidCenterLabel(lbl)
      setMasjidResultsContextLabel(lbl)
      return
    }
    getCurrentPosition()
      .then(async ({ coords: c }) => {
        const loc = { lat: c.latitude, lon: c.longitude }
        setMasjidCenter(loc)
        await resolveMasjidCenterLabel(loc, { syncResultsSubtitle: true })
      })
      .catch(() => {
        setMasjidCenterLabel('Location denied')
        setMasjidResultsContextLabel('Location denied')
      })
  }

  const handleMasjidLocationFromMap = async (loc) => {
    setMasjidFromPlacePick(true)
    masjidSubtitleFollowsGeocodeRef.current = false
    setMasjidCenter(loc)
    setSelectedMasjidId(null)
    setShowMapPicker(false)
    clearMapPickerQueryParam()
    await resolveMasjidCenterLabel(loc, { syncResultsSubtitle: true })
  }

  const handleSelectMasjidFromMap = useCallback((m) => {
    const id = m?.id ?? null
    setSelectedMasjidId(id)
    if (id == null) return
    const idx = masjidResults.findIndex((x) => x?.id === id)
    if (idx >= 0) setMasjidPage(Math.floor(idx / MASJID_PAGE_SIZE) + 1)
  }, [masjidResults])

  // Route-based selection: /weather | /explore-neighborhood | /find-masjids
  useEffect(() => {
    const path = location.pathname
    if (path === '/weather') {
      setActiveWidget('weather')
      setSmartIntent('weather')
      setShowPrayersInMasjidTab(false)
      return
    }

    if (path === '/explore-neighborhood') {
      setActiveWidget('explore')
      setSmartIntent('masjid')
      setShowPrayersInMasjidTab(false)
      setSmartMasjidFilters({ radiusKm: null, nearMe: false, locationText: null })
      setMasjidFromPlacePick(false) // use GPS coords as center
      return
    }

    if (path === '/directions') {
      setActiveWidget('directions')
      setSmartIntent('masjid')
      setShowPrayersInMasjidTab(false)
      setSmartMasjidFilters({ radiusKm: null, nearMe: false, locationText: null })
      setMasjidFromPlacePick(false)
      return
    }

    if (path === '/find-masjids') {
      setActiveWidget('masjid')
      setSmartIntent('masjid')
      setShowPrayersInMasjidTab(true)
      setFindMasjidTab('masjids')
      setSmartMasjidFilters({ radiusKm: null, nearMe: false, locationText: null })
      setMasjidFromPlacePick(false) // use GPS coords as center
      return
    }
  }, [location.pathname])

  // Open the map picker when `mapPicker=1` is present.
  useEffect(() => {
    const sp = new URLSearchParams(location.search || '')
    const mapPicker = sp.get('mapPicker')
    if (mapPicker === '1') {
      setShowMapPicker(true)
      setActiveWidget('masjid')
      setShowPrayersInMasjidTab((prev) => prev) // keep current tab merge intent
    }
  }, [location.search])

  useEffect(() => {
    if (activeWidget !== 'masjid' || !masjidCenter) return
    if (masjidLabelResolveTimer.current) clearTimeout(masjidLabelResolveTimer.current)
    masjidLabelResolveTimer.current = setTimeout(async () => {
      const label = await reverseGeocode(masjidCenter.lat, masjidCenter.lon).catch(() => null)
      const resolved = label || `${masjidCenter.lat.toFixed(4)}, ${masjidCenter.lon.toFixed(4)}`
      setMasjidCenterLabel(resolved)
      if (masjidSubtitleFollowsGeocodeRef.current) {
        setMasjidResultsContextLabel(resolved)
      }
    }, 650)
    return () => {
      if (masjidLabelResolveTimer.current) clearTimeout(masjidLabelResolveTimer.current)
    }
  }, [activeWidget, masjidCenter?.lat, masjidCenter?.lon])

  // SmartSearchBar filter wiring removed (using ola-map style search + Find Masjid tools panel).

  // Search masjids from masjidSearchOrigin (Find Masjids only).
  useEffect(() => {
    if (location.pathname !== '/find-masjids') return
    const center = masjidSearchOrigin
    if (!center) return
    let cancelled = false
  setMasjidSearching(true)
    setMasjidError(null)
    const query = `masjid within ${masjidRadiusKm}km`
    const radiusM = masjidRadiusKm * 1000
    searchMasjids(query, { lastNearCenter: center, radiusKm: masjidRadiusKm })
      .then(({ masjids }) => {
        if (cancelled) return
        const raw = Array.isArray(masjids) ? masjids : []
        const list = raw.filter((m) => {
          if (!Number.isFinite(m?.lat) || !Number.isFinite(m?.lon)) return false
          if (!Number.isFinite(m.distance)) return false
          return m.distance <= radiusM
        })
        const selectedStillExists = selectedMasjidId && list.some((m) => m.id === selectedMasjidId)
        setMasjidResults(list)
        if (!selectedStillExists) setSelectedMasjidId(null)
        setMasjidPage(1)
        setMasjidHasLoaded(true)
      })
      .catch((err) => {
        if (cancelled) return
        const msg = String(err?.message || '')
        if (msg.includes('429')) {
          setMasjidError('Rate limit reached (429). Please wait a few seconds and try again.')
        } else {
          setMasjidError(msg || 'Masjid search failed')
        }
        setMasjidHasLoaded(true)
        // Keep old results visible if we have them; just show error.
      })
      .finally(() => {
        if (!cancelled) setMasjidSearching(false)
      })
    return () => {
      cancelled = true
    }
  }, [location.pathname, masjidSearchOrigin?.lat, masjidSearchOrigin?.lon, masjidRadiusKm])

  useEffect(() => {
    if (activeWidget !== 'masjid') return
    const center = masjidSearchOrigin
    if (!center) return
    if (masjidCenterLabel === '—') {
      resolveMasjidCenterLabel(center, { syncResultsSubtitle: masjidResultsContextLabel === '—' })
    }
  }, [
    activeWidget,
    masjidSearchOrigin?.lat,
    masjidSearchOrigin?.lon,
    masjidCenterLabel,
    masjidResultsContextLabel,
  ])

  const formatRouteDistance = (meters) => {
    const m = Number(meters)
    if (!Number.isFinite(m) || m <= 0) return '—'
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
  }

  const formatRouteDuration = (seconds) => {
    const s = Number(seconds)
    if (!Number.isFinite(s) || s <= 0) return '—'
    const hrs = Math.floor(s / 3600)
    const mins = Math.max(1, Math.round((s % 3600) / 60))
    return hrs > 0 ? `${hrs} hr ${mins} min` : `${mins} min`
  }

  const normalizeReadableDistance = (raw, metersFallback = null) => {
    const s = String(raw || '').trim()
    if (!s) return metersFallback != null ? formatRouteDistance(metersFallback) : null
    // If Ola returns "5.48" without units, treat as km (matches their UI outputs).
    if (/^\d+(\.\d+)?$/.test(s)) return `${s} km`
    return s
  }

  const normalizeReadableDuration = (raw, secondsFallback = null) => {
    const s = String(raw || '').trim()
    const base = s || (secondsFallback != null ? formatRouteDuration(secondsFallback) : '')
    if (!base) return null
    // Compact "0 hours 13 minutes" -> "13 min"
    const m = base.match(/(\d+)\s*hour[s]?\s*(\d+)\s*minute[s]?/i)
    if (m) {
      const h = Number(m[1])
      const min = Number(m[2])
      if (h <= 0) return `${min} min`
      return `${h} hr ${min} min`
    }
    return base
  }

  const routeStepInstruction = (step) =>
    String(step?.instructions || step?.instruction || step?.html_instructions || 'Continue')
      .replace(/<[^>]*>/g, '')
      .trim()

  const routeStops = useMemo(() => {
    const sp = new URLSearchParams(location.search || '')
    if ((sp.get('routeKind') || 'directions') !== 'optimizer') return []
    const encoded = sp.get('optStops') || ''
    if (!encoded) return []
    const isRoundTrip = sp.get('optRoundTrip') === '1'
    const labelsEncoded = sp.get('optStopLabels') || sp.get('optDraftLabels') || ''
    const labels = labelsEncoded
      ? String(labelsEncoded)
        .split('|')
        .map((x) => {
          try { return decodeURIComponent(x) } catch { return String(x) }
        })
      : []
    const rows = encoded
      .split('|')
      .map((x, idx) => {
        const [latRaw, lonRaw] = String(x).split(',')
        const lat = Number(latRaw)
        const lon = Number(lonRaw)
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
        return { id: `stop-${idx + 1}`, lat, lon, idx }
      })
      .filter(Boolean)
    const base = rows.map((s, i) => {
      const isStart = i === 0
      const isEnd = i === rows.length - 1
      let label = (labels[i] && String(labels[i]).trim()) || `Stop ${Math.max(1, i)}`
      if (isStart) label = 'Start'
      else if (isEnd) label = 'End'
      return { ...s, label }
    })
    if (isRoundTrip && base.length >= 2) {
      const first = base[0]
      // Append return-to-start point so segments + markers match round-trip path.
      return [...base, { ...first, id: 'stop-return', label: 'Return' }]
    }
    return base
  }, [location.search])

  const activeRouteLine = useMemo(() => {
    if (activeRouteSegmentIdx == null) return null

    // Prefer slicing the full polyline by nearest stop points (works even when legs have no geometry).
    const full = routeLine?.geometry?.coordinates
    if (Array.isArray(full) && full.length >= 2 && Array.isArray(routeStops) && routeStops.length >= 2) {
      const nearestIdx = (stop) => {
        let bestI = 0
        let bestD = Infinity
        for (let i = 0; i < full.length; i += 1) {
          const p = full[i]
          if (!Array.isArray(p) || p.length < 2) continue
          const lon = Number(p[0])
          const lat = Number(p[1])
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
          const d = haversineMeters(stop.lat, stop.lon, lat, lon)
          if (d < bestD) {
            bestD = d
            bestI = i
          }
        }
        return bestI
      }

      const stopIdxs = routeStops.map((s) => nearestIdx(s))
      // Ensure monotonic increasing indices (route polyline order).
      for (let i = 1; i < stopIdxs.length; i += 1) {
        if (stopIdxs[i] < stopIdxs[i - 1]) stopIdxs[i] = stopIdxs[i - 1]
      }
      const segStart = stopIdxs[activeRouteSegmentIdx]
      const segEnd = stopIdxs[activeRouteSegmentIdx + 1]
      if (Number.isFinite(segStart) && Number.isFinite(segEnd) && segEnd > segStart) {
        const sliced = full.slice(segStart, segEnd + 1)
        if (sliced.length >= 2) {
          return {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: sliced },
            properties: { segmentIdx: activeRouteSegmentIdx },
          }
        }
      }
    }

    // Fallback: leg coordinates if present.
    const legs = Array.isArray(routeSummary?.legs) ? routeSummary.legs : []
    const leg = legs[activeRouteSegmentIdx]
    const coords = Array.isArray(leg?.coordinates) ? leg.coordinates : null
    if (!coords?.length) return null
    return {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { segmentIdx: activeRouteSegmentIdx },
    }
  }, [activeRouteSegmentIdx, routeSummary?.legs, routeLine?.geometry?.coordinates, routeStops])

  return (
    <div className="flex flex-col gap-4"> 
      <div
        className={cn(
          'rounded-2xl p-4 w-full shadow-lg',
          'border border-(--surface-glass-border) bg-(--surface-glass) text-(--surface-glass-text) backdrop-blur-md',
          'max-w-7xl'
        )}
      >
        <div className="mb-3">
          <OlaSearchBar
            currentCenter={activeWidget === 'masjid' || activeWidget === 'explore' ? masjidSearchOrigin : coords}
            onResolvedLocation={handleResolvedLocation}
          />
        </div>

        {activeWidget === 'weather' ? (
          <div className="mb-3 flex items-center justify-end">
            <Button
              type="button"
              onClick={toggleTempUnit}
              variant="outline"
              className="bg-transparent"
            >
              Switch to °{tempUnit === 'C' ? 'F' : 'C'}
            </Button>
          </div>
        ) : null}

        {/* 2. Location display */}
        {activeWidget !== 'directions' && location.pathname !== '/find-masjids' ? (
          <div className="text-xs mb-3 space-y-0.5 text-(--surface-glass-muted)">
            <p className="whitespace-normal wrap-break-word">
              <span className="font-bold text-(--surface-glass-text)">Location:</span>
              <span className="ml-2">{displayLocationLabel}</span>
            </p>
            {(activeWidget === 'masjid' || activeWidget === 'explore' ? masjidSearchOrigin : coords) && (
              <p>
                <span className="font-bold">Latitude:</span>
                <span className="ml-2">{(activeWidget === 'masjid' || activeWidget === 'explore' ? masjidSearchOrigin.lat : coords.lat).toFixed(5)}</span>
                <span className="ml-4 font-bold">Longitude:</span>
                <span className="ml-2">{(activeWidget === 'masjid' || activeWidget === 'explore' ? masjidSearchOrigin.lon : coords.lon).toFixed(5)}</span>
              </p>
            )}
          </div>
        ) : null}

        {/* Main content */}
        {activeWidget === 'weather' ? (
          weatherPromise ? (
            <div className="text-left">
              <ErrorBoundary>
                <Suspense>
                  <WeatherCard
                    weatherPromise={weatherPromise}
                    onWeatherLoad={setTheme}
                    tempUnit={tempUnit}
                    formatTemp={formatTemp}
                  />
                </Suspense>
              </ErrorBoundary>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-(--surface-glass-muted)">
              Waiting for current location to load
            </div>
          )
        ) : activeWidget === 'explore' ? (
          <section className="w-full text-left" aria-label="Explore neighborhood">
            <div className="mx-auto w-full max-w-7xl">
              <div className="rounded-xl border border-border bg-card p-4 md:p-6 overflow-x-visible overflow-y-visible">
                <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Results</div>
                    <div className="text-sm font-medium text-foreground">{exploreSubtitle}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[420px_1fr]">
                  <div className="min-h-[320px]">
                    {explorePlaces.length === 0 ? (
                      <div className="rounded-xl border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                        Pick an amenity in the panel to explore nearby.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                        {explorePlaces.slice(0, 60).map((p) => (
                          <button
                            key={p.id}
                            id={`explore-place-${String(p.id)}`}
                            type="button"
                            onClick={() => {
                              const next = new URLSearchParams(location.search || '')
                              next.set('focusId', String(p.id))
                              // Like ola-map "Nearby → Directions": prefill destination from selected place.
                              // BUT: don't change destination while a route is active or when destination is already set,
                              // otherwise directions "jump" as the user clicks different list items.
                              const routeActive = next.get('route') === '1'
                              const hasTo = next.get('toLat') && next.get('toLon')
                              if (!routeActive && !hasTo && Number.isFinite(p?.lat) && Number.isFinite(p?.lon)) {
                                next.set('toLat', String(p.lat))
                                next.set('toLon', String(p.lon))
                                next.set('toLabel', String(p.name || 'Destination'))
                                next.delete('route')
                              }
                              navigate({ pathname: location.pathname, search: `?${next.toString()}` }, { replace: true })
                            }}
                            className={cn(
                              'w-full text-left rounded-xl border px-3 py-2 transition cursor-pointer',
                              exploreFocusedPlaceId && String(exploreFocusedPlaceId) === String(p.id)
                                ? 'border-primary bg-accent text-accent-foreground'
                                : 'border-border bg-card hover:bg-accent/40'
                            )}
                          >
                            <div className="text-sm font-semibold text-foreground whitespace-normal wrap-break-word leading-snug">
                              {p.name || 'Unknown'}
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-normal wrap-break-word leading-snug">
                              {bestPlaceAddress(p) || 'Address not available'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="min-h-0">
                    {(routeLoading || routeError) ? (
                      <div
                        className={cn(
                          'mb-2 rounded-lg border px-3 py-2 text-sm',
                          routeError
                            ? 'border-destructive/40 bg-destructive/10 text-destructive'
                            : 'border-border bg-muted/30 text-muted-foreground'
                        )}
                      >
                        {routeError ? routeError : 'Loading route…'}
                      </div>
                    ) : null}
                    <div className="h-[520px] max-h-[520px] w-full overflow-hidden rounded-xl border border-border bg-muted/30">
                      <MasjidMap
                        className="min-h-0 h-full max-h-full flex-none rounded-none border-0 shadow-none sm:min-h-0"
                        showErrorBanner={false}
                        masjids={[]}
                        searchCenter={masjidSearchOrigin}
                        searchCenterLabel={masjidMapAreaLabelRaw}
                        selectedMasjidId={null}
                        onSelectMasjid={null}
                        onSearchCenterChange={handleSearchCenterChange}
                        pickSearchCenter={mapPickMode}
                        routeLine={routeLine}
                        routeOrigin={routeOrigin}
                        routeDestination={routeDestination}
                        routeSummary={routeSummary}
                        extraPlaces={explorePlaces}
                        extraLines={exploreLines}
                        focusedExtraPlaceId={exploreFocusedPlaceId}
                        onSelectExtraPlace={(p) => {
                          const next = new URLSearchParams(location.search || '')
                          next.set('focusId', String(p.id))
                          // Prefill destination when clicking marker too (matches ola-map).
                          const routeActive = next.get('route') === '1'
                          const hasTo = next.get('toLat') && next.get('toLon')
                          if (!routeActive && !hasTo && Number.isFinite(p?.lat) && Number.isFinite(p?.lon)) {
                            next.set('toLat', String(p.lat))
                            next.set('toLon', String(p.lon))
                            next.set('toLabel', String(p.name || 'Destination'))
                            next.delete('route')
                          }
                          navigate({ pathname: location.pathname, search: `?${next.toString()}` }, { replace: true })
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : activeWidget === 'directions' ? (
          <section className="w-full text-left" aria-label="Directions map">
            <div className="mx-auto w-full max-w-7xl">
              <div className="rounded-xl border border-border bg-card p-4 md:p-6 overflow-x-visible overflow-y-visible">
                {routeLine?.geometry?.coordinates?.length ? (
                  <div className="mb-3 rounded-xl border border-border bg-card px-3 py-2 text-xs text-card-foreground shadow-sm">
                    {routeCompare.driving || routeCompare.walking ? (
                      <div className="mb-2 flex flex-wrap gap-2 items-center">
                        <button
                          type="button"
                          onClick={() => {
                            const next = new URLSearchParams(location.search || '')
                            next.set('mode', 'driving')
                            next.set('routeKind', 'directions')
                            next.set('route', '1')
                            next.set('routeTs', String(Date.now()))
                            navigate({ pathname: location.pathname, search: `?${next.toString()}` }, { replace: true })
                          }}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium transition',
                            routeMode === 'driving'
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-muted/30 text-foreground hover:bg-muted/50'
                          )}
                        >
                          Drive
                          <span className="font-normal opacity-90">
                            {routeCompare.driving?.readableDuration ?? (routeCompareLoading ? '…' : '—')}
                            {' · '}
                            {routeCompare.driving?.readableDistance ?? (routeCompareLoading ? '…' : '—')}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = new URLSearchParams(location.search || '')
                            next.set('mode', 'walking')
                            next.set('routeKind', 'directions')
                            next.set('route', '1')
                            next.set('routeTs', String(Date.now()))
                            navigate({ pathname: location.pathname, search: `?${next.toString()}` }, { replace: true })
                          }}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium transition',
                            routeMode === 'walking'
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-muted/30 text-foreground hover:bg-muted/50'
                          )}
                        >
                          Walk
                          <span className="font-normal opacity-90">
                            {routeCompare.walking?.readableDuration ?? (routeCompareLoading ? '…' : '—')}
                            {' · '}
                            {routeCompare.walking?.readableDistance ?? (routeCompareLoading ? '…' : '—')}
                          </span>
                        </button>
                      </div>
                    ) : null}
                    <div className="text-muted-foreground">From:</div>
                    <div className="font-medium text-foreground whitespace-normal wrap-break-word leading-snug">
                      {routeOrigin?.label || '—'}
                    </div>
                    {routeOrigin?.address ? (
                      <div className="text-[11px] text-muted-foreground whitespace-normal wrap-break-word leading-snug">
                        {routeOrigin.address}
                      </div>
                    ) : null}
                    <div className="mt-1 text-muted-foreground">To:</div>
                    <div className="font-medium text-foreground whitespace-normal wrap-break-word leading-snug">
                      {routeDestination?.label || '—'}
                    </div>
                    {routeDestination?.address ? (
                      <div className="text-[11px] text-muted-foreground whitespace-normal wrap-break-word leading-snug">
                        {routeDestination.address}
                      </div>
                    ) : null}
                    {Array.isArray(routeStops) && routeStops.length > 2 ? (
                      <div className="mt-2 text-[11px] text-foreground">
                        <span className="text-muted-foreground">Stops:</span>{' '}
                        {routeStops
                          .slice(1, -1)
                          .map((s) => s?.label)
                          .filter(Boolean)
                          .join(' → ') || '—'}
                      </div>
                    ) : null}
                    {Array.isArray(routeStops) && routeStops.length > 1 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveRouteSegmentIdx(null)}
                          className={[
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] transition',
                            activeRouteSegmentIdx == null
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-muted/30 text-foreground hover:bg-muted/50',
                          ].join(' ')}
                        >
                          All
                        </button>
                        {Array.from({ length: Math.max(0, routeStops.length - 1) }).map((_, i) => (
                          <button
                            key={`seg-${i}`}
                            type="button"
                            onClick={() => setActiveRouteSegmentIdx(i)}
                            className={[
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] transition',
                              activeRouteSegmentIdx === i
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-muted/30 text-foreground hover:bg-muted/50',
                            ].join(' ')}
                          >
                            Route {i + 1}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {(() => {
                      const legs = Array.isArray(routeSummary?.legs) ? routeSummary.legs : []
                      const activeLeg =
                        activeRouteSegmentIdx != null && legs[activeRouteSegmentIdx]
                          ? legs[activeRouteSegmentIdx]
                          : null
                      const dist = activeLeg?.readableDistance || routeSummary?.readableDistance || '—'
                      const dur = activeLeg?.readableDuration || routeSummary?.readableDuration || '—'
                      return (
                        <div className="mt-1 font-medium text-foreground">
                          Duration: {dur} · Distance: {dist}
                        </div>
                      )
                    })()}

                    {(() => {
                      const legs = Array.isArray(routeSummary?.legs) ? routeSummary.legs : []
                      const activeLeg =
                        activeRouteSegmentIdx != null && legs[activeRouteSegmentIdx]
                          ? legs[activeRouteSegmentIdx]
                          : null
                      const steps = activeLeg?.steps || routeSummary?.steps
                      if (!Array.isArray(steps) || steps.length === 0) return null
                      return (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setShowRouteSteps((v) => !v)}
                          className="text-xs font-medium text-primary hover:text-primary/80 cursor-pointer"
                        >
                          {showRouteSteps ? 'Hide steps' : 'Show steps'} ({steps.length})
                        </button>
                        {showRouteSteps ? (
                          <div className="mt-2 max-h-52 overflow-y-auto space-y-1.5">
                            {steps.map((s, idx) => (
                              <div key={`${idx}-${s.instruction}`} className="rounded-md border border-border/70 px-2 py-1.5">
                                <div className="text-foreground">{s.instruction || 'Continue'}</div>
                                {(s.distance || s.duration) ? (
                                  <div className="text-[11px] text-muted-foreground mt-0.5">
                                    {s.distance || '—'}{s.distance && s.duration ? ' · ' : ''}{s.duration || ''}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      )
                    })()}
                  </div>
                ) : null}
                {(routeLoading || routeError) ? (
                  <div
                    className={cn(
                      'mb-3 rounded-lg border px-3 py-2 text-sm',
                      routeError
                        ? 'border-destructive/40 bg-destructive/10 text-destructive'
                        : 'border-border bg-muted/30 text-muted-foreground'
                    )}
                  >
                    {routeError ? routeError : 'Loading route…'}
                  </div>
                ) : null}
                <div className="h-[560px] max-h-[70vh] w-full overflow-hidden rounded-xl border border-border bg-muted/30">
                  <MasjidMap
                    className="min-h-0 h-full max-h-full flex-none rounded-none border-0 shadow-none sm:min-h-0"
                    masjids={[]}
                    searchCenter={masjidSearchOrigin}
                    searchCenterLabel={masjidMapAreaLabelRaw}
                    selectedMasjidId={null}
                    onSelectMasjid={null}
                    onSearchCenterChange={handleSearchCenterChange}
                    pickSearchCenter={mapPickMode}
                    showSearchCenterMarker={false}
                    showUserLocationMarker={false}
                    routeLine={routeLine}
                    activeRouteLine={activeRouteLine}
                    routeOrigin={routeOrigin}
                    routeDestination={routeDestination}
                    routeSummary={routeSummary}
                    routeStops={routeStops}
                    routeStepPoints={routeSummary?.stepPoints || null}
                    showRouteStepMarkers={false}
                    extraPlaces={null}
                    extraLines={null}
                  />
                </div>
              </div>
            </div>
          </section>
        ) : activeWidget === 'masjid' ? (
          <>
            {location.pathname === '/find-masjids' && findMasjidTab === 'prayers' ? (
              prayerPromise ? (
                <ErrorBoundary>
                  <Suspense>
                    <PrayerTimesCard prayerPromise={prayerPromise} onUseCurrentLocation={handleUseCurrentLocation} />
                  </Suspense>
                </ErrorBoundary>
              ) : (
                <div className="py-8 text-center text-sm text-(--surface-glass-muted)">Waiting for current location to load</div>
              )
            ) : (
            <section className="w-full text-left" aria-label="Masjids">
            <div className="mx-auto w-full max-w-7xl">
              <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Results</div>
                  <div className="text-sm font-medium text-foreground whitespace-normal wrap-break-word leading-snug">
                    {masjidResultsSubtitle}
                  </div>
                </div>

                <div className="flex items-center gap-2 md:justify-end overflow-x-auto whitespace-nowrap flex-nowrap max-w-full">
                  {[
                    { key: 'list', label: 'List', Icon: List },
                    { key: 'grid', label: 'Grid', Icon: LayoutGrid },
                  ].map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setMasjidView(v.key)}
                      className={cn(
                        'inline-flex flex-none h-9 items-center gap-1.5 rounded-full border px-4 text-xs font-medium shadow-sm cursor-pointer transition',
                        masjidView === v.key
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      )}
                    >
                      {v.Icon && <v.Icon className="size-4" />}
                      <span>{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 md:p-6 overflow-x-visible overflow-y-visible">
                {masjidView === 'list' ? (
                  <div
                    className={cn(
                      'grid grid-cols-1 gap-3',
                      masjidResults.length > 0 && 'lg:grid-cols-[420px_1fr]'
                    )}
                  >
                    <div className="min-h-[320px]">
                      {masjidError && (
                        <div className="mb-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                          {masjidError}
                        </div>
                      )}
                      {masjidSearching && masjidResults.length > 0 && (
                        <div className="mb-2 text-xs text-muted-foreground">(updating)</div>
                      )}

                      {masjidSearching && masjidResults.length === 0 ? (
                        <div className="rounded-xl border border-border bg-muted/30 px-3 py-6">
                          <LoadingSpinner label="Loading masjids" tone="muted" />
                        </div>
                      ) : masjidHasLoaded && masjidResults.length === 0 && !masjidError ? (
                        <div className="rounded-xl border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                          No masjids found for this area.
                        </div>
                      ) : masjidResults.length > 0 ? (
                        <div className="max-h-[520px] overflow-y-auto pr-1 space-y-2">
                          {pagedMasjidResults.map((m) => (
                            <MasjidResultCard
                              key={m.id}
                              masjid={{
                                ...m,
                                address: colonyLabelFromTags(m) || m.address,
                                drivingLeg: drivingLegByMasjidId[m.id] ?? null,
                              }}
                              selected={selectedMasjidId === m.id}
                              mode={masjidView}
                              imageUrl={null}
                              onClick={() => setSelectedMasjidId(m.id)}
                            />
                          ))}
                        </div>
                      ) : null}

                      {masjidResults.length > 0 && (
                        <Pagination
                          currentPage={masjidPage}
                          totalItems={masjidResults.length}
                          pageSize={MASJID_PAGE_SIZE}
                          onPrevious={() => setMasjidPage((p) => Math.max(1, p - 1))}
                          onNext={() => setMasjidPage((p) => p + 1)}
                          className="mt-3"
                          buttonClass="px-3 py-1.5 rounded-lg border border-border bg-secondary text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      )}
                    </div>

                    <div className="h-[520px] max-h-[520px] w-full overflow-hidden rounded-xl border border-border bg-muted/30">
                      <MasjidMap
                        className="min-h-0 h-full max-h-full flex-none rounded-none border-0 shadow-none sm:min-h-0"
                        masjids={masjidResults}
                        searchCenter={masjidSearchOrigin}
                        searchCenterLabel={masjidMapAreaLabelRaw}
                        selectedMasjidId={selectedMasjidId}
                        onSelectMasjid={handleSelectMasjidFromMap}
                        onSearchCenterChange={handleSearchCenterChange}
                        pickSearchCenter={mapPickMode}
                        routeLine={routeLine}
                        routeOrigin={routeOrigin}
                        routeDestination={routeDestination}
                        routeSummary={routeSummary}
                        extraPlaces={location.pathname === '/explore-neighborhood' ? explorePlaces : null}
                        extraLines={location.pathname === '/explore-neighborhood' ? exploreLines : null}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="min-h-[320px]">
                      {masjidError && (
                        <div className="mb-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                          {masjidError}
                        </div>
                      )}
                      {masjidSearching && masjidResults.length > 0 && (
                        <div className="mb-2 text-xs text-muted-foreground">(updating)</div>
                      )}

                      {masjidSearching && masjidResults.length === 0 ? (
                        <div className="rounded-xl border border-border bg-muted/30 px-3 py-6">
                          <LoadingSpinner label="Loading masjids" tone="muted" />
                        </div>
                      ) : masjidHasLoaded && masjidResults.length === 0 && !masjidError ? (
                        <div className="rounded-xl border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                          No masjids found for this area.
                        </div>
                      ) : masjidResults.length > 0 ? (
                        <div
                          className={cn(
                            'w-full',
                            masjidView === 'grid' && 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
                          )}
                        >
                          {pagedMasjidResults.map((m) => (
                            <MasjidResultCard
                              key={m.id}
                              masjid={{
                                ...m,
                                address: colonyLabelFromTags(m) || m.address,
                                drivingLeg: drivingLegByMasjidId[m.id] ?? null,
                              }}
                              selected={selectedMasjidId === m.id}
                              mode={masjidView}
                              imageUrl={selectedMasjidId === m.id && masjidView === 'grid' ? selectedMasjidImage : null}
                              onClick={() => setSelectedMasjidId(m.id)}
                            />
                          ))}
                        </div>
                      ) : null}

                      {masjidResults.length > 0 && (
                        <Pagination
                          currentPage={masjidPage}
                          totalItems={masjidResults.length}
                          pageSize={MASJID_PAGE_SIZE}
                          onPrevious={() => setMasjidPage((p) => Math.max(1, p - 1))}
                          onNext={() => setMasjidPage((p) => p + 1)}
                          className="mt-3"
                          buttonClass="px-3 py-1.5 rounded-lg border border-border bg-secondary text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      )}
                    </div>

                    <div className="mt-3 h-[520px] max-h-[520px] w-full overflow-hidden rounded-xl border border-border bg-muted/30">
                      <MasjidMap
                        className="min-h-0 h-full max-h-full flex-none rounded-none border-0 shadow-none sm:min-h-0"
                        masjids={masjidResults}
                        searchCenter={masjidSearchOrigin}
                        searchCenterLabel={masjidMapAreaLabelRaw}
                        selectedMasjidId={selectedMasjidId}
                        onSelectMasjid={handleSelectMasjidFromMap}
                        onSearchCenterChange={handleSearchCenterChange}
                        pickSearchCenter={mapPickMode}
                        routeLine={routeLine}
                        routeOrigin={routeOrigin}
                        routeDestination={routeDestination}
                        routeSummary={routeSummary}
                        extraPlaces={location.pathname === '/explore-neighborhood' ? explorePlaces : null}
                        extraLines={location.pathname === '/explore-neighborhood' ? exploreLines : null}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
            </section>
            )}

          </>
        ) : null}

      </div>

      {showMapPicker && (
        <LocationMapPicker
          initialCenter={activeWidget === 'masjid' || activeWidget === 'explore' ? (masjidSearchOrigin || coords) : coords}
          onSelectLocation={activeWidget === 'masjid' || activeWidget === 'explore' ? handleMasjidLocationFromMap : handleLocationFromMap}
          onCancel={() => {
            setShowMapPicker(false)
            clearMapPickerQueryParam()
          }}
        />
      )}
    </div>
  )
}

export default HomePage
