import type { Metadata } from 'next'
import { type ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mail, MapPin, MessagesSquare, Phone, StickyNote } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card'
import { Chip, ToneMark } from '@/components/ui/chip'
import { Textarea } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { addCustomerNoteAction } from '../actions'
import { requireCapability } from '@/lib/auth/guards'
import { CUSTOMERS_DONE_MESSAGES } from '@/lib/customers'
import { formatDay, formatDayLong, formatDateTime, formatMonthYear } from '@/lib/dates'
import { prisma } from '@/lib/db'
import { BOOKING_STATUS_META, INQUIRY_STATUS_META, INQUIRY_TOPIC_META, TIER_META, can } from '@/lib/domain'
import { formatMoney } from '@/lib/money'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const customer = await prisma.customer.findUnique({ where: { id }, select: { name: true } })
  return { title: customer?.name ?? 'Customers' }
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">{label}</dt>
      <dd className="text-right text-sm text-ink">{value}</dd>
    </div>
  )
}

function orDash(value: string | null | undefined): ReactNode {
  return value ? value : <span className="text-ink-muted">Not on file</span>
}

function MeasurementItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">{label}</dt>
      <dd className="mt-1 text-sm font-bold text-ink">{value}</dd>
    </div>
  )
}

export default async function CustomerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ done?: string; error?: string }>
}) {
  const { id } = await params
  const { done, error } = await searchParams
  const staff = await requireCapability('customers.view')

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      measurements: true,
      notesLog: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { staff: { select: { name: true } } },
      },
      bookings: {
        orderBy: { eventDate: 'desc' },
        take: 12,
        select: {
          id: true,
          status: true,
          size: true,
          eventDate: true,
          total: true,
          dress: { select: { name: true } },
        },
      },
      inquiries: {
        orderBy: { receivedAt: 'desc' },
        take: 10,
        select: { id: true, subject: true, topic: true, status: true, receivedAt: true },
      },
      _count: { select: { bookings: true, inquiries: true } },
    },
  })
  if (!customer) notFound()

  const caps = {
    notes: can(staff.role, 'customers.note'),
    payments: can(staff.role, 'bookings.payments'),
  }
  const tierMeta = TIER_META[customer.tier]
  const doneMessage = done ? (CUSTOMERS_DONE_MESSAGES[done] ?? null) : null
  const addressLines = [
    customer.addressLine1,
    customer.addressLine2,
    [customer.city, customer.region].filter(Boolean).join(', ') + (customer.postalCode ? ` ${customer.postalCode}` : ''),
    customer.country,
  ].filter((line) => line && line.trim().length > 0)

  return (
    <div className="space-y-6">
      <Link
        href="/studio/customers"
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
        All customers
      </Link>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            <Avatar name={customer.name} size="lg" />
            {customer.name}
          </span>
        }
        description={`Client since ${formatMonthYear(customer.memberSince)} · ${customer.email}`}
      >
        <Chip tone={tierMeta.tone}>{tierMeta.label}</Chip>
      </PageHeader>

      {error ? (
        <div role="alert" className="rounded-xl border border-danger-line bg-surface px-4 py-3 text-sm font-bold text-danger-ink">
          {error}
        </div>
      ) : null}
      {doneMessage ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink">
          <span className="font-bold">{customer.name}</span> {doneMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Rental history"
              description={`${customer._count.bookings} ${customer._count.bookings === 1 ? 'reservation' : 'reservations'} on record — newest first.`}
              action={
                <Link
                  href={`/studio/bookings?q=${encodeURIComponent(customer.name)}`}
                  className="text-[13px] font-bold text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                >
                  All bookings
                </Link>
              }
            />
            {customer.bookings.length === 0 ? (
              <CardBody>
                <p className="text-sm text-ink-muted">No rentals yet — the first booking will appear here with its dress and dates.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {customer.bookings.map((booking) => {
                  const statusMeta = BOOKING_STATUS_META[booking.status]
                  return (
                    <li key={booking.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="text-sm text-ink">
                          <Link
                            href={`/studio/bookings/${booking.id}`}
                            className="font-bold text-ink underline-offset-4 hover:underline"
                          >
                            {booking.id}
                          </Link>
                          <span className="text-ink-muted"> · {booking.dress.name}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {formatDayLong(booking.eventDate)} · size {booking.size}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {caps.payments ? (
                          <span className="text-sm font-bold tabular-nums text-ink">{formatMoney(booking.total)}</span>
                        ) : null}
                        <Chip tone={statusMeta.tone}>{statusMeta.label}</Chip>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Saved measurements"
              description="Taken at the fitting and reused for every reservation."
            />
            {!customer.measurements ? (
              <CardBody>
                <p className="text-sm text-ink-muted">
                  No measurements on file yet — the fitting team records them at the first appointment.
                </p>
              </CardBody>
            ) : (
              <>
                <CardBody>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                    <MeasurementItem label="Height" value={customer.measurements.heightCm ? `${customer.measurements.heightCm} cm` : '—'} />
                    <MeasurementItem label="Bust" value={customer.measurements.bustCm ? `${customer.measurements.bustCm} cm` : '—'} />
                    <MeasurementItem label="Waist" value={customer.measurements.waistCm ? `${customer.measurements.waistCm} cm` : '—'} />
                    <MeasurementItem label="Hips" value={customer.measurements.hipsCm ? `${customer.measurements.hipsCm} cm` : '—'} />
                    <MeasurementItem
                      label="Dress size"
                      value={
                        customer.measurements.dressSizeLabel
                          ? `${customer.measurements.dressSizeLabel}${customer.measurements.backupSize ? ` · backup ${customer.measurements.backupSize}` : ''}`
                          : '—'
                      }
                    />
                    <MeasurementItem label="Shoe size" value={orDash(customer.measurements.shoeSize)} />
                  </dl>
                  {customer.measurements.notes ? (
                    <p className="mt-4 rounded-lg border border-line bg-surface-muted/40 px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
                      {customer.measurements.notes}
                    </p>
                  ) : null}
                </CardBody>
                <CardFooter>
                  <p className="text-xs text-ink-muted">Updated {formatDay(customer.measurements.updatedAt)}</p>
                </CardFooter>
              </>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Inquiries"
              description={`${customer._count.inquiries} ${customer._count.inquiries === 1 ? 'conversation' : 'conversations'} linked to this profile.`}
              action={
                <Link
                  href="/studio/inquiries"
                  className="text-[13px] font-bold text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                >
                  All inquiries
                </Link>
              }
            />
            {customer.inquiries.length === 0 ? (
              <CardBody>
                <p className="text-sm text-ink-muted">No inquiries from this client yet.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {customer.inquiries.map((inquiry) => {
                  const statusMeta = INQUIRY_STATUS_META[inquiry.status]
                  const topicMeta = INQUIRY_TOPIC_META[inquiry.topic]
                  return (
                    <li key={inquiry.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <Link
                          href={`/studio/inquiries/${inquiry.id}`}
                          className="text-sm font-bold text-ink underline-offset-4 hover:underline"
                        >
                          {inquiry.subject}
                        </Link>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                          <MessagesSquare className="size-3.5" strokeWidth={1.75} aria-hidden />
                          {topicMeta.label} · {inquiry.id} · {formatDayLong(inquiry.receivedAt)}
                        </p>
                      </div>
                      <Chip tone={statusMeta.tone}>{statusMeta.label}</Chip>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Internal notes"
              description="Only the studio sees these — sizing reminders, preferences and history."
            />
            <CardBody className="space-y-4">
              {caps.notes ? (
                <form action={addCustomerNoteAction} className="space-y-3">
                  <input type="hidden" name="customerId" value={customer.id} />
                  <Textarea
                    name="body"
                    required
                    maxLength={600}
                    rows={3}
                    aria-label="New internal note"
                    placeholder="Sizing notes, preferences, reminders for the team…"
                  />
                  <Button type="submit" size="sm">
                    <StickyNote className="size-4" strokeWidth={1.75} aria-hidden />
                    Add note
                  </Button>
                </form>
              ) : null}
              {customer.notesLog.length === 0 ? (
                <p className="text-sm text-ink-muted">No notes on the profile yet.</p>
              ) : (
                <ul className="space-y-3">
                  {customer.notesLog.map((note) => (
                    <li key={note.id} className="rounded-lg border border-line bg-surface-muted/40 px-4 py-3">
                      <p className="text-sm leading-relaxed whitespace-pre-line text-ink">{note.body}</p>
                      <p className="mt-1.5 text-xs text-ink-muted">
                        {note.staff?.name ?? 'Studio'} · {formatDateTime(note.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Contact" />
            <CardBody>
              <ul className="space-y-4">
                <li className="flex items-start gap-2.5">
                  <Mail className="mt-0.5 size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Email</p>
                    <a
                      href={`mailto:${customer.email}`}
                      className="text-sm font-bold break-all text-ink underline-offset-4 hover:underline"
                    >
                      {customer.email}
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Phone</p>
                    {customer.phone ? (
                      <a
                        href={`tel:${customer.phone.replace(/[^+\d]/g, '')}`}
                        className="text-sm font-bold text-ink underline-offset-4 hover:underline"
                      >
                        {customer.phone}
                      </a>
                    ) : (
                      <p className="text-sm text-ink-muted">Not on file</p>
                    )}
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Address</p>
                    {addressLines.length > 0 ? (
                      <p className="text-sm leading-relaxed text-ink">
                        {addressLines.map((line) => (
                          <span key={line} className="block">
                            {line}
                          </span>
                        ))}
                      </p>
                    ) : (
                      <p className="text-sm text-ink-muted">Not on file</p>
                    )}
                  </div>
                </li>
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Account" />
            <CardBody>
              <dl className="divide-y divide-line">
                <Fact
                  label="Tier"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <ToneMark tone={tierMeta.tone} />
                      {tierMeta.label}
                    </span>
                  }
                />
                <Fact label="Member since" value={formatMonthYear(customer.memberSince)} />
                <Fact label="Rentals" value={String(customer.rentalsCount)} />
                {caps.payments ? <Fact label="Lifetime spend" value={formatMoney(customer.lifetimeSpend)} /> : null}
                {caps.payments && customer.creditBalance > 0 ? (
                  <Fact label="Membership credit" value={formatMoney(customer.creditBalance)} />
                ) : null}
                <Fact label="Last active" value={customer.lastActiveAt ? formatDay(customer.lastActiveAt) : '—'} />
                <Fact label="Marketing" value={customer.marketingOptIn ? 'Opted in' : 'Not opted in'} />
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-ink-muted">{tierMeta.blurb}</p>
              {customer.notes ? (
                <div className="mt-4 rounded-lg border border-line bg-surface-muted/40 px-4 py-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Preferences</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink">{customer.notes}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
