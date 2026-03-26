import { Building2, CloudSun, MapPin, Route, ShieldCheck } from 'lucide-react'
import ExploreNeighborhoodTools from '@/components/explore/ExploreNeighborhoodTools'
import FindMasjidTools from '@/components/masjid/FindMasjidTools'
import DirectionsTools from '@/components/directions/DirectionsTools'

export const sidebarNavItems = [
  {
    id: 'weather',
    label: 'Weather',
    to: '/weather',
    icon: CloudSun,
    hasTools: false,
    match: ({ pathname }) => pathname === '/weather',
    description: 'Live weather and city overview.',
    sheetContent: (
      null
    ),
  },
  {
    id: 'explore-neighborhood',
    label: 'Explore Neighborhood',
    to: '/explore-neighborhood',
    icon: MapPin,
    hasTools: true,
    match: ({ pathname }) => pathname === '/explore-neighborhood',
    description: 'Explore neighborhood to find masjids.',
    sheetContent: (
      <ExploreNeighborhoodTools />
    ),
  },
  {
    id: 'find-masjids',
    label: 'Find Masjids',
    to: '/find-masjids',
    icon: Building2,
    hasTools: true,
    match: ({ pathname }) => pathname === '/find-masjids',
    description: 'Find masjids and view prayer times.',
    sheetContent: (
      <FindMasjidTools />
    ),
  },
  {
    id: 'directions',
    label: 'Directions',
    to: '/directions',
    icon: Route,
    hasTools: true,
    match: ({ pathname }) => pathname === '/directions',
    description: 'Get directions between two places.',
    sheetContent: (
      <DirectionsTools />
    ),
  },
  {
    id: 'admin',
    label: 'Admin',
    to: '/admin/masjids',
    icon: ShieldCheck,
    hasTools: false,
    match: ({ pathname }) => pathname.startsWith('/admin/masjids'),
    description: 'Manage masjid records and metadata.',
    sheetContent: (
      null
    ),
  },
]

