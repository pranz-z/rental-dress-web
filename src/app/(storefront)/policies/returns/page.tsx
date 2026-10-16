import type { Metadata } from 'next'
import Link from 'next/link'
import { ContentHeader } from '@/components/storefront/content-page'
import { prisma } from '@/lib/db'
import { formatMoney } from '@/lib/money'

export const metadata: Metadata = {
  title: 'Returns and care',
  description: 'How returns work at Maison Rêve — the prepaid label, inspection, refundable deposits, free size exchanges and how damage is handled.',
}

type Settings = Awaited<ReturnType<typeof prisma.studioSettings.findUniqueOrThrow>>

function buildSections(settings: Settings): Array<{ title: string; body: string[] }> {
  const windowDays = settings.cancellationWindowDays
  const withinDays = `${windowDays} ${windowDays === 1 ? 'day' : 'days'}`

  return [
  {
    title: 'The return, in three moves',
    body: [
      'Fold the dress back into the same box it arrived in — it was sized for exactly this. Close the box, and the prepaid label is already affixed, addressed to the studio. Hand it to any UPS point or driver by the end of your return date.',
      'You do not need to clean, press or repair anything. The studio takes over the moment the box is out of your hands.',
    ],
  },
  {
    title: 'What happens when it lands',
    body: [
      'A studio team member scans the return, inspects the dress under good light, and logs its condition. Your deposit authorization is released within a few days — banks usually show it within 3–5 business days.',
      'You will get a quiet email the moment the return is scanned, and another when inspection is complete. If anything at inspection needs a conversation, a stylist calls before anything is charged.',
    ],
  },
  {
    title: 'Running late',
    body: [
      `Tell the studio as soon as life threatens to make you late. Returns within ${settings.lateGraceDays} ${settings.lateGraceDays === 1 ? 'day' : 'days'} of the due date are usually accepted without charge.`,
      `Beyond that, a late fee of ${formatMoney(settings.lateFeePerDay)} per day applies, up to the retail value of the dress. The fee exists because the next renter is standing in a mirror somewhere, waiting.`,
    ],
  },
  {
    title: 'Exchanges, while the dress is new to you',
    body: [
      'If a size does not fit, or the dress simply is not the one, contact the studio the moment the box arrives. While the dress has not left your home, an exchange or a different dress is free — the studio sends the replacement with a fresh label and arranges collection of the first.',
      'A backup size, added at checkout, makes the choice on the spot and is the studio\'s favourite trick for between-two-sizes lives.',
    ],
  },
  {
    title: 'Damage, honestly handled',
    body: [
      'Normal wear is covered, always: settling hems, loosened beading, a faint mark from the table that moved. Small repairs are the studio\'s maintenance, not your bill.',
      'For real damage — a torn hem, a lost accessory, wine across satin — the studio starts with a conversation, photographs, and a repair quote. Rental insurance, optional at checkout, covers accidental damage up to $500. Without insurance, costs are charged at cost and the refundable deposit is applied first.',
    ],
  },
  {
    title: 'Refunds',
    body: [
      `If a rental is cancelled by the studio, everything authorized or paid is refunded in full and immediately. Cancellations by you follow the rental terms: free beyond ${withinDays} before the event, ${settings.cancellationRefundPercent}% retained inside that window.`,
      'Deposit releases are automatic after inspection — there is nothing to request.',
    ],
  },
  ]
}

export default async function ReturnsPage() {
  const settings = await prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } })
  const sections = buildSections(settings)

  return (
    <div className="mx-auto w-full max-w-[780px] px-4 py-12 sm:px-6 lg:px-8">
      <ContentHeader
        eyebrow="Policies"
        title="Returns and care"
        lede="Renting should end as beautifully as it begins. Here is exactly how the dress goes home — and how the studio handles everything on the way."
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
        The full rules live in the{' '}
        <Link href="/policies/rental-terms" className="font-bold text-mulberry hover:underline">
          rental terms
        </Link>
        . Anything still unclear,{' '}
        <Link href="/contact" className="font-bold text-mulberry hover:underline">
          the studio is a note away
        </Link>
        .
      </p>
    </div>
  )
}
