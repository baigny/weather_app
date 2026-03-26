import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronsUpDown, LogOut, Sparkles, BadgeCheck, CreditCard, Bell } from 'lucide-react'
import { supabase } from '@/services/supabaseClient'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SidebarMenuButton } from '@/components/ui/sidebar'

export function ProfileDropdown() {
  const [email, setEmail] = useState(null)

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
      // Keep it simple: reload to reset app state.
      window.location.assign('/')
    }
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="cursor-pointer text-white data-[state=open]:text-white data-[state=open]:bg-black/30"
        >
          <Avatar className="h-8 w-8 rounded-lg">
            {/* If you later add real avatars, wire to your user profile URL here. */}
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
        className="w-56 rounded-lg bg-black/20 backdrop-blur-md border border-white/15 text-white/90 [&_svg]:text-white/90"
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

        <DropdownMenuGroup>
          <DropdownMenuItem
            className="cursor-pointer text-white/90 focus:bg-black/30 focus:text-white/90 data-[state=open]:bg-black/30 data-[state=open]:text-white/90"
          >
            <Sparkles className="mr-2 size-4 text-white/90" />
            Upgrade to Pro
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            asChild
            className="cursor-pointer text-white/90 focus:bg-black/30 focus:text-white/90 data-[state=open]:bg-black/30 data-[state=open]:text-white/90"
          >
            <Link to="/settings/account">
              <BadgeCheck className="mr-2 size-4 text-white/90" />
              Account
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            asChild
            className="cursor-pointer text-white/90 focus:bg-black/30 focus:text-white/90 data-[state=open]:bg-black/30 data-[state=open]:text-white/90"
          >
            <Link to="/settings">
              <CreditCard className="mr-2 size-4 text-white/90" />
              Billing
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            asChild
            className="cursor-pointer text-white/90 focus:bg-black/30 focus:text-white/90 data-[state=open]:bg-black/30 data-[state=open]:text-white/90"
          >
            <Link to="/settings/notifications">
              <Bell className="mr-2 size-4 text-white/90" />
              Notifications
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-white/90 focus:bg-black/30 focus:text-white/90 data-[state=open]:bg-black/30 data-[state=open]:text-white/90"
        >
          <LogOut className="mr-2 size-4 text-white/90" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

