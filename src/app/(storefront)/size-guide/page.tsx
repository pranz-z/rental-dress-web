import type { Metadata } from 'next'
import Link from 'next/link'
import { Ruler } from 'lucide-react'
import { ContentHeader, Faq } from '@/components/storefront/content-page'

export const metadata: Metadata = {
  title: 'Size and fit guide',
  description:
    'How to measure bust, waist and hips, our letter sizing, and when to take a backup size. Free size exchanges while your dress is in transit.',
}

const SIZE_TABLE = [
  { label: 'XS', us: 'US 0–2', bust: '78–83', waist: '60–65', hips: '86–91' },
  { label: 'S', us: 'US 4–6', bust: '84–89', waist: '66–71', hips: '92–97' },
  { label: 'M', us: 'US 8–10', bust: '90–95', waist: '72–77', hips: '98–103' },
  { label: 'L', us: 'US 12–14', bust: '96–103', waist: '78–85', hips: '104–111' },
  { label: 'XL', us: 'US 16–18', bust: '104–112', waist: '86–94', hips: '112–120' },
]

export default function SizeGuidePage() {
  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-12 sm:px-6 lg:px-8">
      <ContentHeader
        eyebrow="Size and fit"
        title="Measured once, worn beautifully."
        lede="Every dress on this site has been fitted on a real body, and every rental is checked against your measurements before it ships. Here is how to give the studio good numbers."
      />

      <section aria-labelledby="measure" className="mt-12">
        <h2 id="measure" className="font-serif text-3xl text-ink">
          Three numbers that matter
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
          Stand relaxed in light clothing, keep the tape level and snug — not tight. If someone can hold the tape for you, better still.
          Save the numbers in{' '}
          <Link href="/account" className="font-bold text-mulberry hover:underline">
            your account
          </Link>{' '}
          and a stylist will use them on every future rental.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { title: 'Bust', copy: 'Around the fullest part of the bust, tape level under the arms and across the back.' },
            { title: 'Waist', copy: 'The narrowest part of your middle — usually just above the navel. Breathe normally.' },
            { title: 'Hips', copy: 'Around the fullest part of the hips, roughly 20cm below the waist, feet together.' },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-line bg-surface p-5">
              <Ruler className="size-5 text-mulberry" strokeWidth={1.75} aria-hidden />
              <h3 className="mt-3 text-sm font-bold text-ink">{item.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="table" className="mt-14">
        <h2 id="table" className="font-serif text-3xl text-ink">
          The sizing chart
        </h2>
        <p className="mt-2 text-sm text-ink-muted">All measurements in centimetres. When you are between two sizes, trust the larger number.</p>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <caption className="sr-only">Maison Rêve letter sizes with US equivalents and body measurements</caption>
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-bold tracking-[0.1em] text-ink-muted uppercase">
                <th scope="col" className="px-5 py-3.5">Size</th>
                <th scope="col" className="px-5 py-3.5">US</th>
                <th scope="col" className="px-5 py-3.5">Bust (cm)</th>
                <th scope="col" className="px-5 py-3.5">Waist (cm)</th>
                <th scope="col" className="px-5 py-3.5">Hips (cm)</th>
              </tr>
            </thead>
            <tbody>
              {SIZE_TABLE.map((row) => (
                <tr key={row.label} className="border-b border-line last:border-0">
                  <th scope="row" className="px-5 py-3.5 text-left font-serif text-lg text-ink">
                    {row.label}
                  </th>
                  <td className="px-5 py-3.5 text-ink-muted">{row.us}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{row.bust}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{row.waist}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{row.hips}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="fit-notes" className="mt-14">
        <h2 id="fit-notes" className="font-serif text-3xl text-ink">
          Questions we hear at the fitting rail
        </h2>
        <div className="mt-5">
          <Faq
            items={[
              {
                q: 'What if I am between two sizes?',
                a: (
                  <>
                    Take the larger size and add a backup in the smaller one for $25 — both travel in the box. Try both on the moment your
                    dress arrives; if the other size suits better, slip it back in the box with the return label and it is done. There is no
                    exchange fee while the dress is new to you.
                  </>
                ),
              },
              {
                q: 'Do styles run differently?',
                a: 'A little. Bias-cut silks, like the Celeste, skim closer than their measurements suggest and are worth sizing up if you dislike cling. Structured brocades and velvet, like the Bianca and Thalia, hold their shape and tend true. Any special notes live on each dress page under “Fit notes from the studio”.',
              },
              {
                q: 'Can a stylist decide for me?',
                a: (
                  <>
                    Gladly. Send your measurements and the event through the{' '}
                    <Link href="/contact" className="font-bold text-mulberry hover:underline">
                      contact form
                    </Link>{' '}
                    and a stylist will shortlist two or three options with the right size for each.
                  </>
                ),
              },
              {
                q: 'What does the $25 backup size include?',
                a: 'A second size of the same dress, shipped and returned in the same box. If both fit, keep the one you love and return the other — the fee covers the courier weight either way.',
              },
            ]}
          />
        </div>
      </section>

      <div className="mt-14 rounded-2xl border border-line bg-surface-muted/50 px-6 py-8 text-center sm:px-10">
        <p className="font-serif text-2xl text-ink">Unsure between two dresses?</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
          Save both to an event list and let a stylist weigh in — they know which dresses photograph, which breathe, and which forgive a
          dance floor.
        </p>
        <Link
          href="/contact"
          className="mt-5 inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
        >
          Ask a stylist
        </Link>
      </div>
    </div>
  )
}
