const themes = {
  thunderstorm: { bg: 'from-gray-900 to-purple-900' },
  drizzle: { bg: 'from-gray-400 to-blue-400' },
  rain: { bg: 'from-gray-600 to-blue-800' },
  snow: { bg: 'from-blue-100 to-gray-300' },
  clear: { bg: 'from-yellow-400 to-orange-500' },
  clouds: { bg: 'from-gray-400 to-gray-600' },
  mist: { bg: 'from-gray-300 to-gray-500' },
  default: { bg: 'from-blue-400 to-blue-600' },
}

// OpenWeatherMap uses weather IDs — map ranges to themes
// https://openweathermap.org/weather-conditions
const getThemeByWeatherId = (id) => {
  if (id >= 200 && id < 300) return themes.thunderstorm
  if (id >= 300 && id < 400) return themes.drizzle
  if (id >= 500 && id < 600) return themes.rain
  if (id >= 600 && id < 700) return themes.snow
  if (id >= 700 && id < 800) return themes.mist
  if (id === 800) return themes.clear
  if (id > 800) return themes.clouds
  return themes.default
}

export const getWeatherTheme = (weather) => {
  const id = weather?.weather?.[0]?.id
  return id ? getThemeByWeatherId(id) : themes.default
}
