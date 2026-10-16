import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { MailCheck, PackageCheck, Sparkles } from 'lucide-react'
import { prisma } from '@/lib/db'
import { formatMoney } from '@/lib/money'
import { formatWeekday } from '@/lib/dates'
import { BOOKING_STATUS_META } from '@/lib/domain'
import { Chip } from '@/components/ui/chip'
import { syncStripeBookingPayment } from '@/lib/storefront/orders'
import { RECENT_ORDER_COOKIE } from '../state'

export const metadata: Metadata = {
  title: 'Reservation received',
  robots: { index: false },
}

type RecentOrder = { ids: string[]; email: string; total: number; deposit: number }

export default async function ConfirmationPage() {
  const jar = await cookies()
  const raw = jar.get(RECENT_ORDER_COOKIE)?.value
  if (!raw) redirect('/shop')

  let recent: RecentOrder | null = null
  try {
    const parsed = JSON.parse(raw) as RecentOrder
    if (Array.isArray(parsed.ids) && parsed.ids.length > 0) recent = parsed
  } catch {
    recent = null
  }
  if (!recent) redirect('/shop')

  // Stripe mode: settle any authorization the webhook has not caught up with.
  const initial = await prisma.booking.findMany({
    where: { id: { in: recent.ids } },
    include: { dress: { select: { name: true, slug: true } } },
  })
  let settled = false
  for (const booking of initial) {
    if (booking.paymentRef?.startsWith('pi_') && booking.paymentStatus !== 'AUTHORIZED') {
      const synced = await syncStripeBookingPayment(booking.id)
      if (synced) settled = true
    }
  }

  const bookings =
    settled || initial.some((booking) => booking.paymentRef?.startsWith('pi_'))
      ? await prisma.booking.findMany({
          where: { id: { in: recent.ids } },
          include: { dress: { select: { name: true, slug: true } } },
        })
      : initial

  if (bookings.length === 0) redirect('/shop')

  return (
    <div className="mx-auto w-full max-w-[820px] px-4 py-14 sm:px-6">
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-10">
        <p className="text-[11px] font-bold tracking-[0.2em] text-gold-ink uppercase">Reservation received</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight text-ink sm:text-5xl">The studio has your dresses</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-muted">
          A receipt is on its way to <span className="font-bold text-ink">{recent.email}</span>. The studio reviews every reservation by
          hand — you will have a confirmation with delivery details within a few hours. Nothing is captured until then.
        </p>

        <ul className="mt-8 space-y-4">
          {bookings.map((booking) => {
            const meta = BOOKING_STATUS_META[booking.status as keyof typeof BOOKING_STATUS_META]
            return (
              <li key={booking.id} className="rounded-xl border border-line bg-surface-muted/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-serif text-xl text-ink">
                    {booking.dress.name} <span className="text-sm text-ink-muted">· size {booking.size}</span>
                  </p>
                  <Chip tone={meta.tone}>{meta.label}</Chip>
                </div>
                <dl className="mt-3 grid gap-x-8 gap-y-1.5 text-[13px] text-ink-muted sm:grid-cols-2">
                  <div className="flex gap-1.5">
                    <dt className="font-bold text-ink">Reference</dt>
                    <dd>{booking.id}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="font-bold text-ink">Rental</dt>
                    <dd>{booking.rentalDays} days</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="font-bold text-ink">Arrives</dt>
                    <dd>{formatWeekday(booking.deliveryDate)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="font-bold text-ink">Event</dt>
                    <dd>{formatWeekday(booking.eventDate)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="font-bold text-ink">Due back</dt>
                    <dd>{formatWeekday(booking.returnDate)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="font-bold text-ink">Authorized</dt>
                    <dd>
                      {formatMoney(booking.total)}
                      {booking.deposit > 0 ? ` + ${formatMoney(booking.deposit)} deposit` : ''}
                    </dd>
                  </div>
                </dl>
              </li>
            )
          })}
        </ul>

        <div className="mt-9 grid gap-5 sm:grid-cols-3">
          {[
            { icon: PackageCheck, title: 'Studio review', copy: 'The team checks the calendar and the dress condition, then confirms.' },
            { icon: Sparkles, title: 'Pressed and packed', copy: 'Your dress is steamed, boxed with its prepaid label, and dispatched.' },
            { icon: MailCheck, title: 'You are kept posted', copy: 'Every step emails you — and your account shows the tracking.' },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-line p-4">
              <item.icon className="size-5 text-mulberry" strokeWidth={1.75} aria-hidden />
              <h2 className="mt-2.5 font-serif text-lg text-ink">{item.title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{item.copy}</p>
            </div>
          ))}
        </div>

        <div className="mt-9 flex flex-wrap gap-2">
          <Link
            href="/account/sign-in"
            className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            Track it in your account
          </Link>
          <Link
            href="/shop"
            className="inline-flex h-11 items-center rounded-full border border-line-strong bg-surface px-6 text-sm font-bold text-ink transition-colors hover:bg-surface-muted"
          >
            Keep browsing
          </Link>
        </div>
      </div>
    </div>
  )
}
