/**
 * Drawer/Sheet for masjid details: name, address, distance, prayer/jummah if available, Start Navigation.
 */
import { formatDistanceMeters, meaningfulRoadDistanceMeters } from '../../services/geo'
import { buildOlaDirectionsUrl } from '../../services/olaMapsConfig'

export default function MasjidDrawer({ masjid, route, open, onClose, onStartNavigation }) {
  if (!open || !masjid) return null

  const roadM = meaningfulRoadDistanceMeters(route?.distanceMeters)
  const distanceLabel = roadM != null ? formatDistanceMeters(roadM) : null
  const durationMin =
    route?.durationSeconds != null && Number.isFinite(route.durationSeconds)
      ? Math.max(1, Math.round(route.durationSeconds / 60))
      : null

  function handleStartNavigation() {
    if (onStartNavigation) onStartNavigation()
    else {
      const { lat, lon } = masjid
      const url = buildOlaDirectionsUrl(lat, lon)
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const iqamah = masjid.iqamah_times || {}
  const jummah = masjid.jummah_times || []
  const images = Array.isArray(masjid.images) ? masjid.images : []

  return (
    <>
      <div
        className="fixed inset-0 bg-foreground/35 z-40"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-60 bg-card text-card-foreground rounded-t-2xl border border-border shadow-xl max-h-[85vh] overflow-y-auto safe-area-pb"
        role="dialog"
        aria-label="Masjid details"
      >
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-semibold text-foreground truncate pr-2">{masjid.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          {masjid.address && (
            <p className="text-sm text-muted-foreground">{masjid.address}</p>
          )}
          {masjid.city && (
            <p className="text-sm text-muted-foreground">City: {masjid.city}</p>
          )}

          {(distanceLabel != null || durationMin != null) && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Drive (roads):</span>
              <span className="font-medium text-foreground">{distanceLabel ?? '—'}</span>
              {durationMin != null && (
                <span className="text-muted-foreground">· {durationMin} min</span>
              )}
            </div>
          )}

          {images.length > 0 && (
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Photos</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img) => (
                  <img
                    key={img.storage_path || img.url}
                    src={img.url}
                    alt=""
                    className="w-24 h-24 object-cover rounded-lg shrink-0"
                  />
                ))}
              </div>
            </div>
          )}

          {(Object.keys(iqamah).length > 0 || jummah.length > 0) && (
            <div className="border-t border-border pt-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Iqamah / Prayer</h3>
              {Object.keys(iqamah).length > 0 && (
                <ul className="text-sm text-muted-foreground space-y-1">
                  {['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map((k) =>
                    iqamah[k] ? (
                      <li key={k}>{k}: {iqamah[k]}</li>
                    ) : null
                  )}
                </ul>
              )}
              {jummah.length > 0 && (
                <p className="text-sm text-muted-foreground">Jummah: {jummah.join(', ')}</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleStartNavigation}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 cursor-pointer"
          >
            Start Navigation
          </button>
        </div>
      </div>
    </>
  )
}
