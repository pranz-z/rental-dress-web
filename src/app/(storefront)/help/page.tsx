import type { Metadata } from 'next'
import Link from 'next/link'
import { ContentHeader, Faq } from '@/components/storefront/content-page'
import { prisma } from '@/lib/db'
import { formatMoney } from '@/lib/money'

export const metadata: Metadata = {
  title: 'Help center',
  description:
    'Answers to the questions renters ask most — reservations, sizes, delivery, deposits, returns, care and memberships.',
}

export default async function HelpPage() {
  const settings = await prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } })
  const windowDays = settings.cancellationWindowDays
  const withinDays = `${windowDays} ${windowDays === 1 ? 'day' : 'days'}`
  const graceDays = `${settings.lateGraceDays} ${settings.lateGraceDays === 1 ? 'day' : 'days'}`
  const replyTarget = settings.replyTargetHours === 1 ? 'an hour' : `${settings.replyTargetHours} hours`

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-12 sm:px-6 lg:px-8">
      <ContentHeader
        eyebrow="Help center"
        title="Answers, before you have to ask."
        lede={`The short version of everything renters want to know. If your question is not here, the studio answers within ${replyTarget}.`}
      />

      <section aria-labelledby="reservations" className="mt-12">
        <h2 id="reservations" className="font-serif text-2xl text-ink">
          Reservations and dates
        </h2>
        <div className="mt-4">
          <Faq
            items={[
              {
                q: 'When is my card charged?',
                a: 'At reservation your card is authorized, not charged. The studio confirms your reservation by hand — often within a couple of hours — and captures the payment at that moment. If your dates cannot be confirmed, the authorization is released immediately.',
              },
              {
                q: 'How do I change my event date?',
                a: `Reply to your confirmation email or write through the contact page with the new date, up to ${withinDays} before the event, free of charge. Inside that window the studio will do everything it can, though a change may not be possible.`,
              },
              {
                q: 'Can I cancel?',
                a: `Cancel free up to ${withinDays} before your event — the authorization simply disappears. Inside ${withinDays}, the studio keeps ${settings.cancellationRefundPercent}% of the rental as a cancellation fee, since the dress likely turned away another date.`,
              },
              {
                q: 'Can I book more than one dress?',
                a: 'Absolutely — hold several in your bag and check out together. Each dress keeps its own window and comes in its own box, so the dates need not match.',
              },
              {
                q: 'Do you take same-week reservations?',
                a: 'The calendar opens from two days out, so yes, when a dress is free. If you need something sooner than that, write to the studio — the team sometimes can, especially with a local pickup.',
              },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="sizing" className="mt-12">
        <h2 id="sizing" className="font-serif text-2xl text-ink">
          Sizing and fit
        </h2>
        <div className="mt-4">
          <Faq
            items={[
              {
                q: 'What if neither size fits?',
                a: 'Tell the studio the moment the box arrives. While the dress is still new to you, a size exchange or a different dress is free — the studio sends the replacement with a fresh label and you keep the wedding-date window.',
              },
              {
                q: 'Do you alter dresses?',
                a: 'We cannot cut or sew a rental — it must go back to the next renter unchanged. A good dry cleaner can steam a hem, and the studio is happy to suggest quick fixes that leave no trace. The backup size is often the simplest answer.',
              },
              {
                q: 'How do I know my size?',
                a: 'The size guide walks through measuring at home, and saved measurements in your account are checked against every dress before it ships. When you are between sizes, take the larger and add a backup in the smaller.',
              },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="delivery" className="mt-12">
        <h2 id="delivery" className="font-serif text-2xl text-ink">
          Delivery and returns
        </h2>
        <div className="mt-4">
          <Faq
            items={[
              {
                q: 'When does my dress arrive?',
                a: 'Standard rentals arrive the day before your event — or two days before for eight-day windows — and you keep it until the stated return date. The exact envelope is on your confirmation email and in your account.',
              },
              {
                q: 'How does the return work?',
                a: 'Fold the dress into the same box, close it, peel the prepaid label — it is already on the box — and hand it to any UPS driver or point by your return date. Nothing else to arrange, nothing to pay.',
              },
              {
                q: 'What if I return late?',
                a: `Life happens: tell the studio as soon as you know. Returns within ${graceDays} of the due date are usually forgiven; beyond that a late fee of ${formatMoney(settings.lateFeePerDay)} per day applies, which the studio will tell you about before charging.`,
              },
              {
                q: 'What if something gets damaged?',
                a: 'Say so, immediately and without fear. Normal wear is covered — hems settling, beads loosening, a champagne mark from a table that moved. For real damage the refundable deposit exists, and a stylist will talk through exactly what the repair costs.',
              },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="money" className="mt-12">
        <h2 id="money" className="font-serif text-2xl text-ink">
          Deposits, insurance and membership
        </h2>
        <div className="mt-4">
          <Faq
            items={[
              {
                q: 'What is the refundable deposit?',
                a: `Every dress carries a deposit of ${settings.depositPercent}% of its retail value, authorized alongside the rental. It is released within a few days of a clean inspection, and it is never captured without a conversation first.`,
              },
              {
                q: 'Should I add insurance?',
                a: 'Insurance is $15 per dress and covers small mishaps end to end, from a red-wine moment to a lost earring loop. It pays for itself the first time a heel goes through a hem; regulars add it every time.',
              },
              {
                q: 'How do membership credits apply?',
                a: 'When you check out, member discounts and credits are applied by the studio at confirmation, and appear on your receipt email. Questions about a specific credit? The studio can see everything.',
              },
            ]}
          />
        </div>
      </section>

      <div className="mt-14 rounded-2xl border border-line bg-surface-muted/50 px-6 py-8 text-center sm:px-10">
        <p className="font-serif text-2xl text-ink">Still curious?</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
          Every note reaches a person, and every person at Maison Rêve has answered a hundred of these before.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <Link
            href="/contact"
            className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            Write to the studio
          </Link>
          <Link
            href="/policies/rental-terms"
            className="inline-flex h-11 items-center rounded-full border border-line-strong bg-surface px-6 text-sm font-bold text-ink transition-colors hover:bg-surface-muted"
          >
            Read the rental terms
          </Link>
        </div>
      </div>
    </div>
  )
}
