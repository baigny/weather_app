import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'

const isLocationError = (e) => {
  const msg = (e?.message || '').toLowerCase()
  return msg.includes('location') || msg.includes('geolocation') || msg.includes('permission') || e?.code === 1
}

const ErrorFallback = ({ error, resetErrorBoundary }) => {
  const message = isLocationError(error)
    ? 'Could not get your location. Please allow location access or pick a place from the map.'
    : (error?.message || 'Something went wrong. Please check your connection and try again.')
  return (
    <div className="text-center">
      <p className="text-lg text-red-200">{message}</p>
      {resetErrorBoundary && (
        <button
          type="button"
          onClick={resetErrorBoundary}
          className="mt-2 px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm hover:bg-white/30"
        >
          Try again
        </button>
      )}
    </div>
  )
}

const ErrorBoundary = ({ children }) => (
  <ReactErrorBoundary FallbackComponent={ErrorFallback}>
    {children}
  </ReactErrorBoundary>
)

export default ErrorBoundary
