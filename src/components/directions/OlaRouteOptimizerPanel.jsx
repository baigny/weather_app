import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { autocompletePlaces } from '@/services/olaPlacesAPI'

function setParam(sp, key, value) {
  if (value == null || value === '') sp.delete(key)
  else sp.set(key, String(value))
}

function nowKey() {
  return String(Date.now())
}

function encodeStops(stops) {
  return stops.map((s) => `${s.lat},${s.lon}`).join('|')
}

function encodeStopLabels(stops) {
  return stops.map((s) => encodeURIComponent(String(s.label || s.query || '').trim())).join('|')
}

function parseStops(encoded) {
  if (!encoded) return []
  return String(encoded)
    .split('|')
    .map((x) => {
      const [latRaw, lonRaw] = String(x).split(',')
      const lat = Number(latRaw)
      const lon = Number(lonRaw)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      return { lat, lon }
    })
    .filter(Boolean)
}

function parseStopLabels(encoded) {
  if (!encoded) return []
  return String(encoded)
    .split('|')
    .map((x) => {
      try { return decodeURIComponent(x) } catch { return String(x) }
    })
}

export default function OlaRouteOptimizerPanel({
  searchParams,
  setSearchParams,
} = {}) {
  const mode = searchParams.get('mode') === 'walking' ? 'walking' : 'driving'
  const [stops, setStops] = useState(() => ([
    { label: '', lat: null, lon: null, query: '' },
    { label: '', lat: null, lon: null, query: '' },
    { label: '', lat: null, lon: null, query: '' },
  ]))
  const [activeResults, setActiveResults] = useState({ idx: null, items: [] })
  const [loadingIdx, setLoadingIdx] = useState(null)
  const [roundTrip, setRoundTrip] = useState(searchParams.get('optRoundTrip') === '1')
  const debounceRef = useRef({})

  useEffect(() => {
    setRoundTrip(searchParams.get('optRoundTrip') === '1')
    const rk = searchParams.get('routeKind') || 'directions'
    const draftStopsEncoded = searchParams.get('optDraftStops') || ''
    const draftLabelsEncoded = searchParams.get('optDraftLabels') || ''
    const encoded = draftStopsEncoded || searchParams.get('optStops') || ''
    const labelsRaw = draftLabelsEncoded || searchParams.get('optStopLabels') || ''
    if (rk !== 'optimizer' || !encoded) return
    const decoded = parseStops(encoded)
    if (!decoded.length) return
    const labels = parseStopLabels(labelsRaw)
    setStops((prev) => {
      const desiredLen = Math.max(prev?.length || 0, decoded.length, 3)
      const next = Array.from({ length: desiredLen }).map((_, idx) => {
        const hasCoord = idx < decoded.length
        const fallback =
          idx === 0
            ? 'Start'
            : idx === decoded.length - 1
              ? 'End'
              : `Stop ${Math.max(1, idx)}`
        const label = (labels[idx] && String(labels[idx]).trim()) || (idx < decoded.length ? fallback : '')
        return {
          label,
          lat: hasCoord ? decoded[idx].lat : null,
          lon: hasCoord ? decoded[idx].lon : null,
          query: hasCoord ? label : (prev?.[idx]?.query ?? ''),
        }
      })
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()])

  useEffect(() => {
    return () => {
      Object.values(debounceRef.current || {}).forEach((t) => {
        if (t) clearTimeout(t)
      })
    }
  }, [])

  const update = useCallback((mutate, { replace = false } = {}) => {
    const next = new URLSearchParams(searchParams.toString())
    mutate(next)
    setSearchParams(next, { replace })
  }, [searchParams, setSearchParams])

  const persistDraftStopsInUrl = useCallback((nextStops) => {
    const rows = Array.isArray(nextStops) ? nextStops : []
    const valid = rows.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
    update((next) => {
      setParam(next, 'routeKind', 'optimizer')
      setParam(next, 'optDraftStops', valid.length ? encodeStops(valid) : null)
      setParam(next, 'optDraftLabels', valid.length ? encodeStopLabels(valid) : null)
      // Keep draft endpoints in URL so From/To persist like directions.
      if (valid.length >= 1) {
        setParam(next, 'fromLat', valid[0].lat)
        setParam(next, 'fromLon', valid[0].lon)
        setParam(next, 'fromLabel', valid[0].label || valid[0].query || 'Start')
      }
      if (valid.length >= 2) {
        setParam(next, 'toLat', valid[valid.length - 1].lat)
        setParam(next, 'toLon', valid[valid.length - 1].lon)
        setParam(next, 'toLabel', valid[valid.length - 1].label || valid[valid.length - 1].query || 'End')
      }
    }, { replace: true })
  }, [update])

  const clearOptimizedRouteInUrl = useCallback(() => {
    update((next) => {
      // User is editing stops: clear previous optimized output so map/markers don't stick.
      next.delete('route')
      next.delete('routeTs')
      next.delete('optStops')
      next.delete('optStopLabels')
      // Keep draft From/To + optDraft* intact so inputs persist.
      setParam(next, 'routeKind', 'optimizer')
    }, { replace: true })
  }, [update])

  const runAutocomplete = useCallback((idx, q) => {
    if (debounceRef.current[idx]) clearTimeout(debounceRef.current[idx])
    const query = q.trim()
    if (query.length < 2) {
      setActiveResults({ idx: null, items: [] })
      setLoadingIdx(null)
      return
    }
    debounceRef.current[idx] = setTimeout(async () => {
      setLoadingIdx(idx)
      try {
        const rows = await autocompletePlaces(query, null, { enrich: false })
        setActiveResults({ idx, items: rows || [] })
      } catch {
        setActiveResults({ idx: null, items: [] })
      } finally {
        setLoadingIdx(null)
      }
    }, 300)
  }, [])

  const updateStopQuery = (idx, query) => {
    setStops((prev) => {
      const next = prev.map((s, i) => (i === idx ? { ...s, query, label: query, lat: null, lon: null } : s))
      // Persist whatever is already selected (valid coords) so panel restores on back/refresh.
      persistDraftStopsInUrl(next)
      return next
    })
    clearOptimizedRouteInUrl()
    runAutocomplete(idx, query)
  }

  const selectStop = (idx, place) => {
    setStops((prev) => {
      const next = prev.map((s, i) => (i === idx ? { ...s, query: place.label, label: place.label, lat: place.lat, lon: place.lon } : s))
      persistDraftStopsInUrl(next)
      return next
    })
    setActiveResults({ idx: null, items: [] })
    clearOptimizedRouteInUrl()
  }

  const addStop = () => {
    setStops((prev) => {
      const next = [...prev, { label: '', lat: null, lon: null, query: '' }]
      persistDraftStopsInUrl(next)
      return next
    })
    clearOptimizedRouteInUrl()
  }

  const removeStop = (idx) => {
    setStops((prev) => {
      const next = prev.length <= 2 ? prev : prev.filter((_, i) => i !== idx)
      persistDraftStopsInUrl(next)
      return next
    })
    setActiveResults({ idx: null, items: [] })
    clearOptimizedRouteInUrl()
  }

  const optimize = async () => {
    const valid = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
    if (valid.length < 2) return
    const encoded = encodeStops(valid)
    update((next) => {
      setParam(next, 'routeKind', 'optimizer')
      setParam(next, 'optStops', encoded)
      setParam(next, 'optStopLabels', encodeStopLabels(valid))
      setParam(next, 'optDraftStops', encoded)
      setParam(next, 'optDraftLabels', encodeStopLabels(valid))
      setParam(next, 'optRoundTrip', roundTrip ? 1 : null)
      setParam(next, 'mode', mode)
      // Keep the existing HomePage route state in sync for markers/labels.
      setParam(next, 'fromLat', valid[0].lat)
      setParam(next, 'fromLon', valid[0].lon)
      setParam(next, 'fromLabel', valid[0].label || 'Start')
      const end = roundTrip ? valid[0] : valid[valid.length - 1]
      setParam(next, 'toLat', end.lat)
      setParam(next, 'toLon', end.lon)
      setParam(next, 'toLabel', roundTrip ? (valid[0].label || 'Start') : (valid[valid.length - 1].label || 'End'))
      setParam(next, 'route', 1)
      setParam(next, 'routeTs', nowKey())
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
            {m.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {stops.map((s, idx) => (
          <div key={idx} className="relative">
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <Input
                  value={s.query}
                  onChange={(e) => updateStopQuery(idx, e.target.value)}
                  placeholder={idx === 0 ? 'Start point' : idx === stops.length - 1 ? 'End point' : `Stop ${idx + 1}`}
                />
                {loadingIdx === idx ? <div className="mt-1 text-[11px] text-muted-foreground">Searching…</div> : null}
              </div>
              {stops.length > 2 ? (
                <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => removeStop(idx)}>
                  <X className="size-4" />
                </Button>
              ) : null}
            </div>

            {activeResults.idx === idx && activeResults.items.length > 0 ? (
              <div className="mt-1 rounded-lg border border-border bg-card overflow-hidden">
                {activeResults.items.slice(0, 4).map((p) => (
                  <button
                    key={`${p.id || ''}-${p.lat}-${p.lon}`}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-accent/40"
                    onClick={() => selectStop(idx, p)}
                  >
                    <div className="text-[12px] font-medium text-foreground truncate">{p.label || p.name}</div>
                    {p.address ? <div className="text-[11px] text-muted-foreground truncate">{p.address}</div> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}

        <Button type="button" variant="secondary" className="w-full" onClick={addStop}>
          <Plus className="mr-2 size-4" />
          Add stop
        </Button>

        <div className="flex items-center gap-2">
          <Checkbox
            id="opt-roundtrip"
            checked={roundTrip}
            onCheckedChange={(v) => setRoundTrip(Boolean(v))}
          />
          <Label htmlFor="opt-roundtrip">Round trip</Label>
        </div>

        <Button
          type="button"
          variant="ghost"
          className="w-full justify-center rounded-full border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-none"
          onClick={async () => { try { await optimize() } catch { /* ignore */ } }}
        >
          Optimize Route
        </Button>
      </div>
    </div>
  )
}

