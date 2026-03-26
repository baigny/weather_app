import { use, useEffect, useMemo, useRef } from 'react'
import { getWeatherTheme } from '../utils/weatherTheme'
import useTempUnit from '../hooks/useTempUnit'

const getIconUrl = (code) =>
  `https://openweathermap.org/img/wn/${code}@2x.png`

const WeatherCard = ({ weatherPromise, onWeatherLoad, onLocationResolved, onCoordsResolved, tempUnit, formatTemp }) => {
  const weather = use(weatherPromise)
  const icon = weather.weather[0].icon
  const fallback = useTempUnit()
  const format = useMemo(() => formatTemp || fallback.format, [formatTemp, fallback.format])

  const onWeatherLoadRef = useRef(onWeatherLoad)
  const onLocationResolvedRef = useRef(onLocationResolved)
  const onCoordsResolvedRef = useRef(onCoordsResolved)
  onWeatherLoadRef.current = onWeatherLoad
  onLocationResolvedRef.current = onLocationResolved
  onCoordsResolvedRef.current = onCoordsResolved

  useEffect(() => {
    const theme = getWeatherTheme(weather)
    onWeatherLoadRef.current?.(theme)
    onLocationResolvedRef.current?.({
      name: weather?.name,
      country: weather?.sys?.country,
    })
    if (weather?.coord) {
      onCoordsResolvedRef.current?.({ lat: weather.coord.lat, lon: weather.coord.lon })
    }
  }, [weather])

  return (
    <>
      <div className="flex items-center justify-between gap-4 mt-1 mb-3">
        <div className="flex items-center gap-3">
          <img
            src={getIconUrl(icon)}
            alt={weather.weather[0].description}
            className="w-16 h-16"
          />
          <div className="text-left">
            <p className="text-5xl font-bold leading-none">{format(weather.main.temp)}</p>
            <p className="text-sm capitalize text-white/90 mt-0.5">
              {weather.weather[0].description}
            </p>
          </div>
        </div>

        <div className="text-right text-sm text-white/90">
          <p>
            <span className="text-white/70">Humidity</span> {weather.main.humidity}%
          </p>
          <p>
            <span className="text-white/70">Wind</span> {Math.round(weather.wind.speed)} m/s
          </p>
        </div>
      </div>
    </>
  )
}

export default WeatherCard
