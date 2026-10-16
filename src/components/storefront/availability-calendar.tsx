'use client'

/**
 * The live availability calendar.
 *
 * Days come straight from the studio's availability engine: existing bookings
 * with prep and buffer days, cleaning windows and admin blocks are all already
 * baked into `busyDays` for the selected size. A day is selectable only when
 * the whole rental window around it is clear, so what the customer taps is
 * what the studio can honour.
 */
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, formatMonthDay, formatMonthYear, isoDay, toDay } from '@/lib/dates'
import { cn } from '@/lib/cn'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function monthStart(value: Date | string): Date {
  const day = toDay(value)
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1))
}

function shiftMonth(cursor: Date, delta: number): Date {
  return new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + delta, 1))
}

export function AvailabilityCalendar({
  busyDays,
  minDay,
  maxDay,
  value,
  rentalDays,
  onChange,
}: {
  /** ISO days already held for the selected size (prep, buffer and blocks included). */
  busyDays: string[]
  minDay: string
  maxDay: string
  value: string | null
  rentalDays: number
  onChange: (iso: string) => void
}) {
  const busy = useMemo(() => new Set(busyDays), [busyDays])
  const [cursor, setCursor] = useState(() => monthStart(value ?? minDay))

  const min = toDay(minDay)
  const max = toDay(maxDay)
  const minMonth = monthStart(minDay)
  const maxMonth = monthStart(maxDay)

  const todayIso = isoDay(toDay(new Date()))

  /** The offsets a chosen event day occupies around itself. */
  function windowOffsets(): number[] {
    const offsets: number[] = []
    for (let offset = -2; offset <= rentalDays - 1; offset += 1) offsets.push(offset)
    return offsets
  }

  function windowClear(day: Date): boolean {
    for (const offset of windowOffsets()) {
      if (busy.has(isoDay(addDays(day, offset)))) return false
    }
    return true
  }

  function stateOf(day: Date): 'past' | 'reserved' | 'free' {
    if (day.getTime() < min.getTime() || day.getTime() > max.getTime()) return 'past'
    return windowClear(day) ? 'free' : 'reserved'
  }

  const cells = useMemo(() => {
    const first = cursor
    const startWeekday = first.getUTCDay()
    const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
    const out: Array<{ day: Date | null; iso: string | null }> = []
    for (let i = 0; i < startWeekday; i += 1) out.push({ day: null, iso: null })
    for (let d = 1; d <= daysInMonth; d += 1) {
      const day = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), d))
      out.push({ day, iso: isoDay(day) })
    }
    while (out.length % 7 !== 0) out.push({ day: null, iso: null })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, rentalDays, busy, minDay, maxDay])

  const selected = value ? toDay(value) : null
  const windowSet = useMemo(() => {
    if (!selected) return new Set<string>()
    const set = new Set<string>()
    for (const offset of windowOffsets()) set.add(isoDay(addDays(selected, offset)))
    return set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.getTime(), rentalDays])

  const firstSelectable = useMemo(() => {
    for (const cell of cells) {
      if (cell.day && stateOf(cell.day) === 'free') return cell.iso
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, busy, minDay, maxDay, rentalDays])

  /** Roving tabindex: the selected day, else the month's first free day. */
  const tabbableIso = value && cells.some((cell) => cell.iso === value) ? value : firstSelectable

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    const iso = target.getAttribute('data-iso')
    if (!iso) return
    let delta = 0
    if (event.key === 'ArrowLeft') delta = -1
    else if (event.key === 'ArrowRight') delta = 1
    else if (event.key === 'ArrowUp') delta = -7
    else if (event.key === 'ArrowDown') delta = 7
    else return

    event.preventDefault()
    const next = addDays(toDay(iso), delta)
    if (next.getTime() < min.getTime() || next.getTime() > max.getTime()) return

    // Focus the same weekday in the neighbouring month when crossing a border.
    if (next.getUTCMonth() !== cursor.getUTCMonth()) setCursor(monthStart(next))
    window.requestAnimationFrame(() => {
      const node = document.querySelector<HTMLButtonElement>(`[data-iso="${isoDay(next)}"]`)
      node?.focus()
    })
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={cursor.getTime() <= minMonth.getTime()}
          onClick={() => setCursor(shiftMonth(cursor, -1))}
          className="grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-40"
        >
          <ChevronLeft className="size-4.5" strokeWidth={1.75} aria-hidden />
        </button>
        <p aria-live="polite" className="font-serif text-base text-ink">
          {formatMonthYear(cursor)}
        </p>
        <button
          type="button"
          aria-label="Next month"
          disabled={cursor.getTime() >= maxMonth.getTime()}
          onClick={() => setCursor(shiftMonth(cursor, 1))}
          className="grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-40"
        >
          <ChevronRight className="size-4.5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <div role="grid" aria-label="Choose your event date" onKeyDown={onKeyDown} className="space-y-1">
        <div role="row" className="grid grid-cols-7">
          {WEEKDAYS.map((label) => (
            <span key={label} role="columnheader" aria-hidden className="pb-1.5 text-center text-[11px] font-bold tracking-wide text-ink-muted uppercase">
              {label}
            </span>
          ))}
        </div>
        {Array.from({ length: cells.length / 7 }, (_, row) => (
          <div key={row} role="row" className="grid grid-cols-7 gap-y-1">
            {cells.slice(row * 7, row * 7 + 7).map((cell, column) => {
              if (!cell.day || !cell.iso) return <span key={column} role="gridcell" className="size-9" />
              const iso = cell.iso
              const state = stateOf(cell.day)
              const isSelected = value === iso
              const inWindow = windowSet.has(iso)
              const isToday = iso === todayIso
              return (
                <span key={column} role="gridcell" className="grid place-items-center">
                  <button
                    type="button"
                    data-iso={iso}
                    tabIndex={iso === tabbableIso ? 0 : -1}
                    aria-disabled={state !== 'free' && !isSelected}
                    aria-pressed={isSelected}
                    aria-label={`${formatMonthDay(cell.day)} — ${
                      state === 'free' ? (isSelected ? 'your event date' : 'available') : state === 'reserved' ? 'reserved' : 'not bookable'
                    }`}
                    onClick={() => {
                      if (state === 'free') onChange(iso)
                    }}
                    className={cn(
                      'relative grid size-9 place-items-center rounded-full text-[13px] font-bold transition-colors',
                      isSelected
                        ? 'bg-accent text-accent-ink shadow-soft'
                        : state === 'reserved'
                          ? 'cursor-not-allowed text-rose/80'
                          : state === 'past'
                            ? 'cursor-not-allowed text-ink-muted/40'
                            : 'text-ink hover:bg-accent/10 hover:text-mulberry',
                      !isSelected && inWindow && state === 'free' ? 'bg-accent/10 text-mulberry' : '',
                      !isSelected && inWindow && state !== 'free' ? 'bg-rose/15 text-rose/90' : '',
                    )}
                  >
                    {cell.day.getUTCDate()}
                    {state === 'reserved' && !isSelected ? (
                      <span aria-hidden className="absolute bottom-0.5 left-1/2 h-0.5 w-3.5 -translate-x-1/2 rounded-full bg-rose/70" />
                    ) : null}
                    {isToday && !isSelected ? (
                      <span aria-hidden className="absolute top-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-gold" />
                    ) : null}
                  </button>
                </span>
              )
            })}
          </div>
        ))}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-accent" /> Selected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full border border-line bg-surface-muted" /> Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-rose/50" /> Reserved
        </span>
        <span className="ml-auto">Prep and cleaning days are already counted.</span>
      </div>
    </div>
  )
}
