import { getCurrentPosition } from './weatherAPI'
import { hasIslamiCloudKey, fetchPrayerTimes as fetchICPrayerTimes } from './islamicloudAPI'

const ALADHAN_BASE = 'https://api.aladhan.com/v1'

const stripTime = (t) => String(t ?? '').trim().split(' ')[0] // "05:12 (IST)" -> "05:12"

/** Al-Adhan API response → same shape as IslamiCloud (timings + date) */
async function fetchAlAdhanTimings(lat, lon, method = 2) {
  const url =
    `${ALADHAN_BASE}/timings?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}` +
    `&method=${encodeURIComponent(method)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch prayer times')
  const json = await res.json()
  if (json?.code !== 200 || !json?.data) throw new Error('Invalid prayer times response')
  const timings = json.data.timings || {}
  const dateObj = json.data.date ?? null
  const hijri = dateObj?.hijri
  const hijriLabel = hijri
    ? `${hijri.day ?? ''} ${hijri.month?.en ?? hijri.month ?? ''} ${hijri.year ?? ''}`.trim()
    : null
  return {
    timings: {
      Fajr: stripTime(timings.Fajr),
      Sunrise: stripTime(timings.Sunrise),
      Dhuhr: stripTime(timings.Dhuhr),
      Asr: stripTime(timings.Asr),
      Maghrib: stripTime(timings.Maghrib),
      Isha: stripTime(timings.Isha),
    },
    date: dateObj,
    hijriLabel,
    meta: json.data.meta ?? null,
  }
}

/**
 * Prayer/azan times by coordinates.
 * Tries IslamiCloud when API key is set; on CORS/network error falls back to Al-Adhan.
 */
export const fetchPrayerTimesByCoords = async (lat, lon, { method = 2 } = {}) => {
  if (hasIslamiCloudKey()) {
    try {
      return await fetchICPrayerTimes(lat, lon)
    } catch {
      // CORS, network, or API error – use public Al-Adhan (no CORS issues)
      return fetchAlAdhanTimings(lat, lon, method)
    }
  }
  return fetchAlAdhanTimings(lat, lon, method)
}

const DEFAULT_LAT = 17.385
const DEFAULT_LON = 78.4867

export const fetchLocalPrayerTimes = async () => {
  let lat = DEFAULT_LAT
  let lon = DEFAULT_LON
  try {
    const { coords } = await getCurrentPosition()
    lat = coords.latitude
    lon = coords.longitude
  } catch {
    // Use default coords when location is denied or unavailable
  }
  try {
    return await fetchPrayerTimesByCoords(lat, lon)
  } catch (err) {
    throw new Error('Unable to load prayer times. Please check your connection and try again.')
  }
}
