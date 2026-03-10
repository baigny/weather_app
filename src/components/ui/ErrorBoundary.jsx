import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'

const ErrorFallback = () => (
  <p className="text-lg text-red-200">
    Could not get your location. Please allow location access.
  </p>
)

const ErrorBoundary = ({ children }) => (
  <ReactErrorBoundary FallbackComponent={ErrorFallback}>
    {children}
  </ReactErrorBoundary>
)

export default ErrorBoundary
