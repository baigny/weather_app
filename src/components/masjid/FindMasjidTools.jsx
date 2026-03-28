import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, LocateFixed } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { autocompletePlaces } from '@/services/olaPlacesAPI'
// Directions are available in the dedicated Directions menu.

function setParam(sp, key, value) {
  if (value == null || value === '') sp.delete(key)
  else sp.set(key, String(value))
}

function readNumber(sp, key) {
  const raw = sp.get(key)
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export default function FindMasjidTools() {
  const location = useLocation()
  const navigate = useNavigate()
  const sp = useMemo(() => new URLSearchParams(location.search || ''), [location.search])

  const radiusKmRaw = readNumber(sp, 'radiusKm')
  const radiusKm = Number.isFinite(radiusKmRaw) ? Math.min(50, Math.max(1, Math.round(radiusKmRaw))) : 5
  const masjidTab = sp.get('masjidTab') === 'prayers' ? 'prayers' : 'masjids'
  const [areaQuery, setAreaQuery] = useState(sp.get('centerLabel') || '')
  const [areaResults, setAreaResults] = useState([])
  const [loadingArea, setLoadingArea] = useState(false)
  const debounceRef = useRef(null)
  // Directions UI is shared with Explore (see `DirectionsTool`).

  const update = (mutate, { replace = false } = {}) => {
    const next = new URLSearchParams(location.search || '')
    mutate(next)
    const search = next.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace })
  }

  useEffect(() => {
    setAreaQuery(sp.get('centerLabel') || '')
    setAreaResults([])
    setLoadingArea(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const runAreaAutocomplete = (q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const query = q.trim()
    if (query.length < 2) {
      setAreaResults([])
      setLoadingArea(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoadingArea(true)
      try {
        const rows = await autocompletePlaces(query, null, { enrich: false })
        setAreaResults(rows || [])
      } catch {
        setAreaResults([])
      } finally {
        setLoadingArea(false)
      }
    }, 300)
  }

  const selectArea = (place) => {
    if (!place?.lat || !place?.lon) return
    update((next) => {
      next.delete('nearMe')
      next.delete('pickCenter')
      next.set('centerLat', String(place.lat))
      next.set('centerLon', String(place.lon))
      setParam(next, 'centerLabel', place.label || place.name || '')
    })
    setAreaResults([])
  }

  return (
    <div className="space-y-6">
      <Tabs
        value={masjidTab}
        onValueChange={(v) => {
          if (v === 'prayers') update((next) => setParam(next, 'masjidTab', 'prayers'), { replace: true })
          else update((next) => next.delete('masjidTab'), { replace: true })
        }}
      >
        <TabsList className="w-full" variant="default">
          <TabsTrigger value="masjids" className="flex-1">Masjids</TabsTrigger>
          <TabsTrigger value="prayers" className="flex-1">Prayer Times</TabsTrigger>
        </TabsList>
      </Tabs>

      {masjidTab === 'masjids' ? (
        <>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search area</div>
            <div className="relative w-full">
              <Input
                value={areaQuery}
                onChange={(e) => {
                  const v = e.target.value
                  setAreaQuery(v)
                  runAreaAutocomplete(v)
                }}
                placeholder="Type an area (e.g. Gachibowli, Hyderabad)"
              />
            </div>
            {loadingArea ? <div className="text-[11px] text-muted-foreground">Searching…</div> : null}
            {areaResults.length ? (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-card">
                {areaResults.slice(0, 8).map((p) => (
                  <button
                    key={`${p.id || ''}-${p.lat}-${p.lon}`}
                    type="button"
                    onClick={() => selectArea(p)}
                    className="w-full px-3 py-2 text-left hover:bg-accent/40"
                  >
                    <div className="text-[12px] font-medium truncate text-foreground">{p.label || p.name}</div>
                    {p.address ? <div className="text-[11px] text-muted-foreground truncate">{p.address}</div> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search radius</div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={50}
                value={radiusKm}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  update((next) => setParam(next, 'radiusKm', v))
                }}
                className="w-full cursor-pointer"
              />
              <div className="w-14 text-right text-sm font-medium text-foreground tabular-nums">{radiusKm} km</div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { label: 'Near me', kind: 'nearMe', radiusKm: null },
                { label: '2 km', kind: 'radius', radiusKm: 2 },
                { label: '5 km', kind: 'radius', radiusKm: 5 },
                { label: '10 km', kind: 'radius', radiusKm: 10 },
              ].map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => {
                    update((next) => {
                      if (b.radiusKm != null) setParam(next, 'radiusKm', b.radiusKm)
                      if (b.kind === 'nearMe') {
                        setParam(next, 'nearMe', 1)
                        next.delete('centerLat')
                        next.delete('centerLon')
                        next.delete('centerLabel')
                      } else {
                        // Keep the selected locality (centerLat/centerLon) if present.
                        next.delete('nearMe')
                      }
                      next.delete('pickCenter')
                    })
                  }}
                  className="inline-flex h-8 items-center rounded-full border border-border bg-secondary px-3 text-[11px] font-medium text-secondary-foreground hover:bg-secondary/80 cursor-pointer transition"
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters</div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1 justify-center rounded-full border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-none"
              onClick={() => {
                update((next) => {
                  setParam(next, 'nearMe', 1)
                  next.delete('pickCenter')
                  next.delete('centerLat')
                  next.delete('centerLon')
                  next.delete('centerLabel')
                })
              }}
            >
              <LocateFixed className="mr-2 size-4" />
              Near me
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="flex-1 justify-center rounded-full border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-none"
              onClick={() => {
                update((next) => {
                  next.delete('nearMe')
                  setParam(next, 'pickCenter', 1)
                  next.delete('centerLat')
                  next.delete('centerLon')
                  next.delete('centerLabel')
                })
              }}
            >
              <MapPin className="mr-2 size-4" />
              Pick on map
            </Button>
          </div>

          {/* Directions are handled in the Directions menu */}

          <Button
            type="button"
            variant="ghost"
            className="w-full justify-center rounded-full border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-none"
            onClick={() => {
              update((next) => {
                next.delete('radiusKm')
                next.delete('nearMe')
                next.delete('pickCenter')
                next.delete('centerLat')
                next.delete('centerLon')
                next.delete('centerLabel')
                // Do not reset directions here (Directions menu owns them).
              })
            }}
          >
            Reset
          </Button>
        </>
      ) : (
        <div className="h-10" />
      )}
    </div>
  )
}

