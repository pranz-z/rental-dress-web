import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlarmClock,
  Banknote,
  ClipboardList,
  Clock3,
  Gauge,
  MessagesSquare,
  PackageCheck,
  PackageOpen,
  Shirt,
  Truck,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Card, CardHeader } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { requireStaff } from '@/lib/auth/guards'
import { markLateBookings } from '@/lib/bookings'
import { STUDIO_TIMEZONE, diffDays, formatDay, formatWeekdayLong, relativeDayLabel, relativeFromNow, todayUtc } from '@/lib/dates'
import { prisma } from '@/lib/db'
import {
  BOOKING_STATUS_META,
  INQUIRY_TOPIC_META,
  can,
  type BookingStatus,
  type InquiryTopic,
  type Tone,
} from '@/lib/domain'
import { overviewSnapshot, revenueTrend } from '@/lib/metrics'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/cn'

export const metadata: Metadata = { title: 'Overview' }
export const dynamic = 'force-dynamic'

type BookingRow = {
  id: string
  status: BookingStatus
  size: string
  city: string
  eventDate: Date
  deliveryDate: Date
  returnDate: Date
  total: number
  customer: { name: string }
  dress: { name: string }
}

type InquiryRow = {
  id: string
  subject: string
  topic: InquiryTopic
  guestName: string
  message: string
  status: 'OPEN' | 'RESOLVED'
  firstReplyAt: Date | null
  receivedAt: Date
}

const bookingInclude = {
  customer: { select: { name: true } },
  dress: { select: { name: true } },
} as const

