import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { autocompletePlaces } from '@/services/olaPlacesAPI'

export default function OlaSearchBar({
  onResolvedLocation,
  currentCenter = null,
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const wrapRef = useRef(null)
  const debounceRef = useRef(null)

  const center = useMemo(() => {
    if (!currentCenter?.lat || !currentCenter?.lon) return null
    return currentCenter
  }, [currentCenter?.lat, currentCenter?.lon])

  useEffect(() => {
    const onDown = (e) => {
      const el = wrapRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const rows = await autocompletePlaces(q, center)
        setResults(rows || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, center?.lat, center?.lon])

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="flex flex-col gap-2">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/60" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search places…"
            className="w-full rounded-xl bg-white/15 px-10 py-3 text-sm text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/50 border border-white/20"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setResults([])
                setOpen(false)
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/90 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {open && (loading || results.length > 0) ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-white/15 bg-slate-950/90 text-xs text-white shadow-lg backdrop-blur-md">
          <ul className="max-h-64 overflow-y-auto">
            {loading ? (
              <li className="px-3 py-2 text-white/70 border-b border-white/10">Searching…</li>
            ) : null}
            {results.map((r) => (
              <li key={`${r.id}-${r.lat}-${r.lon}`}>
                <button
                  type="button"
                  onClick={() => {
                    setQuery(r.label || r.name || '')
                    setOpen(false)
                    onResolvedLocation?.({ coords: { lat: r.lat, lon: r.lon }, label: r.label || r.name || '' })
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-white/10 cursor-pointer"
                >
                  <div className="text-[12px] font-medium whitespace-normal wrap-break-word leading-snug">{r.name || r.label}</div>
                  {r.address ? (
                    <div className="text-[11px] text-white/60 whitespace-normal wrap-break-word leading-snug mt-0.5">{r.address}</div>
                  ) : null}
                </button>
              </li>
            ))}
            {!loading && results.length === 0 ? (
              <li className="px-3 py-2 text-white/60">No results</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

