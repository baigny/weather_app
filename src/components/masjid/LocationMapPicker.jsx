import { useEffect, useRef, useState } from 'react'
import { OlaMaps } from 'olamaps-web-sdk'
import { fetchNearbyIslamicInstitutions } from '../../services/olaPlacesAPI'
import { getOlaApiKey, getOlaStyleJsonUrl } from '../../services/olaMapsConfig'

const SOUTH_ASIA_CENTER = [17, 79]
const DEFAULT_ZOOM = 10
const MASJID_FETCH_RADIUS = 15000

export default function LocationMapPicker({ initialCenter, onSelectLocation, onCancel }) {
  const initialLat = initialCenter?.lat ?? initialCenter?.latitude ?? null
  const initialLon = initialCenter?.lon ?? initialCenter?.lng ?? initialCenter?.longitude ?? null
  const hasInitial = Number.isFinite(initialLat) && Number.isFinite(initialLon)
  const center = hasInitial ? [initialLat, initialLon] : SOUTH_ASIA_CENTER
  const [selected, setSelected] = useState(hasInitial ? [initialLat, initialLon] : null)
  const [masjids, setMasjids] = useState([])
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const olaRef = useRef(null)
  const selectedMarkerRef = useRef(null)
  const poiMarkersRef = useRef([])

  useEffect(() => {
    const lat = center[0]
    const lon = center[1]
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
    fetchNearbyIslamicInstitutions({ lat, lon }, { radius: MASJID_FETCH_RADIUS })
      .then(setMasjids)
      .catch(() => setMasjids([]))
  }, [center[0], center[1]])

  const handleConfirm = () => {
    if (selected) onSelectLocation({ lat: selected[0], lon: selected[1] })
    onCancel?.()
  }

  useEffect(() => {
    let mounted = true
    const apiKey = getOlaApiKey()
    if (!apiKey || !containerRef.current || mapRef.current) return undefined
    olaRef.current = new OlaMaps({ apiKey })
    ;(async () => {
      try {
        // OlaMaps Web SDK expects `style` to be a URL string (it calls `.includes()` internally).
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
          styleUrl = rawStyleUrl
        }
        const map = await olaRef.current.init({
          style: styleUrl,
          container: containerRef.current,
          center: [center[1], center[0]],
          zoom: DEFAULT_ZOOM,
        })
        if (!mounted) return
        mapRef.current = map
        map.on('click', (e) => {
          const lngLat = e.lngLat
          if (!lngLat) return
          setSelected([lngLat.lat, lngLat.lng])
        })
      } catch {
        // no-op; overlay still allows cancel
      }
    })()
    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selected) return
    if (!selectedMarkerRef.current) {
      selectedMarkerRef.current = new OlaMaps.Marker({ color: '#f59e0b' })
        .setLngLat([selected[1], selected[0]])
        .addTo(map)
    } else {
      selectedMarkerRef.current.setLngLat([selected[1], selected[0]])
    }
  }, [selected?.[0], selected?.[1]])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const m of poiMarkersRef.current) m.remove()
    poiMarkersRef.current = []
    for (const p of masjids.slice(0, 120)) {
      const marker = new OlaMaps.Marker({ color: '#0ea5e9' })
        .setLngLat([p.lon, p.lat])
        .addTo(map)
      poiMarkersRef.current.push(marker)
    }
  }, [masjids])

  return (
    <div className="fixed inset-0 z-100 flex flex-col bg-background text-foreground">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card text-card-foreground">
        <p className="text-sm text-foreground">Tap on the map to choose your location. Masjid markers shown.</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selected}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Use this location
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-[300px] relative">
        <div ref={containerRef} className="w-full h-full min-h-[300px]" />
      </div>
    </div>
  )
}
