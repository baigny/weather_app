/**
 * Modal showing masjid details: name, address, prayer times, lat/lon.
 * Includes "Suggest Salah Time Correction" button.
 */
export default function MasjidDetailModal({ masjid, onClose }) {
  if (!masjid) return null

  const timings = masjid.timings || {}
  const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center p-4 bg-foreground/50" onClick={onClose}>
      <div
        className="bg-card text-card-foreground rounded-xl border border-border shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-2 mb-3">
          <h3 className="text-lg font-semibold">{masjid.name}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {masjid.address && (
          <p className="text-sm text-muted-foreground mb-2">
            <span className="font-medium">Address:</span> {masjid.address}
          </p>
        )}
        {(masjid.lat != null || masjid.lon != null) && (
          <p className="text-sm text-muted-foreground mb-3 font-mono">
            <span className="font-medium">Latitude:</span> {masjid.lat?.toFixed(5) ?? '—'},{' '}
            <span className="font-medium">Longitude:</span> {masjid.lon?.toFixed(5) ?? '—'}
          </p>
        )}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Prayer times</p>
        <ul className="text-sm text-foreground space-y-0.5 mb-4">
          {prayerNames.map((name) => (
            <li key={name}>
              {name}: {timings[name] ?? '—'}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => window.open('mailto:support@example.com?subject=Salah%20Time%20Correction%20suggestion', '_blank')}
          className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          Suggest Salah Time Correction
        </button>
      </div>
    </div>
  )
}
