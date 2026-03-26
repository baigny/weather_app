import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ErrorBoundary } from 'react-error-boundary'
import MasjidMap from '../components/masjid/MasjidMap'
import MasjidCard from '../components/masjid/MasjidCard'
import Pagination from '../components/ui/Pagination'
import { DEFAULT_SEARCH_RADIUS_KM, searchMasjids } from '../services/masjidSearchService'

const RESULTS_PAGE_SIZE = 10

const MasjidsPage = () => {
  const location = useLocation()
  const homeLocation = location?.state?.coords ?? null
  const listFromHome = location?.state?.nearbyMasjids

  const [searchResults, setSearchResults] = useState(() => (Array.isArray(listFromHome) ? listFromHome : []))
  const [searchCenter, setSearchCenter] = useState(homeLocation)
  const [searching, setSearching] = useState(!listFromHome)
  const [searchError, setSearchError] = useState(null)
  const [selectedMasjid, setSelectedMasjid] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [resultsPage, setResultsPage] = useState(1)

  useEffect(() => {
    if (listFromHome != null) return
    let cancelled = false
    setSearching(true)
    setSearchError(null)
    const center = homeLocation || { lat: 17.4, lon: 78.5 }
    searchMasjids('', { lastNearCenter: center, radiusKm: DEFAULT_SEARCH_RADIUS_KM })
      .then(({ masjids, center: c }) => {
        if (!cancelled) {
          setSearchResults(Array.isArray(masjids) ? masjids : [])
          if (c) setSearchCenter(c)
          setResultsPage(1)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSearchError(err?.message || 'Search failed')
          setSearchResults([])
        }
      })
      .finally(() => {
        if (!cancelled) setSearching(false)
      })
    return () => { cancelled = true }
  }, [homeLocation, listFromHome])

  const handleSelectMasjid = (m) => {
    setSelectedMasjid(m || null)
  }

  return (
    <main className="flex-1 flex flex-col lg:flex-row min-h-[calc(100vh-8rem)]">
        {/* Left: same list as Home (passed via state or fetched). Back goes to Home. */}
        <div className="w-full lg:w-[380px] shrink-0 flex flex-col border-r border-(--surface-glass-border) bg-(--surface-glass) backdrop-blur-md text-(--surface-glass-text)">
          {searchError && (
            <p className="px-3 py-2 text-xs text-destructive bg-destructive/10 border-b border-border">{searchError}</p>
          )}
          <div className="flex-1 overflow-y-auto p-3">
            {selectedMasjid ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Selected</span>
                  <button
                    type="button"
                    onClick={() => setSelectedMasjid(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
                <MasjidCard masjid={selectedMasjid} showAsLink={false} detail />
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} in and around this search
                  (within {DEFAULT_SEARCH_RADIUS_KM} km)
                </p>
                {searching ? (
                  <p className="text-muted-foreground text-sm">Loading…</p>
                ) : searchResults.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No masjids in and around this area (within {DEFAULT_SEARCH_RADIUS_KM} km). To see other masjids,
                    update location on Home.
                  </p>
                ) : (
                  <>
                    <ul className="space-y-2">
                      {searchResults
                        .slice((resultsPage - 1) * RESULTS_PAGE_SIZE, resultsPage * RESULTS_PAGE_SIZE)
                        .map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => handleSelectMasjid(m)}
                              className="w-full text-left p-3 rounded-xl border border-border hover:border-primary hover:bg-accent/40 transition"
                            >
                              <span className="font-medium text-foreground block whitespace-normal wrap-break-word leading-snug">{m.name}</span>
                              {(m.address || m.city) && (
                                <span className="text-xs text-muted-foreground block whitespace-normal wrap-break-word leading-snug mt-0.5">
                                  {[m.address, m.city].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                    </ul>
                    <Pagination
                      currentPage={resultsPage}
                      totalItems={searchResults.length}
                      pageSize={RESULTS_PAGE_SIZE}
                      onPrevious={() => setResultsPage((p) => p - 1)}
                      onNext={() => setResultsPage((p) => p + 1)}
                      className="mt-3"
                    />
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: map – markers from API search results */}
        <div className="flex-1 min-h-[400px] relative flex flex-col">
          <ErrorBoundary>
            <MasjidMap
              masjids={
                selectedMasjid && !searchResults.some((m) => m.id === selectedMasjid.id)
                  ? [...searchResults, selectedMasjid]
                  : searchResults
              }
              onSelectMasjid={handleSelectMasjid}
              onUserLocation={setUserLocation}
              searchCenter={searchCenter}
              selectedMasjidId={selectedMasjid?.id}
              initialCenter={{ lat: 17.0, lon: 79.0 }}
              initialZoom={6}
            />
          </ErrorBoundary>
        </div>
    </main>
  )
}

export default MasjidsPage
