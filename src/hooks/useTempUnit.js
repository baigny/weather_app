import { useState, useCallback } from 'react'

const useTempUnit = (defaultUnit = 'C') => {
  const [unit, setUnit] = useState(defaultUnit)

  const toggle = useCallback(() => {
    setUnit((prev) => (prev === 'C' ? 'F' : 'C'))
  }, [])

  const convert = useCallback(
    (celsius) => (unit === 'C' ? celsius : celsius * 9 / 5 + 32),
    [unit]
  )

  const format = useCallback(
    (celsius) => `${Math.round(convert(celsius))}°${unit}`,
    [convert, unit]
  )

  return { unit, toggle, format }
}

export default useTempUnit
