/**
 * Payments.
 *
 * With STRIPE_SECRET_KEY set, checkout authorizes a real Stripe PaymentIntent
 * (manual capture — the studio captures when it confirms the booking). Without
 * a key, the same flow runs through the built-in test gateway: card details are
 * validated, only the last four digits are kept, and an authorization is
 * recorded exactly where a Stripe one would be. Storefront and studio read one
 * ledger in both modes.
 */
import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export type StripeMode = 'internal' | 'test' | 'live'

let cachedMode: StripeMode | null = null

/**
 * Which payment rails this deployment runs.
 *
 *  · `internal` — no Stripe key: the built-in test gateway.
 *  · `test`     — a Stripe test key. The safe default whenever a key exists.
 *  · `live`     — real money. Going live takes the explicit `STRIPE_MODE=live`
 *                 environment change: a live key without it refuses to run,
 *                 and `live` with a test key refuses too, so neither can be
 *                 reached by accident.
 */
export function stripeMode(): StripeMode {
  if (cachedMode) return cachedMode
  const key = (process.env.STRIPE_SECRET_KEY ?? '').trim()
  if (!key) {
    cachedMode = 'internal'
    return cachedMode
  }
  const declared = (process.env.STRIPE_MODE ?? 'test').trim().toLowerCase()
  if (declared !== 'test' && declared !== 'live') {
    throw new Error(`STRIPE_MODE must be "test" or "live" — got "${declared}".`)
  }
  const keyIsLive = key.startsWith('sk_live_') || key.startsWith('rk_live_')
  if (keyIsLive && declared !== 'live') {
    throw new Error('A live Stripe key is set but STRIPE_MODE is not "live". Set STRIPE_MODE="live" to take real payments.')
  }
  if (!keyIsLive && declared === 'live') {
    throw new Error('STRIPE_MODE="live" but the Stripe key is a test key — refusing to run in live mode.')
  }
  cachedMode = declared
  return cachedMode
}

/** Whether the Stripe webhook signing secret is present — required once live. */
export function stripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET)
}

let cachedStripe: Stripe | null = null

export function stripe(): Stripe {
  stripeMode() // trip the live/test guards before any call leaves the building
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set — check stripeConfigured() before calling the Stripe client.')
  cachedStripe ??= new Stripe(key, { typescript: true })
  return cachedStripe
}

export type AuthorizationIntent = { id: string; clientSecret: string | null }

/** An authorization-only intent; the studio captures it on confirmation. */
export async function createAuthorizationIntent(input: {
  amountCents: number
  description: string
  metadata: Record<string, string>
  receiptEmail?: string
}): Promise<AuthorizationIntent> {
  const intent = await stripe().paymentIntents.create({
    amount: input.amountCents,
    currency: 'usd',
    capture_method: 'manual',
    automatic_payment_methods: { enabled: true },
    description: input.description,
    metadata: input.metadata,
    ...(input.receiptEmail ? { receipt_email: input.receiptEmail } : {}),
  })
  return { id: intent.id, clientSecret: intent.client_secret }
}

export type IntentSnapshot = {
  status: string
  amountAuthorized: number
  amountCaptured: number
  last4: string | null
  method: 'CARD' | 'APPLE_PAY' | 'GOOGLE_PAY' | 'BNPL' | null
}

/** Reads a live intent so the confirmation page can settle the ledger. */
export async function retrieveIntentSnapshot(intentId: string): Promise<IntentSnapshot | null> {
  try {
    const intent = await stripe().paymentIntents.retrieve(intentId, { expand: ['latest_charge'] })
    const charge = intent.latest_charge as Stripe.Charge | null
    const wallet = charge?.payment_method_details?.card?.wallet?.type
    return {
      status: intent.status,
      amountAuthorized: intent.amount_capturable ?? 0,
      amountCaptured: intent.amount_received ?? 0,
      last4: charge?.payment_method_details?.card?.last4 ?? null,
      method: wallet === 'apple_pay' ? 'APPLE_PAY' : wallet === 'google_pay' ? 'GOOGLE_PAY' : 'CARD',
    }
  } catch (error) {
    console.error('Stripe intent retrieve failed:', error)
    return null
  }
}

// ── internal test gateway ─────────────────────────────────────────────────

export type CardValidation = { last4: string; brand: string }

export function validateCardDetails(input: { number: string; expiry: string; cvc: string }): CardValidation {
  const number = input.number.replaceAll(/[\s-]/g, '')
  if (!/^\d{13,19}$/.test(number)) throw new Error('card-number')
  if (!luhnValid(number)) throw new Error('card-number')

  const expiryMatch = input.expiry.trim().match(/^(\d{2})\s*\/\s*(\d{2}|\d{4})$/)
  if (!expiryMatch) throw new Error('card-expiry')
  const month = Number(expiryMatch[1])
  const rawYear = Number(expiryMatch[2])
  const year = rawYear < 100 ? 2000 + rawYear : rawYear
  if (month < 1 || month > 12) throw new Error('card-expiry')
  const expiryEnd = new Date(Date.UTC(year, month, 1))
  if (expiryEnd.getTime() < Date.now()) throw new Error('card-expiry')

  if (!/^\d{3,4}$/.test(input.cvc.trim())) throw new Error('card-cvc')

  return { last4: number.slice(-4), brand: cardBrand(number) }
}

function luhnValid(number: string): boolean {
  let sum = 0
  let double = false
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let digit = Number(number[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

function cardBrand(number: string): string {
  if (/^4/.test(number)) return 'Visa'
  if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) return 'Mastercard'
  if (/^3[47]/.test(number)) return 'Amex'
  return 'Card'
}

/** The reference recorded on payments taken through the test gateway. */
export function internalPaymentRef(): string {
  return `in_test_${randomUUID().replaceAll('-', '').slice(0, 20)}`
}
