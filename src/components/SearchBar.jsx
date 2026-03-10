import { useState, useEffect, useRef } from 'react'
import { searchCities } from '../services/weatherAPI'
import useDebounce from '../hooks/useDebounce'

const SearchBar = ({ onSelect }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const debouncedQuery = useDebounce(query)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      return
    }
    searchCities(debouncedQuery).then(setResults)
  }, [debouncedQuery])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (city) => {
    setQuery(city.label)
    setIsOpen(false)
    setResults([])
    onSelect(city)
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    onSelect(null)
  }

  return (
    <div ref={wrapperRef} className="relative w-full mb-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search city"
          className="w-full px-3 py-2 rounded-lg bg-white/20 text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/40 text-sm"
        />
        {query && (
          <button
            onClick={handleClear}
            className="px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition cursor-pointer text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute z-10 top-full mt-1 w-full bg-gray-900/90 backdrop-blur-md rounded-lg overflow-hidden shadow-lg">
          {results.map((city) => (
            <li
              key={`${city.lat}-${city.lon}`}
              onClick={() => handleSelect(city)}
              className="px-3 py-2 text-sm text-white/90 hover:bg-white/20 cursor-pointer transition"
            >
              {city.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default SearchBar
