import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { emailProvider } from '@/lib/email/send'
import { stripeConfigured, stripeMode, stripeWebhookConfigured } from '@/lib/payments'

export const dynamic = 'force-dynamic'

/**
 * Liveness and configuration health for the deployment monitor.
 *
 * Reports only statuses — never a secret, a key fragment or customer data.
 * `ok: false` with a 503 tells the uptime check (and a human) that something
 * that must be true for money to move is not.
 */
export async function GET() {
  const checks: Record<string, string> = {}
  let ok = true

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch (error) {
    console.error('Health check: database unreachable:', error)
    checks.database = 'unreachable'
    ok = false
  }

  try {
    const mode = stripeMode()
    checks.payments = mode
    if (mode !== 'internal' && !stripeWebhookConfigured()) {
      // Without the webhook secret an authorization can never settle — refuse
      // to call the deployment healthy.
      checks.stripeWebhook = 'missing'
      ok = false
    } else {
      checks.stripeWebhook = stripeConfigured() ? 'configured' : 'not needed'
    }
  } catch {
    checks.payments = 'misconfigured'
    ok = false
  }

  checks.email = emailProvider()
  checks.inboundEmail =
    process.env.EMAIL_INBOUND_SIGNING_SECRET || process.env.EMAIL_INBOUND_SECRET
      ? 'signed'
      : process.env.NODE_ENV === 'production'
        ? 'unsigned (refused in production)'
        : 'open (development)'

  return NextResponse.json(
    { ok, checks, time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