export default async function StudioOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>
}) {
  const { denied } = await searchParams
  const staff = await requireStaff()
  const today = todayUtc()
  const canRevenue = can(staff.role, 'overview.revenue')

  // Keep the ledger true: past-due rentals become Late before we count them.
  await markLateBookings(today)

  const snapshot = await overviewSnapshot(today)

  const [trend, deliveries, returns, latestInquiries, latestBookings] = await Promise.all([
    canRevenue ? revenueTrend(6, today) : Promise.resolve([]),
    prisma.booking.findMany({
      where: { status: { in: ['PENDING', 'CONFIRMED', 'SHIPPED'] }, deliveryDate: { gte: today } },
      orderBy: [{ deliveryDate: 'asc' }, { id: 'asc' }],
      take: 6,
      include: bookingInclude,
    }) as Promise<BookingRow[]>,
    prisma.booking.findMany({
      where: { status: { in: ['SHIPPED', 'WITH_CUSTOMER', 'LATE'] } },
      orderBy: [{ returnDate: 'asc' }, { id: 'asc' }],
      take: 6,
      include: bookingInclude,
    }) as Promise<BookingRow[]>,
    prisma.inquiry.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 4,
      select: {
        id: true,
        subject: true,
        topic: true,
        guestName: true,
        message: true,
        status: true,
        firstReplyAt: true,
        receivedAt: true,
      },
    }) as Promise<InquiryRow[]>,
    prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: bookingInclude,
    }) as Promise<BookingRow[]>,
  ])

  const studioHour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: STUDIO_TIMEZONE }).format(new Date()),
  )
  const greeting = studioHour < 12 ? 'Good morning' : studioHour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = staff.name.split(' ')[0]

  const peakMonth = trend.length > 0 ? Math.max(...trend.map((point) => point.value)) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={`${greeting}, ${firstName} — ${formatWeekdayLong(today)}.`}
      />

      {denied ? (
        <div className="rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink-muted">
          That part of the studio isn’t available to your role. You’re seeing the sections your access covers.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canRevenue ? (
          <StatCard
            label="Net revenue · this month"
            value={formatMoney(snapshot.revenue.current)}
            delta={{
              value: `${Math.abs(snapshot.revenue.delta)}% vs last month`,
              positive: snapshot.revenue.delta >= 0,
            }}
            icon={Banknote}
            tone="gold"
          />
        ) : null}
        <StatCard
          label="Utilization · next 30 days"
          value={`${snapshot.utilization}%`}
          hint="of the wardrobe committed"
          icon={Gauge}
          tone="rose"
        />
        <StatCard
          label="Active rentals"
          value={snapshot.activeRentals}
          hint={`${snapshot.returnsDueThisWeek} due back within a week`}
          icon={PackageCheck}
          tone="mulberry"
        />
        <StatCard
          label="Open inquiries"
          value={snapshot.openInquiries}
          hint={snapshot.unassignedInquiries > 0 ? `${snapshot.unassignedInquiries} unassigned` : 'all assigned'}
          icon={MessagesSquare}
          tone="blush"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat
          icon={Clock3}
          tone="sage"
          label="First reply"
          value={formatReplyTime(snapshot.firstReplyMinutes)}
          hint="target 2 h"
        />
        <MiniStat
          icon={AlarmClock}
          tone={snapshot.lateReturns > 0 ? 'clay' : 'neutral'}
          label="Late returns"
          value={String(snapshot.lateReturns)}
          hint={snapshot.lateReturns === 0 ? 'all on time' : snapshot.lateReturns === 1 ? 'past its date' : 'past their dates'}
        />
        <MiniStat
          icon={Shirt}
          tone="gold"
          label="Off the rack"
          value={String(snapshot.cleaningQueue)}
          hint="rented or cleaning"
        />
        <MiniStat
          icon={PackageOpen}
          tone="blush"
          label="Returns due"
          value={String(snapshot.returnsDueThisWeek)}
          hint="next 7 days"
        />
      </div>

      {canRevenue && trend.some((point) => point.value > 0) ? (
        <Card>
          <CardHeader
            title="Revenue · last six months"
            description="Captured rentals, add-ons, insurance and late fees, refunds netted out."
            action={
              <p className="font-serif text-xl leading-none text-ink">
                {formatMoney(trend.reduce((sum, point) => sum + point.value, 0))}
              </p>
            }
          />
          <div className="px-5 pt-5 pb-4">
            <div className="flex h-28 items-end gap-3" role="img" aria-label="Monthly revenue for the last six months">
              {trend.map((point) => {
                const height = peakMonth === 0 ? 0 : Math.max(Math.round((point.value / peakMonth) * 100), 4)
                const isCurrent = point === trend[trend.length - 1]
                return (
                  <div key={point.key} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
                    <p className="text-[11px] font-bold text-ink-muted opacity-0 transition-opacity group-hover:opacity-100">
                      {formatMoney(point.value)}
                    </p>
                    <div
                      className={cn('w-full rounded-t-[6px]', isCurrent ? 'bg-accent' : 'bg-rose/70')}
                      style={{ height: `${height}%` }}
                      title={`${point.label}: ${formatMoney(point.value)}`}
                    />
                    <p className={cn('text-[11px] font-bold uppercase tracking-wide', isCurrent ? 'text-ink' : 'text-ink-muted')}>
                      {point.label}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader
            title="Next deliveries"
            description="Bookings leaving the studio for a customer."
            action={<Truck className="size-4.5 text-ink-muted" strokeWidth={1.75} aria-hidden />}
          />
          {deliveries.length === 0 ? (
            <EmptyState icon={Truck} title="Nothing shipping soon" description="New deliveries appear here as bookings are confirmed." />
          ) : (
            <ul className="divide-y divide-line">
              {deliveries.map((booking) => (
                <li key={booking.id}>
                  <Link
                    href={`/studio/bookings/${booking.id}`}
                    className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-surface-muted/60"
                  >
                    <DayChip day={booking.deliveryDate} today={today} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{booking.customer.name}</p>
                      <p className="truncate text-[13px] text-ink-muted">
                        {booking.dress.name} · size {booking.size} · {booking.city}
                      </p>
                    </div>
                    <Chip tone={BOOKING_STATUS_META[booking.status].tone}>{BOOKING_STATUS_META[booking.status].label}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Next returns"
            description="Dresses on their way back — overdue first."
            action={<PackageOpen className="size-4.5 text-ink-muted" strokeWidth={1.75} aria-hidden />}
          />
          {returns.length === 0 ? (
            <EmptyState icon={PackageOpen} title="No returns scheduled" description="Returns appear here once a dress is on its way to a customer." />
          ) : (
            <ul className="divide-y divide-line">
              {returns.map((booking) => (
                <li key={booking.id}>
                  <Link
                    href={`/studio/bookings/${booking.id}`}
                    className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-surface-muted/60"
                  >
                    <DayChip day={booking.returnDate} today={today} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{booking.customer.name}</p>
                      <p className="truncate text-[13px] text-ink-muted">
                        {booking.dress.name} · size {booking.size} · event {formatDay(booking.eventDate)}
                      </p>
                    </div>
                    <Chip tone={BOOKING_STATUS_META[booking.status].tone}>{BOOKING_STATUS_META[booking.status].label}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader
            title="Latest conversations"
            description="Newest first — gold dot marks a question still waiting on a reply."
            action={
              <Link href="/studio/inquiries" className="text-[13px] font-bold text-ink-muted transition-colors hover:text-ink">
                Open inbox →
              </Link>
            }
          />
          {latestInquiries.length === 0 ? (
            <EmptyState icon={MessagesSquare} title="Inbox is quiet" description="Customer questions from the storefront and email land here." />
          ) : (
            <ul className="divide-y divide-line">
              {latestInquiries.map((inquiry) => {
                const awaitingReply = inquiry.status === 'OPEN' && inquiry.firstReplyAt === null
                return (
                  <li key={inquiry.id}>
                    <Link
                      href={`/studio/inquiries/${inquiry.id}`}
                      className="flex gap-3.5 px-5 py-4 transition-colors hover:bg-surface-muted/60"
                    >
                      <span className="mt-1.5 flex size-4 shrink-0 items-center justify-center">
                        {awaitingReply ? (
                          <span
                            className="size-2 rounded-full bg-gold shadow-[0_0_0_3px_var(--surface)]"
                            title="Awaiting a first reply"
                          />
                        ) : (
                          <span className="size-1.5 rounded-full bg-line-strong" aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-ink">{inquiry.subject}</p>
                          <Chip tone={INQUIRY_TOPIC_META[inquiry.topic].tone}>{INQUIRY_TOPIC_META[inquiry.topic].label}</Chip>
                        </div>
                        <p className="mt-0.5 text-[13px] text-ink-muted">
                          {inquiry.guestName} · {relativeFromNow(inquiry.receivedAt)}
                        </p>
                        <p className="mt-1 line-clamp-1 text-[13px] text-ink-muted/85">{inquiry.message}</p>
                      </div>
                      <Chip tone={inquiry.status === 'OPEN' ? 'blush' : 'sage'} className="self-start">
                        {inquiry.status === 'OPEN' ? 'Open' : 'Resolved'}
                      </Chip>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Latest bookings"
            description="Reservations as they came in."
            action={
              <Link href="/studio/bookings" className="text-[13px] font-bold text-ink-muted transition-colors hover:text-ink">
                All bookings →
              </Link>
            }
          />
          {latestBookings.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No bookings yet" description="Reservations from the storefront and the studio appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {latestBookings.map((booking) => (
                <li key={booking.id}>
                  <Link
                    href={`/studio/bookings/${booking.id}`}
                    className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-surface-muted/60"
                  >
                    <Avatar name={booking.customer.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{booking.customer.name}</p>
                      <p className="truncate text-[13px] text-ink-muted">
                        {booking.id} · {booking.dress.name} · size {booking.size}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Chip tone={BOOKING_STATUS_META[booking.status].tone}>{BOOKING_STATUS_META[booking.status].label}</Chip>
                      <p className="text-xs text-ink-muted">
                        {formatDay(booking.eventDate)}
                        {canRevenue ? <> · {formatMoney(booking.total)}</> : null}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Clock3
  label: string
  value: string
  hint: string
  tone: Tone
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-line bg-surface px-4 py-4 shadow-soft">
      <span
        data-tone={tone}
        className="grid size-9 shrink-0 place-items-center rounded-full border"
        style={{ background: 'var(--tone-bg)', borderColor: 'var(--tone-line)', color: 'var(--tone-ink)' }}
      >
        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
        <p className="mt-0.5 flex items-baseline gap-2">
          <span className="font-serif text-[22px] leading-none text-ink">{value}</span>
          <span className="truncate text-[13px] text-ink-muted">{hint}</span>
        </p>
      </div>
    </div>
  )
}

function DayChip({ day, today }: { day: Date; today: Date }) {
  const delta = diffDays(today, day)
  const tone: Tone = delta < 0 ? 'clay' : delta === 0 ? 'gold' : 'neutral'
  return (
    <span className="w-[92px] shrink-0">
      <Chip tone={tone} dot={delta === 0 || delta < 0}>
        {relativeDayLabel(day, today)}
      </Chip>
    </span>
  )
}

function formatReplyTime(minutes: number | null): string {
  if (minutes === null) return '—'
  if (minutes < 60) return `${Math.round(minutes)} min`
  return `${(minutes / 60).toFixed(1)} h`
}
