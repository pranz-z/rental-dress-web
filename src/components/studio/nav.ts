import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  MessagesSquare,
  Settings2,
  Shirt,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { can, SECTION_CAPABILITY, type Capability, type SectionKey, type StaffRole } from '@/lib/domain'

export type StudioNavItem = {
  key: SectionKey
  href: string
  label: string
  icon: LucideIcon
  capability: Capability
  badge?: 'inquiries' | 'late'
}

export const STUDIO_NAV: StudioNavItem[] = [
  { key: 'overview', href: '/studio', label: 'Overview', icon: LayoutDashboard, capability: SECTION_CAPABILITY.overview },
  { key: 'bookings', href: '/studio/bookings', label: 'Bookings', icon: ClipboardList, capability: SECTION_CAPABILITY.bookings },
  { key: 'schedule', href: '/studio/schedule', label: 'Schedule', icon: CalendarDays, capability: SECTION_CAPABILITY.schedule, badge: 'late' },
  { key: 'inquiries', href: '/studio/inquiries', label: 'Inquiries', icon: MessagesSquare, capability: SECTION_CAPABILITY.inquiries, badge: 'inquiries' },
  { key: 'inventory', href: '/studio/inventory', label: 'Inventory', icon: Shirt, capability: SECTION_CAPABILITY.inventory },
  { key: 'customers', href: '/studio/customers', label: 'Customers', icon: Users, capability: SECTION_CAPABILITY.customers },
  { key: 'settings', href: '/studio/settings', label: 'Settings', icon: Settings2, capability: SECTION_CAPABILITY.settings },
]

export function visibleNav(role: StaffRole): StudioNavItem[] {
  return STUDIO_NAV.filter((item) => can(role, item.capability))
}

export function activeNavItem(items: StudioNavItem[], pathname: string): StudioNavItem | undefined {
  return items.find((item) =>
    item.href === '/studio' ? pathname === '/studio' : pathname === item.href || pathname.startsWith(`${item.href}/`),
  )
}
