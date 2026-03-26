import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronsUpDown,
  LogOut,
  Sparkles,
  BadgeCheck,
  CreditCard,
  Bell,
  Sun,
  Moon,
  Check,
  Palette,
} from 'lucide-react'
import { supabase } from '@/services/supabaseClient'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SidebarMenuButton } from '@/components/ui/sidebar'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useTheme } from '@/theme/ThemeProvider'
import { THEME_PALETTES } from '@/utils/themeConstants'
import {
  readBrandStripsFromStorage,
  writeBrandStripsToStorage,
  DEFAULT_BRAND,
} from '@/utils/themeBrand'
import { cn } from '@/lib/utils'

const PRESET_PALETTES = THEME_PALETTES.filter((p) => p.id !== 'brand')

function normalizeHexInput(v) {
  const t = String(v || '').trim()
  if (!t) return null
  const s = t.startsWith('#') ? t : `#${t}`
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) return null
  return s.toLowerCase()
}

export function ProfileDropdown() {
  const [email, setEmail] = useState(null)
  const { resolvedScheme, setScheme, paletteId, setPalette, bumpBrandTheme } = useTheme()
  const [brandLight, setBrandLight] = useState(() => readBrandStripsFromStorage().light)
  const [brandDark, setBrandDark] = useState(() => readBrandStripsFromStorage().dark)

  useEffect(() => {
    if (paletteId === 'brand') {
      const s = readBrandStripsFromStorage()
      setBrandLight(s.light)
      setBrandDark(s.dark)
    }
  }, [paletteId])

  useEffect(() => {
    let cancelled = false
    if (!supabase) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setEmail(session?.user?.email ?? null)
    })

    const { data: subscriptionData } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null)
    })
    const subscription = subscriptionData?.subscription

    return () => {
      cancelled = true
      subscription?.unsubscribe?.()
    }
  }, [])

  const profile = useMemo(() => {
    const e = email || ''
    const name = e ? e.split('@')[0] : 'Guest'
    const initials = name
      .split(/[.\-_ ]+/g)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('')
      .slice(0, 2)
    return { email: email ?? 'Not signed in', name, initials }
  }, [email])

  const handleSignOut = async () => {
    try {
      await supabase?.auth?.signOut?.()
    } finally {
      window.location.assign('/')
    }
  }

  const handleSaveBrand = () => {
    const light = brandLight.map((x, i) => normalizeHexInput(x) || DEFAULT_BRAND.light[i])
    const dark = brandDark.map((x, i) => normalizeHexInput(x) || DEFAULT_BRAND.dark[i])
    try {
      writeBrandStripsToStorage({ light, dark })
    } catch {
      // ignore storage errors (private mode) but still apply for this session
    }
    setPalette('brand')
    bumpBrandTheme()
  }

  const handleResetBrand = () => {
    const light = [...DEFAULT_BRAND.light]
    const dark = [...DEFAULT_BRAND.dark]
    setBrandLight(light)
    setBrandDark(dark)
    try {
      writeBrandStripsToStorage({ light, dark })
    } catch {
      /* ignore */
    }
    setPalette('brand')
    bumpBrandTheme()
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="cursor-pointer text-sidebar-foreground data-[state=open]:text-sidebar-foreground data-[state=open]:bg-sidebar-accent"
        >
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={null} alt={profile.name} />
            <AvatarFallback className="rounded-lg">{profile.initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-start text-sm leading-tight">
            <span className="truncate font-semibold">{profile.name}</span>
            <span className="truncate text-xs">{profile.email}</span>
          </div>
          <ChevronsUpDown className="ms-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-80 rounded-lg border border-border bg-popover/95 p-2 text-popover-foreground shadow-lg backdrop-blur-md"
        sideOffset={4}
        align="start"
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={null} alt={profile.name} />
              <AvatarFallback className="rounded-lg">{profile.initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-start text-sm leading-tight">
              <span className="truncate font-semibold">{profile.name}</span>
              <span className="truncate text-xs">{profile.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Brand (custom) — first */}
        <DropdownMenuGroup className="px-1 pb-2">
          <Label className="mb-1.5 flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
            <Palette className="size-3.5" />
            Brand
          </Label>
          <Card className="border-border bg-card/80">
            <CardHeader className="space-y-1 p-3 pb-2">
              <CardTitle className="text-sm">Brand (custom)</CardTitle>
              <CardDescription className="text-xs">
                Set primary, secondary, tertiary for light and dark UI. Saves to this device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-3 pt-0">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={paletteId === 'brand' ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'relative flex-1 flex-col gap-1 h-auto py-2',
                    paletteId === 'brand' && 'ring-2 ring-ring ring-inset'
                  )}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setPalette('brand')
                  }}
                  aria-pressed={paletteId === 'brand'}
                >
                  <div className="flex h-7 w-full overflow-hidden rounded-md border border-border">
                    {(resolvedScheme === 'dark' ? brandDark : brandLight).map((c, i) => (
                      <div key={i} className="min-w-0 flex-1" style={{ background: c }} />
                    ))}
                  </div>
                  <span className="text-[10px] font-medium">Brand</span>
                  {paletteId === 'brand' ? (
                    <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-background text-foreground shadow-md ring-1 ring-border">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  ) : null}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground">Light · P / S / T</p>
                  {[0, 1, 2].map((i) => (
                    <div key={`l-${i}`} className="flex gap-1.5">
                      <Input
                        type="color"
                        className="h-8 w-10 cursor-pointer p-0.5 shrink-0"
                        value={brandLight[i]?.match(/^#/) ? brandLight[i] : `#${brandLight[i] || '000000'}`}
                        onChange={(e) => {
                          const next = [...brandLight]
                          next[i] = e.target.value
                          setBrandLight(next)
                        }}
                        aria-label={`Light strip ${i + 1}`}
                      />
                      <Input
                        className="h-8 font-mono text-xs"
                        value={brandLight[i] || ''}
                        placeholder="#000000"
                        onChange={(e) => {
                          const next = [...brandLight]
                          next[i] = e.target.value
                          setBrandLight(next)
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground">Dark · P / S / T</p>
                  {[0, 1, 2].map((i) => (
                    <div key={`d-${i}`} className="flex gap-1.5">
                      <Input
                        type="color"
                        className="h-8 w-10 cursor-pointer p-0.5 shrink-0"
                        value={brandDark[i]?.match(/^#/) ? brandDark[i] : `#${brandDark[i] || '000000'}`}
                        onChange={(e) => {
                          const next = [...brandDark]
                          next[i] = e.target.value
                          setBrandDark(next)
                        }}
                        aria-label={`Dark strip ${i + 1}`}
                      />
                      <Input
                        className="h-8 font-mono text-xs"
                        value={brandDark[i] || ''}
                        placeholder="#000000"
                        onChange={(e) => {
                          const next = [...brandDark]
                          next[i] = e.target.value
                          setBrandDark(next)
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSaveBrand()
                  }}
                >
                  Save brand
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleResetBrand()
                  }}
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </DropdownMenuGroup>

        {/* Appearance — second */}
        <DropdownMenuGroup className="px-1 pb-2">
          <Label className="mb-1.5 flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
            <Sun className="size-3.5" />
            Appearance
          </Label>
          <ToggleGroup
            type="single"
            value={resolvedScheme}
            onValueChange={(v) => {
              if (v === 'light' || v === 'dark') setScheme(v)
            }}
            variant="outline"
            size="sm"
            spacing={0}
            className="w-full"
          >
            <ToggleGroupItem value="light" className="flex flex-1 gap-1.5 px-2 py-2 text-xs" aria-label="Light theme">
              <Sun className="size-3.5 shrink-0" />
              Light
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" className="flex flex-1 gap-1.5 px-2 py-2 text-xs" aria-label="Dark theme">
              <Moon className="size-3.5 shrink-0" />
              Dark
            </ToggleGroupItem>
          </ToggleGroup>
        </DropdownMenuGroup>

        {/* Color Theme — third */}
        <DropdownMenuGroup className="px-1 pb-2">
          <Label className="mb-1.5 flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
            <Palette className="size-3.5" />
            Color Theme
          </Label>
          <ScrollArea className="h-[min(44vh,18rem)] pr-2">
            <div className="p-1">
              <div className="grid grid-cols-2 gap-2 pb-2">
                {PRESET_PALETTES.map((p) => {
                  const active = paletteId === p.id
                  const swatches = resolvedScheme === 'dark' ? p.dark : p.light
                  return (
                    <Button
                      key={p.id}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        'relative h-auto flex-col gap-1.5 py-2 px-2',
                        active && 'ring-2 ring-ring ring-inset'
                      )}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setPalette(p.id)
                      }}
                      aria-pressed={active}
                      aria-label={`${p.label} theme`}
                    >
                      <div className="flex h-7 w-full overflow-hidden rounded-md border border-border">
                        {swatches.map((c, i) => (
                          <div key={i} className="min-w-0 flex-1" style={{ background: c }} />
                        ))}
                      </div>
                      <span className="w-full text-left text-[10px] font-medium leading-tight">{p.label}</span>
                      <span className="w-full text-left text-[9px] text-muted-foreground">{p.category}</span>
                      {active ? (
                        <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-background text-foreground shadow-md ring-1 ring-border">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      ) : null}
                    </Button>
                  )
                })}
              </div>
            </div>
          </ScrollArea>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem className="cursor-pointer">
            <Sparkles className="mr-2 size-4" />
            Upgrade to Pro
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/settings/account">
              <BadgeCheck className="mr-2 size-4" />
              Account
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/settings">
              <CreditCard className="mr-2 size-4" />
              Billing
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/settings/notifications">
              <Bell className="mr-2 size-4" />
              Notifications
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          <LogOut className="mr-2 size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
