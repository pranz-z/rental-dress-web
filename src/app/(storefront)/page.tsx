import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Quote } from 'lucide-react'
import { prisma } from '@/lib/db'
import { formatMoney } from '@/lib/money'
import { currentCustomer } from '@/lib/storefront/session'
import { facetsFor, featuredDresses, loadCatalog, trendingDresses, shopHref } from '@/lib/storefront/catalog'
import { DateSearch } from '@/components/storefront/date-search'
import { DressCard } from '@/components/storefront/dress-card'
import { GarmentImage } from '@/components/storefront/garment'
import { NewsletterForm } from '@/components/storefront/newsletter-form'
import { Rail } from '@/components/storefront/rail'

export const metadata: Metadata = {
  title: 'Designer dress rental in Boston',
  description:
    'Rent designer gowns for weddings, galas and black-tie evenings. Reserve your dates online, we deliver pressed to your door and take care of cleaning and returns.',
}

const TILE_OCCASIONS = [
  { occasion: 'Wedding guest', blurb: 'Silks and midis that never upstage the bride' },
  { occasion: 'Gala', blurb: 'Statement gowns for a room full of candlelight' },
  { occasion: 'Black tie', blurb: 'Floor-sweeping velvet and hand-set beading' },
  { occasion: 'Bridal shower', blurb: 'Soft tulle for the bride-to-be' },
  { occasion: 'Rehearsal dinner', blurb: 'Cocktail length, photograph-ready' },
  { occasion: 'Anniversary', blurb: 'Something worth remembering' },
]

