const API_KEY = import.meta.env.VITE_WEATHER_API_KEY
const BASE_URL = import.meta.env.VITE_BASE_URL
const GEO_URL = import.meta.env.VITE_GEO_URL

export const fetchWeatherByCoords = async (lat, lon) => {
  const res = await fetch(
    `${BASE_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
  )
  if (!res.ok) throw new Error('Failed to fetch weather data')
  return res.json()
}

export const fetchWeatherByCity = async (city) => {
  const res = await fetch(
    `${BASE_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`
  )
  if (!res.ok) throw new Error('City not found')
  return res.json()
}

export const searchCities = async (query) => {
  if (!query || query.length < 2) return []
  const res = await fetch(
    `${GEO_URL}?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`
  )
  if (!res.ok) return []
  const data = await res.json()
  return data.map((c) => ({
    name: c.name,
    country: c.country,
    state: c.state,
    lat: c.lat,
    lon: c.lon,
    label: [c.name, c.state, c.country].filter(Boolean).join(', '),
  }))
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