import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRightLeft,
  BadgeCheck,
  CalendarPlus,
  CreditCard,
  MapPin,
  PackageCheck,
  Sparkles,
  StickyNote,
  Ticket,
  Undo2,
  User,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { PageHeader } from '@/components/ui/page-header'
import { BookingActions } from '@/components/studio/bookings/booking-actions'
import { requireCapability } from '@/lib/auth/guards'
import { BOOKING_DONE_MESSAGES, markLateBookings } from '@/lib/bookings'
import { formatDateTime, formatDay, formatDayLong, formatWeekdayLong, todayUtc } from '@/lib/dates'
import { prisma } from '@/lib/db'
import {
  BOOKING_STATUS_META,
  DEPOSIT_STATUS_LABEL,
  PAYMENT_KIND_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  TIER_META,
  can,
  type Tone,
} from '@/lib/domain'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/cn'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  return { title: `Booking ${id}` }
}

const PAYMENT_TONE: Record<string, Tone> = {
  UNPAID: 'neutral',
  AUTHORIZED: 'gold',
  PAID: 'sage',
  REFUNDED: 'rose',
  FAILED: 'clay',
}

const DEPOSIT_TONE: Record<string, Tone> = {
  NONE: 'neutral',
  HELD: 'gold',
  REFUNDED: 'sage',
  FORFEITED: 'clay',
}

