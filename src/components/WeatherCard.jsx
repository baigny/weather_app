import { use, useEffect } from 'react'
import { getWeatherTheme } from '../utils/weatherTheme'
import useTempUnit from '../hooks/useTempUnit'

const getIconUrl = (code) =>
  `https://openweathermap.org/img/wn/${code}@2x.png`

const WeatherCard = ({ weatherPromise, onWeatherLoad }) => {
  const weather = use(weatherPromise)
  const icon = weather.weather[0].icon
  const { unit, toggle, format } = useTempUnit()

  useEffect(() => {
    onWeatherLoad?.(getWeatherTheme(weather))
  }, [weather, onWeatherLoad])

  return (
    <>
      <h2 className="text-2xl font-semibold mb-1">
        {weather.name}, {weather.sys?.country}
      </h2>
      <img
        src={getIconUrl(icon)}
        alt={weather.weather[0].description}
        className="mx-auto w-24 h-24"
      />
      <p className="text-5xl font-bold mb-2">{format(weather.main.temp)}</p>
      <p className="text-lg capitalize mb-4">{weather.weather[0].description}</p>
      <div className="flex justify-around text-sm mb-4">
        <span>Humidity: {weather.main.humidity}%</span>
        <span>Wind: {Math.round(weather.wind.speed)} m/s</span>
      </div>
      <button
        onClick={toggle}
        className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition cursor-pointer text-sm font-medium"
      >
        Switch to °{unit === 'C' ? 'F' : 'C'}
      </button>
    </>
  )
}

export default WeatherCard
