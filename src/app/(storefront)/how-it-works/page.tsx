import type { Metadata } from 'next'
import Link from 'next/link'
import { BadgeCheck, Package, Sparkles, Truck } from 'lucide-react'
import { ContentHeader, Faq } from '@/components/storefront/content-page'
import { prisma } from '@/lib/db'

export const metadata: Metadata = {
  title: 'How renting works',
  description:
    'Reserve your dates, the studio confirms by hand, your dress arrives pressed with a prepaid return label. Cleaning and two-way shipping included.',
}

const TIMELINE = [
  {
    step: '01',
    title: 'Reserve',
    copy: 'Choose the dress, pick your size — add a backup size if you are between two — and drop your event date on the live calendar. Only dates the studio can truly promise appear in the window.',
  },
  {
    step: '02',
    title: 'The studio confirms',
    copy: 'A stylist checks the calendar, the dress and the fit notes from your account, then confirms your reservation by hand — usually within a couple of studio hours. Nothing is captured before then.',
  },
  {
    step: '03',
    title: 'It ships',
    copy: 'Your dress leaves Newbury Street steamed, on the padded hanger, boxed with a prepaid UPS label. Tracking lands in your account the moment it is scanned.',
  },
  {
    step: '04',
    title: 'You wear it',
    copy: 'Standard rentals are four days from the day before your event; eight-day rentals ride through a longer weekend of celebrations. The dress is yours for the whole window.',
  },
  {
    step: '05',
    title: 'Return it',
    copy: 'Fold it back into the same box with the prepaid label and hand it to any UPS point by your return date. Cleaning and inspection are on us — and your deposit is released.',
  },
]

export default async function HowItWorksPage() {
  const settings = await prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } })
  const windowDays = settings.cancellationWindowDays
  const replyTarget = settings.replyTargetHours === 1 ? 'an hour' : `${settings.replyTargetHours} studio hours`

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-12 sm:px-6 lg:px-8">
      <ContentHeader
        eyebrow="The rhythm of a rental"
        title="Beautifully simple, on purpose."
        lede="Five steps between finding the dress and dancing in it. The studio handles everything with a hanger on it, so all you handle is the evening."
      />

      <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TIMELINE.map((item) => (
          <li key={item.step} className="rounded-2xl border border-line bg-surface p-6">
            <p className="font-serif text-3xl text-gold-ink">{item.step}</p>
            <h2 className="mt-3 font-serif text-2xl text-ink">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {item.step === '02'
                ? `A stylist checks the calendar, the dress and the fit notes from your account, then confirms your reservation by hand — usually within ${replyTarget}. Nothing is captured before then.`
                : item.copy}
            </p>
          </li>
        ))}
        <li className="flex flex-col justify-center rounded-2xl border border-line bg-surface-muted/50 p-6">
          <p className="font-serif text-xl leading-snug text-ink">Ready when you are.</p>
          <Link
            href="/shop"
            className="mt-4 inline-flex h-11 w-fit items-center rounded-full bg-accent px-6 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            Browse the collection
          </Link>
          <Link href="/size-guide" className="mt-3 text-sm font-bold text-mulberry hover:underline">
            Check your fit first →
          </Link>
        </li>
      </ol>

      <section aria-labelledby="included" className="mt-16">
        <h2 id="included" className="font-serif text-3xl text-ink">
          In every box
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Truck, title: 'Two-way shipping', copy: 'Insured, tracked, and free in both directions within the continental US.' },
            { icon: Sparkles, title: 'Cleaning and pressing', copy: 'Professionally cleaned and steamed between every rental — never your to-do.' },
            { icon: BadgeCheck, title: 'Fit support', copy: 'A stylist checks your measurements against each dress before it is packed, and after you return it we check the dress.' },
            { icon: Package, title: 'The little things', copy: 'Padded hanger, garment bag, prepaid return label, and a spare button and thread for good measure.' },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-line bg-surface p-5">
              <item.icon className="size-5 text-mulberry" strokeWidth={1.75} aria-hidden />
              <h3 className="mt-3 text-sm font-bold text-ink">{item.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="dates" className="mt-16">
        <h2 id="dates" className="font-serif text-3xl text-ink">
          Dates, honestly
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
          The calendar you see is the studio's own — the same one the office works from. It accounts for every held reservation, the day a
          dress needs after it returns, the cleaning queue, and the quiet days a stylist has blocked for mending or fittings. What it offers
          is what can genuinely arrive in time.
        </p>
        <div className="mt-6">
          <Faq
            items={[
              {
                q: 'What happens right after I reserve?',
                a: 'Your card is authorized, never charged. A stylist reviews the reservation by hand — usually within a couple of hours — and confirms it. That is the moment the authorization is captured, and your confirmation email with delivery details goes out.',
              },
              {
                q: 'Can I change my dates later?',
                a: `Yes, if the calendar allows. Write to the studio or reply to your confirmation email with the new date; moving a reservation as far out as ${windowDays} ${windowDays === 1 ? 'day' : 'days'} before the event is free.`,
              },
              {
                q: 'What if my size is between two?',
                a: 'Choose a backup size for $25 and both sizes travel in the box. Slip on both as soon as the box arrives and return whichever fits least well — exchanges on the spot are free.',
              },
              {
                q: 'How late can I book?',
                a: 'The calendar opens dates from two days out. If you need something sooner, contact the studio — a stylist may be able to make it happen.',
              },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="care" className="mt-16 rounded-2xl border border-line bg-surface-muted/50 px-6 py-8 sm:px-10">
        <h2 id="care" className="font-serif text-3xl text-ink">
          Wearing a dress that is not yours
        </h2>
        <div className="mt-4 max-w-3xl space-y-3 text-[15px] leading-relaxed text-ink-muted">
          <p>
            Rentals stay beautiful because of small care taken by the people wearing them. Keep a glass of red at arm's length, let a
            tailor-free fix be the tape measure you use, and tell the studio about any accident immediately — most can be repaired
            quietly, and honesty almost always keeps a repair out of your hands financially.
          </p>
          <p>
            Normal wear — a settling hem, a loosened bead, a breeze carrying the train through something rustic — is part of a dress's life
            and the studio's maintenance. The{' '}
            <Link href="/policies/returns" className="font-bold text-mulberry hover:underline">
              returns and care page
            </Link>{' '}
            spells out exactly what is and is not covered.
          </p>
        </div>
      </section>
    </div>
  )
}
