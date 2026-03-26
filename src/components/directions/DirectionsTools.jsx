import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import DirectionsTool from '@/components/common/DirectionsTool'

export default function DirectionsTools() {
  const location = useLocation()
  const navigate = useNavigate()
  const sp = useMemo(() => new URLSearchParams(location.search || ''), [location.search])

  const update = (mutate, { replace = false } = {}) => {
    const next = new URLSearchParams(location.search || '')
    mutate(next)
    const search = next.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace })
  }

  const hasAnyRouteParams =
    sp.get('fromLat') || sp.get('toLat') || sp.get('route') || sp.get('routeTs')

  return (
    <div className="space-y-6">
      <DirectionsTool
        title="Directions"
        requireDestination={false}
        collapsePanelOnRoute={false}
      />

      <Button
        type="button"
        variant="ghost"
        className="w-full justify-center rounded-full border border-white/15 bg-white/5 text-white/90 hover:bg-white/10 shadow-none"
        disabled={!hasAnyRouteParams}
        onClick={() => {
          update((next) => {
            next.delete('mode')
            next.delete('fromLat')
            next.delete('fromLon')
            next.delete('fromLabel')
            next.delete('toLat')
            next.delete('toLon')
            next.delete('toLabel')
            next.delete('route')
            next.delete('routeTs')
          })
        }}
      >
        Reset directions
      </Button>
    </div>
  )
}

