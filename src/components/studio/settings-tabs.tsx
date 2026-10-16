'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

export type SettingsTab = { href: string; label: string }

/** Section tabs under the Settings header; the active tab follows the path. */
export function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Settings sections" className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => {
        const active = tab.href === '/studio/settings' ? pathname === '/studio/settings' : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 items-center rounded-full border px-4 text-[13px] font-bold transition-colors',
              active
                ? 'border-line-strong bg-surface text-ink shadow-soft'
                : 'border-line bg-surface-muted text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
