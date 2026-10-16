/**
 * Date-first search: the home page's one job. Event date, occasion, size —
 * straight into the shop with the filters already applied.
 */
import { Search } from 'lucide-react'
import { Select } from '@/components/ui/field'
import { isoDay } from '@/lib/dates'
import { addDays, todayUtc } from '@/lib/dates'
import { STOREFRONT_BOOKING_HORIZON_DAYS } from '@/lib/storefront/shop-params'

export function DateSearch({ occasions, sizes }: { occasions: string[]; sizes: string[] }) {
  const today = todayUtc()
  const min = isoDay(addDays(today, 2))
  const max = isoDay(addDays(today, STOREFRONT_BOOKING_HORIZON_DAYS))

  return (
    <form
      method="GET"
      action="/shop"
      role="search"
      aria-label="Find a dress for your date"
      className="grid gap-3 rounded-2xl border border-line bg-surface/95 p-4 shadow-lift backdrop-blur sm:p-5 md:grid-cols-[1.2fr_1fr_1fr_auto]"
    >
      <div>
        <label htmlFor="hero-date" className="mb-1.5 block text-[11px] font-bold tracking-[0.12em] text-ink-muted uppercase">
          Your event date
        </label>
        <input
          id="hero-date"
          type="date"
          name="event"
          min={min}
          max={max}
          className="h-11 w-full rounded-lg border border-line bg-surface px-3.5 text-sm text-ink focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none"
        />
      </div>
      <div>
        <label htmlFor="hero-occasion" className="mb-1.5 block text-[11px] font-bold tracking-[0.12em] text-ink-muted uppercase">
          Occasion
        </label>
        <Select id="hero-occasion" name="occasion" defaultValue="">
          <option value="">Any occasion</option>
          {occasions.map((occasion) => (
            <option key={occasion} value={occasion}>
              {occasion}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="hero-size" className="mb-1.5 block text-[11px] font-bold tracking-[0.12em] text-ink-muted uppercase">
          Size
        </label>
        <Select id="hero-size" name="size" defaultValue="">
          <option value="">Any size</option>
          {sizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-bold tracking-wide text-accent-ink shadow-soft transition-colors hover:bg-accent-hover md:w-auto"
        >
          <Search className="size-4" strokeWidth={1.75} aria-hidden />
          Find dresses
        </button>
      </div>
    </form>
  )
}
