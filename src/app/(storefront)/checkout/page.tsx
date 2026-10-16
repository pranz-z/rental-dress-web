import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarClock } from 'lucide-react'
import { prisma } from '@/lib/db'
import { readCart, hydrateCart } from '@/lib/storefront/cart'
import { currentCustomer } from '@/lib/storefront/session'
import { formatCutoff, parseDeliveryZones } from '@/lib/delivery'
import { stripeConfigured } from '@/lib/payments'
import { CheckoutForm } from './checkout-form'
import type { CheckoutAddOn, CheckoutLine, CheckoutZone } from './state'

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Confirm your details, dates and add-ons — the studio does the rest.',
  robots: { index: false },
}

export default async function CheckoutPage() {
  const items = await readCart()
  if (items.length === 0) redirect('/cart')

  const [{ lines, subtotal }, customer, accessories, settings] = await Promise.all([
    hydrateCart(items),
    currentCustomer(),
    prisma.accessory.findMany({ where: { active: true, category: 'ACCESSORY' }, orderBy: { price: 'asc' } }),
    prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } }),
  ])

  const blocked = lines.filter((line) => !line.available)

  if (blocked.length > 0) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <p className="text-[11px] font-bold tracking-[0.2em] text-gold-ink uppercase">One moment</p>
          <h1 className="mt-2 font-serif text-3xl text-ink">A dress in your bag needs a new plan</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            The calendar moved while your bag was open. Adjust these pieces and checkout will open right up.
          </p>
          <ul className="mt-5 space-y-3">
            {blocked.map((line) => (
              <li key={line.index} className="rounded-xl border border-gold/50 bg-gold/10 px-4 py-3 text-sm leading-relaxed text-ink">
                <span className="font-bold">{line.dress.name}</span> — {line.issue}
                {line.dress.slug ? (
                  <Link href={`/dress/${line.dress.slug}`} className="mt-1 block font-bold text-mulberry hover:underline">
                    Choose a new date or size →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/cart"
              className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
            >
              Back to your bag
            </Link>
            <Link
              href="/shop"
              className="inline-flex h-11 items-center rounded-full border border-line-strong bg-surface px-6 text-sm font-bold text-ink transition-colors hover:bg-surface-muted"
            >
              Browse the collection
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const checkoutLines: CheckoutLine[] = lines.map((line) => ({
    index: line.index,
    dressId: line.dress.id,
    slug: line.dress.slug,
    name: line.dress.name,
    designer: line.dress.designer,
    color: line.dress.color,
    colorHex: line.dress.colorHex,
    artTone: line.dress.artTone,
    size: line.item.size,
    backupSize: line.item.backupSize,
    rentalDays: line.item.rentalDays,
    eventDate: line.item.eventDate,
    deliveryDate: line.deliveryDate,
    returnDate: line.returnDate,
    price: line.dress.rentalPrice,
    deposit: line.dress.deposit,
  }))

  const accessoryRows: CheckoutAddOn[] = accessories.map((accessory) => ({
    id: accessory.id,
    name: accessory.name,
    description: accessory.description,
    price: accessory.price,
    category: 'ACCESSORY',
  }))

  const allAccessories = await prisma.accessory.findMany({ where: { active: true } })
  const byName = (name: string) => allAccessories.find((accessory) => accessory.name === name)

  const fees = {
    insurance: byName('Rental insurance')?.price ?? settings.insuranceFee,
    express: byName('Express courier delivery')?.price ?? 2500,
    pickup: byName('Return-day pickup')?.price ?? 1900,
    backupPerLine: byName('Backup size')?.price ?? 2500,
    cancellationWindowDays: settings.cancellationWindowDays,
    cancellationRefundPercent: settings.cancellationRefundPercent,
  }

  const zones: CheckoutZone[] = parseDeliveryZones(settings.deliveryZones).map((zone) => ({
    name: zone.name,
    courier: zone.courier,
    etaDays: zone.etaDays,
    fee: zone.fee,
    cutoffLabel: formatCutoff(zone.cutoff),
  }))

  const stripeMode = stripeConfigured()

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
      <header className="max-w-2xl">
        <p className="text-[11px] font-bold tracking-[0.2em] text-gold-ink uppercase">Checkout</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight text-ink sm:text-5xl">Nearly yours</h1>
        <p className="mt-3 flex items-center gap-2 text-[15px] leading-relaxed text-ink-muted">
          <CalendarClock className="size-4.5 text-gold-ink" strokeWidth={1.75} aria-hidden />
          {checkoutLines.length === 1
            ? 'One reservation, held the moment you confirm.'
            : `${checkoutLines.length} reservations, held together the moment you confirm.`}{' '}
          Total due today: <span className="font-bold text-ink">${(subtotal / 100).toFixed(2)}</span> — authorized, not captured.
        </p>
      </header>

      <div className="mt-8">
        <CheckoutForm
          lines={checkoutLines}
          accessories={accessoryRows}
          fees={fees}
          zones={zones}
          prefill={
            customer
              ? {
                  name: customer.name,
                  email: customer.email,
                  phone: customer.phone ?? '',
                  addressLine1: customer.addressLine1 ?? '',
                  addressLine2: customer.addressLine2 ?? '',
                  city: customer.city ?? '',
                  region: customer.region ?? '',
                  postalCode: customer.postalCode ?? '',
                  country: customer.country ?? 'United States',
                }
              : null
          }
          stripeMode={stripeMode}
          publishableKey={process.env.STRIPE_PUBLISHABLE_KEY || null}
        />
      </div>
    </div>
  )
}
