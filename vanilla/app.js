const API_KEY = '2adfb231c72f554d0fc7d85df7c44da5'
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather'

// DOM references
const app = document.getElementById('app')
const loadingEl = document.getElementById('loading')
const errorEl = document.getElementById('error')
const weatherEl = document.getElementById('weather')
const locationEl = document.getElementById('location')
const iconEl = document.getElementById('icon')
const tempEl = document.getElementById('temp')
const descEl = document.getElementById('desc')
const humidityEl = document.getElementById('humidity')
const windEl = document.getElementById('wind')
const toggleBtn = document.getElementById('toggle-unit')

// State
let weatherData = null
let unit = 'C'

// --- API ---

const fetchWeatherByCoords = async (lat, lon) => {
  const res = await fetch(
    `${BASE_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
  )
  if (!res.ok) throw new Error('Failed to fetch weather data')
  return res.json()
}

const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 10000,
      maximumAge: 300000,
    })
  })

// --- Theme ---

const getThemeClass = (id) => {
  if (id >= 200 && id < 300) return 'theme-thunderstorm'
  if (id >= 300 && id < 400) return 'theme-drizzle'
  if (id >= 500 && id < 600) return 'theme-rain'
  if (id >= 600 && id < 700) return 'theme-snow'
  if (id >= 700 && id < 800) return 'theme-mist'
  if (id === 800) return 'theme-clear'
  if (id > 800) return 'theme-clouds'
  return ''
}

// --- Temperature ---

const formatTemp = (celsius) => {
  const value = unit === 'C' ? celsius : celsius * 9 / 5 + 32
  return `${Math.round(value)}°${unit}`
}

// --- Render ---

const showLoading = () => {
  loadingEl.style.display = 'flex'
  errorEl.style.display = 'none'
  weatherEl.style.display = 'none'
}

const showError = () => {
  loadingEl.style.display = 'none'
  errorEl.style.display = 'block'
  weatherEl.style.display = 'none'
}

const renderWeather = () => {
  if (!weatherData) return

  const { name, sys, weather, main, wind } = weatherData
  const icon = weather[0].icon
  const weatherId = weather[0].id

  locationEl.textContent = `${name}, ${sys?.country ?? ''}`
  iconEl.src = `https://openweathermap.org/img/wn/${icon}@2x.png`
  iconEl.alt = weather[0].description
  tempEl.textContent = formatTemp(main.temp)
  descEl.textContent = weather[0].description
  humidityEl.textContent = `Humidity: ${main.humidity}%`
  windEl.textContent = `Wind: ${Math.round(wind.speed)} m/s`
  toggleBtn.textContent = `Switch to °${unit === 'C' ? 'F' : 'C'}`

  // Apply theme
  app.className = `container ${getThemeClass(weatherId)}`

  loadingEl.style.display = 'none'
  errorEl.style.display = 'none'
  weatherEl.style.display = 'block'
}

// --- Events ---

toggleBtn.addEventListener('click', () => {
  unit = unit === 'C' ? 'F' : 'C'
  renderWeather()
})

// --- Init ---

const init = async () => {
  showLoading()
  try {
    const { coords } = await getCurrentPosition()
    console.log('Location:', coords.latitude, coords.longitude)
    weatherData = await fetchWeatherByCoords(coords.latitude, coords.longitude)
    console.log('Weather:', weatherData)
    renderWeather()
  } catch (err) {
    console.error('Error:', err)
    showError()
  }
}

init()
