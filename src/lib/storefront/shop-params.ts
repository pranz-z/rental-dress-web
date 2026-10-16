/**
 * Client-safe shop parameters.
 *
 * Sort labels, price bands, filter shapes and link helpers live here — with no
 * database imports — so client components (the filters, the sort select, the
 * date search) can use them without dragging the server graph into the bundle.
 * The server-side catalog module re-exports everything, so both worlds share
 * one definition.
 */

export const STOREFRONT_BOOKING_HORIZON_DAYS = 120

export type ShopSort = 'recommended' | 'newest' | 'price-asc' | 'price-desc' | 'rented'

export const SORT_LABELS: Array<{ value: ShopSort; label: string }> = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rented', label: 'Most rented' },
]

export const PRICE_BANDS: Array<{ value: string; label: string; min: number; max: number | null }> = [
  { value: 'under-100', label: 'Under $100', min: 0, max: 9999 },
  { value: '100-150', label: '$100 – $150', min: 10000, max: 15000 },
  { value: '150-250', label: '$150 – $250', min: 15001, max: 25000 },
  { value: '250-plus', label: '$250 and up', min: 25001, max: null },
]

export function isShopSort(value: string | undefined): value is ShopSort {
  return SORT_LABELS.some((option) => option.value === value)
}

export type ShopFilters = {
  occasion?: string
  size?: string
  color?: string
  length?: string
  price?: string
  event?: string
  sort: ShopSort
  page: number
}

export function shopHref(current: ShopFilters, patch: Partial<ShopFilters>): string {
  const merged = { ...current, ...patch }
  const search = new URLSearchParams()
  if (merged.occasion) search.set('occasion', merged.occasion)
  if (merged.size) search.set('size', merged.size)
  if (merged.color) search.set('color', merged.color)
  if (merged.length) search.set('length', merged.length)
  if (merged.price) search.set('price', merged.price)
  if (merged.event) search.set('event', merged.event)
  if (merged.sort && merged.sort !== 'recommended') search.set('sort', merged.sort)
  if (merged.page && merged.page > 1) search.set('page', String(merged.page))
  const query = search.toString()
  return query ? `/shop?${query}` : '/shop'
}
