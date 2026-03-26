function formatDistance(meters) {
  const m = Number(meters)
  if (!Number.isFinite(m) || m <= 0) return null
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

function formatDuration(seconds) {
  const s = Number(seconds)
  if (!Number.isFinite(s) || s <= 0) return null
  const hrs = Math.floor(s / 3600)
  const mins = Math.max(1, Math.round((s % 3600) / 60))
  return hrs > 0 ? `${hrs} hr ${mins} min` : `${mins} min`
}

export default function DistanceDuration({ distanceMeters, durationSeconds, className = '' }) {
  const d = formatDistance(distanceMeters)
  const t = formatDuration(durationSeconds)
  if (!d && !t) return null
  return (
    <div
      className={[
        'pointer-events-none inline-flex items-center gap-3 rounded-xl bg-white/90 px-3 py-2 text-xs font-medium text-slate-800 shadow-lg backdrop-blur',
        className,
      ].join(' ')}
      role="status"
      aria-label="Route distance and duration"
    >
      {d ? (
        <div className="inline-flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-500">DISTANCE</span>
          <span className="tabular-nums">{d}</span>
        </div>
      ) : null}
      {t ? (
        <div className="inline-flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-500">DURATION</span>
          <span className="tabular-nums">{t}</span>
        </div>
      ) : null}
    </div>
  )
}

