import { Suspense, useState, useTransition } from 'react'
import { fetchLocalWeather, fetchWeatherByCoords } from './services/weatherAPI'
import { getWeatherTheme } from './utils/weatherTheme'
import ErrorBoundary from './components/ui/ErrorBoundary'
import LoadingSpinner from './components/ui/LoadingSpinner'
import WeatherCard from './components/WeatherCard'
import SearchBar from './components/SearchBar'
import './App.css'

const localWeatherPromise = fetchLocalWeather()

const App = () => {
  const [theme, setTheme] = useState(null)
  const [weatherPromise, setWeatherPromise] = useState(localWeatherPromise)
  const [, startTransition] = useTransition()
  const bg = theme?.bg ?? 'from-blue-400 to-blue-600'

  const handleCitySelect = (city) => {
    if (!city) {
      startTransition(() => setWeatherPromise(localWeatherPromise))
      return
    }
    startTransition(() =>
      setWeatherPromise(fetchWeatherByCoords(city.lat, city.lon))
    )
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center bg-linear-to-br ${bg} p-4 transition-all duration-700`}>
      <h1 className="text-white text-4xl font-bold mb-6">Weather App</h1>

     <div className="bg-white/20 backdrop-blur-md rounded-2xl p-8 text-white w-80 shadow-lg">
        <div className="text-left">
          <SearchBar onSelect={handleCitySelect} />
        </div>
        <div className="text-center">
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <WeatherCard weatherPromise={weatherPromise} onWeatherLoad={setTheme} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}

export default App
