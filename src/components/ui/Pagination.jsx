/**
 * Reusable pagination: Previous / Page X of Y / Next.
 * @param {number} currentPage - 1-based page index
 * @param {number} totalItems - total number of items
 * @param {number} pageSize - items per page
 * @param {() => void} onPrevious
 * @param {() => void} onNext
 * @param {string} [className] - optional wrapper class
 * @param {string} [buttonClass] - optional button class (defaults to neutral)
 */
export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPrevious,
  onNext,
  className = '',
  buttonClass,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const prevDisabled = currentPage <= 1
  const nextDisabled = currentPage >= totalPages
  const defaultBtn =
    'px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
  const btn = buttonClass ?? defaultBtn

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <button type="button" disabled={prevDisabled} onClick={onPrevious} className={btn}>
        Previous
      </button>
      <span className="text-sm text-gray-600">
        Page {currentPage} of {totalPages}
      </span>
      <button type="button" disabled={nextDisabled} onClick={onNext} className={btn}>
        Next
      </button>
    </div>
  )
}
