const LoadingSpinner = () => (
  <div className="flex flex-col items-center gap-3">
    <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    <p className="text-lg text-white/80">Loading weather</p>
  </div>
)

export default LoadingSpinner
