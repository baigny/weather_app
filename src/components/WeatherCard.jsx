import { use } from 'react'

const WeatherCard = ({ weatherPromise }) => {
  const weather = use(weatherPromise)

  return (
    <>
      <h2 className="text-2xl font-semibold mb-1">
        {weather.name}, {weather.sys?.country}
      </h2>
      <img
        src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`}
        alt={weather.weather[0].description}
        className="mx-auto"
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
