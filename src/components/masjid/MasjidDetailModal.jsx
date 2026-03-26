/**
 * Modal showing masjid details: name, address, prayer times, lat/lon.
 * Includes "Suggest Salah Time Correction" button.
 */
export default function MasjidDetailModal({ masjid, onClose }) {
  if (!masjid) return null

  const timings = masjid.timings || {}
  const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto text-gray-900 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-2 mb-3">
          <h3 className="text-lg font-semibold">{masjid.name}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {masjid.address && (
          <p className="text-sm text-gray-600 mb-2">
            <span className="font-medium">Address:</span> {masjid.address}
          </p>
        )}
        {(masjid.lat != null || masjid.lon != null) && (
          <p className="text-sm text-gray-600 mb-3 font-mono">
            <span className="font-medium">Latitude:</span> {masjid.lat?.toFixed(5) ?? '—'},{' '}
            <span className="font-medium">Longitude:</span> {masjid.lon?.toFixed(5) ?? '—'}
          </p>
        )}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Prayer times</p>
        <ul className="text-sm text-gray-700 space-y-0.5 mb-4">
          {prayerNames.map((name) => (
            <li key={name}>
              {name}: {timings[name] ?? '—'}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => window.open('mailto:support@example.com?subject=Salah%20Time%20Correction%20suggestion', '_blank')}
          className="w-full py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600"
        >
          Suggest Salah Time Correction
        </button>
      </div>
    </div>
  )
}
