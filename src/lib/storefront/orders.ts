/**
 * Storefront checkout — where a cart becomes a studio booking.
 *
 * Everything is re-verified inside one transaction at submit time: the dress
 * still exists and is rented out, the size is still carried, the window is
 * still free under the studio's own availability rules (prep, buffer, blocks,
 * live rentals). The dress row is locked while that check runs, so two
 * customers racing for the same dress and dates resolve to exactly one
 * success — the other receives friendly alternatives.
 *
 * Prices are only ever read from the database here, never from the cart.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { addDays, formatMonthDay, toDay, todayUtc } from '@/lib/dates'
import { recordAudit } from '@/lib/audit'
import { createAuthorizationIntent, internalPaymentRef, stripeConfigured, validateCardDetails } from '@/lib/payments'
import { sendBookingReceivedEmail } from '@/lib/notifications'
import { autoConfirmBooking } from '@/lib/bookings'
import { depositFor, rentalPriceFor } from '@/lib/pricing'
import { parseDeliveryZones, zoneByName } from '@/lib/delivery'
import { readCart, type CartItem } from './cart'
import {
  STOREFRONT_BOOKING_HORIZON_DAYS,
  availabilityFor,
  buildAlternatives,
  loadStorefrontOccupancies,
  storefrontWindow,
} from './availability'

export class StorefrontError extends Error {
  suggestions: string[]
  constructor(message: string, suggestions: string[] = []) {
    super(message)
    this.suggestions = suggestions
  }
}

export type CheckoutItemExtras = {
  insurance: boolean
  accessoryIds: string[]
  express: boolean
  pickup: boolean
}

export type CheckoutContact = {
  name: string
  email: string
  phone?: string
  addressLine1: string
  addressLine2?: string
  city: string
  region: string
  postalCode: string
  country: string
  notes?: string
}

export type PlaceOrderInput = {
  contact: CheckoutContact
  items: CheckoutItemExtras[]
  card?: { number: string; expiry: string; cvc: string }
  method: 'CARD' | 'APPLE_PAY' | 'GOOGLE_PAY'
  /** Delivery zone name chosen at checkout — fee comes from StudioSettings, never the client. */
  zone?: string
  customerId?: string | null
}

export type PlacedBooking = { id: string; total: number; deposit: number }

