'use server'

/**
 * Checkout submission.
 *
 * The form posts contact details, add-on choices and (in test-gateway mode)
 * card fields. Everything money-related is recomputed from the database inside
 * `placeOrder`; the form's numbers are only ever a display. On success the cart
 * is cleared, the recent order is tucked into a cookie for the confirmation
 * page, and the customer is sent there.
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { callerAddress, rateLimit, waitMessage } from '@/lib/rate-limit'
import { clearCart } from '@/lib/storefront/cart'
import { StorefrontError, placeOrder, type CheckoutItemExtras } from '@/lib/storefront/orders'
import { currentCustomer } from '@/lib/storefront/session'
import { stripeConfigured } from '@/lib/payments'
import { RECENT_ORDER_COOKIE, type CheckoutState } from './state'

type RecentOrder = { ids: string[]; email: string; total: number; deposit: number }

export async function placeOrderAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const address = await callerAddress()
  const limit = rateLimit(`checkout:${address}`, 6, 15 * 60_000)
  if (!limit.ok) return { status: 'error', message: waitMessage(limit.retryAfterSeconds) }

  if (String(formData.get('website') ?? '').trim()) {
    return { status: 'error', message: 'That did not go through — give it another try.' }
  }

  const contact = {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    addressLine1: String(formData.get('addressLine1') ?? ''),
    addressLine2: String(formData.get('addressLine2') ?? ''),
    city: String(formData.get('city') ?? ''),
    region: String(formData.get('region') ?? ''),
    postalCode: String(formData.get('postalCode') ?? ''),
    country: String(formData.get('country') ?? 'United States'),
    notes: String(formData.get('notes') ?? ''),
  }

  if (formData.get('acceptTerms') !== 'on') {
    return { status: 'error', message: 'Please accept the rental terms before reserving — they cover the important parts.' }
  }

  // One extras block per cart line, keyed by its index.
  const items: CheckoutItemExtras[] = []
  for (let index = 0; ; index += 1) {
    if (!formData.has(`line-${index}`)) break
    const accessoryIds: string[] = []
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string' && key.startsWith(`accessory-${index}-`)) accessoryIds.push(key.slice(`accessory-${index}-`.length))
    }
    items.push({
      insurance: formData.get(`insurance-${index}`) === 'on',
      accessoryIds,
      express: formData.get('express') === 'on',
      pickup: formData.get('pickup') === 'on',
    })
  }

  const stripeMode = stripeConfigured()
  const card = stripeMode
    ? undefined
    : {
        number: String(formData.get('cardNumber') ?? ''),
        expiry: String(formData.get('cardExpiry') ?? ''),
        cvc: String(formData.get('cardCvc') ?? ''),
      }

  const customer = await currentCustomer()

  let result
  try {
    result = await placeOrder({
      contact,
      items,
      card,
      method: 'CARD',
      zone: String(formData.get('zone') ?? '') || undefined,
      customerId: customer?.id ?? null,
    })
  } catch (error) {
    if (error instanceof StorefrontError) {
      return { status: 'error', message: error.message, suggestions: error.suggestions }
    }
    console.error('Checkout failed:', error)
    return { status: 'error', message: 'Something went wrong and nothing was charged — try again in a moment.' }
  }

  const total = result.bookings.reduce((sum, booking) => sum + booking.total, 0)
  const deposit = result.bookings.reduce((sum, booking) => sum + booking.deposit, 0)

  await clearCart()

  const jar = await cookies()
  const recent: RecentOrder = { ids: result.bookings.map((booking) => booking.id), email: contact.email, total, deposit }
  jar.set(RECENT_ORDER_COOKIE, JSON.stringify(recent), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60,
  })

  if (result.stripe) {
    return { status: 'ok', message: 'Reservation held — confirm the payment below.', stripe: result.stripe }
  }

  redirect('/checkout/confirmation')
}
