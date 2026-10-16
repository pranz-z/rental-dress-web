import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { recordInboundInquiryReply } from '@/lib/inquiries'
import { callerAddress, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * Inbound email webhook.
 *
 * Studio replies carry `Reply-To: reply+INQ-####@…`, so a customer answering a
 * studio email lands here and threads straight back onto the inquiry. The
 * provider (Resend inbound, or any forwarder that posts JSON) includes the
 * envelope recipients; we only trust an inquiry id that appears in a reply+
 * address, and we never accept anything except that one, narrow write.
 *
 * Authenticity, in order of preference:
 *  1. `EMAIL_INBOUND_SIGNING_SECRET` — a Svix signing secret (`whsec_…`),
 *     which Resend webhooks sign natively; verified against the raw body.
 *  2. `EMAIL_INBOUND_SECRET` — a shared header secret for generic forwarders.
 *  3. Neither, in development only — accepted so the flow can be exercised.
 *     In production an unsigned webhook is refused outright, because anyone
 *     could otherwise inject replies into a customer's thread.
 */
type InboundPayload = {
  to?: string | string[]
  from?: string
  text?: string
  html?: string
  subject?: string
  data?: { to?: string | string[]; from?: string; text?: string; html?: string }
}

function firstAddress(value: string | string[] | undefined): string | null {
  if (!value) return null
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  const match = raw.match(/<([^>]+)>/)
  return (match ? match[1] : raw).trim().toLowerCase()
}

/** Length-safe comparison so a wrong secret cannot be probed byte by byte. */
function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * Svix-style webhook verification (the scheme Resend signs with): the signed
 * content is `{svix-id}.{svix-timestamp}.{payload}`, HMAC-SHA256 under the
 * base64 secret (after the `whsec_` prefix), compared against every `v1`
 * entry of the `svix-signature` header. Timestamps older than five minutes
 * are refused so a captured request cannot be replayed.
 */
function verifySvixSignature(rawBody: string, headers: Headers, secret: string): boolean {
  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const signatureHeader = headers.get('svix-signature')
  if (!id || !timestamp || !signatureHeader) return false

  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(age) || age > 300) return false

  const key = secret.startsWith('whsec_') ? Buffer.from(secret.slice(6), 'base64') : Buffer.from(secret, 'utf8')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest('base64')

  return signatureHeader.split(' ').some((part) => {
    const [version, value] = part.split(',')
    if (version !== 'v1' || !value) return false
    return constantTimeEquals(expected, value)
  })
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  const signingSecret = process.env.EMAIL_INBOUND_SIGNING_SECRET?.trim()
  const sharedSecret = process.env.EMAIL_INBOUND_SECRET?.trim()

  if (signingSecret) {
    if (!verifySvixSignature(rawBody, request.headers, signingSecret)) {
      return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 })
    }
  } else if (sharedSecret) {
    const supplied = request.headers.get('x-webhook-secret') ?? ''
    if (!constantTimeEquals(supplied, sharedSecret)) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'Inbound email is not configured' }, { status: 503 })
  }

  const address = await callerAddress()
  const limit = rateLimit(`inbound:${address}`, 60, 60_000)
  if (!limit.ok) return NextResponse.json({ ok: false }, { status: 429 })

  let payload: InboundPayload
  try {
    payload = JSON.parse(rawBody) as InboundPayload
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  // Resend-style envelopes nest under `data`; plain forwarders do not.
  const to = payload.data?.to ?? payload.to
  const from = firstAddress(payload.data?.from ?? payload.from)
  const text = (payload.data?.text ?? payload.text ?? '').trim()
  const html = payload.data?.html ?? payload.html

  const recipient = Array.isArray(to) ? to.join(' ') : (to ?? '')
  const match = recipient.match(/reply\+(INQ-\d+)/i)
  if (!match) {
    // Not an inquiry thread — accept quietly so the provider does not retry.
    return NextResponse.json({ ok: true, ignored: true })
  }

  const body = text || stripHtml(html ?? '')
  if (!body) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  try {
    const { guestName } = await recordInboundInquiryReply(match[1].toUpperCase(), {
      body: body.slice(0, 8000),
      fromEmail: from ?? undefined,
    })
    return NextResponse.json({ ok: true, inquiry: match[1].toUpperCase(), guestName })
  } catch (error) {
    console.error('Inbound inquiry reply failed:', error)
    // 200 so the provider does not hammer retries over a message we cannot route.
    return NextResponse.json({ ok: false, error: 'Could not thread the reply' }, { status: 202 })
  }
}

export function GET() {
  return NextResponse.json({ ok: false, error: 'POST only' }, { status: 405 })
}
