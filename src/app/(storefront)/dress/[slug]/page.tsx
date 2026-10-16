import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BadgeCheck, RefreshCcw, Sparkles, Star, Truck } from 'lucide-react'
import { prisma } from '@/lib/db'
import { addDays, isoDay, todayUtc } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { depositFor, rentalPriceFor } from '@/lib/pricing'
import { currentCustomer } from '@/lib/storefront/session'
import { STOREFRONT_BOOKING_HORIZON_DAYS, busyDays, loadStorefrontOccupancies } from '@/lib/storefront/availability'
import type { CatalogDress } from '@/lib/storefront/catalog'
import { DressGallery } from '@/components/storefront/dress-gallery'
import { DressCard } from '@/components/storefront/dress-card'
import { GarmentImage, GALLERY_VIEWS, garmentAlt, isGarmentView, type GarmentView } from '@/components/storefront/garment'
import { InquiryForm } from '@/components/storefront/inquiry-form'
import { PurchasePanel } from '@/components/storefront/purchase-panel'
import { SaveToList } from '@/components/storefront/save-to-list'
import { Chip } from '@/components/ui/chip'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const [dress, settings] = await Promise.all([
    prisma.dress.findUnique({
      where: { slug },
      select: { name: true, designer: true, story: true, retailValue: true, status: true },
    }),
    prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } }),
  ])
  if (!dress || dress.status === 'RETIRED') return { title: 'Dress not found' }
  return {
    title: `${dress.name} — rent for ${formatMoney(rentalPriceFor(dress.retailValue, 4, settings))}`,
    description: `${dress.story.slice(0, 150)} Rent the ${dress.name} by ${dress.designer} from Maison Rêve, delivered pressed with free returns and cleaning.`,
  }
}

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={className} role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          aria-hidden
          className={step <= Math.round(rating) ? 'inline size-4 fill-gold text-gold' : 'inline size-4 text-line-strong'}
          strokeWidth={1.5}
        />
      ))}
    </span>
  )
}

