import { clampMasjidRadiusKm } from './masjidSearchService'

export function parseSearchIntent(raw) {
  const q = (raw || '').toLowerCase().trim()
  if (!q) return { intent: 'weather', filters: { radiusKm: null, nearMe: false, locationText: null } }

  const wantsMasjid =
    /masjid|mosque/.test(q) ||
    /near me/.test(q) ||
    /within\s*\d+(?:\.\d+)?\s*km/.test(q)
  const wantsWeather = /weather/.test(q) || (!wantsMasjid && q.length > 0)

  let radiusKm = null
  const withinMatch = q.match(/within\s*(\d+(?:\.\d+)?)\s*km/)
  if (withinMatch) radiusKm = clampMasjidRadiusKm(parseFloat(withinMatch[1]))

  const nearMe = /near me/.test(q)

  const tokens = q.split(/\s+/)
  const ignored = new Set(['weather', 'masjid', 'mosque', 'near', 'me', 'within', 'km', 'in'])
  const locationTokens = tokens.filter((t) => !ignored.has(t))
  const locationText = locationTokens.join(' ').trim() || null

  const intent = wantsMasjid ? 'masjid' : wantsWeather ? 'weather' : 'weather'

  return {
    intent,
    filters: {
      radiusKm,
      nearMe,
      locationText,
    },
  }
}

