/**
 * A dress in a grid — shop, home rails, favorites. One card, one image
 * component, one price language ("Rent $185 · retail $1,450").
 */
import Link from 'next/link'
import { formatMoney } from '@/lib/money'
import type { CatalogDress } from '@/lib/storefront/catalog'
import { Chip } from '@/components/ui/chip'
import { GarmentImage } from './garment'
import { WishlistHeart } from './wishlist-heart'

export function DressCard({
  dress,
  saved = false,
  signedIn = false,
  eventDate,
  available,
  sizesLeft,
  className,
}: {
  dress: CatalogDress
  saved?: boolean
  signedIn?: boolean
  /** ISO day the visitor is shopping for, when chosen. */
  eventDate?: string | null
  available?: { available: boolean; availableSizes: string[] }
  sizesLeft?: string[]
  className?: string
}) {
  const sizesToShow = available?.availableSizes ?? sizesLeft ?? dress.sizes

  return (
    <div className={className}>
      <div className="relative">
        <Link
          href={`/dress/${dress.slug}`}
          className="group block rounded-xl outline-offset-4"
          aria-label={`${dress.name} by ${dress.designer} — view details`}
        >
          <GarmentImage
            name={dress.name}
            designer={dress.designer}
            color={dress.color}
            colorHex={dress.colorHex}
            artTone={dress.artTone}
            view="FRONT"
            className="aspect-[3/4] w-full transition-transform duration-300 group-hover:-translate-y-0.5"
          />
        </Link>
        <WishlistHeart dressId={dress.id} dressName={dress.name} saved={saved} signedIn={signedIn} className="absolute top-3 right-3" />
        {eventDate && available ? (
          <div className="absolute bottom-3 left-3">
            <Chip tone="sage" dot>
              Available for your date
            </Chip>
          </div>
        ) : null}
        {dress.isNewArrival && !eventDate ? (
          <div className="absolute bottom-3 left-3">
            <Chip tone="gold">New arrival</Chip>
          </div>
        ) : null}
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-[10px] font-bold tracking-[0.18em] text-ink-muted uppercase">{dress.designer}</p>
        <Link href={`/dress/${dress.slug}`} className="block font-serif text-lg leading-snug text-ink hover:text-mulberry">
          {dress.name}
        </Link>
        <p className="text-sm text-ink">
          Rent <span className="font-bold">{formatMoney(dress.rentalPrice4)}</span>
          <span className="text-ink-muted"> · retail {formatMoney(dress.retailValue)}</span>
        </p>
        <p className="text-xs text-ink-muted">
          {sizesToShow.length > 0 ? `Sizes ${sizesToShow.join(' · ')}` : 'No sizes in rotation'}
          {eventDate && dress.reviewRating ? ` — ${dress.reviewRating.toFixed(1)} ★` : ''}
        </p>
      </div>
    </div>
  )
}
