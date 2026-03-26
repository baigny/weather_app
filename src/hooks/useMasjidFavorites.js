import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'masjid_favorites'

function loadFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveFavorites(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {}
}

export function useMasjidFavorites() {
  const [favoriteIds, setFavoriteIds] = useState(loadFavorites)

  useEffect(() => {
    saveFavorites(favoriteIds)
  }, [favoriteIds])

  const toggleFavorite = useCallback((id) => {
    setFavoriteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }, [])

  const isFavorite = useCallback(
    (id) => favoriteIds.includes(id),
    [favoriteIds]
  )

  return { favoriteIds, toggleFavorite, isFavorite }
}
