/**
 * Card showing masjid details (synced with admin form): full info – name, address, state, district,
 * locality, city, colony, contact, imam, prayer/iqamah, jummah, images, Navigate.
 */
import { Link } from 'react-router-dom'
import { buildOlaDirectionsUrl } from '../../services/olaMapsConfig'

const PRAYER_KEYS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

function openNavigate(lat, lon) {
  if (lat == null || lon == null) return
  const url = buildOlaDirectionsUrl(lat, lon)
  window.open(url, '_blank', 'noopener,noreferrer')
}

export default function MasjidCard({ masjid, showAsLink = true, compact = false, detail = false }) {
  if (!masjid) return null

  const iqamah = masjid.iqamah_times || {}
  const jummah = Array.isArray(masjid.jummah_times) ? masjid.jummah_times : []
  const hasPrayer = PRAYER_KEYS.some((k) => iqamah[k]) || jummah.length > 0
  const images = Array.isArray(masjid.images) ? masjid.images : []

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900 flex-1 min-w-0 pr-1 wrap-break-words">
          {masjid.name}
        </h3>
      </div>

      {masjid.address && (
        <p className="text-sm text-gray-600 mt-0.5">{masjid.address}</p>
      )}

      {(detail || masjid.state || masjid.district) && (masjid.state || masjid.district) && (
        <p className="text-sm text-gray-500">
          {[masjid.district, masjid.state].filter(Boolean).join(', ')}
        </p>
      )}
      {(masjid.city || masjid.locality || masjid.colony) && (
        <p className="text-sm text-gray-500">
          {[masjid.locality, masjid.colony, masjid.city].filter(Boolean).join(', ')}
        </p>
      )}

      {!hasPrayer && images.length === 0 && (
        <p className="text-xs text-gray-500 mt-0.5">Type: Masjid</p>
      )}

      {detail && (masjid.imam_name || masjid.contact) && (
        <div className="mt-2 pt-2 border-t border-gray-100 text-sm text-gray-600">
          {masjid.imam_name && <p>Imam: {masjid.imam_name}</p>}
          {masjid.contact && <p>Contact: {masjid.contact}</p>}
        </div>
      )}

      {hasPrayer && (!compact || detail) && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Prayer / Iqamah
          </h4>
          <ul className="grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-1 text-sm text-gray-700">
            {PRAYER_KEYS.map((k) =>
              iqamah[k] ? (
                <li key={k}>
                  {k}: <span className="font-medium">{iqamah[k]}</span>
                </li>
              ) : null
            )}
          </ul>
          {jummah.length > 0 && (
            <p className="text-sm text-gray-700 mt-1">Jummah: {jummah.join(', ')}</p>
          )}
        </div>
      )}

      {detail && images.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Photos</h4>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((img) => (
              <img
                key={img.storage_path || img.url}
                src={img.url}
                alt=""
                className="w-20 h-20 object-cover rounded-lg shrink-0"
              />
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openNavigate(masjid.lat, masjid.lon)
        }}
        className="mt-3 w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 cursor-pointer"
      >
        Navigate
      </button>
    </>
  )

  const cardClass =
    'block w-full text-left p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition'

  if (showAsLink && masjid.id) {
    return (
      <Link to={`/masjids/${masjid.id}`} className={cardClass}>
        {content}
      </Link>
    )
  }

  return <div className={cardClass}>{content}</div>
}
