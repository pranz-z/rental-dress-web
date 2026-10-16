import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { PrintButton } from './print-button'
import { requireCapability } from '@/lib/auth/guards'
import { markLateBookings } from '@/lib/bookings'
import { addDays, dayUtc, diffDays, formatDateTime, formatDay, formatWeekdayLong, isoDay, todayUtc } from '@/lib/dates'
import { prisma } from '@/lib/db'

export const metadata: Metadata = { title: 'Run sheet' }
export const dynamic = 'force-dynamic'

/** `?date=YYYY-MM-DD`, falling back to today's studio date. */
function parseDay(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, dayOfMonth] = value.split('-').map(Number)
  const day = dayUtc(year, month - 1, dayOfMonth)
  if (day.getUTCFullYear() !== year || day.getUTCMonth() !== month - 1 || day.getUTCDate() !== dayOfMonth) return null
  return day
}

const runSheetHref = (day: Date) => `/studio/schedule/run-sheet?date=${isoDay(day)}`

const bookingInclude = {
  customer: { select: { name: true, phone: true, email: true } },
  dress: { select: { name: true } },
} as const

export default async function RunSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date } = await searchParams
  await requireCapability('schedule.view')

  const today = todayUtc()
  const day = parseDay(date) ?? today

  await markLateBookings(today)

  const [deliveries, returns, overdue, settings] = await Promise.all([
    prisma.booking.findMany({
      where: { deliveryDate: day, status: { in: ['CONFIRMED', 'SHIPPED'] } },
      orderBy: { id: 'asc' },
      include: bookingInclude,
    }),
    prisma.booking.findMany({
      where: { returnDate: day, status: { in: ['SHIPPED', 'WITH_CUSTOMER', 'LATE'] } },
      orderBy: { id: 'asc' },
      include: bookingInclude,
    }),
    prisma.booking.findMany({
      where: { status: 'LATE' },
      orderBy: { returnDate: 'asc' },
      include: bookingInclude,
    }),
    prisma.studioSettings.findUnique({ where: { id: 'studio' } }),
  ])

  const nothingOnToday = deliveries.length === 0 && returns.length === 0 && overdue.length === 0

  return (
    <div className="space-y-6">
      <div data-print-hide className="space-y-5">
        <Link
          href="/studio/schedule"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
          Back to the schedule
        </Link>
        <PageHeader
          title="Daily run sheet"
          description={`Everything the courier needs for ${formatWeekdayLong(day)} — print it or keep it open on the dispatch desk.`}
        >
          <div className="flex items-center gap-2">
            <ButtonLink href={runSheetHref(addDays(day, -1))} variant="secondary" size="sm" aria-label="Previous day">
              <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
            </ButtonLink>
            <ButtonLink href={runSheetHref(today)} variant="secondary" size="sm">
              Today
            </ButtonLink>
            <ButtonLink href={runSheetHref(addDays(day, 1))} variant="secondary" size="sm" aria-label="Next day">
              <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
            </ButtonLink>
            <PrintButton />
          </div>
        </PageHeader>
      </div>

      <article className="print-sheet mx-auto w-full max-w-[760px] rounded-xl border border-line bg-surface p-6 shadow-soft sm:p-9">
        <header className="border-b-2 border-line-strong pb-5 text-center">
          <p className="font-serif text-[26px] leading-none tracking-tight text-ink">Maison Rêve</p>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.24em] text-gold-ink">Daily run sheet</p>
          <p className="mt-4 font-serif text-xl text-ink">{formatWeekdayLong(day)}</p>
          <p className="mt-1.5 text-xs text-ink-muted">
            {settings ? `${settings.studioAddress} · ${settings.studioPhone}` : 'Maison Rêve studio'}
          </p>
        </header>

        {nothingOnToday ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            No deliveries, returns or pickups for this day. The wardrobe stays home.
          </p>
        ) : (
          <div className="space-y-8 pt-6">
            <RunSheetSection
              title={`Deliveries out · ${deliveries.length}`}
              empty="No deliveries leaving the studio."
              count={deliveries.length}
            >
              {deliveries.map((booking) => (
                <RunSheetItem key={booking.id} booking={booking}>
                  <address className="mt-2 text-sm not-italic leading-relaxed text-ink">
                    {booking.shipName}
                    <br />
                    {booking.addressLine1}
                    {booking.addressLine2 ? (
                      <>
                        <br />
                        {booking.addressLine2}
                      </>
                    ) : null}
                    <br />
                    {booking.city}, {booking.region} {booking.postalCode}
                    <br />
                    {booking.country}
                  </address>
                  <p className="mt-2 text-[13px] text-ink-muted">
                    Contact{' '}
                    {booking.customer.phone ? (
                      <a href={`tel:${booking.customer.phone}`} className="text-ink underline-offset-4 hover:underline">
                        {booking.customer.phone}
                      </a>
                    ) : (
                      'via the studio'
                    )}
                  </p>
                  {booking.status === 'SHIPPED' && booking.courier ? (
                    <p className="mt-1 text-xs font-bold text-ink-muted">
                      Already handed to {booking.courier}
                      {booking.trackingNumber ? ` · ${booking.trackingNumber}` : ''}
                    </p>
                  ) : null}
                </RunSheetItem>
              ))}
            </RunSheetSection>

            <RunSheetSection
              title={`Returns to collect · ${returns.length}`}
              empty="Nothing coming back on this day."
              count={returns.length}
            >
              {returns.map((booking) => (
                <RunSheetItem key={booking.id} booking={booking}>
                  <p className="mt-2 text-sm text-ink">
                    Collect with the garment bag and hangers. Inspect with the customer if anything looks marked.
                  </p>
                  <p className="mt-2 text-[13px] text-ink-muted">
                    Contact{' '}
                    {booking.customer.phone ? (
                      <a href={`tel:${booking.customer.phone}`} className="text-ink underline-offset-4 hover:underline">
                        {booking.customer.phone}
                      </a>
                    ) : (
                      'via the studio'
                    )}
                  </p>
                </RunSheetItem>
              ))}
            </RunSheetSection>

            {overdue.length > 0 ? (
              <RunSheetSection
                title={`Overdue pickups · ${overdue.length}`}
                empty=""
                count={overdue.length}
              >
                {overdue.map((booking) => {
                  const daysLate = Math.max(diffDays(booking.returnDate, today), 0)
                  return (
                    <RunSheetItem key={booking.id} booking={booking}>
                      <p className="mt-2 text-sm font-bold text-danger-ink">
                        {daysLate} day{daysLate === 1 ? '' : 's'} overdue — was due back {formatDay(booking.returnDate)}
                      </p>
                      <p className="mt-2 text-[13px] text-ink-muted">
                        Contact{' '}
                        {booking.customer.phone ? (
                          <a href={`tel:${booking.customer.phone}`} className="text-ink underline-offset-4 hover:underline">
                            {booking.customer.phone}
                          </a>
                        ) : (
                          'via the studio'
                        )}
                      </p>
                    </RunSheetItem>
                  )
                })}
              </RunSheetSection>
            ) : null}
          </div>
        )}

        <footer className="mt-8 border-t border-line pt-4 text-center text-xs text-ink-muted">
          Prepared {formatDateTime(new Date())}
          {settings ? ` · ${settings.studioEmail}` : ''} · Maison Rêve studio
        </footer>
      </article>
    </div>
  )
}

