import type { Metadata } from 'next'
import Link from 'next/link'
import { ContentHeader } from '@/components/storefront/content-page'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What Maison Rêve collects, why, and the choices you have. No data selling, ever — a dress rental business is not an advertising business.',
}

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: 'What we collect',
    body: [
      'When you reserve, enquire or create an account: your name, email, phone, delivery address and the details of what you rented or asked about. If you save measurements, those too — they exist to make dresses fit and are visible only to you and the styling team.',
      'Payments are handled by our payment processor. The studio sees the last four digits of the card, the amount and whether the payment succeeded — never the full number.',
    ],
  },
  {
    title: 'Why we collect it',
    body: [
      'To reserve, pack, ship and track your rentals; to reply to your notes; to keep the calendar honest; and to email you about reservations you have made. If you join the newsletter, to send you the letters you asked for — twice a month, easy to leave from the footer of any email.',
    ],
  },
  {
    title: 'What we never do',
    body: [
      'We do not sell, rent or trade personal data. We do not run third-party advertising trackers on this site. Analytics, when used, are aggregate and cookieless: how many people visited a page, not who.',
    ],
  },
  {
    title: 'Sharing, the short list',
    body: [
      'Couriers need your name and address to deliver. The payment processor needs the payment details you enter. Email delivery runs through a transactional email service. That is the whole list, and each of them is bound to use the data only for that purpose.',
    ],
  },
  {
    title: 'Cookies and sessions',
    body: [
      'The site sets a small number of first-party cookies: a session cookie so you stay signed in, a cart cookie holding the references of dresses in your bag, and short-lived cookies that make forms work. None of them follow you off maisonreve.com.',
    ],
  },
  {
    title: 'Keeping things',
    body: [
      'Rental and payment records are kept as long as accounting law expects, generally seven years. Measurements and account details stay until you ask for them to be removed. Newsletter subscriptions stay until you unsubscribe.',
    ],
  },
  {
    title: 'Your choices',
    body: [
      'You can ask for a copy of your data, ask for corrections, ask for deletion, or unsubscribe from letters — write to studio@maisonreve.com and the studio will handle it within a month, usually the same week.',
    ],
  },
  {
    title: 'Security',
    body: [
      'Traffic is encrypted in transit, customer sessions are signed and httpOnly, and access to customer records inside the studio is limited to the people who need it to do their jobs. If anything ever goes wrong, the studio will tell you plainly and quickly.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-[780px] px-4 py-12 sm:px-6 lg:px-8">
      <ContentHeader
        eyebrow="Policies"
        title="Privacy"
        lede="A dress rental business, not an advertising business. Here is what the studio collects, and everything it refuses to do with it."
      />
      <p className="mt-4 text-[13px] text-ink-muted">Last updated: January 2026</p>

      <div className="mt-10 space-y-10">
        {SECTIONS.map((section) => (
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
        Questions about your data?{' '}
        <Link href="/contact" className="font-bold text-mulberry hover:underline">
          Write to the studio
        </Link>{' '}
        — a person answers.
      </p>
    </div>
  )
}
