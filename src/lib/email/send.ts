/**
 * Outbound email.
 *
 * One function carries every message out of the building. With RESEND_API_KEY
 * set it posts to Resend's API; without one — the default for local review —
 * the message lands in the local outbox so it can be read at /studio/dev/outbox.
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

export type SendEmailResult = {
  id: string
  provider: 'outbox' | 'resend'
  delivered: boolean
}

export function emailProvider(): 'resend' | 'outbox' {
  return process.env.RESEND_API_KEY ? 'resend' : 'outbox'
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
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
    provider: emailProvider(),
  }

  if (emailProvider() === 'resend') {
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
