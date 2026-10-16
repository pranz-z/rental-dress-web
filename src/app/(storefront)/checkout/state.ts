import type { FormState } from '../form-state'

/** One Stripe authorization the customer still has to confirm client-side. */
export type StripeIntentSummary = {
  bookingId: string
  clientSecret: string | null
  amount: number
}

export type CheckoutState = FormState & {
  /** Present when Stripe is configured: the page moves to the payment step. */
  stripe?: { intents: StripeIntentSummary[] }
}

export const IDLE_CHECKOUT: CheckoutState = { status: 'idle' }

/** Cookie holding the recent order id list for the confirmation page. */
export const RECENT_ORDER_COOKIE = 'mr_recent_order'

/** Serializable lines the checkout form prices and submits. */
export type CheckoutLine = {
  index: number
  dressId: string
  slug: string
  name: string
  designer: string
  color: string
  colorHex: string
  artTone: string
  size: string
  backupSize: string | null
  rentalDays: number
  deliveryDate: string
  returnDate: string
  eventDate: string
  price: number
  deposit: number
}

export type CheckoutAddOn = {
  id: string
  name: string
  description: string
  price: number
  category: 'ACCESSORY' | 'FIT' | 'COVERAGE' | 'DELIVERY'
}

export type CheckoutFees = {
  insurance: number
  express: number
  pickup: number
  backupPerLine: number
  /** Cancellation policy shown in the summary — read from Settings. */
  cancellationWindowDays: number
  cancellationRefundPercent: number
}

/** A delivery zone offered at checkout — name and fee come from Settings. */
export type CheckoutZone = {
  name: string
  courier: string
  etaDays: number
  fee: number
  cutoffLabel: string
}
