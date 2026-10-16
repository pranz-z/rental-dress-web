/**
 * Storefront catalog reads.
 *
 * One loader fetches every dressed piece with its sizes, prices, reviews count
 * and occupancy map — the wardrobe is boutique-sized, so the shop, the home
 * page and the dress pages all compute their views from a single pass.
 */
import { prisma } from '@/lib/db'
import type { Occupancy } from '@/lib/availability'
import { formatMoney } from '@/lib/money'
import { isoDay, todayUtc } from '@/lib/dates'
import { rentalPriceFor } from '@/lib/pricing'
import { availabilityFor, loadStorefrontOccupancies, storefrontWindow } from './availability'
import { PRICE_BANDS, type ShopFilters, type ShopSort } from './shop-params'

// Client-safe pieces live in shop-params; re-exported so every existing
// server-side import keeps working.
export {
  PRICE_BANDS,
  SORT_LABELS,
  STOREFRONT_BOOKING_HORIZON_DAYS,
  isShopSort,
  shopHref,
  type ShopFilters,
  type ShopSort,
} from './shop-params'

export type CatalogDress = {
  id: string
  slug: string
  name: string
  designer: string
  category: string
  occasion: string
  color: string
  colorHex: string
  length: string
  neckline: string
  sleeve: string
  fabric: string
  retailValue: number
  rentalPrice4: number
  rentalPrice8: number
  featured: boolean
  isNewArrival: boolean
  timesRented: number
  artTone: string
  sizes: string[]
  reviewCount: number
  reviewRating: number | null
}

export type Catalog = {
  dresses: CatalogDress[]
  occupancies: Map<string, Occupancy[]>
  prepDays: number
  bufferDays: number
}

export async function loadCatalog(): Promise<Catalog> {
  const [settings, rows] = await Promise.all([
    prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } }),
    prisma.dress.findMany({
      where: { status: { not: 'RETIRED' } },
      include: {
        sizes: { orderBy: { position: 'asc' } },
        _count: { select: { reviews: true } },
        reviews: { select: { rating: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const occupancies = await loadStorefrontOccupancies(prisma, rows.map((row) => row.id), settings.prepDays, settings.bufferDays)

  const dresses: CatalogDress[] = rows.map((row) => {
    const ratings = row.reviews.map((review) => review.rating)
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      designer: row.designer,
      category: row.category,
      occasion: row.occasion,
      color: row.color,
      colorHex: row.colorHex,
      length: row.length,
      neckline: row.neckline,
      sleeve: row.sleeve,
      fabric: row.fabric,
      retailValue: row.retailValue,
      rentalPrice4: rentalPriceFor(row.retailValue, 4, settings),
      rentalPrice8: rentalPriceFor(row.retailValue, 8, settings),
      featured: row.featured,
      isNewArrival: row.isNewArrival,
      timesRented: row.timesRented,
      artTone: row.artTone,
      sizes: row.sizes.map((size) => size.size),
      reviewCount: row._count.reviews,
      reviewRating: ratings.length > 0 ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10 : null,
    }
  })

  return { dresses, occupancies, prepDays: settings.prepDays, bufferDays: settings.bufferDays }
}

// ── shop filtering ────────────────────────────────────────────────────────

/** A valid ISO day within the booking horizon, or null. */
export function parseEventDay(value: string | undefined): Date | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  if (parsed.getTime() < todayUtc().getTime()) return null
  return parsed
}

export type ShopFacets = {
  occasions: Array<{ value: string; count: number }>
  colors: Array<{ value: string; count: number }>
  lengths: Array<{ value: string; count: number }>
  sizes: string[]
}

export function facetsFor(catalog: Catalog): ShopFacets {
  const tally = (pick: (dress: CatalogDress) => string) => {
    const counts = new Map<string, number>()
    for (const dress of catalog.dresses) counts.set(pick(dress), (counts.get(pick(dress)) ?? 0) + 1)
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value))
  }
  const sizeCounts = new Map<string, number>()
  for (const dress of catalog.dresses) {
    for (const size of dress.sizes) sizeCounts.set(size, (sizeCounts.get(size) ?? 0) + 1)
  }
  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  return {
    occasions: tally((dress) => dress.occasion).sort((a, b) => b.count - a.count),
    colors: tally((dress) => dress.color),
    lengths: tally((dress) => dress.length),
    sizes: [...sizeCounts.keys()].sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b)),
  }
}

