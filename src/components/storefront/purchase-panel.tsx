'use client'

/**
 * Choose your size, period and date — then into the bag.
 * Every combination is checked against the live availability calendar, and the
 * final word still belongs to the server when the bag is submitted.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState } from 'react'
import { Check, Info, Loader2, ShoppingBag } from 'lucide-react'
import { addToCartAction } from '@/app/(storefront)/actions'
import { IDLE_FORM } from '@/app/(storefront)/form-state'
import { formatMoney } from '@/lib/money'
import { addDays, formatWeekday, isoDay, toDay } from '@/lib/dates'
import { cn } from '@/lib/cn'
import { Checkbox, FieldLabel } from '@/components/ui/field'
import { AvailabilityCalendar } from './availability-calendar'

type BusyMap = Record<string, string[]>

export function PurchasePanel({
  dressId,
  dressName,
  sizes,
  price4,
  price8,
  deposit,
  backupFee,
  busyBySize,
  minDay,
  maxDay,
  defaultSize,
}: {
  dressId: string
  dressName: string
  sizes: string[]
  price4: number
  price8: number
  deposit: number
  backupFee: number
  busyBySize: BusyMap
  minDay: string
  maxDay: string
  defaultSize?: string | null
}) {
  const router = useRouter()
  const [size, setSize] = useState<string>(defaultSize && sizes.includes(defaultSize) ? defaultSize : '')
  const [rentalDays, setRentalDays] = useState<4 | 8>(4)
  const [eventDate, setEventDate] = useState<string | null>(null)
  const [backupOn, setBackupOn] = useState(false)
  const [backupSize, setBackupSize] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [state, formAction, pending] = useActionState(addToCartAction, IDLE_FORM)

  const price = rentalDays === 8 ? price8 : price4
  const total = price + (backupOn && backupSize ? backupFee : 0)

  const busy = useMemo(() => new Set(busyBySize[size] ?? []), [busyBySize, size])

  function windowClear(candidate: string, forSize: string, days: number): boolean {
    const busySet = new Set(busyBySize[forSize] ?? [])
    const day = toDay(candidate)
    for (let offset = -2; offset <= days - 1; offset += 1) {
      if (busySet.has(isoDay(addDays(day, offset)))) return false
    }
    return true
  }

  function switchSize(next: string) {
    setSize(next)
    setNotice(null)
    if (eventDate && !windowClear(eventDate, next, rentalDays)) {
      setEventDate(null)
      setNotice(`Your date was taken in size ${next} — pick another from the calendar.`)
    }
    if (backupSize === next) setBackupSize('')
  }

  function switchDays(next: 4 | 8) {
    setRentalDays(next)
    setNotice(null)
    if (eventDate && size && !windowClear(eventDate, size, next)) {
      setEventDate(null)
      setNotice(`The ${next}-day window does not fit your date — choose another event date.`)
    }
  }

  useEffect(() => {
    if (state.status === 'ok') router.refresh()
  }, [state, router])

  const backupChoices = sizes.filter((option) => option !== size)
  const selectedDay = eventDate ? toDay(eventDate) : null
  const deliveryDay = selectedDay ? addDays(selectedDay, -1) : null
  const returnDay = deliveryDay ? addDays(deliveryDay, rentalDays - 1) : null

  return (
    <div className="space-y-6">
      {/* size */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <FieldLabel className="mb-0">Your size</FieldLabel>
          <Link href="/size-guide" className="text-xs font-bold text-mulberry hover:underline">
            Size guide
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {sizes.map((option) => {
            const free = eventDate ? windowClear(eventDate, option, rentalDays) : true
            return (
              <button
                key={option}
                type="button"
                onClick={() => switchSize(option)}
                aria-pressed={size === option}
                className={cn(
                  'inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-bold transition-colors',
                  size === option ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-muted hover:border-rose hover:text-mulberry',
                )}
              >
                {option}
                {eventDate && !free ? <span aria-hidden className="size-1.5 rounded-full bg-rose" /> : null}
              </button>
            )
          })}
        </div>
        {sizes.length === 0 ? <p className="text-sm text-ink-muted">This piece is between sizes — the studio can advise by email.</p> : null}
      </div>

      {/* backup size */}
      <div className="rounded-xl border border-line bg-surface-muted/40 p-4">
        <label className="flex items-start gap-3">
          <Checkbox checked={backupOn} onChange={(event) => setBackupOn(event.target.checked)} />
          <span>
            <span className="block text-sm font-bold text-ink">
              Add a backup size <span className="font-normal text-ink-muted">— {formatMoney(backupFee)}</span>
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
              A second, sealed size of the same dress. Never opened, refunded in full with your deposit.
            </span>
          </span>
        </label>
        {backupOn ? (
          <div className="mt-3">
            <label htmlFor="backup-size" className="mb-1.5 block text-[11px] font-bold tracking-[0.1em] text-ink-muted uppercase">
              Backup size
            </label>
            <div className="flex flex-wrap gap-2">
              {backupChoices.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setBackupSize(option)}
                  aria-pressed={backupSize === option}
                  className={cn(
                    'inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3.5 text-[13px] font-bold transition-colors',
                    backupSize === option ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-muted hover:border-rose hover:text-mulberry',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* rental period */}
      <fieldset className="border-0 p-0">
        <legend className="mb-2 text-[11px] font-bold tracking-[0.1em] text-ink-muted uppercase">Rental window</legend>
        <div className="grid grid-cols-2 gap-2">
          {([4, 8] as const).map((days) => (
            <label
              key={days}
              className={cn(
                'cursor-pointer rounded-xl border p-3.5 text-center transition-colors',
                rentalDays === days ? 'border-accent bg-accent/5' : 'border-line bg-surface hover:border-rose',
              )}
            >
              <input
                type="radio"
                name="rentalDaysChoice"
                value={days}
                checked={rentalDays === days}
                onChange={() => switchDays(days)}
                className="sr-only"
              />
              <span className="block font-serif text-lg text-ink">{days} days</span>
              <span className="mt-0.5 block text-sm font-bold text-ink">{formatMoney(days === 4 ? price4 : price8)}</span>
              <span className="mt-0.5 block text-[11px] text-ink-muted">{days === 4 ? 'Arrives the day before' : 'A week to style it'}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* calendar */}
      <div>
        <p className="mb-2 text-[11px] font-bold tracking-[0.1em] text-ink-muted uppercase">Your event date</p>
        {!size ? (
          <p className="rounded-xl border border-dashed border-line bg-surface-muted/40 px-4 py-3 text-sm text-ink-muted">
            Choose a size above and the calendar will open for it.
          </p>
        ) : (
          <AvailabilityCalendar
            busyDays={busyBySize[size] ?? []}
            minDay={minDay}
            maxDay={maxDay}
            value={eventDate}
            rentalDays={rentalDays}
            onChange={(iso) => {
              setEventDate(iso)
              setNotice(null)
            }}
          />
        )}
      </div>

      {selectedDay && deliveryDay && returnDay ? (
        <p className="flex items-start gap-2 rounded-xl border border-line bg-surface-muted/50 px-4 py-3 text-sm leading-relaxed text-ink">
          <Check className="mt-0.5 size-4 shrink-0 text-mulberry" strokeWidth={2} aria-hidden />
          <span>
            Arrives <span className="font-bold">{formatWeekday(deliveryDay)}</span>, ready for your event on{' '}
            <span className="font-bold">{formatWeekday(selectedDay)}</span>. Due back{' '}
            <span className="font-bold">{formatWeekday(returnDay)}</span> — the prepaid label is in the box.
          </span>
        </p>
      ) : null}

      {notice ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-gold/50 bg-gold/10 px-4 py-3 text-sm leading-relaxed text-ink">
          <Info className="mt-0.5 size-4 shrink-0 text-gold-ink" strokeWidth={2} aria-hidden />
          {notice}
        </p>
      ) : null}

      {state.status === 'ok' ? (
        <div role="status" className="rounded-xl border border-line bg-surface p-4">
          <p className="font-serif text-lg text-ink">In your bag</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{state.message}</p>
          <div className="mt-3 flex gap-2">
            <Link href="/cart" className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-[13px] font-bold text-accent-ink transition-colors hover:bg-accent-hover">
              Go to your bag
            </Link>
            <Link href="/shop" className="inline-flex h-10 items-center rounded-full border border-line-strong bg-surface px-5 text-[13px] font-bold text-ink transition-colors hover:bg-surface-muted">
              Keep looking
            </Link>
          </div>
        </div>
      ) : (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="dressId" value={dressId} />
          <input type="hidden" name="size" value={size} />
          <input type="hidden" name="rentalDays" value={rentalDays} />
          <input type="hidden" name="eventDate" value={eventDate ?? ''} />
          {backupOn && backupSize ? <input type="hidden" name="backupSize" value={backupSize} /> : null}

          <button
            type="submit"
            disabled={pending || !size || !eventDate}
            className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-accent px-7 text-[15px] font-bold tracking-wide text-accent-ink shadow-soft transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-55"
          >
            {pending ? <Loader2 className="size-4.5 animate-spin" aria-hidden /> : <ShoppingBag className="size-4.5" strokeWidth={1.75} aria-hidden />}
            {!size ? 'Choose a size' : !eventDate ? 'Choose your event date' : `Add to bag — ${formatMoney(total)}`}
          </button>

          <p className="text-center text-xs leading-relaxed text-ink-muted">
            Rent {formatMoney(price)} for {rentalDays} days{backupOn && backupSize ? ` + ${formatMoney(backupFee)} backup` : ''} · a refundable{' '}
            {formatMoney(deposit)} deposit is authorized, never charged unless something is damaged.
          </p>

          {state.status === 'error' ? (
            <p role="alert" className="rounded-xl border border-danger-line bg-surface px-4 py-3 text-sm font-bold text-danger-ink">
              {state.message}
              {state.suggestions && state.suggestions.length > 0 ? (
                <span className="mt-1 block font-normal text-ink-muted">Try: {state.suggestions.join(', or ')}.</span>
              ) : null}
            </p>
          ) : null}
        </form>
      )}
    </div>
  )
}
