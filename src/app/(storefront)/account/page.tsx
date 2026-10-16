import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Heart, MapPin, Package, Truck } from 'lucide-react'
import { prisma } from '@/lib/db'
import { BOOKING_STATUS_META } from '@/lib/domain'
import { formatDay } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { requireCustomer } from '@/lib/storefront/session'
import { loadCatalog } from '@/lib/storefront/catalog'
import { removeEventListItemAction, signOutAction } from './actions'
import { DressCard } from '@/components/storefront/dress-card'
import { GarmentImage } from '@/components/storefront/garment'
import { MeasurementsForm } from '@/components/storefront/measurements-form'
import { NewEventListForm } from '@/components/storefront/event-list-form'
import { Chip } from '@/components/ui/chip'

export const metadata: Metadata = {
  title: 'Your account',
  description: 'Upcoming and past rentals, tracking, saved measurements, favorites and event lists.',
  robots: { index: false },
}

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'SHIPPED', 'WITH_CUSTOMER', 'LATE'] as const

export default async function AccountPage() {
  const customer = await requireCustomer('/account')

  const [bookings, favorites, lists, measurement, catalog] = await Promise.all([
    prisma.booking.findMany({
      where: { customerId: customer.id },
      include: {
        dress: { select: { id: true, name: true, slug: true, designer: true, color: true, colorHex: true, artTone: true, status: true } },
      },
      orderBy: { eventDate: 'desc' },
    }),
    prisma.favorite.findMany({ where: { customerId: customer.id }, select: { dressId: true } }),
    prisma.eventList.findMany({
      where: { customerId: customer.id },
      include: {
        items: {
          include: { dress: { select: { id: true, name: true, slug: true, status: true, colorHex: true, artTone: true, color: true, designer: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.measurement.findUnique({ where: { customerId: customer.id } }),
    loadCatalog(),
  ])

  const active = bookings.filter((booking) => (ACTIVE_STATUSES as readonly string[]).includes(booking.status)).sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime())
  const past = bookings
    .filter((booking) => !(ACTIVE_STATUSES as readonly string[]).includes(booking.status))
    .sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime())

  const savedIds = new Set(favorites.map((favorite) => favorite.dressId))
  const favoriteDresses = catalog.dresses.filter((dress) => savedIds.has(dress.id))
  const occasions = [...new Set(catalog.dresses.map((dress) => dress.occasion))].sort()

  const firstName = customer.name.split(' ')[0] ?? customer.name

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-gold-ink uppercase">Your account</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight text-ink sm:text-5xl">Bonjour, {firstName}.</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {customer.tier === 'PARIS_CLUB' ? 'Paris Club member' : customer.tier === 'MEMBER' ? 'Member' : 'Guest'} since{' '}
            {formatDay(customer.memberSince)}
            {customer.creditBalance > 0 ? ` · ${formatMoney(customer.creditBalance)} in credits` : ''}
          </p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-full border border-line-strong bg-surface px-5 text-[13px] font-bold text-ink transition-colors hover:border-rose hover:text-mulberry"
          >
            Sign out
          </button>
        </form>
      </header>

      <nav aria-label="Account sections" className="mt-7 flex flex-wrap gap-2 border-y border-line py-3 text-[13px] font-bold">
        {[
          { href: '#rentals', label: `Rentals${active.length > 0 ? ` (${active.length})` : ''}` },
          { href: '#favorites', label: `Favorites${favoriteDresses.length > 0 ? ` (${favoriteDresses.length})` : ''}` },
          { href: '#lists', label: `Event lists${lists.length > 0 ? ` (${lists.length})` : ''}` },
          { href: '#measurements', label: 'Measurements' },
        ].map((link) => (
          <a key={link.href} href={link.href} className="rounded-full px-3.5 py-1.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-mulberry">
            {link.label}
          </a>
        ))}
      </nav>

      {/* rentals */}
      <section id="rentals" aria-labelledby="rentals-heading" className="mt-10 scroll-mt-24">
        <h2 id="rentals-heading" className="font-serif text-3xl text-ink">
          {active.length > 0 ? 'On their way to you' : 'Your rentals'}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          {active.length > 0
            ? 'Each window below is held for you until the studio confirms — tracking appears here the moment a dress ships.'
            : 'Nothing reserved right now. The freshest arrivals are a good place to start.'}
        </p>

        {active.length === 0 ? (
          <Link
            href="/shop?sort=newest"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            See new arrivals
            <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
          </Link>
        ) : (
          <ul className="mt-6 space-y-4">
            {active.map((booking) => {
              const meta = BOOKING_STATUS_META[booking.status]
              return (
                <li key={booking.id} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <Link href={`/dress/${booking.dress.slug}`} className="shrink-0" tabIndex={-1} aria-hidden>
                      <GarmentImage
                        name={booking.dress.name}
                        designer={booking.dress.designer}
                        color={booking.dress.color}
                        colorHex={booking.dress.colorHex}
                        artTone={booking.dress.artTone}
                        view="FRONT"
                        className="aspect-[3/4] w-[86px]"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold tracking-[0.18em] text-ink-muted uppercase">{booking.dress.designer}</p>
                          <h3 className="mt-0.5 font-serif text-xl leading-snug text-ink">
                            <Link href={`/dress/${booking.dress.slug}`} className="hover:text-mulberry">
                              {booking.dress.name}
                            </Link>
                          </h3>
                        </div>
                        <Chip tone={meta.tone}>{meta.label}</Chip>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{meta.description}</p>

                      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[13px] text-ink-muted sm:grid-cols-2 lg:grid-cols-4">
                        <div className="flex gap-1.5">
                          <dt className="font-bold text-ink">Size</dt>
                          <dd>
                            {booking.size}
                            {booking.backupSize ? ` · backup ${booking.backupSize}` : ''}
                          </dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="font-bold text-ink">Arrives</dt>
                          <dd>{formatDay(booking.deliveryDate)}</dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="font-bold text-ink">Event</dt>
                          <dd>{formatDay(booking.eventDate)}</dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="font-bold text-ink">Due back</dt>
                          <dd>{formatDay(booking.returnDate)}</dd>
                        </div>
                      </dl>

                      {booking.trackingNumber ? (
                        <p className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-surface-muted/50 px-3.5 py-2.5 text-[13px] text-ink">
                          <Truck className="size-4 shrink-0 text-mulberry" strokeWidth={1.75} aria-hidden />
                          {booking.courier ?? 'Courier'} · tracking <span className="font-bold">{booking.trackingNumber}</span>
                        </p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
                        <span className="text-ink-muted">
                          {booking.id} · {formatMoney(booking.total)}
                          {booking.deposit > 0 ? ` + ${formatMoney(booking.deposit)} deposit` : ''}
                        </span>
                        <Link href={`/contact?about=${encodeURIComponent(`${booking.id} — ${booking.dress.name}`)}`} className="font-bold text-mulberry hover:underline">
                          Ask about this booking
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {past.length > 0 ? (
          <details className="group mt-8">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-serif text-2xl text-ink [&::-webkit-details-marker]:hidden">
              Past rentals
              <span className="text-sm font-normal text-ink-muted transition-transform group-open:rotate-90">→</span>
            </summary>
            <ul className="mt-4 space-y-3">
              {past.map((booking) => {
                const meta = BOOKING_STATUS_META[booking.status]
                return (
                  <li key={booking.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3.5">
                    <Package className="size-4 text-gold-ink" strokeWidth={1.75} aria-hidden />
                    <span className="min-w-0 flex-1 text-sm text-ink">
                      <Link href={`/dress/${booking.dress.slug}`} className="font-bold hover:text-mulberry">
                        {booking.dress.name}
                      </Link>{' '}
                      <span className="text-ink-muted">
                        · worn {formatDay(booking.eventDate)} · {booking.id}
                      </span>
                    </span>
                    <Chip tone={meta.tone}>{meta.label}</Chip>
                    {booking.returnScannedAt ? <span className="text-xs text-ink-muted">Returned {formatDay(booking.returnScannedAt)}</span> : null}
                  </li>
                )
              })}
            </ul>
          </details>
        ) : null}
      </section>

      {/* favorites */}
      <section id="favorites" aria-labelledby="favorites-heading" className="mt-14 scroll-mt-24">
        <h2 id="favorites-heading" className="font-serif text-3xl text-ink">
          Favorites
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          The dresses you tapped the heart on — they wait here while you decide.
        </p>
        {favoriteDresses.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-line-strong bg-surface-muted/30 px-5 py-8 text-center text-sm text-ink-muted">
            No favorites yet. Tap the heart on any dress and it will appear here.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {favoriteDresses.map((dress) => (
              <DressCard key={dress.id} dress={dress} saved signedIn />
            ))}
          </div>
        )}
      </section>

      {/* event lists */}
      <section id="lists" aria-labelledby="lists-heading" className="mt-14 scroll-mt-24">
        <h2 id="lists-heading" className="font-serif text-3xl text-ink">
          Event lists
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Keep every option for one evening together — wedding season, a gala, or the dress you keep coming back to. Add pieces from any dress
          page.
        </p>

        <div className="mt-5 rounded-2xl border border-line bg-surface p-5">
          <NewEventListForm occasions={occasions} />
        </div>

        {lists.length > 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {lists.map((list) => (
              <div key={list.id} className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-serif text-xl text-ink">{list.name}</h3>
                  {list.eventDate ? <span className="text-[13px] text-ink-muted">{formatDay(list.eventDate)}</span> : null}
                </div>
                {list.occasion ? <p className="mt-0.5 text-[13px] text-ink-muted">{list.occasion}</p> : null}
                {list.items.length === 0 ? (
                  <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
                    Nothing on this list yet — open a dress page and save it here.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2.5">
                    {list.items.map((item) => (
                      <li key={item.id} className="flex items-center gap-3">
                        {item.dress.status !== 'RETIRED' ? (
                          <Link href={`/dress/${item.dress.slug}`} className="shrink-0" tabIndex={-1} aria-hidden>
                            <GarmentImage
                              name={item.dress.name}
                              designer={item.dress.designer}
                              color={item.dress.color}
                              colorHex={item.dress.colorHex}
                              artTone={item.dress.artTone}
                              view="DETAIL"
                              className="aspect-[3/4] w-[44px]"
                            />
                          </Link>
                        ) : null}
                        <span className="min-w-0 flex-1 text-sm text-ink">
                          {item.dress.status !== 'RETIRED' ? (
                            <Link href={`/dress/${item.dress.slug}`} className="font-bold hover:text-mulberry">
                              {item.dress.name}
                            </Link>
                          ) : (
                            <span className="font-bold text-ink-muted">{item.dress.name}</span>
                          )}
                          {item.size ? <span className="text-ink-muted"> · size {item.size}</span> : null}
                        </span>
                        <form action={removeEventListItemAction}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <button
                            type="submit"
                            aria-label={`Remove ${item.dress.name} from ${list.name}`}
                            className="grid size-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-danger-ink"
                          >
                            ×
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* measurements */}
      <section id="measurements" aria-labelledby="measurements-heading" className="mt-14 scroll-mt-24">
        <h2 id="measurements-heading" className="font-serif text-3xl text-ink">
          Saved measurements
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Share them once and the studio checks them against every dress before it ships — and a stylist will tell you when a size is worth
          reconsidering.
        </p>
        <div className="mt-5 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <MeasurementsForm
            saved={
              measurement
                ? {
                    heightCm: measurement.heightCm,
                    bustCm: measurement.bustCm,
                    waistCm: measurement.waistCm,
                    hipsCm: measurement.hipsCm,
                    dressSizeLabel: measurement.dressSizeLabel,
                    backupSize: measurement.backupSize,
                    shoeSize: measurement.shoeSize,
                    notes: measurement.notes,
                  }
                : null
            }
          />
        </div>
      </section>

      <p className="mt-14 flex items-center gap-2 text-[13px] text-ink-muted">
        <MapPin className="size-4 text-gold-ink" strokeWidth={1.75} aria-hidden />
        Shipping address: {[customer.addressLine1, customer.city, customer.region, customer.postalCode].filter(Boolean).join(', ') || 'added at checkout'}
      </p>
      <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-muted">
        <Heart className="size-4 text-gold-ink" strokeWidth={1.75} aria-hidden />
        Need something changed?{' '}
        <Link href="/contact" className="font-bold text-mulberry hover:underline">
          Write to the studio
        </Link>{' '}
        — replies usually land within a couple of hours.
      </p>
    </div>
  )
}
