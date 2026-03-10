import { Suspense } from 'react'
import { fetchLocalWeather } from './services/weatherAPI'
import ErrorBoundary from './components/ui/ErrorBoundary'
import LoadingSpinner from './components/ui/LoadingSpinner'
import WeatherCard from './components/WeatherCard'
import './App.css'

const weatherPromise = fetchLocalWeather()

const App = () => (
  <div className="flex flex-col items-center justify-center bg-linear-to-br from-blue-400 to-blue-600 p-4">
    <h1 className="text-white text-4xl font-bold mb-6">Weather App</h1>

    <div className="bg-white/20 backdrop-blur-md rounded-2xl p-8 text-white min-w-75 text-center shadow-lg">
      <ErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <WeatherCard weatherPromise={weatherPromise} />
        </Suspense>
      </ErrorBoundary>
    </div>
  </div>
)

export default App
