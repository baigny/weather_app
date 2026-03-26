import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeftRight, LocateFixed, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { autocompletePlaces } from '@/services/olaPlacesAPI'
import { getCurrentPosition, reverseGeocode } from '@/services/weatherAPI'

function setParam(sp, key, value) {
  if (value == null || value === '') sp.delete(key)
  else sp.set(key, String(value))
}

function nowKey() {
  return String(Date.now())
}

export default function DirectionsTool({
  collapsePanelOnRoute = false,
  requireDestination = false,
  title = 'Directions',
} = {}) {
  const location = useLocation()
  const navigate = useNavigate()
  const sp = useMemo(() => new URLSearchParams(location.search || ''), [location.search])

  const mode = sp.get('mode') === 'walking' ? 'walking' : 'driving'
  const [fromQuery, setFromQuery] = useState(sp.get('fromLabel') || '')
  const [toQuery, setToQuery] = useState(sp.get('toLabel') || '')
  const [fromResults, setFromResults] = useState([])
  const [toResults, setToResults] = useState([])
  const [loadingFrom, setLoadingFrom] = useState(false)
  const [loadingTo, setLoadingTo] = useState(false)
  const [routing, setRouting] = useState(false)
  const debounceRef = useRef({ from: null, to: null })

  useEffect(() => {
    setFromQuery(sp.get('fromLabel') || '')
    setToQuery(sp.get('toLabel') || '')
    setRouting(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  const update = (mutate, { replace = false } = {}) => {
    const next = new URLSearchParams(location.search || '')
    mutate(next)
    const search = next.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace })
  }

  const runAutocomplete = (q, which) => {
    if (debounceRef.current[which]) clearTimeout(debounceRef.current[which])
    const query = q.trim()
    if (query.length < 2) {
      which === 'from' ? setFromResults([]) : setToResults([])
      which === 'from' ? setLoadingFrom(false) : setLoadingTo(false)
      return
    }
    debounceRef.current[which] = setTimeout(async () => {
      which === 'from' ? setLoadingFrom(true) : setLoadingTo(true)
      try {
        const rows = await autocompletePlaces(query, null)
        if (which === 'from') setFromResults(rows || [])
        else setToResults(rows || [])
      } catch {
        if (which === 'from') setFromResults([])
        else setToResults([])
      } finally {
        which === 'from' ? setLoadingFrom(false) : setLoadingTo(false)
      }
    }, 300)
  }

  const selectPlace = (place, which) => {
    update((next) => {
      next.delete('route')
      if (which === 'from') {
        setParam(next, 'fromLat', place.lat)
        setParam(next, 'fromLon', place.lon)
        setParam(next, 'fromLabel', place.label || place.name || '')
      } else {
        setParam(next, 'toLat', place.lat)
        setParam(next, 'toLon', place.lon)
        setParam(next, 'toLabel', place.label || place.name || '')
      }
    })
    if (which === 'from') setFromResults([])
    else setToResults([])
  }

  const setCurrentLocationLabel = async (which) => {
    const { coords } = await getCurrentPosition()
    const loc = { lat: coords.latitude, lon: coords.longitude }
    const label = await reverseGeocode(loc.lat, loc.lon).catch(() => null)
    update((next) => {
      next.delete('route')
      if (which === 'from') {
        setParam(next, 'fromLat', loc.lat)
        setParam(next, 'fromLon', loc.lon)
        setParam(next, 'fromLabel', label || `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`)
      } else {
        setParam(next, 'toLat', loc.lat)
        setParam(next, 'toLon', loc.lon)
        setParam(next, 'toLabel', label || `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`)
      }
    })
  }

  const clickGetDirections = async () => {
    const cur = new URLSearchParams(location.search || '')
    const hasTo = cur.get('toLat') && cur.get('toLon')
    if (requireDestination && !hasTo) return

    const hasFrom = cur.get('fromLat') && cur.get('fromLon')
    if (hasFrom) {
      setRouting(true)
      update((next) => {
        setParam(next, 'route', 1)
        // Force refetch + repaint even if route is already enabled.
        setParam(next, 'routeTs', nowKey())
        if (collapsePanelOnRoute) setParam(next, 'panel', 0)
      })
      return
    }

    // Single navigation: set current location as origin AND enable route.
    try {
      setRouting(true)
      const { coords } = await getCurrentPosition()
      const loc = { lat: coords.latitude, lon: coords.longitude }
      const label = await reverseGeocode(loc.lat, loc.lon).catch(() => null)
      update((next) => {
        setParam(next, 'fromLat', loc.lat)
        setParam(next, 'fromLon', loc.lon)
        setParam(next, 'fromLabel', label || `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`)
        setParam(next, 'route', 1)
        setParam(next, 'routeTs', nowKey())
        if (collapsePanelOnRoute) setParam(next, 'panel', 0)
      })
    } catch {
      setRouting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-white/80">{title}</div>

      <div className="flex gap-2">
        {[
          { id: 'driving', label: 'Drive' },
          { id: 'walking', label: 'Walk' },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => update((next) => setParam(next, 'mode', m.id))}
            className={[
              'flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-full text-xs font-medium transition border',
              mode === m.id
                ? 'bg-white/15 text-white border-white/20'
                : 'bg-white/5 text-white/80 border-white/15 hover:bg-white/10',
            ].join(' ')}
          >
            <Navigation className="size-4" />
            {m.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="relative w-full">
          <input
            value={fromQuery}
            onChange={(e) => {
              const v = e.target.value
              setFromQuery(v)
              runAutocomplete(v, 'from')
            }}
            placeholder="From (start)"
            className="w-full rounded-lg bg-white/10 px-3 py-2 pr-10 text-sm text-white placeholder-white/50 outline-none border border-white/15 focus:ring-2 focus:ring-white/40"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white cursor-pointer"
            aria-label="Use current location for origin"
            onClick={async () => {
              try {
                await setCurrentLocationLabel('from')
              } catch {
                /* ignore */
              }
            }}
          >
            <LocateFixed className="size-4" />
          </button>
        </div>
        {loadingFrom ? <div className="text-[11px] text-white/60">Searching…</div> : null}
        {fromResults.length ? (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-white/15 bg-slate-950/60">
            {fromResults.slice(0, 6).map((p) => (
              <button
                key={`${p.id}-${p.lat}-${p.lon}`}
                type="button"
                onClick={() => selectPlace(p, 'from')}
                className="w-full px-3 py-2 text-left hover:bg-white/10 cursor-pointer"
              >
                <div className="text-[12px] font-medium truncate">{p.name || p.label}</div>
                {p.address ? <div className="text-[11px] text-white/60 truncate">{p.address}</div> : null}
              </button>
            ))}
          </div>
        ) : null}

        <div className="relative w-full">
          <input
            value={toQuery}
            onChange={(e) => {
              const v = e.target.value
              setToQuery(v)
              runAutocomplete(v, 'to')
            }}
            placeholder="To (destination)"
            className="w-full rounded-lg bg-white/10 px-3 py-2 pr-10 text-sm text-white placeholder-white/50 outline-none border border-white/15 focus:ring-2 focus:ring-white/40"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white cursor-pointer"
            aria-label="Use current location for destination"
            onClick={async () => {
              try {
                await setCurrentLocationLabel('to')
              } catch {
                /* ignore */
              }
            }}
          >
            <LocateFixed className="size-4" />
          </button>
        </div>
        {loadingTo ? <div className="text-[11px] text-white/60">Searching…</div> : null}
        {toResults.length ? (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-white/15 bg-slate-950/60">
            {toResults.slice(0, 6).map((p) => (
              <button
                key={`${p.id}-${p.lat}-${p.lon}`}
                type="button"
                onClick={() => selectPlace(p, 'to')}
                className="w-full px-3 py-2 text-left hover:bg-white/10 cursor-pointer"
              >
                <div className="text-[12px] font-medium truncate">{p.name || p.label}</div>
                {p.address ? <div className="text-[11px] text-white/60 truncate">{p.address}</div> : null}
              </button>
            ))}
          </div>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          className="w-full justify-center rounded-full border border-white/15 bg-white/5 text-white/90 hover:bg-white/10 shadow-none"
          onClick={() => {
            update((next) => {
              const fl = next.get('fromLat')
              const fn = next.get('fromLon')
              const tl = next.get('toLat')
              const tn = next.get('toLon')
              const flb = next.get('fromLabel')
              const tlb = next.get('toLabel')
              setParam(next, 'fromLat', tl)
              setParam(next, 'fromLon', tn)
              setParam(next, 'fromLabel', tlb)
              setParam(next, 'toLat', fl)
              setParam(next, 'toLon', fn)
              setParam(next, 'toLabel', flb)
              next.delete('route')
            })
          }}
        >
          <ArrowLeftRight className="mr-2 size-4" />
          Swap
        </Button>

        <Button
          type="button"
          className="w-full justify-center rounded-lg bg-white/15 hover:bg-white/20 text-white shadow-none cursor-pointer"
          onClick={clickGetDirections}
        >
          {routing ? 'Routing…' : 'Get Directions'}
        </Button>
      </div>
    </div>
  )
}