export type PlaceOrderResult = {
  bookings: PlacedBooking[]
  /** Present when Stripe is configured and each card must be confirmed client-side. */
  stripe?: { intents: Array<{ bookingId: string; clientSecret: string | null; amount: number }> }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function assertContact(input: CheckoutContact): CheckoutContact {
  const contact = {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || undefined,
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2?.trim() || undefined,
    city: input.city.trim(),
    region: input.region.trim(),
    postalCode: input.postalCode.trim(),
    country: input.country.trim() || 'United States',
    notes: input.notes?.trim() || undefined,
  }
  if (contact.name.length < 2) throw new StorefrontError('Please share the name the courier should ask for.')
  if (contact.name.length > 120) throw new StorefrontError('That name is longer than the form can hold.')
  if (!EMAIL_PATTERN.test(contact.email)) throw new StorefrontError('That email address does not look right — check it and try again.')
  if (contact.addressLine1.length < 4) throw new StorefrontError('Please add the street address the dress should arrive at.')
  if (contact.city.length < 2) throw new StorefrontError('Please add your city.')
  if (contact.region.length < 2) throw new StorefrontError('Please add your state or region.')
  if (!/^[A-Za-z0-9 -]{3,12}$/.test(contact.postalCode)) throw new StorefrontError('That postal code does not look right.')
  if (contact.notes && contact.notes.length > 1000) throw new StorefrontError('Notes are limited to 1,000 characters.')
  return contact
}

async function nextBookingId(tx: Prisma.TransactionClient): Promise<string> {
  const latest = await tx.booking.findMany({ orderBy: { createdAt: 'desc' }, take: 60, select: { id: true } })
  const max = latest.reduce((best, row) => {
    const parsed = Number.parseInt(row.id.replace(/^MR-/, ''), 10)
    return Number.isFinite(parsed) && parsed > best ? parsed : best
  }, 2800)
  return `MR-${max + 1}`
}

type PricedItem = {
  item: CartItem
  dressId: string
  dressName: string
  dressSlug: string
  deposit: number
  deliveryDate: Date
  returnDate: Date
  subtotal: number
  addOnTotal: number
  insuranceFee: number
  total: number
  addOns: Array<{ accessoryId: string | null; label: string; amount: number }>
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const contact = assertContact(input.contact)
  const cart = await readCart()
  if (cart.length === 0) throw new StorefrontError('Your cart is empty — find a dress you love first.')

  const settings = await prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } })
  const accessories = await prisma.accessory.findMany({ where: { active: true } })
  const accessoryById = new Map(accessories.map((accessory) => [accessory.id, accessory]))
  const insuranceAccessory = accessories.find((accessory) => accessory.name === 'Rental insurance')
  const backupAccessory = accessories.find((accessory) => accessory.name === 'Backup size')
  const expressAccessory = accessories.find((accessory) => accessory.name === 'Express courier delivery')
  const pickupAccessory = accessories.find((accessory) => accessory.name === 'Return-day pickup')

  // Delivery zones come from Settings → Hours & delivery; the client only ever
  // sends a zone name.
  const zones = parseDeliveryZones(settings.deliveryZones)
  const chosenZone = zoneByName(zones, input.zone)
  if (zones.length > 0 && !chosenZone) {
    throw new StorefrontError('Choose a delivery zone so the studio can route your parcel.')
  }

  const today = todayUtc()
  const earliestDelivery = addDays(today, 1)

  // ── price everything from the database ──────────────────────────────────
  const dresses = await prisma.dress.findMany({
    where: { id: { in: [...new Set(cart.map((item) => item.dressId))] } },
    include: { sizes: true },
  })
  const dressById = new Map(dresses.map((dress) => [dress.id, dress]))

  const priced: PricedItem[] = cart.map((item, index) => {
    const dress = dressById.get(item.dressId)
    if (!dress) throw new StorefrontError('One of your dresses has left the wardrobe — remove it from the cart and try again.')
    if (dress.status === 'RETIRED') throw new StorefrontError(`${dress.name} has been retired from the collection — remove it from the cart.`)
    if (!dress.sizes.some((size) => size.size === item.size)) {
      throw new StorefrontError(`Size ${item.size} is no longer carried in the ${dress.name} — pick another size.`)
    }
    if (item.backupSize && !dress.sizes.some((size) => size.size === item.backupSize)) {
      throw new StorefrontError(`Backup size ${item.backupSize} is not carried in the ${dress.name}.`)
    }

    const eventDate = toDay(item.eventDate)
    const { deliveryDate, returnDate } = storefrontWindow(eventDate, item.rentalDays)
    if (deliveryDate.getTime() < earliestDelivery.getTime()) {
      throw new StorefrontError(`The ${dress.name} needs a day in the studio before your event — pick an event date from ${formatMonthDay(addDays(today, 2))}.`)
    }
    if (eventDate.getTime() > addDays(today, STOREFRONT_BOOKING_HORIZON_DAYS).getTime()) {
      throw new StorefrontError('The studio takes reservations up to four months ahead — pick a closer date.')
    }

    const extras = input.items[index] ?? { insurance: false, accessoryIds: [], express: false, pickup: false }
    const subtotal = rentalPriceFor(dress.retailValue, item.rentalDays, settings)
    const addOns: PricedItem['addOns'] = []
    let addOnTotal = 0

    if (index === 0 && chosenZone && chosenZone.fee > 0) {
      addOns.push({
        accessoryId: null,
        label: `Delivery — ${chosenZone.name} (${chosenZone.courier})`,
        amount: chosenZone.fee,
      })
      addOnTotal += chosenZone.fee
    }

    if (item.backupSize) {
      const amount = backupAccessory?.price ?? 2500
      addOns.push({ accessoryId: backupAccessory?.id ?? null, label: `Backup size — ${item.backupSize}`, amount })
      addOnTotal += amount
    }
    for (const accessoryId of [...new Set(extras.accessoryIds)]) {
      const accessory = accessoryById.get(accessoryId)
      if (!accessory || accessory.category === 'COVERAGE') continue
      if (accessory.id === expressAccessory?.id || accessory.id === pickupAccessory?.id) continue
      addOns.push({ accessoryId: accessory.id, label: accessory.name, amount: accessory.price })
      addOnTotal += accessory.price
    }
    if (extras.express && expressAccessory) {
      addOns.push({ accessoryId: expressAccessory.id, label: expressAccessory.name, amount: expressAccessory.price })
      addOnTotal += expressAccessory.price
    }
    if (extras.pickup && pickupAccessory) {
      addOns.push({ accessoryId: pickupAccessory.id, label: pickupAccessory.name, amount: pickupAccessory.price })
      addOnTotal += pickupAccessory.price
    }

    const insuranceFee = extras.insurance ? insuranceAccessory?.price ?? settings.insuranceFee : 0
    const total = subtotal + addOnTotal + insuranceFee

    return {
      item,
      dressId: dress.id,
      dressName: dress.name,
      dressSlug: dress.slug,
      deposit: depositFor(dress.retailValue, settings),
      deliveryDate,
      returnDate,
      subtotal,
      addOnTotal,
      insuranceFee,
      total,
      addOns,
    }
  })

  // Card details are checked before the ledger is touched, in both modes.
  let cardLast4: string | null = null
  let paymentRef: string | null = null
  const stripeMode = stripeConfigured()
  if (!stripeMode) {
    if (input.method !== 'CARD') {
      throw new StorefrontError('Apple Pay and Google Pay appear here once the studio’s payment keys are live — use the card form for now.')
    }
    if (!input.card) throw new StorefrontError('Add your card details to hold the reservation.')
    try {
      cardLast4 = validateCardDetails(input.card).last4
    } catch (error) {
      const field = error instanceof Error ? error.message : ''
      throw new StorefrontError(
        field === 'card-expiry'
          ? 'That expiry date does not look right — use MM / YY with a future date.'
          : field === 'card-cvc'
            ? 'The security code should be the 3 or 4 digits on the back of the card.'
            : 'That card number does not look right — check the digits and try again.',
      )
    }
    paymentRef = internalPaymentRef()
  }

  const lockIds = [...new Set(priced.map((entry) => entry.dressId))].sort()

  const bookingIds = await prisma.$transaction(async (tx) => {
    // Serialize checkouts per dress so two customers cannot both win.
    for (const dressId of lockIds) {
      await tx.$queryRaw`SELECT id FROM "Dress" WHERE id = ${dressId} FOR UPDATE`
    }

    // Re-read occupancies under the lock — the same engine the studio runs.
    const occupancies = await loadStorefrontOccupancies(tx, lockIds, settings.prepDays, settings.bufferDays)

    for (const entry of priced) {
      const dress = dressById.get(entry.dressId)!
      const result = availabilityFor(
        occupancies.get(entry.dressId) ?? [],
        entry.deliveryDate,
        entry.returnDate,
        entry.item.size,
        settings.prepDays,
        settings.bufferDays,
      )
      if (!result.available) {
        const suggestions = buildAlternatives({
          dressName: dress.name,
          occupancies: occupancies.get(entry.dressId) ?? [],
          sizes: dress.sizes.map((size) => size.size),
          size: entry.item.size,
          rentalDays: entry.item.rentalDays,
          deliveryDate: entry.deliveryDate,
          returnDate: entry.returnDate,
          prepDays: settings.prepDays,
          bufferDays: settings.bufferDays,
        })
        throw new StorefrontError(
          `The ${dress.name} in size ${entry.item.size} was reserved for ${formatMonthDay(entry.deliveryDate)} – ${formatMonthDay(entry.returnDate)} while you were checking out.`,
          suggestions,
        )
      }
      if (entry.item.backupSize) {
        const backup = availabilityFor(
          occupancies.get(entry.dressId) ?? [],
          entry.deliveryDate,
          entry.returnDate,
          entry.item.backupSize,
          settings.prepDays,
          settings.bufferDays,
        )
        if (!backup.available) {
          throw new StorefrontError(
            `The backup size ${entry.item.backupSize} for the ${dress.name} is taken those days — drop the backup or choose another size.`,
          )
        }
      }
    }

    // Match the customer book by email, or open a guest profile.
    let customerId = input.customerId ?? null
    if (customerId) {
      const existing = await tx.customer.findUnique({ where: { id: customerId }, select: { id: true } })
      if (!existing) customerId = null
    }
    if (!customerId) {
      const matched = await tx.customer.findFirst({
        where: { email: { equals: contact.email, mode: 'insensitive' } },
        select: { id: true },
      })
      if (matched) customerId = matched.id
      else {
        const created = await tx.customer.create({
          data: {
            name: contact.name,
            email: contact.email,
            phone: contact.phone ?? null,
            tier: 'GUEST',
            addressLine1: contact.addressLine1,
            addressLine2: contact.addressLine2 ?? null,
            city: contact.city,
            region: contact.region,
            postalCode: contact.postalCode,
            country: contact.country,
            marketingOptIn: false,
          },
          select: { id: true },
        })
        customerId = created.id
      }
    }

    const createdIds: string[] = []
    for (const entry of priced) {
      let id = await nextBookingId(tx)
      for (let attempt = 0; ; attempt += 1) {
        const clash = await tx.booking.findUnique({ where: { id }, select: { id: true } })
        if (!clash) break
        if (attempt >= 5) throw new StorefrontError('The studio ledger is busy — try again in a moment.')
        id = await nextBookingId(tx)
      }

      await tx.booking.create({
        data: {
          id,
          customerId,
          dressId: entry.dressId,
          size: entry.item.size,
          backupSize: entry.item.backupSize,
          eventType: dressById.get(entry.dressId)!.occasion,
          eventDate: toDay(entry.item.eventDate),
          deliveryDate: entry.deliveryDate,
          returnDate: entry.returnDate,
          rentalDays: entry.item.rentalDays,
          bufferDays: settings.bufferDays,
          status: 'PENDING',
          subtotal: entry.subtotal,
          addOnTotal: entry.addOnTotal,
          insuranceFee: entry.insuranceFee,
          total: entry.total,
          deposit: entry.deposit,
          paymentStatus: stripeMode ? 'UNPAID' : 'AUTHORIZED',
          depositStatus: 'NONE',
          paymentRef,
          paymentMethod: 'CARD',
          shipName: contact.name,
          addressLine1: contact.addressLine1,
          addressLine2: contact.addressLine2 ?? null,
          city: contact.city,
          region: contact.region,
          postalCode: contact.postalCode,
          country: contact.country,
          notes: contact.notes ?? null,
        },
      })

      if (entry.addOns.length > 0) {
        await tx.bookingAddOn.createMany({
          data: entry.addOns.map((addOn) => ({
            bookingId: id,
            accessoryId: addOn.accessoryId,
            label: addOn.label,
            amount: addOn.amount,
            quantity: 1,
          })),
        })
      }

      if (!stripeMode) {
        const payments: Prisma.PaymentCreateManyInput[] = [
          {
            bookingId: id,
            customerId,
            kind: 'RENTAL',
            amount: entry.subtotal,
            status: 'AUTHORIZED',
            provider: 'STUDIO',
            method: 'CARD',
            providerRef: paymentRef,
            cardLast4,
            note: 'Authorized at checkout — captured when the studio confirms',
          },
        ]
        if (entry.addOnTotal > 0) {
          payments.push({ bookingId: id, customerId, kind: 'ADD_ON', amount: entry.addOnTotal, status: 'AUTHORIZED', provider: 'STUDIO', method: 'CARD', providerRef: paymentRef, cardLast4 })
        }
        if (entry.insuranceFee > 0) {
          payments.push({ bookingId: id, customerId, kind: 'INSURANCE', amount: entry.insuranceFee, status: 'AUTHORIZED', provider: 'STUDIO', method: 'CARD', providerRef: paymentRef, cardLast4 })
        }
        if (entry.deposit > 0) {
          payments.push({ bookingId: id, customerId, kind: 'DEPOSIT', amount: entry.deposit, status: 'AUTHORIZED', provider: 'STUDIO', method: 'CARD', providerRef: paymentRef, cardLast4, note: 'Refundable damage deposit' })
        }
        await tx.payment.createMany({ data: payments })
      }

      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          type: 'CREATED',
          toValue: 'PENDING',
          summary: 'Reserved on the storefront — awaiting studio confirmation.',
          detail: `${entry.item.rentalDays}-day rental · arrives ${formatMonthDay(entry.deliveryDate)} · due back ${formatMonthDay(entry.returnDate)}`,
          visibleToCustomer: true,
        },
      })

      await recordAudit(tx, {
        staffId: null,
        actorLabel: `${contact.name} (customer)`,
        action: 'booking.created',
        entity: 'Booking',
        entityId: id,
        summary: `Storefront reservation ${id} — ${dressById.get(entry.dressId)!.name} in size ${entry.item.size} for ${formatMonthDay(toDay(entry.item.eventDate))}`,
        metadata: {
          source: 'storefront',
          payment: stripeMode ? 'stripe-intent' : 'authorization-test-gateway',
          total: entry.total,
          deposit: entry.deposit,
        },
      })

      createdIds.push(id)
    }
    return createdIds
  })

  // Stripe mode: one authorization intent per booking, confirmed client-side.
  if (stripeMode) {
    const intents: Array<{ bookingId: string; clientSecret: string | null; amount: number }> = []
    try {
      for (const [index, bookingId] of bookingIds.entries()) {
        const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })
        const amount = booking.total + booking.deposit
        const intent = await createAuthorizationIntent({
          amountCents: amount,
          description: `Maison Rêve ${bookingId} — ${priced[index]!.dressName}`,
          metadata: { bookingId },
          receiptEmail: contact.email,
        })
        await prisma.booking.update({ where: { id: bookingId }, data: { paymentRef: intent.id } })
        intents.push({ bookingId, clientSecret: intent.clientSecret, amount })
      }
    } catch (error) {
      console.error('Stripe intent creation failed:', error)
      for (const id of bookingIds) await sendBookingReceivedEmail(id)
      throw new StorefrontError('The reservation is held, but the payment page could not start — the studio will email you a secure link.')
    }
    for (const id of bookingIds) await sendBookingReceivedEmail(id)
    return {
      bookings: bookingIds.map((id, index) => ({ id, total: priced[index]!.total, deposit: priced[index]!.deposit })),
      stripe: { intents },
    }
  }

  // Settings → Rental rules decides whether a paid, available booking is
  // confirmed on the spot or waits for the studio. Default: wait.
  for (const id of bookingIds) {
    const confirmed = settings.autoConfirmBookings && (await autoConfirmBooking(id))
    if (!confirmed) await sendBookingReceivedEmail(id)
  }

  return {
    bookings: bookingIds.map((id, index) => ({ id, total: priced[index]!.total, deposit: priced[index]!.deposit })),
  }
}

/**
 * Settles a Stripe authorization after the customer confirms on the payment
 * page — the belt to the webhook's braces.
 */
export async function syncStripeBookingPayment(bookingId: string): Promise<boolean> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
  if (!booking?.paymentRef || !booking.paymentRef.startsWith('pi_')) return false
  const { retrieveIntentSnapshot } = await import('@/lib/payments')
  const snapshot = await retrieveIntentSnapshot(booking.paymentRef)
  if (!snapshot) return false
  if (snapshot.status === 'requires_capture' || snapshot.status === 'succeeded' || snapshot.status === 'processing') {
    await prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({ where: { bookingId, status: 'UNPAID' }, data: { status: 'AUTHORIZED', providerRef: booking.paymentRef, cardLast4: snapshot.last4 } })
      await tx.booking.update({ where: { id: bookingId }, data: { paymentStatus: 'AUTHORIZED', paymentMethod: snapshot.method ?? 'CARD' } })
    })
    // Verified payment settled — honour the studio's auto-confirm setting.
    const settings = await prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } })
    if (settings.autoConfirmBookings) await autoConfirmBooking(bookingId)
    return true
  }
  return false
}
