import { useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import OlaDirectionsPanel from '@/components/directions/OlaDirectionsPanel'
import OlaRouteOptimizerPanel from '@/components/directions/OlaRouteOptimizerPanel'

export default function DirectionsTools() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
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
      <Tabs defaultValue="directions">
        <TabsList className="w-full" variant="default">
          <TabsTrigger value="directions" className="flex-1">Directions</TabsTrigger>
          <TabsTrigger value="optimizer" className="flex-1">Route Optimizer</TabsTrigger>
        </TabsList>

        <TabsContent value="directions" className="pt-2">
          <OlaDirectionsPanel
            searchParams={searchParams}
            setSearchParams={setSearchParams}
            requireDestination={false}
            collapsePanelOnRoute={false}
          />
        </TabsContent>

        <TabsContent value="optimizer" className="pt-2">
          <OlaRouteOptimizerPanel
            searchParams={searchParams}
            setSearchParams={setSearchParams}
          />
        </TabsContent>
      </Tabs>

      <Button
        type="button"
        variant="ghost"
        className="w-full justify-center rounded-full border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-none"
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
            next.delete('routeKind')
            next.delete('optStops')
            next.delete('optRoundTrip')
          })
        }}
      >
        Reset directions
      </Button>
    </div>
  )
}

