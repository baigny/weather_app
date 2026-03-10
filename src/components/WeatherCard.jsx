import { use, useEffect } from 'react'
import { getWeatherTheme } from '../utils/weatherTheme'

const getIconUrl = (code) =>
  `https://openweathermap.org/img/wn/${code}@2x.png`

const WeatherCard = ({ weatherPromise, onWeatherLoad }) => {
  const weather = use(weatherPromise)
  const icon = weather.weather[0].icon

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
      <p className="text-5xl font-bold mb-2">{Math.round(weather.main.temp)}°C</p>
      <p className="text-lg capitalize mb-4">{weather.weather[0].description}</p>
      <div className="flex justify-around text-sm">
        <span>Humidity: {weather.main.humidity}%</span>
        <span>Wind: {Math.round(weather.wind.speed)} m/s</span>
      </div>
    </>
  )
}

export default WeatherCard
