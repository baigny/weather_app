import { Suspense, useState } from 'react'
import { fetchLocalWeather } from './services/weatherAPI'
import { getWeatherTheme } from './utils/weatherTheme'
import ErrorBoundary from './components/ui/ErrorBoundary'
import LoadingSpinner from './components/ui/LoadingSpinner'
import WeatherCard from './components/WeatherCard'
import './App.css'

const weatherPromise = fetchLocalWeather()

const App = () => {
  const [theme, setTheme] = useState(null)
  const bg = theme?.bg ?? 'from-blue-400 to-blue-600'

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center bg-linear-to-br ${bg} p-4 transition-all duration-700`}>
      <h1 className="text-white text-4xl font-bold mb-6">Weather App</h1>

      <div className="bg-white/20 backdrop-blur-md rounded-2xl p-8 text-white min-w-75 text-center shadow-lg">
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <WeatherCard weatherPromise={weatherPromise} onWeatherLoad={setTheme} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}

export default App
