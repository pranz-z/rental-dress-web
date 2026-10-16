import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { ContentHeader, Faq } from '@/components/storefront/content-page'

export const metadata: Metadata = {
  title: 'Membership — the Paris Club',
  description:
    'Rent like it is your own wardrobe. Membership from $49 a month, the Paris Club from $89 — rentals, credits, priority dates and a stylist who knows your measurements.',
}

const TIERS = [
  {
    name: 'Member',
    price: '$49',
    cadence: 'a month',
    summary: 'For the calendar with a few good evenings on it.',
    features: [
      'One rental credit each month (unused credits roll for 60 days)',
      'Free express courier on every rental',
      '24-hour early access to new arrivals',
      '50% off backup sizes',
    ],
    featured: false,
  },
  {
    name: 'Paris Club',
    price: '$89',
    cadence: 'a month',
    summary: 'For the invitation that says black tie, and the one next month too.',
    features: [
      'Three rental credits each month, rolling for 90 days',
      'A stylist who knows your measurements on call by email',
      'First look at every new arrival, a week early',
      'Same-day courier in Boston and Cambridge, both directions',
      'Backup sizes and insurance included on every reservation',
      'Two guest passes a year for someone you love',
    ],
    featured: true,
  },
]

export default function MembershipPage() {
  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-12 sm:px-6 lg:px-8">
      <ContentHeader
        eyebrow="The Paris Club"
        title="Rent like it is your own wardrobe."
        lede="A membership turns the collection into a closet: standing credits toward every evening out, priority on the dresses everyone wants, and a stylist who already knows what fits you."
      />

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        {TIERS.map((tier) => (
          <section
            key={tier.name}
            aria-label={`${tier.name} membership`}
            className={
              tier.featured
                ? 'relative overflow-hidden rounded-2xl border border-line p-7 text-ivory'
                : 'rounded-2xl border border-line bg-surface p-7'
            }
            style={tier.featured ? { background: 'linear-gradient(130deg, #6d3745 0%, #7a3e4d 60%, #8f5866 100%)' } : undefined}
          >
            {tier.featured ? (
              <span className="absolute top-5 right-5 rounded-full bg-ivory/15 px-3 py-1 text-[10px] font-bold tracking-[0.16em] text-blush uppercase">
                Most chosen
              </span>
            ) : null}
            <h2 className={`font-serif text-3xl ${tier.featured ? 'text-ivory' : 'text-ink'}`}>{tier.name}</h2>
            <p className={`mt-1 text-sm ${tier.featured ? 'text-blush/85' : 'text-ink-muted'}`}>{tier.summary}</p>
            <p className={`mt-5 font-serif text-5xl ${tier.featured ? 'text-ivory' : 'text-ink'}`}>
              {tier.price}
              <span className={`ml-2 font-sans text-sm font-normal ${tier.featured ? 'text-blush/80' : 'text-ink-muted'}`}>{tier.cadence}</span>
            </p>
            <ul className={`mt-6 space-y-3 text-sm leading-relaxed ${tier.featured ? 'text-blush/95' : 'text-ink-muted'}`}>
              {tier.features.map((feature) => (
                <li key={feature} className="flex gap-2.5">
                  <Check className={`mt-0.5 size-4 shrink-0 ${tier.featured ? 'text-blush' : 'text-mulberry'}`} strokeWidth={2.25} aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href={`/contact?about=${encodeURIComponent(`${tier.name} membership`)}`}
              className={
                tier.featured
                  ? 'mt-7 inline-flex h-11 items-center rounded-full bg-ivory px-6 text-sm font-bold text-mulberry transition-colors hover:bg-blush'
                  : 'mt-7 inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover'
              }
            >
              Ask to join
            </Link>
          </section>
        ))}
      </div>

      <p className="mt-5 text-[13px] leading-relaxed text-ink-muted">
        Memberships are arranged by hand while the studio gets to know you — a stylist writes back within a couple of hours and sets up your
        first month. Credits apply to any dress; a $600 gown simply uses two credits instead of one.
      </p>

      <section aria-labelledby="club-faq" className="mt-14">
        <h2 id="club-faq" className="font-serif text-3xl text-ink">
          The fine print, unshrunk
        </h2>
        <div className="mt-5">
          <Faq
            items={[
              {
                q: 'How do rental credits work?',
                a: 'Each credit covers a standard four-day rental of any dress up to $600 retail value. Above that, a rental uses two credits. Eight-day windows count as one credit plus a small extension.',
              },
              {
                q: 'Can I pause my membership?',
                a: 'Yes — write to the studio and it pauses from the next renewal, keeping your credits and your measurements. You can pause twice a year.',
              },
              {
                q: 'What happens if I cancel?',
                a: 'Credits already earned stay valid for 60 days after your final month, and everything you have rented returns to the collection as usual.',
              },
              {
                q: 'Is membership worth it if I only rent twice a year?',
                a: 'Probably not — and we will say so. The open cupboard is always there at list price. Membership is built for people with four or more evenings on the calendar.',
              },
            ]}
          />
        </div>
      </section>
    </div>
  )
}
