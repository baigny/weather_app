import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, LocateFixed } from 'lucide-react'
import { searchCities } from '../services/weatherAPI'
import { parseSearchIntent } from '../services/searchIntent'
import useDebounce from '../hooks/useDebounce'

const SmartSearchBar = ({
  onResolvedLocation,
  onIntentChange,
  onUseCurrentLocation,
  onOpenMapPicker,
  onMasjidNearMe,
  currentCoords = null,
  showMasjidQuickFilters = false,
  disableNavigation = false,
}) => {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [intent, setIntent] = useState('weather')
  const [filters, setFilters] = useState({ radiusKm: null, nearMe: false, locationText: null })
  const [open, setOpen] = useState(false)
  const debounced = useDebounce(query, 250)
  const wrapperRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!debounced.trim()) {
      setSuggestions([])
      return
    }
    const { intent: parsedIntent, filters: parsedFilters } = parseSearchIntent(debounced)
    setIntent(parsedIntent)
    setFilters(parsedFilters)
    onIntentChange?.(parsedIntent, parsedFilters)

    const q = parsedFilters.locationText || debounced
    searchCities(q, { center: currentCoords }).then((items) => setSuggestions(items || []))
  }, [debounced, currentCoords?.lat, currentCoords?.lon])

  const handleSelectSuggestion = (place) => {
    setQuery(place.label)
    setOpen(false)
    const coords = { lat: place.lat, lon: place.lon }
    onResolvedLocation?.({ coords, label: place.label })
    if (!disableNavigation && intent === 'masjid') {
      navigate('/masjids', {
        state: {
          coords,
          locationLabel: place.label,
          radiusM: (filters.radiusKm ?? 5) * 1000,
        },
      })
    }
  }

  const triggerMasjidNearMe = (radiusKmOverride = null) => {
    const nextFilters = { ...filters, radiusKm: radiusKmOverride ?? filters.radiusKm }
    onUseCurrentLocation?.()
    onMasjidNearMe?.(nextFilters)
    if (!disableNavigation) {
      navigate('/masjids', {
        state: {
          coords: null,
          locationLabel: 'Near me',
          radiusM: (nextFilters.radiusKm ?? 5) * 1000,
        },
      })
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full mb-3">
      <div className="flex flex-col gap-2">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 size-4 text-white/60" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            placeholder='Search: "Weather Hyderabad", "Masjid near me"'
            className="w-full rounded-full bg-white/15 px-9 py-2.5 text-sm text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/50 border border-white/20"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onUseCurrentLocation?.()
                setOpen(false)
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-400/70 bg-amber-50 px-4 text-xs font-medium text-amber-950 shadow-sm hover:bg-amber-100 cursor-pointer transition"
            >
              <LocateFixed className="size-4" />
              <span>Use current</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenMapPicker?.()
                setOpen(false)
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-400/70 bg-amber-50 px-4 text-xs font-medium text-amber-950 shadow-sm hover:bg-amber-100 cursor-pointer transition"
            >
              <MapPin className="size-4" />
              <span>Select on map</span>
            </button>

            {(intent === 'masjid' || showMasjidQuickFilters) && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (intent !== 'masjid') setIntent('masjid')
                    triggerMasjidNearMe(null)
                  }}
                  className="inline-flex h-9 items-center rounded-full border border-amber-400/60 bg-white px-4 text-xs font-medium text-amber-900 shadow-sm hover:bg-amber-50 cursor-pointer"
                >
                  Near me
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (intent !== 'masjid') setIntent('masjid')
                    setFilters((f) => ({ ...f, radiusKm: 2 }))
                    triggerMasjidNearMe(2)
                  }}
                  className="inline-flex h-9 items-center rounded-full border border-amber-400/60 bg-white px-4 text-xs font-medium text-amber-900 shadow-sm hover:bg-amber-50 cursor-pointer"
                >
                  Within 2 km
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (intent !== 'masjid') setIntent('masjid')
                    setFilters((f) => ({ ...f, radiusKm: 5 }))
                    triggerMasjidNearMe(5)
                  }}
                  className="inline-flex h-9 items-center rounded-full border border-amber-400/60 bg-white px-4 text-xs font-medium text-amber-900 shadow-sm hover:bg-amber-50 cursor-pointer"
                >
                  Within 5 km
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (intent !== 'masjid') setIntent('masjid')
                    setFilters((f) => ({ ...f, radiusKm: 10 }))
                    triggerMasjidNearMe(10)
                  }}
                  className="inline-flex h-9 items-center rounded-full border border-amber-400/60 bg-white px-4 text-xs font-medium text-amber-900 shadow-sm hover:bg-amber-50 cursor-pointer"
                >
                  Within 10 km
                </button>
              </div>
            )}
          </div>

          {intent === 'masjid' && (
            <span className="text-[11px] text-white/75">Masjid filters are available here</span>
          )}
        </div>
      </div>

      {open && (suggestions.length > 0 || intent === 'masjid') && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-white/15 bg-slate-950/95 text-xs text-white shadow-lg backdrop-blur-md">
          <ul className="max-h-60 overflow-y-auto">
            {suggestions.map((city) => (
              <li
                key={`${city.label}-${city.lat}-${city.lon}`}
                onClick={() => handleSelectSuggestion(city)}
                className="cursor-pointer px-3 py-2 text-[12px] hover:bg-white/10"
              >
                <span className="font-medium">{city.label}</span>
                {city.country && <span className="ml-1 text-white/60">· {city.country}</span>}
              </li>
            ))}
            {suggestions.length === 0 && intent === 'weather' && (
              <li className="px-3 py-2 text-[12px] text-white/60">Type at least 2 characters to search locations</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export default SmartSearchBar

