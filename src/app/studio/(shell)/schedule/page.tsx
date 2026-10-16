import type { Metadata } from 'next'
import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import {
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  PackageCheck,
  PackageOpen,
  Printer,
  Sparkles,
  Truck,
} from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { FieldLabel, Input, Select } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { requireCapability } from '@/lib/auth/guards'
import { markLateBookings } from '@/lib/bookings'
import { cn } from '@/lib/cn'
import {
  addDays,
  blockedUntil,
  diffDays,
  eachDay,
  formatDay,
  formatWeekdayLong,
  isoDay,
  relativeDayLabel,
  relativeFromNow,
  todayUtc,
  toStudioDay,
  weekdayName,
} from '@/lib/dates'
import { prisma } from '@/lib/db'
import { BOOKING_STATUS_META, can } from '@/lib/domain'
import {
  SCHEDULE_DONE_MESSAGES,
  SCHEDULE_RANGES,
  SCHEDULE_TYPES,
  SCHEDULE_TYPE_LABEL,
  parseScheduleRange,
  parseScheduleTypes,
  scheduleHref,
  type ScheduleType,
} from '@/lib/schedule'
import {
  completeCleaningAction,
  deliverFromScheduleAction,
  returnFromScheduleAction,
  shipFromScheduleAction,
} from './actions'

export const metadata: Metadata = { title: 'Schedule' }
export const dynamic = 'force-dynamic'

const bookingRowSelect = {
  id: true,
  status: true,
  size: true,
  deliveryDate: true,
  returnDate: true,
  bufferDays: true,
  courier: true,
  trackingNumber: true,
  customer: { select: { name: true } },
  dress: { select: { id: true, name: true } },
} satisfies Prisma.BookingSelect

type ScheduleBooking = Prisma.BookingGetPayload<{ select: typeof bookingRowSelect }>

const cleaningRowSelect = {
  id: true,
  startedAt: true,
  method: true,
  completedAt: true,
  dress: { select: { id: true, name: true, status: true } },
  booking: {
    select: {
      id: true,
      returnDate: true,
      bufferDays: true,
      customer: { select: { name: true } },
    },
  },
} satisfies Prisma.CleaningRecordSelect

type CleaningRow = Prisma.CleaningRecordGetPayload<{ select: typeof cleaningRowSelect }>

type ScheduleCapabilities = {
  ship: boolean
  deliver: boolean
  return: boolean
  cleaning: boolean
}

type DayEntry = { kind: 'DELIVERY' | 'RETURN'; booking: ScheduleBooking }