type RunSheetBooking = {
  id: string
  size: string
  shipName: string
  addressLine1: string
  addressLine2: string | null
  city: string
  region: string
  postalCode: string
  country: string
  status: string
  courier: string | null
  trackingNumber: string | null
  customer: { name: string; phone: string | null; email: string }
  dress: { name: string }
}

function RunSheetSection({
  title,
  empty,
  count,
  children,
}: {
  title: string
  empty: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="print-keep">
      <h2 className="border-b border-line pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">
        {title}
      </h2>
      {count === 0 ? (
        <p className="pt-3 text-sm text-ink-muted">{empty}</p>
      ) : (
        <ol className="space-y-4 pt-3">{children}</ol>
      )}
    </section>
  )
}

/** One pickup/drop-off card with a print-only tick box for the courier. */
function RunSheetItem({ booking, children }: { booking: RunSheetBooking; children: React.ReactNode }) {
  return (
    <li className="print-keep rounded-lg border border-line p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1 size-4 shrink-0 rounded-[4px] border border-line-strong" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="font-bold text-ink">{booking.customer.name}</p>
            <p className="text-xs font-bold tracking-wide text-ink-muted">
              {booking.id} · size {booking.size}
            </p>
          </div>
          <p className="mt-0.5 text-sm text-ink">{booking.dress.name}</p>
          {children}
        </div>
      </div>
    </li>
  )
}