export default async function DressPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const dress = await prisma.dress.findUnique({
    where: { slug },
    include: {
      sizes: { orderBy: { position: 'asc' } },
      images: { orderBy: { position: 'asc' } },
      reviews: { orderBy: { createdAt: 'desc' } },
      _count: { select: { reviews: true } },
    },
  })
  if (!dress || dress.status === 'RETIRED') notFound()

  const [settings, customer] = await Promise.all([
    prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } }),
    currentCustomer(),
  ])

  const [occupanciesByDress, accessories, related, savedIds, measurements, lists] = await Promise.all([
    loadStorefrontOccupancies(prisma, [dress.id], settings.prepDays, settings.bufferDays),
    prisma.accessory.findMany({
      where: { active: true, OR: [{ dressId: dress.id }, { dressId: null }] },
      orderBy: { price: 'asc' },
    }),
    prisma.dress.findMany({
      where: { occasion: dress.occasion, id: { not: dress.id }, status: { not: 'RETIRED' } },
      include: { sizes: { orderBy: { position: 'asc' } }, reviews: { select: { rating: true } }, _count: { select: { reviews: true } } },
      orderBy: { timesRented: 'desc' },
      take: 4,
    }),
    customer
      ? prisma.favorite
          .findMany({ where: { customerId: customer.id }, select: { dressId: true } })
          .then((rows) => new Set(rows.map((row) => row.dressId)))
      : Promise.resolve(new Set<string>()),
    customer ? prisma.measurement.findUnique({ where: { customerId: customer.id } }) : Promise.resolve(null),
    customer
      ? prisma.eventList.findMany({ where: { customerId: customer.id }, select: { id: true, name: true }, orderBy: { createdAt: 'desc' } })
      : Promise.resolve([]),
  ])

  const occupancies = occupanciesByDress.get(dress.id) ?? []
  const price4 = rentalPriceFor(dress.retailValue, 4, settings)
  const price8 = rentalPriceFor(dress.retailValue, 8, settings)
  const deposit = depositFor(dress.retailValue, settings)
  const today = todayUtc()
  const minDay = isoDay(addDays(today, 2))
  const maxDay = isoDay(addDays(today, STOREFRONT_BOOKING_HORIZON_DAYS))
  const minIso = isoDay(today)
  const maxIso = isoDay(addDays(today, STOREFRONT_BOOKING_HORIZON_DAYS + 8))

  const busyBySize: Record<string, string[]> = {}
  for (const size of dress.sizes) {
    busyBySize[size.size] = [...busyDays(occupancies, size.size)].filter((iso) => iso >= minIso && iso <= maxIso)
  }

  const galleryViews: Array<{ kind: GarmentView; alt: string }> = dress.images
    .filter((image) => isGarmentView(image.kind))
    .map((image) => ({ kind: image.kind as GarmentView, alt: image.alt }))
  const views =
    galleryViews.length > 0
      ? galleryViews
      : GALLERY_VIEWS.map((kind) => ({
          kind,
          alt: garmentAlt({ name: dress.name, designer: dress.designer, color: dress.color, view: kind }),
        }))

  const backupAccessory = accessories.find((accessory) => accessory.name === 'Backup size')
  const backupFee = backupAccessory?.price ?? 2500
  const addOnAccessories = accessories.filter((accessory) => accessory.name !== 'Backup size')

  const reviewCount = dress._count.reviews
  const rating = reviewCount > 0 ? dress.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount : null
  const defaultSize = measurements?.dressSizeLabel ?? null

  const relatedDresses: CatalogDress[] = related.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    designer: row.designer,
    category: row.category,
    occasion: row.occasion,
    color: row.color,
    colorHex: row.colorHex,
    length: row.length,
    neckline: row.neckline,
    sleeve: row.sleeve,
    fabric: row.fabric,
    retailValue: row.retailValue,
    rentalPrice4: rentalPriceFor(row.retailValue, 4, settings),
    rentalPrice8: rentalPriceFor(row.retailValue, 8, settings),
    featured: row.featured,
    isNewArrival: row.isNewArrival,
    timesRented: row.timesRented,
    artTone: row.artTone,
    sizes: row.sizes.map((size) => size.size),
    reviewCount: row._count.reviews,
    reviewRating:
      row.reviews.length > 0 ? Math.round((row.reviews.reduce((sum, review) => sum + review.rating, 0) / row.reviews.length) * 10) / 10 : null,
  }))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: dress.name,
    description: dress.story,
    brand: { '@type': 'Brand', name: dress.designer },
    color: dress.color,
    material: dress.fabric,
    category: dress.category,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: (price4 / 100).toFixed(2),
      availability: 'https://schema.org/InStock',
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dress/${dress.slug}`,
    },
    ...(rating && reviewCount > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rating.toFixed(1), reviewCount } }
      : {}),
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="mb-6 text-[13px] text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-mulberry">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/shop" className="hover:text-mulberry">
              Shop
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="font-bold text-ink">
            {dress.name}
          </li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <DressGallery views={views} name={dress.name} designer={dress.designer} color={dress.color} colorHex={dress.colorHex} artTone={dress.artTone} />

        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[11px] font-bold tracking-[0.2em] text-ink-muted uppercase">{dress.designer}</p>
          <h1 className="mt-1.5 font-serif text-4xl leading-tight text-ink sm:text-[44px]">{dress.name}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-muted">
            {rating ? (
              <span className="flex items-center gap-2">
                <Stars rating={rating} />
                <span>
                  {rating.toFixed(1)} · {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                </span>
              </span>
            ) : (
              <span>New to the wardrobe</span>
            )}
            <span aria-hidden>·</span>
            <span>{dress.occasion}</span>
            <span aria-hidden>·</span>
            <span>
              {dress.color}, {dress.length.toLowerCase()}
            </span>
          </div>

          <p className="mt-4 text-[15px] leading-relaxed text-ink">
            Rent <span className="font-bold">{formatMoney(price4)}</span> for four days{' '}
            <span className="text-ink-muted">· eight days {formatMoney(price8)} · retail {formatMoney(dress.retailValue)}</span>
          </p>

          <p className="mt-4 text-sm leading-relaxed text-ink-muted">{dress.story}</p>

          <div className="mt-7">
            <PurchasePanel
              dressId={dress.id}
              dressName={dress.name}
              sizes={dress.sizes.map((size) => size.size)}
              price4={price4}
              price8={price8}
              deposit={deposit}
              backupFee={backupFee}
              busyBySize={busyBySize}
              minDay={minDay}
              maxDay={maxDay}
              defaultSize={defaultSize}
            />
          </div>

          {customer ? (
            <div className="mt-6">
              <SaveToList
                dressId={dress.id}
                dressName={dress.name}
                sizes={dress.sizes.map((size) => size.size)}
                lists={lists}
                defaultSize={defaultSize}
              />
            </div>
          ) : null}

          <div className="mt-7 grid gap-2.5 border-t border-line pt-6 text-[13px] text-ink-muted sm:grid-cols-2">
            <p className="flex items-center gap-2">
              <Truck className="size-4 text-gold-ink" strokeWidth={1.75} aria-hidden /> Free two-way shipping, insured
            </p>
            <p className="flex items-center gap-2">
              <Sparkles className="size-4 text-gold-ink" strokeWidth={1.75} aria-hidden /> Cleaned and pressed before it arrives
            </p>
            <p className="flex items-center gap-2">
              <RefreshCcw className="size-4 text-gold-ink" strokeWidth={1.75} aria-hidden /> Free exchanges while it ships
            </p>
            <p className="flex items-center gap-2">
              <BadgeCheck className="size-4 text-gold-ink" strokeWidth={1.75} aria-hidden /> Fit advice from a stylist
            </p>
          </div>

          <details className="group mt-6 rounded-xl border border-line bg-surface">
            <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-bold text-ink [&::-webkit-details-marker]:hidden">
              Ask about this dress
              <span className="text-ink-muted transition-transform group-open:rotate-45" aria-hidden>
                ＋
              </span>
            </summary>
            <div className="border-t border-line px-4 py-4 sm:px-5">
              <InquiryForm
                channel="DRESS_PAGE"
                subject={`About the ${dress.name}`}
                topicDefault="SIZING"
                defaultName={customer?.name ?? ''}
                defaultEmail={customer?.email ?? ''}
                context={`${dress.designer} · ${dress.name}`}
                replyTargetHours={settings.replyTargetHours}
              />
            </div>
          </details>
        </div>
      </div>

      {/* fit and care */}
      <section aria-labelledby="fit-care" className="mt-16 grid gap-5 md:grid-cols-2">
        <h2 id="fit-care" className="sr-only">
          Fit and care
        </h2>
        <div className="rounded-xl border border-line bg-surface p-6">
          <h3 className="font-serif text-xl text-ink">Fit notes from the studio</h3>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{dress.fitNotes}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            {dress.neckline} neckline, {dress.sleeve.toLowerCase()} — cut in {dress.fabric.toLowerCase()}.{' '}
            <Link href="/size-guide" className="font-bold text-mulberry hover:underline">
              See how to measure
            </Link>
            .
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-6">
          <h3 className="font-serif text-xl text-ink">Care and wear</h3>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{dress.careNotes}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Cleaning is on us. If a hem catches or a bead slips, tell the studio — small repairs are part of the rental, not a charge.
          </p>
        </div>
      </section>

      {/* reviews */}
      <section aria-labelledby="reviews" className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-gold-ink uppercase">Worn and reviewed</p>
            <h2 id="reviews" className="mt-1.5 font-serif text-3xl text-ink">
              {reviewCount > 0 ? `Notes from ${reviewCount} ${reviewCount === 1 ? 'customer' : 'customers'}` : 'Be the first to wear it'}
            </h2>
          </div>
          {rating ? (
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <Stars rating={rating} /> {rating.toFixed(1)} average
            </p>
          ) : null}
        </div>

        {reviewCount > 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dress.reviews.slice(0, 9).map((review) => (
              <article key={review.id} className="rounded-xl border border-line bg-surface p-5">
                <Stars rating={review.rating} />
                <h3 className="mt-2.5 font-serif text-lg leading-snug text-ink">{review.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{review.body}</p>
                <p className="mt-3 text-xs text-ink-muted">
                  <span className="font-bold text-ink">{review.customerName}</span>
                  {review.occasion ? ` · ${review.occasion}` : ''}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-muted">
            Every review on this page is from a verified rental. Wear it beautifully and you may find your own note here.
          </p>
        )}
      </section>

      {/* accessories */}
      {addOnAccessories.length > 0 ? (
        <section aria-labelledby="accessories" className="mt-16">
          <p className="text-[11px] font-bold tracking-[0.2em] text-gold-ink uppercase">Complete the look</p>
          <h2 id="accessories" className="mt-1.5 font-serif text-3xl text-ink">
            Little things, chosen well
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
            Add these at checkout — they arrive in the same box as the dress, and go back in it.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {addOnAccessories.map((accessory) => (
              <div key={accessory.id} className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface p-5">
                <div>
                  <h3 className="text-sm font-bold text-ink">{accessory.name}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{accessory.description}</p>
                  {accessory.category === 'FIT' || accessory.category === 'COVERAGE' ? (
                    <Chip tone="gold" className="mt-2.5">
                      Choose at checkout
                    </Chip>
                  ) : null}
                </div>
                <p className="shrink-0 text-sm font-bold text-ink">{formatMoney(accessory.price)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* related */}
      {relatedDresses.length > 0 ? (
        <section aria-labelledby="related" className="mt-16">
          <h2 id="related" className="font-serif text-3xl text-ink">
            More for {dress.occasion.toLowerCase()}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {relatedDresses.map((relatedDress) => (
              <DressCard key={relatedDress.id} dress={relatedDress} saved={savedIds.has(relatedDress.id)} signedIn={Boolean(customer)} />
            ))}
          </div>
        </section>
      ) : null}

      {/* how it works strip */}
      <section aria-label="What renting looks like" className="mt-16 rounded-2xl border border-line bg-surface-muted/50 px-6 py-10 sm:px-10">
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            { step: '01', title: 'Choose', copy: 'Pick your dress, size and dates. The calendar shows what the studio can truly promise.' },
            { step: '02', title: 'Wear', copy: 'It arrives pressed with a prepaid return label. Live your evening; we will handle the rest.' },
            { step: '03', title: 'Return', copy: 'Drop the box with any UPS point when you are done. Cleaning and inspection are on us.' },
          ].map((item) => (
            <div key={item.step}>
              <p className="font-serif text-2xl text-gold-ink">{item.step}</p>
              <h3 className="mt-2 font-serif text-xl text-ink">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.copy}</p>
            </div>
          ))}
        </div>
        <Link href="/how-it-works" className="mt-6 inline-block text-sm font-bold text-mulberry hover:underline">
          See how renting works →
        </Link>
      </section>
    </div>
  )
}
