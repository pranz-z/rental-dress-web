import type { ReactNode } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { SettingsTabs, type SettingsTab } from '@/components/studio/settings-tabs'
import { requireCapability } from '@/lib/auth/guards'
import { can } from '@/lib/domain'

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const staff = await requireCapability('settings.view')

  const tabs: SettingsTab[] = [
    { href: '/studio/settings', label: 'Overview' },
    { href: '/studio/settings/rental-rules', label: 'Rental rules' },
    { href: '/studio/settings/templates', label: 'Email templates' },
    { href: '/studio/settings/hours', label: 'Hours & delivery' },
  ]
  if (can(staff.role, 'settings.staff')) {
    tabs.push({ href: '/studio/settings/staff', label: 'Staff accounts' })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="The studio’s operating rules — prices, schedules, policies and the messages customers receive. Storefront and studio read the same values."
      />
      <SettingsTabs tabs={tabs} />
      {children}
    </div>
  )
}