const EVENT_ICON = {
  CREATED: Sparkles,
  STATUS_CHANGE: ArrowRightLeft,
  NOTE: StickyNote,
  EXTENSION: CalendarPlus,
  PAYMENT: CreditCard,
  REFUND: Undo2,
  CLEANING: Sparkles,
  TICKET: Ticket,
} as const

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ done?: string; error?: string }>
}) {
  const { id } = await params
  const { done, error } = await searchParams
  const staff = await requireCapability('bookings.view')

  await markLateBookings(todayUtc())

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      customer: true,
      dress: { select: { name: true, designer: true, category: true, slug: true } },
      addOns: { orderBy: { label: 'asc' } },
      payments: { orderBy: { createdAt: 'desc' } },
      cleaningRecords: { orderBy: { startedAt: 'desc' }, take: 3 },
      events: {
        orderBy: { occurredAt: 'desc' },
        include: { staff: { select: { name: true } } },
      },
    },
  })

  if (!booking) notFound()

  const statusMeta = BOOKING_STATUS_META[booking.status]
  const doneMessage = done ? (BOOKING_DONE_MESSAGES[done] ?? null) : null
  const caps = {
    confirm: can(staff.role, 'bookings.confirm'),
    ship: can(staff.role, 'bookings.ship'),
    deliver: can(staff.role, 'bookings.deliver'),
    return: can(staff.role, 'bookings.return'),
    extend: can(staff.role, 'bookings.extend'),
    cancel: can(staff.role, 'bookings.cancel'),
    note: can(staff.role, 'bookings.note'),
    payments: can(staff.role, 'bookings.payments'),
  }
  const isPriced = booking.subtotal + booking.addOnTotal + booking.insuranceFee + booking.lateFee
  const timelineEvents = caps.payments
    ? booking.events
    : booking.events.filter((event) => event.type !== 'PAYMENT' && event.type !== 'REFUND')

  return (
    <div className="space-y-6">
      <Link
        href="/studio/bookings"
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
        All bookings
      </Link>

      <PageHeader
        title={booking.id}
        description={
          <>
            {booking.customer.name} · {booking.dress.name} · size {booking.size}
            {booking.backupSize ? ` (backup ${booking.backupSize})` : ''} · {formatWeekdayLong(booking.eventDate)}
          </>
        }
      >
        <Chip tone={statusMeta.tone} dot={booking.status === 'LATE'}>
          {statusMeta.label}
        </Chip>
      </PageHeader>

      {error ? (
        <div role="alert" className="rounded-xl border border-danger-line bg-surface px-4 py-3 text-sm font-bold text-danger-ink">
          {error}
        </div>
      ) : null}
      {doneMessage ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink">
          <span className="font-bold">{booking.id}</span> {doneMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Reservation"
              description={statusMeta.description}
              action={
                <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted">
                  <PackageCheck className="size-4" strokeWidth={1.75} aria-hidden />
                  {booking.dress.category}
                </span>
              }
            />
            <dl className="grid gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2">
              <DetailItem label="Dress">
                <p className="font-bold text-ink">{booking.dress.name}</p>
                <p className="text-[13px] text-ink-muted">{booking.dress.designer}</p>
              </DetailItem>
              <DetailItem label="Rental window">
                <p className="text-ink">
                  {formatDay(booking.deliveryDate)} → {formatDay(booking.returnDate)}
                </p>
                <p className="text-[13px] text-ink-muted">
                  {booking.rentalDays}-day rental · {booking.bufferDays}-day cleaning buffer
                </p>
              </DetailItem>
              <DetailItem label="Event">
                <p className="text-ink">{booking.eventType}</p>
                <p className="text-[13px] text-ink-muted">{formatDayLong(booking.eventDate)}</p>
              </DetailItem>
              <DetailItem label="Courier">
                {booking.courier ? (
                  <>
                    <p className="text-ink">{booking.courier}</p>
                    <p className="text-[13px] text-ink-muted">{booking.trackingNumber ?? 'No tracking number on file'}</p>
                  </>
                ) : (
                  <p className="text-ink-muted">Not shipped yet</p>
                )}
              </DetailItem>
              {booking.notes ? (
                <DetailItem label="Note from the customer" className="sm:col-span-2">
                  <p className="text-ink">{booking.notes}</p>
                </DetailItem>
              ) : null}
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Actions"
              description="Every action is checked against availability and lands in the audit trail."
            />
            <BookingActions bookingId={booking.id} status={booking.status} caps={caps} />
          </Card>

          <Card>
            <CardHeader
              title="Timeline"
              description={
                caps.payments
                  ? 'Status changes, payments, extensions and notes — newest first.'
                  : 'Status changes, cleaning and notes — newest first.'
              }
            />
            <ol className="px-5 py-2">
              {timelineEvents.map((event) => {
                const Icon = EVENT_ICON[event.type] ?? ArrowRightLeft
                return (
                  <li key={event.id} className="relative flex gap-4 border-b border-line py-4 last:border-b-0">
                    <span
                      data-tone={
                        event.type === 'PAYMENT' || event.type === 'REFUND'
                          ? 'gold'
                          : event.type === 'EXTENSION'
                            ? 'rose'
                            : event.type === 'NOTE'
                              ? 'neutral'
                              : 'blush'
                      }
                      className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border"
                      style={{ background: 'var(--tone-bg)', borderColor: 'var(--tone-line)', color: 'var(--tone-ink)' }}
                    >
                      <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <p className="text-sm font-bold text-ink">{eventText(event.summary, caps.payments)}</p>
                        {event.fromValue && event.toValue ? (
                          <p className="text-xs text-ink-muted">
                            {BOOKING_STATUS_META[event.fromValue as keyof typeof BOOKING_STATUS_META]?.label ?? event.fromValue}
                            {' → '}
                            {BOOKING_STATUS_META[event.toValue as keyof typeof BOOKING_STATUS_META]?.label ?? event.toValue}
                          </p>
                        ) : null}
                      </div>
                      {event.detail ? (
                        <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-ink-muted">
                          {eventText(event.detail, caps.payments)}
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-xs text-ink-muted">
                        {event.staff?.name ?? 'Studio automation'} · {formatDateTime(event.occurredAt)}
                        {event.visibleToCustomer ? ' · shared with customer' : event.type === 'NOTE' ? ' · internal' : ''}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Customer" />
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={booking.customer.name} size="lg" />
                <div className="min-w-0">
                  <p className="font-bold text-ink">{booking.customer.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Chip tone={TIER_META[booking.customer.tier].tone}>{TIER_META[booking.customer.tier].label}</Chip>
                    <span className="text-xs text-ink-muted">Member since {formatDayLong(booking.customer.memberSince)}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2.5 text-sm">
                <ContactRow icon={User} label="Email">
                  <a href={`mailto:${booking.customer.email}`} className="break-all text-ink underline-offset-4 hover:underline">
                    {booking.customer.email}
                  </a>
                </ContactRow>
                {booking.customer.phone ? (
                  <ContactRow icon={User} label="Phone">
                    <a href={`tel:${booking.customer.phone}`} className="text-ink underline-offset-4 hover:underline">
                      {booking.customer.phone}
                    </a>
                  </ContactRow>
                ) : null}
              </div>
              <p className="border-t border-line pt-3 text-[13px] text-ink-muted">
                {booking.customer.rentalsCount} rental{booking.customer.rentalsCount === 1 ? '' : 's'}
                {caps.payments ? <> · {formatMoney(booking.customer.lifetimeSpend)} lifetime</> : null}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Delivery address" />
            <CardBody>
              <div className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden />
                <address className="text-sm not-italic leading-relaxed text-ink">
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
              </div>
            </CardBody>
          </Card>

          {caps.payments ? (
            <Card>
              <CardHeader title="Payment" />
              <CardBody className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Chip tone={PAYMENT_TONE[booking.paymentStatus]}>
                    Payment: {PAYMENT_STATUS_LABEL[booking.paymentStatus]}
                  </Chip>
                  <Chip tone={DEPOSIT_TONE[booking.depositStatus]}>{DEPOSIT_STATUS_LABEL[booking.depositStatus]}</Chip>
                </div>
                <dl className="space-y-2 text-sm">
                  <MoneyRow label="Rental" value={booking.subtotal} />
                  <MoneyRow label="Add-ons" value={booking.addOnTotal} />
                  <MoneyRow label="Insurance" value={booking.insuranceFee} />
                  {booking.lateFee > 0 ? <MoneyRow label="Late fee" value={booking.lateFee} tone="clay" /> : null}
                  <div className="flex items-center justify-between border-t border-line pt-2.5">
                    <dt className="font-bold text-ink">Total</dt>
                    <dd className="font-serif text-xl text-ink">{formatMoney(booking.total)}</dd>
                  </div>
                  {booking.deposit > 0 ? (
                    <div className="flex items-center justify-between text-[13px] text-ink-muted">
                      <dt>Damage deposit</dt>
                      <dd>{formatMoney(booking.deposit)}</dd>
                    </div>
                  ) : null}
                </dl>
                {isPriced === 0 ? <p className="text-[13px] text-ink-muted">No charges on this booking yet.</p> : null}

                {booking.addOns.length > 0 ? (
                  <div className="border-t border-line pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">Add-ons</p>
                    <ul className="mt-2 space-y-1.5 text-[13px]">
                      {booking.addOns.map((addOn) => (
                        <li key={addOn.id} className="flex items-center justify-between gap-3">
                          <span className="text-ink">
                            {addOn.label}
                            {addOn.quantity > 1 ? ` × ${addOn.quantity}` : ''}
                          </span>
                          <span className="tabular-nums text-ink-muted">{formatMoney(addOn.amount * addOn.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {booking.payments.length > 0 ? (
                  <div className="border-t border-line pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">Ledger</p>
                    <ul className="mt-2 space-y-2">
                      {booking.payments.map((payment) => (
                        <li key={payment.id} className="flex items-start justify-between gap-3 text-[13px]">
                          <div className="min-w-0">
                            <p className="text-ink">
                              {PAYMENT_KIND_LABEL[payment.kind] ?? payment.kind}
                              <span className="text-ink-muted"> · {PAYMENT_STATUS_LABEL[payment.status]}</span>
                            </p>
                            <p className="text-xs text-ink-muted">
                              {formatDay(payment.capturedAt ?? payment.refundedAt ?? payment.createdAt)}
                              {payment.method ? ` · ${PAYMENT_METHOD_LABEL[payment.method] ?? payment.method}` : ''}
                              {payment.cardLast4 ? ` ···· ${payment.cardLast4}` : ''}
                            </p>
                            {payment.note ? <p className="mt-0.5 text-xs text-ink-muted/85">{payment.note}</p> : null}
                          </div>
                          <span
                            className={cn(
                              'shrink-0 tabular-nums',
                              payment.amount < 0 ? 'text-danger-ink' : 'text-ink',
                            )}
                          >
                            {formatMoney(payment.amount, { signed: payment.amount > 0 })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {booking.cleaningRecords.length > 0 ? (
            <Card>
              <CardHeader title="Cleaning &amp; inspection" />
              <CardBody>
                <ul className="space-y-2 text-[13px]">
                  {booking.cleaningRecords.map((record) => (
                    <li key={record.id}>
                      <p className="text-ink">
                        {record.completedAt ? 'Completed' : 'In progress'} · started {formatDay(record.startedAt)}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {record.method}
                        {record.note ? ` — ${record.note}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Access" />
            <CardBody className="space-y-2 text-[13px] text-ink-muted">
              <div className="flex items-center gap-2">
                <BadgeCheck className="size-4 text-ink-muted" strokeWidth={1.75} aria-hidden />
                Signed in as <span className="font-bold text-ink">{staff.name}</span>
                {' — '}
                {staff.title}
              </div>
              <p>
                {caps.confirm || caps.ship || caps.extend || caps.cancel
                  ? 'You can move this booking through its lifecycle.'
                  : 'Your role can review this booking; lifecycle changes need a studio manager.'}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

function DetailItem({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  )
}

function MoneyRow({ label, value, tone }: { label: string; value: number; tone?: Tone }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={cn('text-ink-muted', tone === 'clay' ? 'text-[var(--tone-ink)]' : '')} data-tone={tone}>
        {label}
      </dt>
      <dd className="tabular-nums text-ink">{formatMoney(value)}</dd>
    </div>
  )
}

function ContactRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden />
      <span className="w-12 shrink-0 text-xs text-ink-muted">{label}</span>
      <span className="min-w-0 flex-1 text-[13px]">{children}</span>
    </div>
  )
}

/** Amounts stay out of the timeline for roles without payment access. */
function eventText(text: string, allowAmounts: boolean): string {
  return allowAmounts ? text : text.replace(/\$[\d,]+(?:\.\d{2})?/g, '•••')
}
