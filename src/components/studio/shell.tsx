'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Menu, Moon, Sun, X } from 'lucide-react'
import type { StaffRole } from '@/lib/domain'
import { ROLE_META } from '@/lib/domain'
import { cn } from '@/lib/cn'
import { Avatar } from '@/components/ui/avatar'
import { Chip } from '@/components/ui/chip'
import { signOutAction } from '@/app/studio/actions'
import { activeNavItem, visibleNav, type StudioNavItem } from './nav'
import { SessionKeepAlive } from './session-keep-alive'

type StaffSummary = { id: string; name: string; role: StaffRole; title: string }

export function StudioShell({
  staff,
  badges,
  theme,
  today,
  children,
}: {
  staff: StaffSummary
  badges: { openInquiries: number; lateReturns: number }
  theme: 'light' | 'dark'
  today: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(theme)

  const items = visibleNav(staff.role)

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [drawerOpen])

  function toggleTheme() {
    const next = currentTheme === 'dark' ? 'light' : 'dark'
    setCurrentTheme(next)
    document.cookie = `mr_studio_theme=${next}; path=/; max-age=31536000; samesite=lax`
  }

  const navList = (
    <NavList items={items} pathname={pathname} badges={badges} onNavigate={() => setDrawerOpen(false)} />
  )

  const userFooter = (
    <div className="border-t border-line p-4">
      <div className="flex items-center gap-3">
        <Avatar name={staff.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{staff.name}</p>
          <p className="truncate text-xs text-ink-muted">{staff.title}</p>
        </div>
        <Chip tone={ROLE_META[staff.role].tone}>{ROLE_META[staff.role].label}</Chip>
      </div>
      <div className="mt-3 flex items-center gap-1">
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <LogOut className="size-3.5" strokeWidth={1.75} aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <div data-theme={currentTheme} className="min-h-dvh bg-page text-ink">
      <a
        href="#studio-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-accent-ink"
      >
        Skip to content
      </a>

      <div className="lg:grid lg:grid-cols-[264px_1fr]">
        <aside data-print-hide className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface lg:flex">
          <div className="flex items-baseline gap-2.5 px-5 pt-6 pb-5">
            <p className="font-serif text-[22px] leading-none tracking-tight text-ink">Maison Rêve</p>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-ink">Studio</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3">{navList}</div>
          {userFooter}
        </aside>

        <div className="flex min-h-dvh flex-col">
          <header data-print-hide className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-page/85 px-4 backdrop-blur-sm sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink lg:hidden"
            >
              <Menu className="size-5" strokeWidth={1.75} aria-hidden />
            </button>
            <p className="font-serif text-lg leading-none tracking-tight text-ink lg:hidden">Maison Rêve</p>

            <div className="ml-auto flex items-center gap-2">
              <p className="hidden text-xs font-bold tracking-wide text-ink-muted sm:block">{today}</p>
              <span aria-hidden className="hidden h-4 w-px bg-line sm:block" />
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={currentTheme === 'dark' ? 'Switch to light workspace' : 'Switch to dark workspace'}
                title={currentTheme === 'dark' ? 'Light workspace' : 'Dark workspace'}
                className="grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
              >
                {currentTheme === 'dark' ? (
                  <Sun className="size-4.5" strokeWidth={1.75} aria-hidden />
                ) : (
                  <Moon className="size-4.5" strokeWidth={1.75} aria-hidden />
                )}
              </button>
              <form action={signOutAction}>
                <button
                  type="submit"
                  aria-label="Sign out"
                  title="Sign out"
                  className="grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                >
                  <LogOut className="size-4.5" strokeWidth={1.75} aria-hidden />
                </button>
              </form>
            </div>
          </header>

          <main id="studio-content" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-charcoal/45 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-[286px] max-w-[86vw] flex-col border-r border-line bg-surface shadow-lift">
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <p className="font-serif text-xl leading-none tracking-tight text-ink">Maison Rêve</p>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
              >
                <X className="size-4.5" strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3">{navList}</div>
            {userFooter}
          </div>
        </div>
      ) : null}

      <SessionKeepAlive />
    </div>
  )
}

function NavList({
  items,
  pathname,
  badges,
  onNavigate,
}: {
  items: StudioNavItem[]
  pathname: string
  badges: { openInquiries: number; lateReturns: number }
  onNavigate: () => void
}) {
  const active = activeNavItem(items, pathname)

  return (
    <nav aria-label="Studio sections" className="space-y-1">
      {items.map((item) => {
        const isActive = active?.key === item.key
        const badgeCount = item.badge === 'inquiries' ? badges.openInquiries : item.badge === 'late' ? badges.lateReturns : 0
        const badgeTone = item.badge === 'late' ? 'clay' : 'mulberry'
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            data-tone={isActive ? 'blush' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold tracking-wide transition-colors',
              isActive ? 'text-[var(--tone-ink)]' : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
            )}
            style={isActive ? { background: 'var(--tone-bg)', boxShadow: 'inset 2px 0 0 var(--color-gold)' } : undefined}
          >
            <item.icon className="size-4.5 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="truncate">{item.label}</span>
            {badgeCount > 0 ? (
              <span
                data-tone={badgeTone}
                className="ml-auto rounded-full border px-2 py-0.5 text-[11px] font-bold"
                style={{ background: 'var(--tone-bg)', borderColor: 'var(--tone-line)', color: 'var(--tone-ink)' }}
              >
                {badgeCount}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
