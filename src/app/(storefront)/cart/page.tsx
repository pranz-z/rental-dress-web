import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CalendarDays, Trash2 } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { formatWeekday } from '@/lib/dates'
import { readCart, hydrateCart } from '@/lib/storefront/cart'
import { removeCartItemAction } from '@/app/(storefront)/actions'
import { GarmentImage } from '@/components/storefront/garment'

export const metadata: Metadata = {
  title: 'Your bag',
  description: 'The dresses you are holding, with their dates and sizes, before checkout.',
  robots: { index: false },
}

export default async function CartPage() {
  const items = await readCart()
  const { lines, subtotal, depositTotal } = await hydrateCart(items)
  const anyUnavailable = lines.some((line) => !line.available)

  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <p className="text-[11px] font-bold tracking-[0.2em] text-gold-ink uppercase">Your bag</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight text-ink sm:text-5xl">
          {lines.length === 0 ? 'Nothing here yet' : lines.length === 1 ? 'One dress, on its way soon' : `${lines.length} dresses, being held`}
        </h1>
      </header>

      {lines.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-surface px-6 py-16 text-center">
          <p className="mx-auto max-w-md text-sm leading-relaxed text-ink-muted">
            Find something you would wear to the event you keep thinking about — the calendar knows exactly what is free.
          </p>
          <Link
            href="/shop"
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-[15px] font-bold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            Browse the collection
            <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <ul className="space-y-5">
            {lines.map((line) => (
              <li key={`${line.item.dressId}-${line.item.size}-${line.item.rentalDays}-${line.index}`} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
                <div className="flex gap-4 sm:gap-5">
                  <Link href={line.dress.slug ? `/dress/${line.dress.slug}` : '/shop'} className="shrink-0" tabIndex={-1} aria-hidden>
                    <GarmentImage
                      name={line.dress.name}
                      designer={line.dress.designer}
                      color={line.dress.color || 'Signature'}
                      colorHex={line.dress.colorHex}
                      artTone="blush"
                      view="FRONT"
                      className="aspect-[3/4] w-[92px] sm:w-[110px]"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold tracking-[0.18em] text-ink-muted uppercase">{line.dress.designer}</p>
                        <h2 className="mt-0.5 font-serif text-xl leading-snug text-ink">
                          {line.dress.slug ? (
                            <Link href={`/dress/${line.dress.slug}`} className="hover:text-mulberry">
                              {line.dress.name}
                            </Link>
                          ) : (
                            line.dress.name
                          )}
                        </h2>
                      </div>
                      <form action={removeCartItemAction}>
                        <input type="hidden" name="index" value={line.index} />
                        <button
                          type="submit"
                          aria-label={`Remove ${line.dress.name} from your bag`}
                          className="grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-danger-ink"
                        >
                          <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                        </button>
                      </form>
                    </div>

                    <dl className="mt-2.5 grid gap-x-6 gap-y-1.5 text-[13px] text-ink-muted sm:grid-cols-2">
                      <div className="flex gap-1.5">
                        <dt className="font-bold text-ink">Size</dt>
                        <dd>
                          {line.item.size}
                          {line.item.backupSize ? ` · backup ${line.item.backupSize}` : ''}
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="font-bold text-ink">Window</dt>
                        <dd>{line.item.rentalDays} days</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="font-bold text-ink">Arrives</dt>
                        <dd>{formatWeekday(line.deliveryDate)}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="font-bold text-ink">Due back</dt>
                        <dd>{formatWeekday(line.returnDate)}</dd>
                      </div>
                    </dl>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-bold text-ink">
                        {formatMoney(line.dress.rentalPrice)}
                        <span className="font-normal text-ink-muted"> · refundable {formatMoney(line.dress.deposit)} deposit</span>
                      </p>
                      {line.dress.slug ? (
                        <Link
                          href={`/dress/${line.dress.slug}`}
                          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-mulberry hover:underline"
                        >
                          <CalendarDays className="size-3.5" strokeWidth={2} aria-hidden />
                          Change size or dates
                        </Link>
                      ) : null}
                    </div>

                    {!line.available ? (
                      <p role="alert" className="mt-3 rounded-lg border border-gold/50 bg-gold/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">
                        {line.issue}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
              <h2 className="font-serif text-2xl text-ink">The ledger</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Rentals</dt>
                  <dd className="font-bold text-ink">{formatMoney(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Refundable deposit</dt>
                  <dd className="text-ink-muted">{formatMoney(depositTotal)}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2.5 text-base">
                  <dt className="font-bold text-ink">Due at checkout</dt>
                  <dd className="font-bold text-ink">{formatMoney(subtotal)}</dd>
                </div>
              </dl>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                Deposits are authorized but never captured unless something comes back damaged. Insurance and accessories are offered at
                checkout.
              </p>

              {anyUnavailable ? (
                <div className="mt-5">
                  <p className="rounded-lg border border-gold/50 bg-gold/10 px-3.5 py-3 text-[13px] leading-relaxed text-ink">
                    One of your pieces needs a new date or size before checkout — the studio cannot hold it as it stands.
                  </p>
                  <Link
                    href="/shop"
                    className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full border border-line-strong bg-surface text-sm font-bold text-ink transition-colors hover:bg-surface-muted"
                  >
                    Find something else
                  </Link>
                </div>
              ) : (
                <Link
                  href="/checkout"
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-bold text-accent-ink shadow-soft transition-colors hover:bg-accent-hover"
                >
                  Continue to checkout
                  <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
                </Link>
              )}

              <ul className="mt-5 space-y-2 border-t border-line pt-4 text-xs leading-relaxed text-ink-muted">
                <li>Free two-way shipping and a prepaid return label in the box.</li>
                <li>Professional cleaning after every rental, always included.</li>
                <li>Free size exchanges while the first dress is still in transit.</li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
