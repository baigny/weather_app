import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MapPin, Coffee, Utensils, Hospital, Fuel, Hotel, GraduationCap, ParkingSquare, Landmark, LocateFixed } from 'lucide-react'
import { Button } from '@/components/ui/button'
// Directions are available in the dedicated Directions menu.

function setParam(sp, key, value) {
  if (value == null || value === '') sp.delete(key)
  else sp.set(key, String(value))
}

const AMENITIES = [
  { id: 'restaurant', label: 'Restaurant', Icon: Utensils },
  { id: 'cafe', label: 'Cafe', Icon: Coffee },
  { id: 'hospital', label: 'Hospital', Icon: Hospital },
  { id: 'gas_station', label: 'Fuel', Icon: Fuel },
  { id: 'hotel', label: 'Hotel', Icon: Hotel },
  { id: 'school', label: 'School', Icon: GraduationCap },
  { id: 'parking', label: 'Parking', Icon: ParkingSquare },
  { id: 'atm', label: 'ATM', Icon: Landmark },
]

export default function ExploreNeighborhoodTools() {
  const location = useLocation()
  const navigate = useNavigate()

  const sp = useMemo(() => new URLSearchParams(location.search || ''), [location.search])
  const centerLat = Number(sp.get('centerLat'))
  const centerLon = Number(sp.get('centerLon'))
  const amenity = sp.get('amenity') || null
  const radiusKm = Number(sp.get('radiusKm') || 2)
  const safeRadiusKm = Number.isFinite(radiusKm) ? Math.min(50, Math.max(1, Math.round(radiusKm))) : 5
  // Directions UI is shared with Find Masjids (see `DirectionsTool`).

  const update = (mutate) => {
    const next = new URLSearchParams(location.search || '')
    mutate(next)
    const search = next.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/80">Explore nearby</div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {AMENITIES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => update((next) => setParam(next, 'amenity', a.id))}
              className={[
                'flex flex-col items-center gap-1 py-3 rounded-xl transition-all border backdrop-blur-sm cursor-pointer',
                amenity === a.id ? 'bg-white/15 border-white/25' : 'bg-white/5 border-white/10 hover:bg-white/10',
              ].join(' ')}
            >
              <a.Icon className="size-5 text-white/90" />
              <span className="text-[10px] font-medium text-white/80">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Directions are handled in the Directions menu */}

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/80">Search radius</div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={50}
            value={safeRadiusKm}
            onChange={(e) => {
              const v = Number(e.target.value)
              update((next) => setParam(next, 'radiusKm', v))
            }}
            className="w-full cursor-pointer"
          />
          <div className="w-14 text-right text-sm font-medium text-white/90 tabular-nums">{safeRadiusKm} km</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/80">Filters</div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className="flex-1 justify-center rounded-full border border-white/15 bg-white/5 text-white/90 hover:bg-white/10 shadow-none"
            onClick={() => {
              update((next) => {
                next.delete('pickCenter')
                next.delete('focusId')
                setParam(next, 'nearMe', 1)
              })
            }}
          >
            <LocateFixed className="mr-2 size-4" />
            Current
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="flex-1 justify-center rounded-full border border-white/15 bg-white/5 text-white/90 hover:bg-white/10 shadow-none"
            onClick={() => {
              update((next) => {
                next.delete('nearMe')
                setParam(next, 'pickCenter', 1)
              })
            }}
          >
            <MapPin className="mr-2 size-4" />
            Pick on map
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { label: '2 km', radiusKm: 2 },
            { label: '5 km', radiusKm: 5 },
            { label: '10 km', radiusKm: 10 },
            { label: '20 km', radiusKm: 20 },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => update((next) => setParam(next, 'radiusKm', b.radiusKm))}
              className="inline-flex h-8 items-center rounded-full border border-white/15 bg-white/5 px-3 text-[11px] font-medium text-white/90 hover:bg-white/10 cursor-pointer transition"
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="text-[11px] text-white/70">
          Radius calculator: \( {safeRadiusKm} \) km ≈ \( {safeRadiusKm * 1000} \) meters
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-center rounded-full border border-white/15 bg-white/5 text-white/90 hover:bg-white/10 shadow-none"
          onClick={() => {
            update((next) => {
              next.delete('radiusKm')
              next.delete('nearMe')
              next.delete('mapPicker')
              next.delete('pickCenter')
              next.delete('amenity')
              next.delete('focusLat')
              next.delete('focusLon')
              next.delete('focusId')
              // Do not reset directions here (Directions menu owns them).
            })
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  )
}

