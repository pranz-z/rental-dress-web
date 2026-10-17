/**
 * Outbound email.
 *
 * One function carries every message out of the building:
 *
 * - with RESEND_API_KEY set it posts to Resend's API;
 * - in development without one — the default for local review — the message
 *   lands in the local outbox so it can be read at /studio/dev/outbox;
 * - in production without one there is nowhere durable to put it: a serverless
 *   filesystem is read-only, so sending is skipped with a logged warning and
 *   `/api/health` reports email as disabled.
 *
 * Sending never throws: a failed notification must not undo a booking.
 */
import { newOutboxId, writeOutboxMessage, type OutboxMessage } from './outbox'

export const EMAIL_FROM = process.env.EMAIL_FROM || 'Maison Rêve <studio@maisonreve.com>'

export type SendEmailInput = {
  to: string
  toName?: string
  subject: string
  html: string
  text: string
  kind: string
  reference?: string
  replyTo?: string
}

export type EmailProvider = 'resend' | 'outbox' | 'disabled'

export type SendEmailResult = {
  id: string
  provider: EmailProvider
  delivered: boolean
}

export function emailProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY) return 'resend'
  return process.env.NODE_ENV === 'production' ? 'disabled' : 'outbox'
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = emailProvider()

  if (provider === 'disabled') {
    // Production without a provider key. The deployment must keep working —
    // bookings, notifications and studio screens do not need email — so the
    // message is skipped, not retried into a read-only filesystem. The health
    // check and the startup log both say so out loud.
    console.warn(
      `[email] RESEND_API_KEY is not set — skipping “${input.kind}” to ${input.to}. ` +
        'Transactional email is disabled on this deployment; see the README, Deploying for real.',
    )
    return { id: newOutboxId(), provider: 'disabled', delivered: false }
  }

  const message: OutboxMessage = {
    id: newOutboxId(),
    to: input.to,
    toName: input.toName,
    from: EMAIL_FROM,
    subject: input.subject,
    html: input.html,
    text: input.text,
    kind: input.kind,
    reference: input.reference,
    replyTo: input.replyTo,
    createdAt: new Date().toISOString(),
    provider,
  }

  if (provider === 'resend') {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
          ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        }),
      })
      if (!response.ok) {
        message.error = `Resend refused the message (${response.status})`
      } else {
        return { id: message.id, provider: 'resend', delivered: true }
      }
    } catch (error) {
      message.error = error instanceof Error ? error.message : 'Resend request failed'
    }
  }

  // Outbox first, or a provider failure we still want to be able to inspect.
  try {
    await writeOutboxMessage(message)
  } catch (error) {
    console.error('Outbox write failed:', error)
  }
  return { id: message.id, provider: 'outbox', delivered: message.provider !== 'resend' }
}
