const LoadingSpinner = ({ label = 'Loading', tone = 'light' }) => (
  <div className="flex flex-col items-center gap-3">
    <div
      className={
        tone === 'amber'
          ? 'w-10 h-10 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin'
          : 'w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin'
      }
    />
    <p className={tone === 'amber' ? 'text-sm text-amber-900/80' : 'text-lg text-white/80'}>
      {label}
    </p>
  </div>
)

export default LoadingSpinner
