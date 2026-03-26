import { useLocation } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarRail,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { ProfileDropdown } from './ProfileDropdown'

export default function AppSidebar({ items, onSelect }) {
  const location = useLocation()

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="px-2 pt-2 pb-1">
        <SidebarTrigger aria-label="Toggle menu" className="cursor-pointer" />
      </SidebarHeader>
      <SidebarContent className="pt-2 pb-2">
        <SidebarGroup>
          <SidebarMenu>
            {items.map((item) => {
              const active =
                item.match != null
                  ? item.match({ pathname: location.pathname, search: location.search })
                  : item.to === location.pathname

              const Icon = item.icon

              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    tooltip={item.label}
                    isActive={active}
                    onClick={() => onSelect?.(item)}
                    className="cursor-pointer text-sidebar-foreground data-[active=true]:text-sidebar-foreground"
                  >
                    <Icon className="size-4" strokeWidth={2} />
                  <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ProfileDropdown />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

