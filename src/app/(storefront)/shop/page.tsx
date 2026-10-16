import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays, SlidersHorizontal } from 'lucide-react'
import { prisma } from '@/lib/db'
import { cn } from '@/lib/cn'
import { isoDay } from '@/lib/dates'
import { currentCustomer } from '@/lib/storefront/session'
import { addDays, todayUtc } from '@/lib/dates'
import {
  STOREFRONT_BOOKING_HORIZON_DAYS,
  facetsFor,
  isShopSort,
  loadCatalog,
  parseEventDay,
  shopDresses,
  shopHref,
  type ShopFilters,
} from '@/lib/storefront/catalog'
import { DressCard } from '@/components/storefront/dress-card'
import { ActiveFilterChips, ShopFilters as ShopFilterPanel } from '@/components/storefront/shop-filters'
import { SortSelect } from '@/components/storefront/sort-select'

export const metadata: Metadata = {
  title: 'Shop — designer dresses to rent',
  description:
    'Browse the Maison Rêve collection: designer gowns, midis and maxis for weddings, galas and black-tie evenings. Filter by occasion, size, colour and date availability.',
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const filters: ShopFilters = {
    occasion: one(params.occasion),
    size: one(params.size),
    color: one(params.color),
    length: one(params.length),
    price: one(params.price),
    event: one(params.event),
    sort: isShopSort(one(params.sort)) ? (one(params.sort) as ShopFilters['sort']) : 'recommended',
    page: Math.max(Number(one(params.page) ?? '1') || 1, 1),
  }

  const [catalog, customer] = await Promise.all([loadCatalog(), currentCustomer()])
  const facets = facetsFor(catalog)
  const result = shopDresses(catalog, filters)

  const savedIds = customer
    ? new Set(
        (
          await prisma.favorite.findMany({
            where: { customerId: customer.id, dressId: { in: result.dresses.map((dress) => dress.id) } },
            select: { dressId: true },
          })
        ).map((row) => row.dressId),
      )
    : new Set<string>()

  const eventDay = parseEventDay(filters.event)
  const today = todayUtc()
  const filterCount = [filters.occasion, filters.size, filters.color, filters.length, filters.price].filter(Boolean).length

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
      <header className="max-w-2xl">
        <p className="text-[11px] font-bold tracking-[0.2em] text-gold-ink uppercase">The collection</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight text-ink sm:text-5xl">
          {filters.occasion ? `Dresses for ${filters.occasion.toLowerCase()}` : 'Every dress, ready to be worn'}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
          {eventDay
            ? `Showing pieces that are free for an event on ${isoDay(eventDay)}. A four-day rental arrives the day before and returns two days after.`
            : 'Reserve four or eight days, wear it once, send it back with the prepaid label. The studio handles cleaning.'}
        </p>
      </header>

      <div className="mt-7 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <form method="GET" action="/shop" className="flex flex-wrap items-end gap-2.5 rounded-xl border border-line bg-surface p-3.5">
          {filters.occasion ? <input type="hidden" name="occasion" value={filters.occasion} /> : null}
          {filters.size ? <input type="hidden" name="size" value={filters.size} /> : null}
          {filters.color ? <input type="hidden" name="color" value={filters.color} /> : null}
          {filters.length ? <input type="hidden" name="length" value={filters.length} /> : null}
          {filters.price ? <input type="hidden" name="price" value={filters.price} /> : null}
          {filters.sort !== 'recommended' ? <input type="hidden" name="sort" value={filters.sort} /> : null}
          <div>
            <label htmlFor="shop-date" className="mb-1.5 block text-[11px] font-bold tracking-[0.12em] text-ink-muted uppercase">
              <CalendarDays className="mr-1 inline size-3.5 -translate-y-px" strokeWidth={2} aria-hidden />
              Shopping for a date?
            </label>
            <input
              id="shop-date"
              type="date"
              name="event"
              defaultValue={filters.event ?? ''}
              min={isoDay(addDays(today, 2))}
              max={isoDay(addDays(today, STOREFRONT_BOOKING_HORIZON_DAYS))}
              className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-[13px] font-bold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            Check availability
          </button>
        </form>
        <SortSelect value={filters.sort} />
      </div>

      <div className="mt-5">
        <ActiveFilterChips facets={facets} filters={filters} />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[250px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-xl border border-line bg-surface p-5">
            <ShopFilterPanel facets={facets} filters={filters} resultCount={result.total} />
          </div>
        </aside>

        <div>
          <details className="mb-5 rounded-xl border border-line bg-surface lg:hidden">
            <summary className="flex h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-bold text-ink [&::-webkit-details-marker]:hidden">
              <SlidersHorizontal className="size-4" strokeWidth={1.75} aria-hidden />
              Filters
              {filterCount > 0 ? (
                <span className="grid size-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">{filterCount}</span>
              ) : null}
            </summary>
            <div className="border-t border-line p-5">
              <ShopFilterPanel facets={facets} filters={filters} resultCount={result.total} />
            </div>
          </details>

          {result.dresses.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface px-6 py-16 text-center">
              <p className="font-serif text-2xl text-ink">Nothing matches — yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
                Try removing a filter{eventDay ? ', or a different event date' : ''}. The studio adds new pieces most weeks.
              </p>
              <Link
                href={shopHref(filters, { occasion: undefined, size: undefined, color: undefined, length: undefined, price: undefined, event: undefined, page: 1 })}
                className="mt-5 inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
              >
                Show everything
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
                {result.dresses.map((dress) => (
                  <DressCard
                    key={dress.id}
                    dress={dress}
                    saved={savedIds.has(dress.id)}
                    signedIn={Boolean(customer)}
                    eventDate={filters.event ?? null}
                    available={result.availability.get(dress.id)}
                  />
                ))}
              </div>

              {result.pageCount > 1 ? (
                <nav aria-label="Shop pages" className="mt-12 flex items-center justify-center gap-2">
                  {Array.from({ length: result.pageCount }, (_, index) => index + 1).map((page) => (
                    <Link
                      key={page}
                      href={shopHref(filters, { page })}
                      aria-current={page === result.page ? 'page' : undefined}
                      className={cn(
                        'grid size-10 place-items-center rounded-full border text-sm font-bold transition-colors',
                        page === result.page ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-muted hover:border-rose hover:text-mulberry',
                      )}
                    >
                      {page}
                    </Link>
                  ))}
                </nav>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
