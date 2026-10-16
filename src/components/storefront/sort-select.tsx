'use client'

import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/field'
import { SORT_LABELS } from '@/lib/storefront/shop-params'

/** Sort changes navigate straight to the new URL — no submit button needed. */
export function SortSelect({ value }: { value: string }) {
  const router = useRouter()

  function onSort(next: string) {
    const url = new URL(window.location.href)
    if (next === 'recommended') url.searchParams.delete('sort')
    else url.searchParams.set('sort', next)
    url.searchParams.delete('page')
    router.push(`${url.pathname}?${url.searchParams.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="shop-sort" className="text-xs font-bold tracking-wide text-ink-muted">
        Sort
      </label>
      <span className="w-[190px]">
        <Select id="shop-sort" defaultValue={value} className="h-10" onChange={(event) => onSort(event.target.value)}>
          {SORT_LABELS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </span>
    </div>
  )
}
