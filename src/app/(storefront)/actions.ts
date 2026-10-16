'use server'

/**
 * Public storefront actions — cart, wishlist, inquiries, newsletter.
 *
 * Every action validates server-side, rate-limits by caller, honours a
 * honeypot field, and writes through the shared libraries so the studio sees
 * the same records it would see from its own screens.
 */
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { callerAddress, rateLimit, waitMessage } from '@/lib/rate-limit'
import { addDays, toDay, todayUtc } from '@/lib/dates'
import { InquiryError, createInquiry } from '@/lib/inquiries'
import { AccountError, subscribeToNewsletter, toggleFavorite } from '@/lib/storefront/account'
import { addToCart, cartItemKey, readCart, removeFromCart } from '@/lib/storefront/cart'
import {
  STOREFRONT_BOOKING_HORIZON_DAYS,
  availabilityFor,
  loadStorefrontOccupancies,
  storefrontWindow,
} from '@/lib/storefront/availability'
import { currentCustomer } from '@/lib/storefront/session'
import { isInquiryTopic, type FormState } from './form-state'

function messageFrom(error: unknown, fallback: string): string {
  if (error instanceof InquiryError || error instanceof AccountError) return error.message
  console.error('Storefront action failed:', error)
  return fallback
}

/** Bots fill hidden fields; humans never see them. */
function looksLikeBot(formData: FormData): boolean {
  return String(formData.get('website') ?? '').trim().length > 0
}

// ── cart ──────────────────────────────────────────────────────────────────

export async function addToCartAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const address = await callerAddress()
  const limit = rateLimit(`cart:${address}`, 30, 10 * 60_000)
  if (!limit.ok) return { status: 'error', message: waitMessage(limit.retryAfterSeconds) }
  if (looksLikeBot(formData)) return { status: 'ok', message: 'Added to your bag.' }

  const dressId = String(formData.get('dressId') ?? '')
  const size = String(formData.get('size') ?? '').trim()
  const backupSizeRaw = String(formData.get('backupSize') ?? '').trim()
  const backupSize = backupSizeRaw && backupSizeRaw !== size ? backupSizeRaw : null
  const rentalDays = Number(formData.get('rentalDays') ?? 4) === 8 ? 8 : 4
  const eventDateRaw = String(formData.get('eventDate') ?? '')

  if (!dressId) return { status: 'error', message: 'Choose a dress first.' }
  if (!size) return { status: 'error', message: 'Choose your size so the studio can hold the right one.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDateRaw)) return { status: 'error', message: 'Pick your event date on the calendar.' }

  const eventDate = toDay(eventDateRaw)
  const today = todayUtc()
  if (eventDate.getTime() < addDays(today, 2).getTime()) {
    return { status: 'error', message: 'The studio needs at least a day to prepare the dress — pick a later date.' }
  }
  if (eventDate.getTime() > addDays(today, STOREFRONT_BOOKING_HORIZON_DAYS).getTime()) {
    return { status: 'error', message: 'Reservations open four months ahead — pick a closer date.' }
  }

  const [dress, settings] = await Promise.all([
    prisma.dress.findUnique({ where: { id: dressId }, include: { sizes: true } }),
    prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } }),
  ])
  if (!dress || dress.status === 'RETIRED') return { status: 'error', message: 'That dress is no longer in the collection.' }
  if (!dress.sizes.some((row) => row.size === size)) return { status: 'error', message: `Size ${size} is not carried in this dress.` }
  if (backupSize && !dress.sizes.some((row) => row.size === backupSize)) {
    return { status: 'error', message: `Backup size ${backupSize} is not carried in this dress.` }
  }

  const { deliveryDate, returnDate } = storefrontWindow(eventDate, rentalDays)
  const occupancies = (await loadStorefrontOccupancies(prisma, [dressId], settings.prepDays, settings.bufferDays)).get(dressId) ?? []
  const check = availabilityFor(occupancies, deliveryDate, returnDate, size, settings.prepDays, settings.bufferDays)
  if (!check.available) {
    return {
      status: 'error',
      message: `The ${dress.name} in size ${size} is reserved for ${check.conflictLabel}. Try another date or size.`,
    }
  }
  if (backupSize) {
    const backupCheck = availabilityFor(occupancies, deliveryDate, returnDate, backupSize, settings.prepDays, settings.bufferDays)
    if (!backupCheck.available) {
      return { status: 'error', message: `Backup size ${backupSize} is taken for those dates — choose another backup or leave it off.` }
    }
  }

  const item = { dressId, size, backupSize, rentalDays: rentalDays as 4 | 8, eventDate: eventDateRaw }
  const items = await readCart()
  const key = cartItemKey(item)
  const willReplace = items.some((entry) => cartItemKey(entry) === key)
  const willGrow = !willReplace && items.length >= 6
  if (willGrow) return { status: 'error', message: 'Your bag holds six pieces — check out or remove one to add another.' }

  const { replaced } = await addToCart(item)
  revalidatePath('/cart')
  revalidatePath('/dress/[slug]', 'page')
  return {
    status: 'ok',
    message: replaced
      ? `Your ${dress.name} is updated — size ${size} for those dates.`
      : `The ${dress.name} in size ${size} is in your bag for those dates.`,
  }
}

