const API_KEY = import.meta.env.VITE_WEATHER_API_KEY
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather'

export const fetchWeatherByCoords = async (lat, lon) => {
  const res = await fetch(
    `${BASE_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
  )
  if (!res.ok) throw new Error('Failed to fetch weather data')
  return res.json()
}

export const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject)
  })

export const fetchLocalWeather = async () => {
  const { coords } = await getCurrentPosition()
  return fetchWeatherByCoords(coords.latitude, coords.longitude)
}