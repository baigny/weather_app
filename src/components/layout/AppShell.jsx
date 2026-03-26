import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import AppSidebar from './AppSidebar'
import { sidebarNavItems } from '@/lib/sidebarNavItems'

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
      className="relative min-h-screen overflow-x-hidden"
      style={{
        background: 'linear-gradient(to bottom right, var(--shell-gradient-from), var(--shell-gradient-to))',
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
              rounded-l-[1.35rem] rounded-r-none border border-[var(--surface-glass-border)] border-b-0
              bg-[var(--surface-glass)] backdrop-blur-md
              flex flex-col w-[min(22rem,90vw)] text-[var(--surface-glass-text)]
            `}
          >
            <SheetHeader className="sticky top-0 z-10 border-b border-[var(--surface-glass-border)] bg-[color-mix(in_oklch,var(--surface-glass)_92%,transparent)] backdrop-blur-md px-5 pb-3 pt-3">
              {activeItem?.hasTools ? (
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--surface-glass-border)] bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] text-[var(--surface-glass-text)] hover:bg-[color-mix(in_oklch,var(--foreground)_14%,transparent)] transition cursor-pointer"
                  aria-label="Close tools panel"
                  title="Close"
                >
                  <span className="text-lg leading-none">×</span>
                </button>
              ) : null}
              <div className="min-w-0">
                <SheetTitle className="font-serif text-lg font-semibold tracking-tight text-[var(--surface-glass-text)]">
                  {activeItem?.label}
                </SheetTitle>
                {activeItem?.description ? (
                  <SheetDescription className="mt-1 text-sm leading-relaxed text-[var(--surface-glass-muted)]">
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
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[var(--surface-glass-border)] bg-[var(--surface-glass)] px-4 py-2 text-sm font-medium text-[var(--surface-glass-text)] shadow-lg backdrop-blur-md hover:bg-[color-mix(in_oklch,var(--card)_95%,var(--foreground))] transition cursor-pointer"
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