export async function removeCartItemAction(formData: FormData): Promise<void> {
  const index = Number(formData.get('index') ?? -1)
  await removeFromCart(index)
  revalidatePath('/cart')
  revalidatePath('/checkout')
}

// ── wishlist ──────────────────────────────────────────────────────────────

export async function toggleFavoriteAction(dressId: string): Promise<{ saved: boolean; requiresSignIn?: boolean }> {
  const customer = await currentCustomer()
  if (!customer) return { saved: false, requiresSignIn: true }

  const address = await callerAddress()
  const limit = rateLimit(`favorite:${address}`, 60, 10 * 60_000)
  if (!limit.ok) return { saved: false }

  try {
    const result = await toggleFavorite(customer.id, dressId)
    revalidatePath('/account')
    revalidatePath('/shop')
    return result
  } catch (error) {
    console.error('Favorite toggle failed:', error)
    return { saved: false }
  }
}

// ── newsletter ────────────────────────────────────────────────────────────

export async function subscribeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const address = await callerAddress()
  const limit = rateLimit(`subscribe:${address}`, 8, 60 * 60_000)
  if (!limit.ok) return { status: 'error', message: waitMessage(limit.retryAfterSeconds) }
  if (looksLikeBot(formData)) return { status: 'ok', message: 'Welcome to the list.' }

  const email = String(formData.get('email') ?? '')
  const source = String(formData.get('source') ?? 'home').slice(0, 30)
  try {
    await subscribeToNewsletter(email, source)
    return { status: 'ok', message: 'Welcome to the list — the next collection and private sale come to you first.' }
  } catch (error) {
    return { status: 'error', message: messageFrom(error, 'That did not save — try again in a moment.') }
  }
}

// ── inquiries ─────────────────────────────────────────────────────────────

export async function sendInquiryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const address = await callerAddress()
  const limit = rateLimit(`inquiry:${address}`, 6, 60 * 60_000)
  if (!limit.ok) return { status: 'error', message: waitMessage(limit.retryAfterSeconds) }
  if (looksLikeBot(formData)) {
    return { status: 'ok', message: 'Thank you — your note is on its way to the studio.' }
  }

  const topicRaw = String(formData.get('topic') ?? 'GENERAL')
  const customer = await currentCustomer()

  try {
    const { id } = await createInquiry({
      guestName: String(formData.get('name') ?? customer?.name ?? ''),
      guestEmail: String(formData.get('email') ?? customer?.email ?? ''),
      guestPhone: String(formData.get('phone') ?? '') || undefined,
      subject: String(formData.get('subject') ?? '').trim() || 'A note from the website',
      topic: isInquiryTopic(topicRaw) ? topicRaw : 'GENERAL',
      message: String(formData.get('message') ?? ''),
      channel: String(formData.get('channel') ?? 'CONTACT_FORM') === 'DRESS_PAGE' ? 'DRESS_PAGE' : 'CONTACT_FORM',
    })
    return {
      status: 'ok',
      message: `Thank you — your note is with the studio (${id}). A stylist replies within a couple of hours; a receipt is already in your inbox.`,
    }
  } catch (error) {
    return { status: 'error', message: messageFrom(error, 'The note did not send — try again in a moment.') }
  }
}
