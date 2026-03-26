import { useEffect, useRef, useState } from 'react'
import { OlaMaps } from 'olamaps-web-sdk'
import { fetchNearbyIslamicInstitutions } from '../../services/olaPlacesAPI'
import { fetchOlaStyleJson, getOlaApiKey, getOlaStyleJsonUrl } from '../../services/olaMapsConfig'

const SOUTH_ASIA_CENTER = [17, 79]
const DEFAULT_ZOOM = 10
const MASJID_FETCH_RADIUS = 15000

export default function LocationMapPicker({ initialCenter, onSelectLocation, onCancel }) {
  const center = initialCenter ? [initialCenter.lat, initialCenter.lon] : SOUTH_ASIA_CENTER
  const [selected, setSelected] = useState(initialCenter ? [initialCenter.lat, initialCenter.lon] : null)
  const [masjids, setMasjids] = useState([])
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const olaRef = useRef(null)
  const selectedMarkerRef = useRef(null)
  const poiMarkersRef = useRef([])

  useEffect(() => {
    const lat = center[0]
    const lon = center[1]
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
        let style = getOlaStyleJsonUrl()
        try {
          style = await fetchOlaStyleJson({ strip3dModels: true })
        } catch {
          // fall back to URL style
        }
        const map = await olaRef.current.init({
          style,
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
    <div className="fixed inset-0 z-100 flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
        <p className="text-sm text-gray-700">Tap on the map to choose your location. Masjid markers shown.</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selected}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