/** The first day a dress is expected back from cleaning, across all open tickets. */
function readyDayFor(record: CleaningRow, bufferDays: number): Date {
  // Cleaning starts when the dress actually comes back, so the clock runs from
  // the ticket (not the original due date — a late return means late cleaning).
  return addDays(toStudioDay(record.startedAt), bufferDays)
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; range?: string; done?: string; error?: string }>
}) {
  const { type: typeParam, range: rangeParam, done, error } = await searchParams
  const staff = await requireCapability('schedule.view')

  const activeTypes = parseScheduleTypes(typeParam)
  const range = parseScheduleRange(rangeParam)
  const showDelivery = activeTypes.includes('DELIVERY')
  const showReturn = activeTypes.includes('RETURN')
  const showCleaning = activeTypes.includes('CLEANING')

  const today = todayUtc()
  const horizon = addDays(today, range - 1)

  await markLateBookings(today)

  const [overdue, deliveries, returns, cleaningQueue, recentlySignedOff, settings] = await Promise.all([
    prisma.booking.findMany({
      where: { status: 'LATE' },
      orderBy: { returnDate: 'asc' },
      select: bookingRowSelect,
    }),
    prisma.booking.findMany({
      where: {
        deliveryDate: { gte: today, lte: horizon },
        status: { in: ['CONFIRMED', 'SHIPPED'] },
      },
      orderBy: [{ deliveryDate: 'asc' }, { id: 'asc' }],
      select: bookingRowSelect,
    }),
    prisma.booking.findMany({
      where: {
        returnDate: { gte: today, lte: horizon },
        status: { in: ['SHIPPED', 'WITH_CUSTOMER', 'LATE'] },
      },
      orderBy: [{ returnDate: 'asc' }, { id: 'asc' }],
      select: bookingRowSelect,
    }),
    prisma.cleaningRecord.findMany({
      where: { completedAt: null },
      orderBy: { startedAt: 'asc' },
      select: cleaningRowSelect,
    }),
    prisma.cleaningRecord.findMany({
      where: { completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      take: 4,
      select: cleaningRowSelect,
    }),
    prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } }),
  ])

  const caps: ScheduleCapabilities = {
    ship: can(staff.role, 'bookings.ship'),
    deliver: can(staff.role, 'bookings.deliver'),
    return: can(staff.role, 'bookings.return'),
    cleaning: can(staff.role, 'inventory.cleaning'),
  }

  const days = eachDay(today, horizon)
  const byDay = new Map<string, DayEntry[]>(days.map((day) => [isoDay(day), []]))
  if (showDelivery) {
    for (const booking of deliveries) byDay.get(isoDay(booking.deliveryDate))?.push({ kind: 'DELIVERY', booking })
  }
  if (showReturn) {
    for (const booking of returns) byDay.get(isoDay(booking.returnDate))?.push({ kind: 'RETURN', booking })
  }

  const cleaningReadyByDress = new Map<string, Date>()
  for (const record of cleaningQueue) {
    const ready = readyDayFor(record, settings.bufferDays)
    const current = cleaningReadyByDress.get(record.dress.id)
    if (!current || ready.getTime() < current.getTime()) cleaningReadyByDress.set(record.dress.id, ready)
  }

  const returnTo = scheduleHref({ types: activeTypes, range })
  const doneMessage = done ? (SCHEDULE_DONE_MESSAGES[done] ?? null) : null

  const counts: Record<ScheduleType, number> = {
    DELIVERY: deliveries.length,
    RETURN: returns.length + overdue.length,
    CLEANING: cleaningQueue.length,
  }

  function toggleTypeHref(entryType: ScheduleType): string {
    const next = activeTypes.includes(entryType)
      ? activeTypes.filter((value) => value !== entryType)
      : SCHEDULE_TYPES.filter((value) => value === entryType || activeTypes.includes(value))
    return scheduleHref({ types: [...next], range })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description={`What leaves the studio and what comes home — ${formatWeekdayLong(today)} through ${formatWeekdayLong(horizon)}.`}
      >
        <ButtonLink href={`/studio/schedule/run-sheet?date=${isoDay(today)}`} variant="secondary" size="sm">
          <Printer className="size-4" strokeWidth={1.75} aria-hidden />
          Run sheet
        </ButtonLink>
      </PageHeader>

      {error ? (
        <div role="alert" className="rounded-xl border border-danger-line bg-surface px-4 py-3 text-sm font-bold text-danger-ink">
          {error}
        </div>
      ) : null}
      {doneMessage ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden />
            {doneMessage}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by type">
          {SCHEDULE_TYPES.map((entryType) => {
            const active = activeTypes.includes(entryType)
            return (
              <Link
                key={entryType}
                href={toggleTypeHref(entryType)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'chip transition-shadow',
                  active ? 'ring-2 ring-accent/45 ring-offset-2 ring-offset-page' : 'hover:ring-2 hover:ring-accent/20',
                )}
              >
                {SCHEDULE_TYPE_LABEL[entryType]} · {counts[entryType]}
              </Link>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-ink-muted">Range</span>
          <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1" role="group" aria-label="Date range">
            {SCHEDULE_RANGES.map((option) => (
              <Link
                key={option}
                href={scheduleHref({ types: activeTypes, range: option })}
                aria-current={option === range ? 'true' : undefined}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors',
                  option === range ? 'bg-surface-muted text-ink' : 'text-ink-muted hover:text-ink',
                )}
              >
                {option} days
              </Link>
            ))}
          </div>
        </div>
      </div>

      {activeTypes.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
          <EmptyState
            icon={CalendarOff}
            title="Everything is hidden"
            description="Deliveries, returns and the cleaning queue are all filtered out. Turn a type back on to see the board."
            action={
              <ButtonLink href="/studio/schedule" size="sm" variant="secondary">
                Show everything
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <>
          {showReturn && overdue.length > 0 ? <OverdueSection bookings={overdue} caps={caps} returnTo={returnTo} today={today} /> : null}

          {showDelivery || showReturn ? (
            <div className="space-y-4">
              {days.map((day) => {
                const entries = byDay.get(isoDay(day)) ?? []
                const isToday = isoDay(day) === isoDay(today)
                if (entries.length === 0 && !isToday) return null
                return (
                  <DaySection
                    key={isoDay(day)}
                    day={day}
                    entries={entries}
                    isToday={isToday}
                    caps={caps}
                    returnTo={returnTo}
                    cleaningReadyByDress={cleaningReadyByDress}
                    bufferDays={settings.bufferDays}
                  />
                )
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink-muted">
              Day-by-day movement is filtered out — only the cleaning queue is showing.
            </p>
          )}

          {showCleaning ? (
            <CleaningSection
              records={cleaningQueue}
              recentlySignedOff={recentlySignedOff}
              caps={caps}
              returnTo={returnTo}
              today={today}
              bufferDays={settings.bufferDays}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

// ── sections ──────────────────────────────────────────────────────────────

function SectionShell({
  icon: Icon,
  tone,
  title,
  description,
  count,
  children,
  alert = false,
}: {
  icon: typeof Truck
  tone: 'clay' | 'sage'
  title: string
  description: string
  count: number
  children: React.ReactNode
  alert?: boolean
}) {
  return (
    <section aria-label={title} className={cn('overflow-hidden rounded-xl border bg-surface shadow-soft', alert ? 'border-danger-line' : 'border-line')}>
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <span
          data-tone={tone}
          className="grid size-9 shrink-0 place-items-center rounded-full border"
          style={{ background: 'var(--tone-bg)', borderColor: 'var(--tone-line)', color: 'var(--tone-ink)' }}
        >
          <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-lg leading-snug text-ink">{title}</h2>
          <p className="text-xs text-ink-muted">{description}</p>
        </div>
        <Chip tone={tone}>{count}</Chip>
      </header>
      {children}
    </section>
  )
}

function OverdueSection({
  bookings,
  caps,
  returnTo,
  today,
}: {
  bookings: ScheduleBooking[]
  caps: ScheduleCapabilities
  returnTo: string
  today: Date
}) {
  return (
    <SectionShell
      icon={AlertTriangle}
      tone="clay"
      alert
      title="Overdue returns"
      description="Pinned here until every dress has been checked back in."
      count={bookings.length}
    >
      <ul className="divide-y divide-line">
        {bookings.map((booking) => {
          const daysLate = Math.max(diffDays(booking.returnDate, today), 0)
          return (
            <li key={booking.id} className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                <span
                  data-tone="clay"
                  className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border"
                  style={{ background: 'var(--tone-bg)', borderColor: 'var(--tone-line)', color: 'var(--tone-ink)' }}
                >
                  <PackageOpen className="size-4" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="clay" dot>
                      Late
                    </Chip>
                    <p className="text-sm font-bold text-ink">
                      {daysLate} day{daysLate === 1 ? '' : 's'} overdue
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-ink">
                    {booking.dress.name} <span className="text-ink-muted">· size {booking.size}</span>
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-muted">
                    {booking.customer.name} ·{' '}
                    <Link
                      href={`/studio/bookings/${booking.id}`}
                      className="font-bold text-ink underline-offset-4 hover:underline"
                    >
                      {booking.id}
                    </Link>
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">Was due back {formatDay(booking.returnDate)}.</p>
                </div>
                {caps.return ? (
                  <form action={returnFromScheduleAction} className="shrink-0 self-center">
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <Button type="submit" size="sm">
                      <PackageOpen className="size-4" strokeWidth={1.75} aria-hidden />
                      Mark returned
                    </Button>
                  </form>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </SectionShell>
  )
}

function DaySection({
  day,
  entries,
  isToday,
  caps,
  returnTo,
  cleaningReadyByDress,
  bufferDays,
}: {
  day: Date
  entries: DayEntry[]
  isToday: boolean
  caps: ScheduleCapabilities
  returnTo: string
  cleaningReadyByDress: Map<string, Date>
  bufferDays: number
}) {
  const deliveryCount = entries.filter((entry) => entry.kind === 'DELIVERY').length
  const returnCount = entries.length - deliveryCount
  const summaryParts: string[] = []
  if (deliveryCount > 0) summaryParts.push(`${deliveryCount} ${deliveryCount === 1 ? 'delivery' : 'deliveries'}`)
  if (returnCount > 0) summaryParts.push(`${returnCount} ${returnCount === 1 ? 'return' : 'returns'}`)

  return (
    <section
      aria-label={formatWeekdayLong(day)}
      className={cn('overflow-hidden rounded-xl border bg-surface shadow-soft', isToday ? 'border-line-strong' : 'border-line')}
    >
      <header className={cn('flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5', isToday ? 'bg-surface-muted/70' : 'bg-surface')}>
        <span className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-line bg-surface py-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
            {weekdayName(day).slice(0, 3)}
          </span>
          <span className="font-serif text-xl leading-none text-ink">{day.getUTCDate()}</span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-lg leading-snug text-ink">{formatWeekdayLong(day)}</h2>
          <p className="text-xs text-ink-muted">{summaryParts.length > 0 ? summaryParts.join(' · ') : 'Nothing scheduled'}</p>
        </div>
        {isToday ? (
          <Chip tone="mulberry">Today</Chip>
        ) : (
          <span className="text-xs font-bold text-ink-muted">{relativeDayLabel(day)}</span>
        )}
      </header>

      {entries.length === 0 ? (
        <p className="px-4 py-4 text-sm text-ink-muted sm:px-5">Nothing leaves or returns on this day.</p>
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((entry) => (
            <ScheduleEntryRow
              key={`${entry.kind}-${entry.booking.id}`}
              entry={entry}
              caps={caps}
              returnTo={returnTo}
              cleaningReady={cleaningReadyByDress.get(entry.booking.dress.id)}
              bufferDays={bufferDays}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function ScheduleEntryRow({
  entry,
  caps,
  returnTo,
  cleaningReady,
  bufferDays,
}: {
  entry: DayEntry
  caps: ScheduleCapabilities
  returnTo: string
  cleaningReady?: Date
  bufferDays: number
}) {
  const booking = entry.booking
  const meta = BOOKING_STATUS_META[booking.status]
  const isDelivery = entry.kind === 'DELIVERY'
  const Icon = isDelivery ? Truck : PackageOpen

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <span
          data-tone={isDelivery ? 'rose' : 'sage'}
          className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border"
          style={{ background: 'var(--tone-bg)', borderColor: 'var(--tone-line)', color: 'var(--tone-ink)' }}
        >
          <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-ink">{isDelivery ? 'Delivery' : 'Return due'}</p>
            <Chip tone={meta.tone} dot={booking.status === 'LATE'}>
              {meta.label}
            </Chip>
          </div>
          <p className="mt-1 text-sm text-ink">
            {booking.dress.name} <span className="text-ink-muted">· size {booking.size}</span>
          </p>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {booking.customer.name} ·{' '}
            <Link
              href={`/studio/bookings/${booking.id}`}
              className="font-bold text-ink underline-offset-4 hover:underline"
            >
              {booking.id}
            </Link>
          </p>
          {isDelivery ? (
            <>
              {booking.status === 'SHIPPED' && booking.courier ? (
                <p className="mt-1 text-xs text-ink-muted">
                  With {booking.courier}
                  {booking.trackingNumber ? ` · ${booking.trackingNumber}` : ''}
                </p>
              ) : null}
              {cleaningReady ? (
                cleaningReady.getTime() <= booking.deliveryDate.getTime() ? (
                  <p className="mt-1 text-xs text-ink-muted">
                    Back from cleaning {formatDay(cleaningReady)} — ready for this delivery.
                  </p>
                ) : (
                  <p className="mt-1 text-xs font-bold text-danger-ink">
                    Cleaning runs until {formatDay(cleaningReady)} — after this delivery date.
                  </p>
                )
              ) : null}
            </>
          ) : (
            <p className="mt-1 text-xs text-ink-muted">
              Cleaning &amp; inspection until {formatDay(blockedUntil(booking.returnDate, bufferDays))}.
            </p>
          )}
        </div>

        {isDelivery && booking.status === 'SHIPPED' && caps.deliver ? (
          <form action={deliverFromScheduleAction} className="shrink-0 self-center">
            <input type="hidden" name="bookingId" value={booking.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <Button type="submit" size="sm" variant="secondary">
              <PackageCheck className="size-4" strokeWidth={1.75} aria-hidden />
              Mark delivered
            </Button>
          </form>
        ) : null}

        {!isDelivery && caps.return ? (
          <form action={returnFromScheduleAction} className="shrink-0 self-center">
            <input type="hidden" name="bookingId" value={booking.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <Button type="submit" size="sm">
              <PackageOpen className="size-4" strokeWidth={1.75} aria-hidden />
              Mark returned
            </Button>
          </form>
        ) : null}
      </div>

      {isDelivery && booking.status === 'CONFIRMED' && caps.ship ? (
        <ShipInlineForm bookingId={booking.id} returnTo={returnTo} />
      ) : null}
    </li>
  )
}

function ShipInlineForm({ bookingId, returnTo }: { bookingId: string; returnTo: string }) {
  return (
    <details className="mt-3">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 py-2 text-[13px] font-bold text-ink transition-colors select-none hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
        <Truck className="size-3.5" strokeWidth={2} aria-hidden />
        Ship with courier
      </summary>
      <form
        action={shipFromScheduleAction}
        className="mt-3 grid gap-3 rounded-lg border border-line bg-surface-muted/50 p-3 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-end"
      >
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <div>
          <FieldLabel htmlFor={`courier-${bookingId}`}>Courier</FieldLabel>
          <Select id={`courier-${bookingId}`} name="courier" defaultValue="UPS" required>
            <option value="UPS">UPS</option>
            <option value="FedEx">FedEx</option>
            <option value="USPS">USPS</option>
            <option value="DHL Express">DHL Express</option>
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor={`tracking-${bookingId}`}>Tracking number (optional)</FieldLabel>
          <Input id={`tracking-${bookingId}`} name="trackingNumber" placeholder="1Z999AA10123456784" />
        </div>
        <Button type="submit" size="sm">
          <Truck className="size-4" strokeWidth={1.75} aria-hidden />
          Mark as shipped
        </Button>
      </form>
    </details>
  )
}

function CleaningSection({
  records,
  recentlySignedOff,
  caps,
  returnTo,
  today,
  bufferDays,
}: {
  records: CleaningRow[]
  recentlySignedOff: CleaningRow[]
  caps: ScheduleCapabilities
  returnTo: string
  today: Date
  bufferDays: number
}) {
  return (
    <SectionShell
      icon={Sparkles}
      tone="sage"
      title="Cleaning queue"
      description="Every dress is cleaned and inspected between rentals — sign off when it is back on the rack."
      count={records.length}
    >
      {records.length === 0 ? (
        <p className="px-4 py-4 text-sm text-ink-muted sm:px-5">Nothing in cleaning — every dress is ready to go out.</p>
      ) : (
        <ul className="divide-y divide-line">
          {records.map((record) => {
            const ready = readyDayFor(record, bufferDays)
            const daysInCleaning = Math.max(diffDays(record.startedAt, today), 0)
            return (
              <li key={record.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                  <span
                    data-tone="sage"
                    className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border"
                    style={{ background: 'var(--tone-bg)', borderColor: 'var(--tone-line)', color: 'var(--tone-ink)' }}
                  >
                    <Sparkles className="size-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">{record.dress.name}</p>
                    <p className="mt-0.5 text-[13px] text-ink-muted">
                      {record.booking ? (
                        <>
                          {record.booking.customer.name} ·{' '}
                          <Link
                            href={`/studio/bookings/${record.booking.id}`}
                            className="font-bold text-ink underline-offset-4 hover:underline"
                          >
                            {record.booking.id}
                          </Link>
                        </>
                      ) : (
                        'Logged at the studio'
                      )}
                      {' · '}
                      {record.method}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {daysInCleaning === 0 ? 'In cleaning since today' : `In cleaning for ${daysInCleaning} day${daysInCleaning === 1 ? '' : 's'}`}
                      {' · '}expected back {formatDay(ready)} · {relativeDayLabel(ready, today)}
                    </p>
                  </div>
                  {caps.cleaning ? (
                    <form action={completeCleaningAction} className="shrink-0 self-center">
                      <input type="hidden" name="recordId" value={record.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <Button type="submit" size="sm" variant="secondary">
                        <CheckCircle2 className="size-4" strokeWidth={1.75} aria-hidden />
                        Mark cleaning complete
                      </Button>
                    </form>
                  ) : (
                    <p className="shrink-0 self-center text-xs text-ink-muted">Awaiting studio sign-off</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {recentlySignedOff.length > 0 ? (
        <div className="border-t border-line bg-surface-muted/50 px-4 py-3 sm:px-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">Recently signed off</p>
          <ul className="mt-1.5 space-y-1 text-[13px] text-ink-muted">
            {recentlySignedOff.map((record) => (
              <li key={record.id}>
                {record.dress.name}
                {record.booking ? ` after ${record.booking.id}` : ''} — {record.completedAt ? relativeFromNow(record.completedAt) : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SectionShell>
  )
}
