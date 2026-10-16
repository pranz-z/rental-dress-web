'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Heart, Menu, ShoppingBag, UserRound, X } from 'lucide-react'
import { cn } from '@/lib/cn'

const NAV = [
  { href: '/shop', label: 'Shop' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/size-guide', label: 'Size guide' },
  { href: '/membership', label: 'Membership' },
  { href: '/help', label: 'Help' },
]

export function SiteHeader({
  cartCount,
  customerName,
  signedIn,
  studioAddress,
  studioPhone,
}: {
  cartCount: number
  customerName?: string | null
  signedIn: boolean
  studioAddress?: string
  studioPhone?: string
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const firstName = customerName?.trim().split(/\s+/)[0]

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-6 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink lg:hidden"
        >
          <Menu className="size-5" strokeWidth={1.75} aria-hidden />
        </button>

        <Link href="/" className="font-serif text-[24px] leading-none tracking-tight text-ink">
          Maison Rêve
        </Link>

        <nav aria-label="Storefront" className="ml-4 hidden items-center gap-6 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) ? 'page' : undefined}
              className={cn(
                'text-sm font-bold tracking-wide text-ink-muted transition-colors hover:text-mulberry',
                pathname.startsWith(item.href) && 'text-ink',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href={signedIn ? '/account#favorites' : '/account/sign-in?next=%2Faccount%23favorites'}
            aria-label="Favorites"
            className="hidden size-10 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-mulberry sm:grid"
          >
            <Heart className="size-4.5" strokeWidth={1.75} aria-hidden />
          </Link>
          <Link
            href="/account"
            aria-label={signedIn ? 'Your account' : 'Sign in'}
            className="flex h-10 items-center gap-2 rounded-full px-3 text-sm font-bold text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <UserRound className="size-4.5" strokeWidth={1.75} aria-hidden />
            <span className="hidden sm:inline">{signedIn ? (firstName ?? 'Account') : 'Sign in'}</span>
          </Link>
          <Link
            href="/cart"
            aria-label={`Your bag, ${cartCount} ${cartCount === 1 ? 'piece' : 'pieces'}`}
            className="relative grid size-10 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-mulberry"
          >
            <ShoppingBag className="size-4.5" strokeWidth={1.75} aria-hidden />
            {cartCount > 0 ? (
              <span className="absolute top-0.5 right-0.5 grid size-4.5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-ink">
                {cartCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 flex w-[300px] max-w-[86vw] flex-col border-r border-line bg-surface shadow-lift">
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <p className="font-serif text-xl tracking-tight text-ink">Maison Rêve</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
              >
                <X className="size-4.5" strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <nav aria-label="Storefront" className="flex-1 space-y-1 overflow-y-auto px-3">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-3 py-2.5 text-sm font-bold tracking-wide text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/account"
                className="block rounded-lg px-3 py-2.5 text-sm font-bold tracking-wide text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
              >
                {signedIn ? 'Your account' : 'Sign in'}
              </Link>
              <Link
                href="/contact"
                className="block rounded-lg px-3 py-2.5 text-sm font-bold tracking-wide text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
              >
                Contact the studio
              </Link>
            </nav>
            <div className="border-t border-line p-4 text-xs leading-relaxed text-ink-muted">
              {studioAddress ?? '418 Newbury Street, Floor 3, Boston, MA 02115'}
              <br />
              {studioPhone ?? '(617) 555-0148'}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}