export type ShopResult = {
  dresses: CatalogDress[]
  total: number
  pageCount: number
  page: number
  /** When an event day is chosen, each shown dress's availability for it. */
  availability: Map<string, { available: boolean; availableSizes: string[] }>
}

export function shopDresses(catalog: Catalog, filters: ShopFilters, perPage = 12): ShopResult {
  const eventDay = parseEventDay(filters.event)

  let list = catalog.dresses.filter((dress) => {
    if (filters.occasion && dress.occasion !== filters.occasion) return false
    if (filters.size && !dress.sizes.includes(filters.size)) return false
    if (filters.color && dress.color !== filters.color) return false
    if (filters.length && dress.length !== filters.length) return false
    if (filters.price) {
      const band = PRICE_BANDS.find((entry) => entry.value === filters.price)
      if (band) {
        if (dress.rentalPrice4 < band.min) return false
        if (band.max !== null && dress.rentalPrice4 > band.max) return false
      }
    }
    return true
  })

  const availability = new Map<string, { available: boolean; availableSizes: string[] }>()
  if (eventDay) {
    for (const dress of list) {
      const occupancies = catalog.occupancies.get(dress.id) ?? []
      const { deliveryDate, returnDate } = storefrontWindow(eventDay, 4)
      const availableSizes = dress.sizes.filter((size) =>
        availabilityFor(occupancies, deliveryDate, returnDate, size, catalog.prepDays, catalog.bufferDays).available,
      )
      availability.set(dress.id, { available: availableSizes.length > 0, availableSizes })
    }
    list = list.filter((dress) => availability.get(dress.id)?.available)
  }

  const sorted = [...list].sort((a, b) => {
    switch (filters.sort) {
      case 'newest':
        return Number(b.isNewArrival) - Number(a.isNewArrival) || b.timesRented - a.timesRented
      case 'price-asc':
        return a.rentalPrice4 - b.rentalPrice4
      case 'price-desc':
        return b.rentalPrice4 - a.rentalPrice4
      case 'rented':
        return b.timesRented - a.timesRented
      case 'recommended':
      default:
        return Number(b.featured) - Number(a.featured) || b.timesRented - a.timesRented
    }
  })

  const total = sorted.length
  const pageCount = Math.max(Math.ceil(total / perPage), 1)
  const page = Math.min(Math.max(filters.page, 1), pageCount)
  return {
    dresses: sorted.slice((page - 1) * perPage, page * perPage),
    total,
    pageCount,
    page,
    availability,
  }
}

// ── home page slices ──────────────────────────────────────────────────────

export function featuredDresses(catalog: Catalog, take = 8): CatalogDress[] {
  return [...catalog.dresses]
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b.timesRented - a.timesRented)
    .slice(0, take)
}

export function newArrivals(catalog: Catalog, take = 4): CatalogDress[] {
  return catalog.dresses.filter((dress) => dress.isNewArrival).sort((a, b) => b.timesRented - a.timesRented).slice(0, take)
}

export function trendingDresses(catalog: Catalog, take = 8): CatalogDress[] {
  return [...catalog.dresses].sort((a, b) => b.timesRented - a.timesRented).slice(0, take)
}

export function priceSummary(dress: CatalogDress): string {
  return `${formatMoney(dress.rentalPrice4)} · retail ${formatMoney(dress.retailValue)}`
}

/** The window a 4-day rental of this dress would occupy for a chosen event day. */
export function windowForEvent(eventDay: Date): { start: string; end: string } {
  const { deliveryDate, returnDate } = storefrontWindow(eventDay, 4)
  return { start: isoDay(deliveryDate), end: isoDay(returnDate) }
}
