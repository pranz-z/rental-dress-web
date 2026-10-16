import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardList, Search, SearchX } from 'lucide-react'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/table'
import { requireCapability } from '@/lib/auth/guards'
import { markLateBookings } from '@/lib/bookings'
import { formatDay, todayUtc } from '@/lib/dates'
import { prisma } from '@/lib/db'
import { BOOKING_STATUS_META, can, type BookingStatus } from '@/lib/domain'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/cn'

export const metadata: Metadata = { title: 'Bookings' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

/** The six chips the studio filters by, in spec order. */
const FILTER_STATUSES: BookingStatus[] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'WITH_CUSTOMER', 'LATE', 'RETURNED']

function parseStatuses(raw: string | undefined): BookingStatus[] {
  if (!raw) return []
  const wanted = new Set(raw.split(','))
  return FILTER_STATUSES.filter((status) => wanted.has(status))
}

function bookingsHref(params: { q?: string; statuses?: BookingStatus[]; page?: number }): string {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.statuses && params.statuses.length > 0) search.set('status', params.statuses.join(','))
  if (params.page && params.page > 1) search.set('page', String(params.page))
  const query = search.toString()
  return query ? `/studio/bookings?${query}` : '/studio/bookings'
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const staff = await requireCapability('bookings.view')
  const showTotals = can(staff.role, 'bookings.payments')
  const params = await searchParams
  const q = (params.q ?? '').trim()
  const statuses = parseStatuses(params.status)
  const requestedPage = Math.max(Number(params.page ?? '1') || 1, 1)

  // Rule: past-due bookings become Late the moment the studio looks at them.
  await markLateBookings(todayUtc())

  const searchFilter = q
    ? {
        OR: [
          { id: { contains: q, mode: 'insensitive' as const } },
          { customer: { name: { contains: q, mode: 'insensitive' as const } } },
          { dress: { name: { contains: q, mode: 'insensitive' as const } } },
        ],
      }
    : {}

  const where = {
    ...searchFilter,
    ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
  }

  const [statusCounts, totalMatching, totalAll] = await Promise.all([
    prisma.booking.groupBy({ by: ['status'], where: searchFilter, _count: { _all: true } }),
    prisma.booking.count({ where }),
    prisma.booking.count(),
  ])

  const pageCount = Math.max(Math.ceil(totalMatching / PAGE_SIZE), 1)
  const page = Math.min(requestedPage, pageCount)
  const bookings = await prisma.booking.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      customer: { select: { name: true, tier: true } },
      dress: { select: { name: true, designer: true } },
    },
  })

  const countsByStatus = new Map(statusCounts.map((row) => [row.status, row._count._all]))
  const showingFrom = totalMatching === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(page * PAGE_SIZE, totalMatching)
  const filtersActive = q.length > 0 || statuses.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description={`${totalAll} reservations in the ledger — search by booking ID, customer or dress.`}
      />

      <div className="space-y-3.5">
        <form action="/studio/bookings" method="get" className="flex max-w-md items-center gap-2">
          {statuses.length > 0 ? <input type="hidden" name="status" value={statuses.join(',')} /> : null}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.75} aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="MR-2841, Camille Dubois, Valentina…"
              aria-label="Search bookings"
              className="h-11 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
            />
          </div>
          <button
            type="submit"
            className="h-11 rounded-full bg-accent px-5 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={bookingsHref({ q })}
            className={cn(
              'chip transition-shadow',
              statuses.length === 0 ? 'ring-2 ring-accent/45 ring-offset-2 ring-offset-page' : 'hover:ring-2 hover:ring-accent/20',
            )}
          >
            All · {totalAll}
          </Link>
          {FILTER_STATUSES.map((status) => {
            const active = statuses.includes(status)
            const nextStatuses = active ? statuses.filter((s) => s !== status) : [...statuses, status]
            const meta = BOOKING_STATUS_META[status]
            return (
              <Link
                key={status}
                href={bookingsHref({ q, statuses: nextStatuses })}
                data-tone={meta.tone}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'chip transition-shadow',
                  active ? 'ring-2 ring-accent/45 ring-offset-2 ring-offset-page' : 'hover:ring-2 hover:ring-accent/20',
                )}
              >
                {meta.label} · {countsByStatus.get(status) ?? 0}
              </Link>
            )
          })}
          {filtersActive ? (
            <Link href="/studio/bookings" className="ml-1 text-[13px] font-bold text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline">
              Clear
            </Link>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
        {bookings.length === 0 ? (
          <EmptyState
            icon={filtersActive ? SearchX : ClipboardList}
            title={filtersActive ? 'No bookings match' : 'No bookings yet'}
            description={
              filtersActive
                ? 'Try a different name or booking ID, or clear the status filters.'
                : 'Reservations from the storefront and the studio will appear here.'
            }
            action={
              filtersActive ? (
                <Link href="/studio/bookings" className="text-sm font-bold text-accent underline-offset-4 hover:underline">
                  Clear filters
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Booking</Th>
                    <Th>Customer</Th>
                    <Th>Dress · size</Th>
                    <Th>Event</Th>
                    <Th>Event date</Th>
                    <Th>Return date</Th>
                    <Th>Status</Th>
                    {showTotals ? <Th className="text-right">Total</Th> : null}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => {
                    const meta = BOOKING_STATUS_META[booking.status]
                    return (
                      <Tr key={booking.id} className="relative">
                        <Td>
                          <Link
                            href={`/studio/bookings/${booking.id}`}
                            className="font-bold text-ink after:absolute after:inset-0 after:content-['']"
                          >
                            {booking.id}
                          </Link>
                          <p className="mt-0.5 text-xs text-ink-muted">Booked {formatDay(booking.createdAt)}</p>
                        </Td>
                        <Td>
                          <p className="font-bold text-ink">{booking.customer.name}</p>
                          <p className="mt-0.5 text-xs text-ink-muted">{booking.city}</p>
                        </Td>
                        <Td>
                          <p className="text-ink">{booking.dress.name}</p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            Size {booking.size}
                            {booking.backupSize ? ` · backup ${booking.backupSize}` : ''}
                          </p>
                        </Td>
                        <Td className="text-ink-muted">{booking.eventType}</Td>
                        <Td>
                          <p className="text-ink">{formatDay(booking.eventDate)}</p>
                          <p className="mt-0.5 text-xs text-ink-muted">{booking.rentalDays}-day rental</p>
                        </Td>
                        <Td className="text-ink">{formatDay(booking.returnDate)}</Td>
                        <Td>
                          <Chip tone={meta.tone} dot={booking.status === 'LATE'}>
                            {meta.label}
                          </Chip>
                        </Td>
                        {showTotals ? (
                          <Td className="text-right font-bold tabular-nums text-ink">{formatMoney(booking.total)}</Td>
                        ) : null}
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableWrap>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3.5">
              <p className="text-[13px] text-ink-muted">
                Showing {showingFrom}–{showingTo} of {totalMatching}
                {statuses.length > 0 || q ? ` matching` : ''} bookings
              </p>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={bookingsHref({ q, statuses, page: page - 1 })}
                    className="inline-flex h-9 items-center rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-bold text-ink transition-colors hover:bg-surface-muted"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="inline-flex h-9 items-center rounded-full border border-line px-3.5 text-[13px] font-bold text-ink-muted">
                    Previous
                  </span>
                )}
                <p className="px-1 text-[13px] text-ink-muted">
                  Page {page} of {pageCount}
                </p>
                {page < pageCount ? (
                  <Link
                    href={bookingsHref({ q, statuses, page: page + 1 })}
                    className="inline-flex h-9 items-center rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-bold text-ink transition-colors hover:bg-surface-muted"
                  >
                    Next
                  </Link>
                ) : (
                  <span className="inline-flex h-9 items-center rounded-full border border-line px-3.5 text-[13px] font-bold text-ink-muted">
                    Next
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
