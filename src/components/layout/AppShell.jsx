import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import AppSidebar from './AppSidebar'
import { sidebarNavItems } from '@/lib/sidebarNavItems'

const bg = 'from-amber-200 to-amber-400'

const NAV_ITEMS = sidebarNavItems

const AppShell = ({ children }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(() => location.pathname === '/find-masjids')
  const activeItem = useMemo(() => {
    return (
      NAV_ITEMS.find((item) => {
        if (item.match) return item.match({ pathname: location.pathname, search: location.search })
        return item.to === location.pathname
      }) || null
    )
  }, [location.pathname, location.search])

  const open = useMemo(() => {
    return !!activeItem?.hasTools && sheetOpen
  }, [activeItem?.hasTools, sheetOpen])

  // Allow tools panel to be controlled via URL (used by Directions to collapse the panel).
  useEffect(() => {
    if (!activeItem?.hasTools) return
    const sp = new URLSearchParams(location.search || '')
    const panel = sp.get('panel')
    if (panel === '0') setSheetOpen(false)
    if (panel === '1') setSheetOpen(true)
  }, [activeItem?.hasTools, location.search])

  const handleSelectNavItem = (item) => {
    if (!item) return

    // Always navigate to the item's route (no `tab` query).
    setSheetOpen(!!item.hasTools)
    navigate(item.to)
  }

  return (
    <div
      className={`relative min-h-screen bg-linear-to-br ${bg} overflow-x-hidden`}
      style={{
        '--sidebar': 'hsl(0 0% 0% / 0.20)',
        '--sidebar-foreground': 'hsl(0 0% 100% / 0.90)',
        '--sidebar-accent': 'hsl(0 0% 0% / 0.30)',
        '--sidebar-accent-foreground': 'hsl(0 0% 100% / 0.95)',
        '--sidebar-border': 'hsl(0 0% 100% / 0.15)',
        '--sidebar-ring': 'hsl(217.2 91.2% 59.8%)',
        '--sidebar-primary': 'hsl(0 0% 0% / 0.30)',
        '--sidebar-primary-foreground': 'hsl(0 0% 100% / 1)',
      }}
    >
      <SidebarProvider defaultOpen={false}>
        <AppSidebar items={NAV_ITEMS} onSelect={handleSelectNavItem} />

        <Sheet
          open={open}
          onOpenChange={(o) => {
            setSheetOpen(o)
          }}
        >
          <SheetContent
            side="right"
            showCloseButton={false}
            className={`
              vintage-sheet-enter-right
              rounded-l-[1.35rem] rounded-r-none border border-white/15 border-b-0
              bg-black/20 backdrop-blur-md
              flex flex-col w-[min(22rem,90vw)]
            `}
          >
            <SheetHeader className="sticky top-0 z-10 border-b border-white/15 bg-black/10 backdrop-blur-md px-5 pb-3 pt-3">
              {activeItem?.hasTools ? (
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/90 hover:bg-white/10 transition cursor-pointer"
                  aria-label="Close tools panel"
                  title="Close"
                >
                  <span className="text-lg leading-none">×</span>
                </button>
              ) : null}
              <div className="min-w-0">
                <SheetTitle className="font-serif text-lg font-semibold tracking-tight text-white/95">
                  {activeItem?.label}
                </SheetTitle>
                {activeItem?.description ? (
                  <SheetDescription className="mt-1 text-sm leading-relaxed text-white/75">
                    {activeItem.description}
                  </SheetDescription>
                ) : null}
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{activeItem?.sheetContent}</div>
          </SheetContent>
        </Sheet>

        <SidebarInset className="min-h-svh bg-transparent overflow-x-hidden">
          {activeItem?.hasTools && !open ? (
            <div className="pointer-events-none fixed right-4 top-4 z-50">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-4 py-2 text-sm font-medium text-white/95 shadow-lg backdrop-blur-md hover:bg-black/40 transition cursor-pointer"
                aria-label="Open tools panel"
              >
                Tools
              </button>
            </div>
          ) : null}
          {children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

export default AppShell
