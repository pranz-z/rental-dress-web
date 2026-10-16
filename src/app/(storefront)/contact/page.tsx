import type { Metadata } from 'next'
import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { currentCustomer } from '@/lib/storefront/session'
import { ContentHeader } from '@/components/storefront/content-page'
import { InquiryForm } from '@/components/storefront/inquiry-form'
import { formatBusinessHours, parseBusinessHours } from '@/lib/business-hours'
import { prisma } from '@/lib/db'

export const metadata: Metadata = {
  title: 'Contact the studio',
  description:
    'Write to the Maison Rêve studio — sizing, bookings, delivery or a dress you are deciding between. Replies within a couple of studio hours.',
}

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ about?: string }> }) {
  const [params, customer, settings] = await Promise.all([
    searchParams,
    currentCustomer(),
    prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } }),
  ])
  const about = typeof params.about === 'string' && params.about.trim() ? params.about.trim().slice(0, 160) : undefined
  const hours = formatBusinessHours(parseBusinessHours(settings.businessHours))
  const replyTarget = settings.replyTargetHours === 1 ? 'an hour' : `${settings.replyTargetHours} hours`

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-12 sm:px-6 lg:px-8">
      <ContentHeader
        eyebrow="The studio"
        title="Write to us like a neighbour."
        lede={`Sizing, a reservation you would like moved, a dress you cannot stop thinking about — a stylist reads every note and replies, usually within ${replyTarget} during studio hours.`}
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <InquiryForm
            channel="CONTACT_FORM"
            subject={about}
            topicDefault={about ? 'BOOKING_CHANGE' : 'GENERAL'}
            defaultName={customer?.name ?? ''}
            defaultEmail={customer?.email ?? ''}
            replyTargetHours={settings.replyTargetHours}
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="font-serif text-xl text-ink">The atelier</h2>
            <ul className="mt-4 space-y-3.5 text-sm leading-relaxed text-ink-muted">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-mulberry" strokeWidth={1.75} aria-hidden />
                {settings.studioAddress}
              </li>
              <li className="flex gap-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-mulberry" strokeWidth={1.75} aria-hidden />
                <span>
                  <span className="sr-only">Business hours</span>
                  {hours.map((line) => (
                    <span key={line.day} className="grid grid-cols-[88px_1fr]">
                      <span className="font-bold text-ink">{line.day}</span>
                      <span>{line.hours}</span>
                    </span>
                  ))}
                  <span className="mt-1 block">Fittings by appointment</span>
                </span>
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-mulberry" strokeWidth={1.75} aria-hidden />
                {settings.studioPhone}
              </li>
              <li className="flex gap-3">
                <Mail className="mt-0.5 size-4 shrink-0 text-mulberry" strokeWidth={1.75} aria-hidden />
                {settings.studioEmail}
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-line bg-surface-muted/50 p-6">
            <h2 className="font-serif text-xl text-ink">Faster answers</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              The help center covers dates, deposits, returns and the things renters ask most. Your account shows every reservation with its
              tracking.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
