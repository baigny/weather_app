import { Suspense, useMemo, useState, useEffect, useTransition, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { List, LayoutGrid, IdCard } from 'lucide-react'
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
import '../App.css'
import { formatDistanceMeters, meaningfulRoadDistanceMeters } from '../services/geo'
import { clampMasjidRadiusKm, searchMasjids } from '../services/masjidSearchService'
import { buildPlacePhotoUrl, fetchAdvancedPlaceDetails, fetchPlaceDetails } from '../services/olaPlacesAPI'
import { decodePolyline, fetchDirections, fetchDrivingLegsFromDirections } from '../services/olaRoutingAPI'
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
    'w-full text-left rounded-xl border shadow-sm transition',
    selected ? 'border-amber-400 bg-amber-50' : 'border-amber-200 bg-white hover:bg-amber-50/60'
  )
  const inner = (
    <>
      {mode === 'card' && imageUrl ? (
        <img src={imageUrl} alt={name} className="h-28 w-full rounded-t-xl object-cover" loading="lazy" />
      ) : null}
      <div className={cn('p-3', mode === 'card' && 'p-4')}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 whitespace-normal wrap-break-word leading-snug">{name}</div>
            <div className="mt-0.5 text-xs text-slate-600 whitespace-normal wrap-break-word leading-snug">{address}</div>
            {hasDriveRow && (
              <div className="mt-1.5 text-xs text-slate-600">
                <span className="font-medium text-slate-800">Drive (Ola Maps):</span>{' '}
                {driveDistLabel ?? '—'}
                {durationMin != null && <span> · {durationMin} min</span>}
              </div>
            )}
          </div>
          {(badgeLabel != null || (hasDuration && !badgeLabel)) && (
            <div className="shrink-0 text-right max-w-[42%] sm:max-w-none">
              {badgeLabel != null && (
                <>
                  <div className="text-xs font-semibold text-slate-800 whitespace-nowrap">{badgeLabel}</div>
                  {badgeSub != null && (
                    <div className="text-[10px] font-normal text-slate-500 mt-0.5">{badgeSub}</div>
                  )}
                </>
              )}
              {badgeLabel == null && hasDuration && (
                <div className="text-xs font-semibold text-slate-800 whitespace-nowrap">
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
  // Use a fixed amber gradient that matches the prayer card theme.
  // WeatherCard still computes its own theme internally via getWeatherTheme.
  const bg = 'from-amber-200 to-amber-400'

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
  const [explorePlaces, setExplorePlaces] = useState([])
  const [exploreAmenityType, setExploreAmenityType] = useState(null)
  const [exploreLines, setExploreLines] = useState(null) // FeatureCollection
  const [exploreFocusedPlaceId, setExploreFocusedPlaceId] = useState(null)
  const [findMasjidTab, setFindMasjidTab] = useState('masjids') // masjids | prayers

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
    if (Number.isFinite(fromLat) && Number.isFinite(fromLon) && (fromLat !== 0 || fromLon !== 0)) {
      setRouteOrigin({ lat: fromLat, lon: fromLon, label: fromLabel })
    }
    else setRouteOrigin(null)

    const toLatRaw = sp.get('toLat')
    const toLonRaw = sp.get('toLon')
    const toLat = toLatRaw == null || toLatRaw === '' ? null : Number(toLatRaw)
    const toLon = toLonRaw == null || toLonRaw === '' ? null : Number(toLonRaw)
    const toLabel = sp.get('toLabel') || null
    if (Number.isFinite(toLat) && Number.isFinite(toLon) && (toLat !== 0 || toLon !== 0)) {
      setRouteDestination({ lat: toLat, lon: toLon, label: toLabel })
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
      setRouteLoading(false)
      setRouteError(null)
      return
    }
    let cancelled = false
    setRouteLoading(true)
    setRouteError(null)
    fetchDirections(
      { lat: routeOrigin.lat, lon: routeOrigin.lon },
      { lat: routeDestination.lat, lon: routeDestination.lon },
      null,
      'full',
      { mode: routeMode }
    )
      .then((res) => {
        if (cancelled) return
        const coords =
          Array.isArray(res?.coordinates) && res.coordinates.length
            ? res.coordinates
            : res?.polyline
              ? decodePolyline(res.polyline)
              : []
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
        setRouteSummary({
          distanceMeters: res?.distanceMeters ?? null,
          durationSeconds: res?.durationSeconds ?? null,
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

  const isWeatherRoute = location.pathname === '/weather'
  const isMasjidRoute = location.pathname === '/explore-neighborhood' || location.pathname === '/find-masjids'

  return (
    <div
      className={cn(
        `min-h-screen flex flex-col bg-linear-to-br ${bg} p-4 transition-all duration-700 overflow-x-hidden`,
        isWeatherRoute ? 'items-stretch justify-start' : 'items-center justify-center'
      )}
    >
      <div className={cn('bg-black/20 backdrop-blur-md rounded-2xl p-4 text-white w-full shadow-lg border border-white/15', 'max-w-7xl')}>
        <div className="mb-3">
          <OlaSearchBar
            currentCenter={activeWidget === 'masjid' || activeWidget === 'explore' ? masjidSearchOrigin : coords}
            onResolvedLocation={handleResolvedLocation}
          />
        </div>

        {activeWidget === 'weather' ? (
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              onClick={toggleTempUnit}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition cursor-pointer text-sm font-medium"
            >
              Switch to °{tempUnit === 'C' ? 'F' : 'C'}
            </button>
          </div>
        ) : null}

        {/* 2. Location display */}
        <div className="text-xs text-white/95 mb-3 space-y-0.5">
          <p className="whitespace-normal wrap-break-word">
            <span className="font-bold text-white">Location:</span>
            <span className="ml-2 text-white/90">{displayLocationLabel}</span>
          </p>
          {(activeWidget === 'masjid' || activeWidget === 'explore' ? masjidSearchOrigin : coords) && (
            <p className="text-white/90">
              <span className="font-bold">Latitude:</span>
              <span className="ml-2">{(activeWidget === 'masjid' || activeWidget === 'explore' ? masjidSearchOrigin.lat : coords.lat).toFixed(5)}</span>
              <span className="ml-4 font-bold">Longitude:</span>
              <span className="ml-2">{(activeWidget === 'masjid' || activeWidget === 'explore' ? masjidSearchOrigin.lon : coords.lon).toFixed(5)}</span>
            </p>
          )}
        </div>

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
            <div className="py-8 text-center text-sm text-white/80">
              Waiting for current location to load
            </div>
          )
        ) : activeWidget === 'explore' ? (
          <section className="w-full text-left" aria-label="Explore neighborhood">
            <div className="mx-auto w-full max-w-7xl">
              <div className="rounded-xl border border-amber-300/80 bg-white p-4 md:p-6 overflow-x-visible overflow-y-visible">
                <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-amber-900/70">Results</div>
                    <div className="text-sm font-medium text-slate-900">{exploreSubtitle}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[420px_1fr]">
                  <div className="min-h-[320px]">
                    {explorePlaces.length === 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-4 text-sm text-amber-900/80">
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
                                ? 'border-amber-400 bg-amber-100'
                                : 'border-amber-200/70 bg-amber-50 hover:bg-amber-100/60'
                            )}
                          >
                            <div className="text-sm font-semibold text-amber-950 whitespace-normal wrap-break-word leading-snug">
                              {p.name || 'Unknown'}
                            </div>
                            <div className="text-xs text-amber-900/70 whitespace-normal wrap-break-word leading-snug">
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
                          routeError ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-900/80'
                        )}
                      >
                        {routeError ? routeError : 'Loading route…'}
                      </div>
                    ) : null}
                    <div className="h-[520px] max-h-[520px] w-full overflow-hidden rounded-xl border border-amber-200/80 bg-slate-100/40">
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
              <div className="rounded-xl border border-amber-300/80 bg-white p-4 md:p-6 overflow-x-visible overflow-y-visible">
                {(routeLoading || routeError) ? (
                  <div
                    className={cn(
                      'mb-3 rounded-lg border px-3 py-2 text-sm',
                      routeError ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-900/80'
                    )}
                  >
                    {routeError ? routeError : 'Loading route…'}
                  </div>
                ) : null}
                <div className="h-[560px] max-h-[70vh] w-full overflow-hidden rounded-xl border border-amber-200/80 bg-slate-100/40">
                  <MasjidMap
                    className="min-h-0 h-full max-h-full flex-none rounded-none border-0 shadow-none sm:min-h-0"
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
                    extraPlaces={null}
                    extraLines={null}
                  />
                </div>
              </div>
            </div>
          </section>
        ) : activeWidget === 'masjid' ? (
          <>
            {location.pathname === '/find-masjids' ? (
              <div className="mb-3 inline-flex overflow-hidden rounded-full border border-white/15 bg-white/10 text-sm font-medium text-white/90">
                <button
                  type="button"
                  onClick={() => setFindMasjidTab('masjids')}
                  className={cn(
                    'flex h-9 items-center gap-1.5 px-4 transition cursor-pointer',
                    findMasjidTab === 'masjids' ? 'bg-black/30 text-white shadow-sm' : 'bg-transparent hover:bg-black/20'
                  )}
                >
                  Masjids
                </button>
                <button
                  type="button"
                  onClick={() => setFindMasjidTab('prayers')}
                  className={cn(
                    'flex h-9 items-center gap-1.5 px-4 border-l border-white/15 transition cursor-pointer',
                    findMasjidTab === 'prayers' ? 'bg-black/30 text-white shadow-sm' : 'bg-transparent hover:bg-black/20'
                  )}
                >
                  Prayer Times
                </button>
              </div>
            ) : null}

            {location.pathname === '/find-masjids' && findMasjidTab === 'prayers' ? (
              prayerPromise ? (
                <ErrorBoundary>
                  <Suspense>
                    <PrayerTimesCard prayerPromise={prayerPromise} onUseCurrentLocation={handleUseCurrentLocation} />
                  </Suspense>
                </ErrorBoundary>
              ) : (
                <div className="py-8 text-center text-sm text-white/80">Waiting for current location to load</div>
              )
            ) : (
            <section className="w-full text-left" aria-label="Masjids">
            <div className="mx-auto w-full max-w-7xl">
              <div className="rounded-xl border border-amber-300/80 bg-white p-4 md:p-6 overflow-x-visible overflow-y-visible">
                <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-amber-900/70">Results</div>
                    <div className="text-sm font-medium text-slate-900 whitespace-normal wrap-break-word leading-snug">
                      {masjidResultsSubtitle}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:justify-end overflow-x-auto whitespace-nowrap flex-nowrap max-w-full">
                    {[
                      { key: 'list', label: 'List', Icon: List },
                      { key: 'grid', label: 'Grid', Icon: LayoutGrid },
                      { key: 'card', label: 'Card', Icon: IdCard },
                    ].map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => setMasjidView(v.key)}
                        className={cn(
                          'inline-flex flex-none h-9 items-center gap-1.5 rounded-full border px-4 text-xs font-medium shadow-sm cursor-pointer transition',
                          masjidView === v.key
                            ? 'border-amber-500 bg-amber-300 text-amber-950'
                            : 'border-amber-400/70 bg-amber-50 text-amber-950 hover:bg-amber-100'
                        )}
                      >
                        {v.Icon && <v.Icon className="size-4" />}
                        <span>{v.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className={cn(
                    'grid grid-cols-1 gap-3',
                    masjidView === 'grid' ? 'grid-cols-1' : 'lg:grid-cols-[420px_1fr]'
                  )}
                >
                  <div className="min-h-[320px]">
                    {masjidError && (
                      <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {masjidError}
                      </div>
                    )}
                    {masjidSearching && masjidResults.length > 0 && (
                      <div className="mb-2 text-xs text-amber-900/70">(updating)</div>
                    )}

                    {masjidSearching && masjidResults.length === 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-6">
                        <LoadingSpinner label="Loading masjids" tone="amber" />
                      </div>
                    ) : masjidHasLoaded && masjidResults.length === 0 && !masjidError ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-4 text-sm text-amber-900/80">
                        No masjids found for this area.
                      </div>
                    ) : masjidResults.length > 0 ? (
                      <div
                        className={cn(
                          'overflow-y-auto pr-1',
                          masjidView === 'list' && 'space-y-2 max-h-[520px]',
                          masjidView === 'card' && 'space-y-3 max-h-[520px]',
                          masjidView === 'grid' && 'grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4'
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
                            imageUrl={selectedMasjidId === m.id && masjidView === 'card' ? selectedMasjidImage : null}
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
                        buttonClass="px-3 py-1.5 rounded-lg border border-amber-300 text-sm font-medium text-amber-950 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    )}
                  </div>

                  <div className={cn('min-h-0', masjidView === 'grid' && 'order-2')}>
                    <div className="h-[520px] max-h-[520px] w-full overflow-hidden rounded-xl border border-amber-200/80 bg-slate-100/40">
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
                </div>
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