export default async function HomePage() {
  const [catalog, customer, stories] = await Promise.all([
    loadCatalog(),
    currentCustomer(),
    prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { dress: { select: { name: true, slug: true, color: true, colorHex: true, artTone: true, designer: true, occasion: true } } },
    }),
  ])

  const facets = facetsFor(catalog)
  const trending = trendingDresses(catalog, 8)
  const featured = featuredDresses(catalog, 4)
  const savedIds = customer
    ? new Set(
        (
          await prisma.favorite.findMany({ where: { customerId: customer.id }, select: { dressId: true } })
        ).map((row) => row.dressId),
      )
    : new Set<string>()

  const tiles = TILE_OCCASIONS.flatMap((tile) => {
    const matches = catalog.dresses.filter((dress) => dress.occasion === tile.occasion)
    if (matches.length === 0) return []
    const hero = [...matches].sort((a, b) => Number(b.featured) - Number(a.featured) || b.timesRented - a.timesRented)[0]!
    return [{ ...tile, count: matches.length, hero }]
  })

  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(85% 90% at 82% 10%, var(--color-blush) 0%, rgba(243,225,225,0) 55%), radial-gradient(70% 80% at 12% 90%, var(--color-cream) 0%, rgba(246,240,236,0) 60%)',
          }}
        />
        <div className="relative mx-auto w-full max-w-[1200px] px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold tracking-[0.24em] text-gold-ink uppercase">Designer dress rental · Boston</p>
            <h1 className="mt-4 font-serif text-[46px] leading-[1.04] text-ink sm:text-[72px]">Wear something unforgettable.</h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-muted">
              The Valentina, the Aurelia, the dress you have been picturing — reserved for your date, delivered pressed to your door, and
              returned with a label we have already paid for.
            </p>
            <div className="mt-8">
              <a
                href="#find-your-date"
                className="inline-flex h-13 items-center gap-2.5 rounded-full bg-accent px-8 text-[15px] font-bold tracking-wide text-accent-ink shadow-lift transition-colors hover:bg-accent-hover"
              >
                Find your dress
                <ArrowRight className="size-4.5" strokeWidth={2} aria-hidden />
              </a>
            </div>
          </div>

          <div id="find-your-date" className="mt-12 max-w-4xl scroll-mt-24">
            <DateSearch occasions={facets.occasions.map((entry) => entry.value)} sizes={facets.sizes} />
            <p className="mt-2.5 text-xs leading-relaxed text-ink-muted">
              The calendar knows what is free — searched against every held reservation, prep and cleaning day.
            </p>
          </div>
        </div>
      </section>

      {/* shop by occasion */}
      <section aria-labelledby="occasions" className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-gold-ink uppercase">Where are you going?</p>
            <h2 id="occasions" className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
              Dress for the invitation
            </h2>
          </div>
          <Link href="/shop" className="text-sm font-bold text-mulberry hover:underline">
            See the whole collection →
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {tiles.map((tile) => (
            <Link
              key={tile.occasion}
              href={shopHref({ sort: 'recommended', page: 1 }, { occasion: tile.occasion })}
              className="group rounded-xl outline-offset-4"
            >
              <GarmentImage
                name={tile.hero.name}
                designer={tile.hero.designer}
                color={tile.hero.color}
                colorHex={tile.hero.colorHex}
                artTone={tile.hero.artTone}
                view="ON_BODY"
                className="aspect-[3/4] w-full transition-transform duration-300 group-hover:-translate-y-1"
              />
              <p className="mt-2.5 font-serif text-lg leading-snug text-ink group-hover:text-mulberry">{tile.occasion}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                {tile.blurb} · {tile.count} {tile.count === 1 ? 'piece' : 'pieces'}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* trending */}
      <section aria-labelledby="trending" className="border-y border-line bg-surface-muted/40 py-16">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-gold-ink uppercase">On the road right now</p>
              <h2 id="trending" className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
                Most-worn this season
              </h2>
            </div>
            <Link href="/shop?sort=rented" className="text-sm font-bold text-mulberry hover:underline">
              All most-rented →
            </Link>
          </div>

          <Rail ariaLabel="Most-worn dresses" className="mt-8">
            {trending.map((dress) => (
              <div key={dress.id} className="w-[210px] shrink-0 snap-start sm:w-[240px]">
                <DressCard dress={dress} saved={savedIds.has(dress.id)} signedIn={Boolean(customer)} />
              </div>
            ))}
          </Rail>
        </div>
      </section>

      {/* new arrivals — editorial split */}
      {featured.length > 0 ? (
        <section aria-labelledby="new" className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-gold-ink uppercase">Just arrived</p>
              <h2 id="new" className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
                New to the Newbury Street racks
              </h2>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-muted">
                Four or five pieces join the collection most months — often one at a time, often gone by the weekend. The newest are below;
                a stylist can tell you what is coming next.
              </p>
              <Link href="/shop?sort=newest" className="mt-5 inline-block text-sm font-bold text-mulberry hover:underline">
                See all new arrivals →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
              {featured.map((dress) => (
                <DressCard key={dress.id} dress={dress} saved={savedIds.has(dress.id)} signedIn={Boolean(customer)} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* how it works */}
      <section aria-labelledby="how" className="border-y border-line bg-surface py-16">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-bold tracking-[0.2em] text-gold-ink uppercase">Effortless by design</p>
          <h2 id="how" className="mt-2 max-w-xl font-serif text-3xl leading-tight text-ink sm:text-4xl">
            Choose it. Wear it. Send it back.
          </h2>

          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Choose',
                copy: 'Pick your dress, choose a size — with a backup if you are between two — and drop your event date on the live calendar. It only offers what the studio can promise.',
              },
              {
                step: '02',
                title: 'Wear',
                copy: 'The dress arrives the day before your event, steamed and boxed with the prepaid return label. Insurance and a styling hand are one tap away at checkout.',
              },
              {
                step: '03',
                title: 'Return',
                copy: 'Drop the box at any UPS point by your return date. Cleaning, inspection and the deposit ride are handled by the studio.',
              },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border border-line bg-surface-muted/40 p-6">
                <p className="font-serif text-3xl text-gold-ink">{item.step}</p>
                <h3 className="mt-3 font-serif text-2xl text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.copy}</p>
              </div>
            ))}
          </div>

          <Link href="/how-it-works" className="mt-8 inline-block text-sm font-bold text-mulberry hover:underline">
            The details, hour by hour →
          </Link>
        </div>
      </section>

      {/* customer stories */}
      {stories.length > 0 ? (
        <section aria-labelledby="stories" className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-gold-ink uppercase">Weddings, galas, Tuesdays</p>
              <h2 id="stories" className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
                Worn by you, reviewed honestly
              </h2>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
              Every note below is from a verified rental. The dresses keep their stories; the fit advice keeps.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {stories.map((story) => (
              <figure key={story.id} className="flex flex-col rounded-xl border border-line bg-surface">
                <Link href={`/dress/${story.dress.slug}`} className="group" tabIndex={-1} aria-hidden>
                  <GarmentImage
                    name={story.dress.name}
                    designer={story.dress.designer}
                    color={story.dress.color}
                    colorHex={story.dress.colorHex}
                    artTone={story.dress.artTone}
                    view="MOVEMENT"
                    className="aspect-[3/4] w-full rounded-b-none border-0 transition-transform duration-300 group-hover:-translate-y-0.5"
                  />
                </Link>
                <figcaption className="flex flex-1 flex-col p-3.5">
                  <Quote className="size-3.5 text-gold-ink" strokeWidth={2} aria-hidden />
                  <blockquote className="mt-1.5 line-clamp-4 text-[13px] leading-relaxed text-ink">“{story.title}”</blockquote>
                  <p className="mt-auto pt-2 text-[11px] leading-snug text-ink-muted">
                    <span className="font-bold text-ink">{story.customerName}</span>
                    <br />
                    {story.occasion ?? story.dress.occasion} ·{' '}
                    <Link href={`/dress/${story.dress.slug}`} className="hover:text-mulberry hover:underline">
                      {story.dress.name}
                    </Link>
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {/* membership + newsletter */}
      <section aria-labelledby="club" className="mx-auto w-full max-w-[1200px] px-4 pb-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-line" style={{ background: 'linear-gradient(120deg, #6d3745 0%, #7a3e4d 55%, #8f5866 100%)' }}>
          <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-[11px] font-bold tracking-[0.24em] text-blush uppercase">Paris Club membership</p>
              <h2 id="club" className="mt-3 font-serif text-3xl leading-tight text-ivory sm:text-4xl">
                Rent like it is your own wardrobe.
              </h2>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-blush/90">
                Three rentals a month, a stylist who knows your measurements, first look at new arrivals and standing credit toward every
                evening out. From $89 a month.
              </p>
              <Link
                href="/membership"
                className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-ivory px-7 text-sm font-bold text-mulberry transition-colors hover:bg-blush"
              >
                Explore membership
                <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
              </Link>
            </div>
            <div className="rounded-2xl border border-ivory/15 bg-ivory/10 p-6 backdrop-blur-sm sm:p-7">
              <p className="font-serif text-2xl text-ivory">Letters from the studio</p>
              <p className="mt-1.5 text-sm leading-relaxed text-blush/85">
                New arrivals, private sale days and the occasional dress with a story. Twice a month, never more.
              </p>
              <div className="mt-5">
                <NewsletterForm source="home" dark />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* quiet reassurance strip */}
      <section aria-label="What is included" className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-[13px] font-bold text-ink-muted">
          <span>Free two-way shipping</span>
          <span aria-hidden className="text-gold">·</span>
          <span>Cleaning and pressing included</span>
          <span aria-hidden className="text-gold">·</span>
          <span>Refundable deposits, never hidden</span>
          <span aria-hidden className="text-gold">·</span>
          <span>From {formatMoney(Math.min(...catalog.dresses.map((dress) => dress.rentalPrice4)))} a rental</span>
        </div>
      </section>
    </>
  )
}
