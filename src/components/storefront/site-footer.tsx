import Link from 'next/link'
import { NewsletterForm } from './newsletter-form'

const COLUMNS: Array<{ heading: string; links: Array<{ href: string; label: string }> }> = [
  {
    heading: 'Shop',
    links: [
      { href: '/shop?occasion=Wedding+guest', label: 'Wedding guest' },
      { href: '/shop?occasion=Gala', label: 'Gala' },
      { href: '/shop?occasion=Black+tie', label: 'Black tie' },
      { href: '/shop?sort=newest', label: 'New arrivals' },
    ],
  },
  {
    heading: 'The house',
    links: [
      { href: '/how-it-works', label: 'How it works' },
      { href: '/size-guide', label: 'Size and fit guide' },
      { href: '/membership', label: 'Membership' },
      { href: '/contact', label: 'Contact the studio' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { href: '/help', label: 'Help center' },
      { href: '/policies/rental-terms', label: 'Rental terms' },
      { href: '/policies/returns', label: 'Returns and care' },
      { href: '/policies/privacy', label: 'Privacy' },
    ],
  },
]

export function SiteFooter({
  studioAddress,
  studioPhone,
  studioEmail,
  hoursSummary,
}: {
  studioAddress?: string
  studioPhone?: string
  studioEmail?: string
  hoursSummary?: string
}) {
  return (
    <footer className="mt-20 border-t border-line bg-surface-muted/50">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_2fr]">
          <div className="max-w-sm">
            <p className="font-serif text-[26px] leading-none tracking-tight text-ink">Maison Rêve</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Designer dresses, rented. Delivered pressed, return shipped free — and someone on the other end of the line if the fit
              needs a second look.
            </p>
            <div className="mt-6">
              <p className="mb-2.5 text-[11px] font-bold tracking-[0.16em] text-gold-ink uppercase">Letters from the studio</p>
              <NewsletterForm source="footer" />
              <p className="mt-2.5 text-xs text-ink-muted">New arrivals and private sale invitations, twice a month.</p>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <nav key={column.heading} aria-label={column.heading}>
                <p className="mb-3 text-[11px] font-bold tracking-[0.16em] text-ink-muted uppercase">{column.heading}</p>
                <ul className="space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link href={link.href} className="text-sm text-ink-muted transition-colors hover:text-mulberry">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <hr className="my-10 border-line" />

        <div className="flex flex-col gap-4 text-xs leading-relaxed text-ink-muted sm:flex-row sm:items-end sm:justify-between">
          <p>
            {studioAddress ?? '418 Newbury Street, Floor 3 · Boston, MA 02115'}
            <br />
            {studioEmail ?? 'studio@maisonreve.com'} · {studioPhone ?? '(617) 555-0148'}
            {hoursSummary ? ` · ${hoursSummary}` : ''}
          </p>
          <p>© {new Date().getFullYear()} Maison Rêve. All dresses are one-of-a-kind; wear them beautifully.</p>
        </div>
      </div>
    </footer>
  )
}
