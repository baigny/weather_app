import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, LocateFixed, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { autocompletePlaces } from '@/services/olaPlacesAPI'
import { getCurrentPosition, reverseGeocode } from '@/services/weatherAPI'

function setParam(sp, key, value) {
  if (value == null || value === '') sp.delete(key)
  else sp.set(key, String(value))
}

function nowKey() {
  return String(Date.now())
}

export default function OlaDirectionsPanel({
  searchParams,
  setSearchParams,
  collapsePanelOnRoute = false,
  requireDestination = false,
} = {}) {
  const mode = searchParams.get('mode') === 'walking' ? 'walking' : 'driving'
  const [fromQuery, setFromQuery] = useState(searchParams.get('fromLabel') || '')
  const [toQuery, setToQuery] = useState(searchParams.get('toLabel') || '')
  const [fromResults, setFromResults] = useState([])
  const [toResults, setToResults] = useState([])
  const [loadingFrom, setLoadingFrom] = useState(false)
  const [loadingTo, setLoadingTo] = useState(false)
  const debounceRef = useRef({ from: null, to: null })

  useEffect(() => {
    setFromQuery(searchParams.get('fromLabel') || '')
    setToQuery(searchParams.get('toLabel') || '')
    setFromResults([])
    setToResults([])
    setLoadingFrom(false)
    setLoadingTo(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()])

  useEffect(() => {
    return () => {
      if (debounceRef.current.from) clearTimeout(debounceRef.current.from)
      if (debounceRef.current.to) clearTimeout(debounceRef.current.to)
    }
  }, [])

  const update = useCallback((mutate, { replace = false } = {}) => {
    const next = new URLSearchParams(searchParams.toString())
    mutate(next)
    setSearchParams(next, { replace })
  }, [searchParams, setSearchParams])

  const runAutocomplete = useCallback((q, which) => {
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
        const rows = await autocompletePlaces(query, null, { enrich: false })
        if (which === 'from') setFromResults(rows || [])
        else setToResults(rows || [])
      } catch {
        if (which === 'from') setFromResults([])
        else setToResults([])
      } finally {
        which === 'from' ? setLoadingFrom(false) : setLoadingTo(false)
      }
    }, 300)
  }, [])

  const selectPlace = (place, which) => {
    update((next) => {
      setParam(next, 'routeKind', 'directions')
      if (which === 'from') {
        setParam(next, 'fromLat', place.lat)
        setParam(next, 'fromLon', place.lon)
        setParam(next, 'fromLabel', place.label || place.name || '')
        setParam(next, 'fromAddr', place.address || '')
      } else {
        setParam(next, 'toLat', place.lat)
        setParam(next, 'toLon', place.lon)
        setParam(next, 'toLabel', place.label || place.name || '')
        setParam(next, 'toAddr', place.address || '')
      }

      // Auto-show route as soon as both points exist.
      const hasFrom = next.get('fromLat') && next.get('fromLon')
      const hasTo = next.get('toLat') && next.get('toLon')
      if (hasFrom && hasTo) {
        setParam(next, 'route', 1)
        setParam(next, 'routeTs', nowKey())
      } else {
        next.delete('route')
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
      setParam(next, 'routeKind', 'directions')
      if (which === 'from') {
        setParam(next, 'fromLat', loc.lat)
        setParam(next, 'fromLon', loc.lon)
        setParam(next, 'fromLabel', label || `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`)
        setParam(next, 'fromAddr', label || '')
      } else {
        setParam(next, 'toLat', loc.lat)
        setParam(next, 'toLon', loc.lon)
        setParam(next, 'toLabel', label || `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`)
        setParam(next, 'toAddr', label || '')
      }

      // Auto-show route as soon as both points exist.
      const hasFrom = next.get('fromLat') && next.get('fromLon')
      const hasTo = next.get('toLat') && next.get('toLon')
      if (hasFrom && hasTo) {
        setParam(next, 'route', 1)
        setParam(next, 'routeTs', nowKey())
      } else {
        next.delete('route')
      }
    })
  }

  const clickGetDirections = async () => {
    const cur = new URLSearchParams(searchParams.toString())
    const hasTo = cur.get('toLat') && cur.get('toLon')
    if (requireDestination && !hasTo) return

    const hasFrom = cur.get('fromLat') && cur.get('fromLon')
    if (hasFrom) {
      update((next) => {
        setParam(next, 'routeKind', 'directions')
        setParam(next, 'route', 1)
        setParam(next, 'routeTs', nowKey())
        if (collapsePanelOnRoute) setParam(next, 'panel', 0)
      })
      return
    }

    // Single navigation: set current location as origin AND enable route.
    const { coords } = await getCurrentPosition()
    const loc = { lat: coords.latitude, lon: coords.longitude }
    const label = await reverseGeocode(loc.lat, loc.lon).catch(() => null)
    update((next) => {
      setParam(next, 'routeKind', 'directions')
      setParam(next, 'fromLat', loc.lat)
      setParam(next, 'fromLon', loc.lon)
      setParam(next, 'fromLabel', label || `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`)
      setParam(next, 'route', 1)
      setParam(next, 'routeTs', nowKey())
      if (collapsePanelOnRoute) setParam(next, 'panel', 0)
    })
  }

  return (
    <div className="space-y-3">
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
                ? 'bg-accent text-accent-foreground border-border'
                : 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80',
            ].join(' ')}
          >
            <Navigation className="size-4" />
            {m.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="relative w-full">
          <Input
            value={fromQuery}
            onChange={(e) => {
              const v = e.target.value
              setFromQuery(v)
              runAutocomplete(v, 'from')
            }}
            placeholder="From (start)"
            className="pr-10"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Use current location for origin"
            onClick={async () => {
              try { await setCurrentLocationLabel('from') } catch { /* ignore */ }
            }}
          >
            <LocateFixed className="size-4" />
          </button>
        </div>
        {loadingFrom ? <div className="text-[11px] text-muted-foreground">Searching…</div> : null}
        {fromResults.length ? (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-card">
            {fromResults.slice(0, 6).map((p) => (
              <button
                key={`${p.id || ''}-${p.lat}-${p.lon}`}
                type="button"
                onClick={() => selectPlace(p, 'from')}
                className="w-full px-3 py-2 text-left hover:bg-accent/40"
              >
                <div className="text-[12px] font-medium truncate text-foreground">{p.label || p.name}</div>
                {p.address ? <div className="text-[11px] text-muted-foreground truncate">{p.address}</div> : null}
              </button>
            ))}
          </div>
        ) : null}

        <div className="relative w-full">
          <Input
            value={toQuery}
            onChange={(e) => {
              const v = e.target.value
              setToQuery(v)
              runAutocomplete(v, 'to')
            }}
            placeholder="To (destination)"
            className="pr-10"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Use current location for destination"
            onClick={async () => {
              try { await setCurrentLocationLabel('to') } catch { /* ignore */ }
            }}
          >
            <LocateFixed className="size-4" />
          </button>
        </div>
        {loadingTo ? <div className="text-[11px] text-muted-foreground">Searching…</div> : null}
        {toResults.length ? (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-card">
            {toResults.slice(0, 6).map((p) => (
              <button
                key={`${p.id || ''}-${p.lat}-${p.lon}`}
                type="button"
                onClick={() => selectPlace(p, 'to')}
                className="w-full px-3 py-2 text-left hover:bg-accent/40"
              >
                <div className="text-[12px] font-medium truncate text-foreground">{p.label || p.name}</div>
                {p.address ? <div className="text-[11px] text-muted-foreground truncate">{p.address}</div> : null}
              </button>
            ))}
          </div>
        ) : null}

        <Button
          type="button"
          variant="secondary"
          className="w-full justify-center rounded-lg"
          onClick={() => {
            update((next) => {
              const fl = next.get('fromLat')
              const fn = next.get('fromLon')
              const tl = next.get('toLat')
              const tn = next.get('toLon')
              const flb = next.get('fromLabel')
              const tlb = next.get('toLabel')
              const fa = next.get('fromAddr')
              const ta = next.get('toAddr')
              setParam(next, 'fromLat', tl)
              setParam(next, 'fromLon', tn)
              setParam(next, 'fromLabel', tlb)
              setParam(next, 'fromAddr', ta)
              setParam(next, 'toLat', fl)
              setParam(next, 'toLon', fn)
              setParam(next, 'toLabel', flb)
              setParam(next, 'toAddr', fa)
              setParam(next, 'routeKind', 'directions')

              const hasFrom = next.get('fromLat') && next.get('fromLon')
              const hasTo = next.get('toLat') && next.get('toLon')
              if (hasFrom && hasTo) {
                setParam(next, 'route', 1)
                setParam(next, 'routeTs', nowKey())
              } else {
                next.delete('route')
              }
            })
          }}
        >
          <ArrowLeftRight className="mr-2 size-4" />
          Swap
        </Button>

        <Button
          type="button"
          className="w-full justify-center rounded-lg"
          onClick={async () => {
            try { await clickGetDirections() } catch { /* ignore */ }
          }}
        >
          Get Directions
        </Button>

      </div>
    </div>
  )
}

