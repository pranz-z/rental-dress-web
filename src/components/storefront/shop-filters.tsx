/**
 * Shop filters — plain links, so every state is a real URL, shareable and
 * keyboard-navigable. The mobile drawer renders the same groups.
 */
import Link from 'next/link'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { PRICE_BANDS, shopHref } from '@/lib/storefront/shop-params'
import type { ShopFacets, ShopFilters } from '@/lib/storefront/catalog'

type Group = {
  key: 'occasion' | 'size' | 'color' | 'length' | 'price'
  label: string
  options: Array<{ value: string; label: string; count?: number; swatch?: string }>
}

const COLOR_SWATCHES: Record<string, string> = {
  Champagne: '#e8d9b8',
  'Midnight blue': '#2f3540',
  Blush: '#f0d4d4',
  Emerald: '#33544a',
  'Soft white': '#f7f3ef',
  'Dusty rose': '#d8a7a7',
  Terracotta: '#c47a5a',
  Noir: '#2b2628',
  'Pearl grey': '#d9d6d1',
  Ivory: '#f4ede7',
  'Antique gold': '#c9a96e',
  'Blush pink': '#f3d9d9',
  Burgundy: '#6d2f3c',
}

function groupList(facets: ShopFacets): Group[] {
  return [
    {
      key: 'occasion',
      label: 'Occasion',
      options: facets.occasions.map((entry) => ({ value: entry.value, label: entry.value, count: entry.count })),
    },
    { key: 'size', label: 'Size', options: facets.sizes.map((size) => ({ value: size, label: size })) },
    {
      key: 'color',
      label: 'Colour',
      options: facets.colors.map((entry) => ({ value: entry.value, label: entry.value, count: entry.count, swatch: COLOR_SWATCHES[entry.value] })),
    },
    {
      key: 'length',
      label: 'Length',
      options: facets.lengths.map((entry) => ({ value: entry.value, label: entry.value, count: entry.count })),
    },
    { key: 'price', label: 'Rental price', options: PRICE_BANDS.map((band) => ({ value: band.value, label: band.label })) },
  ]
}

export function ShopFilters({ facets, filters, resultCount }: { facets: ShopFacets; filters: ShopFilters; resultCount: number }) {
  const groups = groupList(facets)
  const activeCount = [filters.occasion, filters.size, filters.color, filters.length, filters.price].filter(Boolean).length

  function toggle(key: Group['key'], value: string): string {
    const current = filters[key]
    return shopHref(filters, { [key]: current === value ? undefined : value, page: 1 } as Partial<ShopFilters>)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold tracking-[0.16em] text-ink-muted uppercase">Refine</p>
        {activeCount > 0 ? (
          <Link href={shopHref(filters, { occasion: undefined, size: undefined, color: undefined, length: undefined, price: undefined, page: 1 })} className="text-xs font-bold text-mulberry hover:underline">
            Clear all
          </Link>
        ) : null}
      </div>

      {groups.map((group) => (
        <fieldset key={group.key} className="border-0 p-0">
          <legend className="mb-2.5 text-[11px] font-bold tracking-[0.14em] text-ink-muted uppercase">{group.label}</legend>
          <ul className="flex flex-wrap gap-2">
            {group.options.map((option) => {
              const active = filters[group.key] === option.value
              return (
                <li key={option.value}>
                  <Link
                    href={toggle(group.key, option.value)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-bold tracking-wide transition-colors',
                      active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-muted hover:border-rose hover:text-mulberry',
                    )}
                  >
                    {option.swatch ? (
                      <span
                        aria-hidden
                        className="size-3 rounded-full border border-charcoal/15"
                        style={{ background: option.swatch }}
                      />
                    ) : null}
                    {option.label}
                    {option.count !== undefined ? <span className={cn('text-[11px]', active ? 'text-accent-ink/80' : 'text-ink-muted/80')}>{option.count}</span> : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </fieldset>
      ))}

      <p className="border-t border-line pt-4 text-xs text-ink-muted">
        {resultCount} {resultCount === 1 ? 'dress' : 'dresses'} in the collection
        {filters.event ? ' for this date' : ''}
      </p>
    </div>
  )
}

/** Active filter chips above the grid, each one removable. */
export function ActiveFilterChips({ facets, filters }: { facets: ShopFacets; filters: ShopFilters }) {
  const chips: Array<{ key: Group['key']; label: string; value: string }> = []
  if (filters.occasion) chips.push({ key: 'occasion', label: filters.occasion, value: filters.occasion })
  if (filters.size) chips.push({ key: 'size', label: `Size ${filters.size}`, value: filters.size })
  if (filters.color) chips.push({ key: 'color', label: filters.color, value: filters.color })
  if (filters.length) chips.push({ key: 'length', label: filters.length, value: filters.length })
  if (filters.price) chips.push({ key: 'price', label: PRICE_BANDS.find((band) => band.value === filters.price)?.label ?? filters.price, value: filters.price })
  void facets

  if (chips.length === 0 && !filters.event) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.event ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-bold text-ink-muted">
          For your event on {filters.event}
          <Link href={shopHref(filters, { event: undefined, page: 1 })} aria-label="Remove date filter" className="text-ink-muted hover:text-mulberry">
            <X className="size-3.5" strokeWidth={2} aria-hidden />
          </Link>
        </span>
      ) : null}
      {chips.map((chip) => (
        <span key={`${chip.key}-${chip.value}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-bold text-ink-muted">
          {chip.label}
          <Link
            href={shopHref(filters, { [chip.key]: undefined, page: 1 } as Partial<ShopFilters>)}
            aria-label={`Remove ${chip.label} filter`}
            className="hover:text-mulberry"
          >
            <X className="size-3.5" strokeWidth={2} aria-hidden />
          </Link>
        </span>
      ))}
    </div>
  )
}
