import type { Metadata } from 'next'
import Link from 'next/link'
import { ContentHeader } from '@/components/storefront/content-page'
import { prisma } from '@/lib/db'
import { formatMoney } from '@/lib/money'

export const metadata: Metadata = {
  title: 'Rental terms',
  description: 'The terms that govern every Maison Rêve rental — reservations, payment, deposits, care, late returns and cancellations.',
}

type Settings = Awaited<ReturnType<typeof prisma.studioSettings.findUniqueOrThrow>>

function buildSections(settings: Settings): Array<{ title: string; body: string[] }> {
  const windowDays = settings.cancellationWindowDays
  const withinDays = `${windowDays} ${windowDays === 1 ? 'day' : 'days'}`
  const graceDays = `${settings.lateGraceDays} ${settings.lateGraceDays === 1 ? 'day' : 'days'}`

  return [
  {
    title: '1 · The agreement',
    body: [
      'These terms govern every rental arranged through maisonreve.com or the studio at 418 Newbury Street. By reserving a dress you accept them on behalf of yourself and anyone who wears the dress.',
      'A rental agreement is formed when the studio confirms your reservation in writing (email is writing). Until then, a reservation is a request and the dress remains available to others.',
    ],
  },
  {
    title: '2 · Reservations and dates',
    body: [
      'Standard rentals are four days: the dress aims to arrive the day before your event and is due back on the return date stated in your confirmation. Eight-day rentals extend the window by four days. Dates that the calendar offers are what the studio can promise; a courier delay does not create a new entitlement but the studio will always make a good-faith effort to get the dress to you in time.',
      `Changes to an event date are free up to ${withinDays} before the event, subject to availability. Inside that window, changes are possible only if the calendar allows.`,
    ],
  },
  {
    title: '3 · Payment and authorization',
    body: [
      'When you reserve, your card is authorized for the rental total and the refundable deposit. The rental is captured when the studio confirms your reservation. The deposit is authorized but not captured, and is released promptly after the dress returns and passes inspection.',
      'If the studio cannot confirm your reservation, every authorization is released immediately. Card authorizations typically clear within 3–5 business days depending on your bank.',
    ],
  },
  {
    title: '4 · Cancellations',
    body: [
      `Cancel more than ${withinDays} before your event and nothing is owed — any authorization is released. Cancel within ${withinDays} of the event and ${settings.cancellationRefundPercent}% of the rental fee is retained as a cancellation fee, because the dress most likely turned away another date.`,
      'If the studio cancels — a dress is damaged beyond wearing, a shipment is lost in transit — you pay nothing, and the team will offer alternatives with priority.',
    ],
  },
  {
    title: '5 · The refundable deposit',
    body: [
      `Each dress carries a refundable deposit of ${settings.depositPercent}% of its retail value, held on your card. The deposit exists for damage beyond normal wear, loss of the dress or a substantially late return.`,
      'Normal wear — hems settling, minor bead loss, a loose seam — is never charged. For anything beyond it, a stylist will contact you with photographs, the repair quote and a conversation before the deposit is touched.',
    ],
  },
  {
    title: '6 · Care of the dress',
    body: [
      'You agree to wear the dress reasonably: no permanent alterations, no adhesive fixes, no cleaning at home, no wearing it for a second, unmentioned event. Perfume and deodorant are welcome, hairspray and self-tanner are not your friends.',
      'Smoking, grilling in the dress, and open flames near tulle are exactly as bad an idea as they sound.',
    ],
  },
  {
    title: '7 · Returns',
    body: [
      `The dress travels in a box with a prepaid label already affixed. Send it back through any UPS point or with a driver, by the end of the return date. Beyond it, a late fee of ${formatMoney(settings.lateFeePerDay)} per day applies after a ${graceDays} grace period, with a maximum of the retail value.`,
      'Never sent the dress? After 14 days past the return date the studio may treat the dress as lost and charge the retail value less the deposit already held.',
    ],
  },
  {
    title: '8 · Damage and loss',
    body: [
      'Tell the studio about damage immediately — honesty keeps small repairs small. Rental insurance (optional at checkout) covers accidental damage up to $500 including stains, snags and lost accessories.',
      'Without insurance, repair or replacement costs are charged at cost with the studio\'s review, up to the dress\'s retail value. The deposit is applied first.',
    ],
  },
  {
    title: '9 · Liability',
    body: [
      'Where the law allows, the studio\'s total liability for any rental is limited to the rental fee and deposit paid. The studio is not liable for indirect losses — the wedding photograph, the impression made, or the shoes that matched perfectly.',
    ],
  },
  {
    title: '10 · Governing law and changes',
    body: [
      'These terms are governed by the laws of the Commonwealth of Massachusetts. The studio may update these terms; the version at the time of your reservation governs your rental.',
    ],
  },
  ]
}

export default async function RentalTermsPage() {
  const settings = await prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } })
  const sections = buildSections(settings)

  return (
    <div className="mx-auto w-full max-w-[780px] px-4 py-12 sm:px-6 lg:px-8">
      <ContentHeader
        eyebrow="Policies"
        title="Rental terms"
        lede="The whole agreement, in plain sentences. Short version: book, wear it beautifully, send it back — the studio handles most of what could go wrong."
      />
      <p className="mt-4 text-[13px] text-ink-muted">Last updated: January 2026</p>

      <div className="mt-10 space-y-10">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-serif text-2xl text-ink">{section.title}</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-muted">
              {section.body.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-12 text-sm leading-relaxed text-ink-muted">
        Questions about any of this?{' '}
        <Link href="/contact" className="font-bold text-mulberry hover:underline">
          Write to the studio
        </Link>{' '}
        — they read the fine print so you do not have to.
      </p>
    </div>
  )
}
