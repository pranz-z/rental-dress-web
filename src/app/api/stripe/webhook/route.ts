import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { recordAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * Stripe webhook — the authoritative signal that an authorization landed.
 * The confirmation page also retrieves intents synchronously, so this route
 * is the belt to that pair of braces: whichever arrives first settles the
 * booking, and the audit trail records that it happened.
 */
function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false
  const parts = header.split(',').reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split('=')
    if (key && value) acc[key.trim()] = value.trim()
    return acc
  }, {})
  const timestamp = parts.t
  const signature = parts.v1
  if (!timestamp || !signature) return false

  // Five-minute tolerance, per Stripe's own guidance.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(age) || age > 300) return false

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

type StripeEvent = {
  type?: string
  data?: { object?: { id?: string; payment_intent?: string; last_payment_error?: { message?: string } } }
}

async function settleAuthorized(paymentRef: string, source: string): Promise<boolean> {
  const booking = await prisma.booking.findFirst({
    where: { paymentRef },
    select: { id: true, paymentStatus: true },
  })
  if (!booking) return false
  if (booking.paymentStatus === 'AUTHORIZED' || booking.paymentStatus === 'PAID') return true

  await prisma.$transaction(async (tx) => {
    await tx.payment.updateMany({
      where: { bookingId: booking.id, status: 'UNPAID' },
      data: { status: 'AUTHORIZED', providerRef: paymentRef },
    })
    await tx.booking.update({
      where: { id: booking.id },
      data: { paymentStatus: 'AUTHORIZED', paymentMethod: 'CARD' },
    })
    await recordAudit(tx, {
      staffId: null,
      actorLabel: 'Stripe',
      action: 'payment.authorized',
      entity: 'Booking',
      entityId: booking.id,
      summary: `${source} confirmed the authorization for ${booking.id}`,
    })
  })
  return true
}

async function markFailed(paymentRef: string, message: string | undefined): Promise<void> {
  const booking = await prisma.booking.findFirst({ where: { paymentRef }, select: { id: true, paymentStatus: true } })
  if (!booking || booking.paymentStatus !== 'UNPAID') return
  await prisma.$transaction(async (tx) => {
    await tx.payment.updateMany({ where: { bookingId: booking.id, status: 'UNPAID' }, data: { status: 'FAILED' } })
    await tx.booking.update({ where: { id: booking.id }, data: { paymentStatus: 'FAILED' } })
    await recordAudit(tx, {
      staffId: null,
      actorLabel: 'Stripe',
      action: 'payment.failed',
      entity: 'Booking',
      entityId: booking.id,
      summary: `Card authorization failed for ${booking.id}${message ? ` — ${message}` : ''}`,
    })
  })
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const rawBody = await request.text()

  if (secret && !verifySignature(rawBody, request.headers.get('stripe-signature'), secret)) {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 400 })
  }
  if (!secret) {
    // Without a secret the route refuses to act — an unsigned webhook must
    // never be able to flip payment state.
    return NextResponse.json({ ok: false, error: 'Webhook secret not configured' }, { status: 503 })
  }

  let event: StripeEvent
  try {
    event = JSON.parse(rawBody) as StripeEvent
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  try {
    const object = event.data?.object
    const paymentRef = object?.id
    if (!paymentRef || !paymentRef.startsWith('pi_')) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    switch (event.type) {
      case 'payment_intent.amount_capturable_updated':
      case 'payment_intent.succeeded':
        await settleAuthorized(paymentRef, 'Stripe webhook')
        break
      case 'payment_intent.payment_failed':
        await markFailed(paymentRef, object?.last_payment_error?.message)
        break
      default:
        return NextResponse.json({ ok: true, ignored: true })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Stripe webhook handling failed:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
