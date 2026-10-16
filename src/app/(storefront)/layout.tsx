import type { Metadata } from 'next'
import { SiteFooter } from '@/components/storefront/site-footer'
import { SiteHeader } from '@/components/storefront/site-header'
import { businessHoursSummary, parseBusinessHours } from '@/lib/business-hours'
import { prisma } from '@/lib/db'
import { readCart } from '@/lib/storefront/cart'
import { currentCustomer } from '@/lib/storefront/session'

export const metadata: Metadata = {
  title: {
    default: 'Maison Rêve — Designer dress rental, Boston',
    template: '%s · Maison Rêve',
  },
  description:
    'Maison Rêve rents designer gowns for weddings, galas and evenings out. Reserve online, we deliver to your door, cleaned and pressed.',
}

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  // One settings read feeds the header and footer, so the studio's address,
  // phone and hours always match Settings → Hours & delivery.
  const [cart, customer, settings] = await Promise.all([
    readCart(),
    currentCustomer(),
    prisma.studioSettings.findUnique({ where: { id: 'studio' } }),
  ])
  const hoursSummary = settings ? businessHoursSummary(parseBusinessHours(settings.businessHours)) : undefined

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-accent-ink"
      >
        Skip to content
      </a>
      <SiteHeader
        cartCount={cart.length}
        customerName={customer?.name ?? null}
        signedIn={Boolean(customer)}
        studioAddress={settings?.studioAddress}
        studioPhone={settings?.studioPhone}
      />
      <main id="content" className="flex-1">
        {children}
      </main>
      <SiteFooter
        studioAddress={settings?.studioAddress}
        studioPhone={settings?.studioPhone}
        studioEmail={settings?.studioEmail}
        hoursSummary={hoursSummary}
      />
    </div>
  )
}
