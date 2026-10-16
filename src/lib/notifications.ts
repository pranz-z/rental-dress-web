/**
 * Customer notifications.
 *
 * Every message the business sends to a customer is composed here — booking
 * milestones, return reminders and inquiry correspondence — so the wording and
 * the send point stay in one place. Notifications never throw: a delivery
 * failure is logged and the studio ledger stays true.
 */
import { prisma } from '@/lib/db'
import { addDays, formatMonthDay, todayUtc } from '@/lib/dates'
import { recordAudit } from './audit'
import { sendTemplatedEmail } from './email/templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/** Replies to studio emails thread back onto the inquiry. */
export const REPLY_DOMAIN = process.env.EMAIL_REPLY_DOMAIN || 'inbox.maisonreve.com'

export function inquiryReplyTo(inquiryId: string): string {
  return `reply+${inquiryId}@${REPLY_DOMAIN}`
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}

async function bookingEmailContext(bookingId: string) {
  const [booking, settings] = await Promise.all([
    prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { select: { name: true, email: true } },
        dress: { select: { name: true } },
      },
    }),
    prisma.studioSettings.findUnique({ where: { id: 'studio' } }),
  ])
  if (!booking) return null
  return { booking, cancellationWindow: settings?.cancellationWindowDays ?? 7 }
}

type EventKind = 'booking_received' | 'confirmation' | 'shipped' | 'returned'

async function sendBookingEvent(kind: EventKind, bookingId: string): Promise<void> {
  try {
    const context = await bookingEmailContext(bookingId)
    if (!context) return
    const { booking } = context
    await sendTemplatedEmail({
      kind,
      to: booking.customer.email,
      toName: booking.customer.name,
      reference: booking.id,
      vars: {
        firstName: firstName(booking.customer.name),
        dressName: booking.dress.name,
        size: booking.size,
        bookingId: booking.id,
        eventDate: formatMonthDay(booking.eventDate),
        deliveryDate: formatMonthDay(booking.deliveryDate),
        returnDate: formatMonthDay(booking.returnDate),
        courier: booking.courier ?? 'our courier',
        trackingNumber: booking.trackingNumber ?? '—',
        cancellationWindow: context.cancellationWindow,
        accountUrl: `${APP_URL}/account`,
      },
    })
  } catch (error) {
    console.error(`Notification ${kind} for ${bookingId} failed:`, error)
  }
}

export const sendBookingReceivedEmail = (bookingId: string) => sendBookingEvent('booking_received', bookingId)
export const sendBookingConfirmedEmail = (bookingId: string) => sendBookingEvent('confirmation', bookingId)
export const sendBookingShippedEmail = (bookingId: string) => sendBookingEvent('shipped', bookingId)
export const sendReturnReceivedEmail = (bookingId: string) => sendBookingEvent('returned', bookingId)

/**
 * Return reminders: two days and one day before the dress is due back. Runs as
 * a lazy sweep from the studio's own screens (the ledger pattern the studio
 * already uses for late bookings) and records an audit line per send so a
 * reminder is never mailed twice.
 */
export async function sendReturnReminders(today: Date = todayUtc()): Promise<number> {
  const targets = [
    { daysBefore: 2, due: addDays(today, 2), action: 'email.return_reminder_2', kind: 'return_reminder_2day' as const },
    { daysBefore: 1, due: addDays(today, 1), action: 'email.return_reminder_1', kind: 'return_reminder_1day' as const },
  ]

  let sent = 0
  for (const target of targets) {
    let due: Array<{ id: string }>
    try {
      due = await prisma.booking.findMany({
        where: { status: { in: ['SHIPPED', 'WITH_CUSTOMER'] }, returnDate: target.due },
        select: { id: true },
      })
    } catch {
      return sent
    }

    for (const booking of due) {
      const already = await prisma.auditLog.findFirst({
        where: { action: target.action, entity: 'Booking', entityId: booking.id },
        select: { id: true },
      })
      if (already) continue

      try {
        const context = await bookingEmailContext(booking.id)
        if (!context) continue
        const { booking: row } = context
        await sendTemplatedEmail({
          kind: target.kind,
          to: row.customer.email,
          toName: row.customer.name,
          reference: row.id,
          vars: {
            firstName: firstName(row.customer.name),
            dressName: row.dress.name,
            returnDate: formatMonthDay(row.returnDate),
            accountUrl: `${APP_URL}/account`,
          },
        })
        await prisma.auditLog.create({
          data: {
            staffId: null,
            actorLabel: 'Studio automation',
            action: target.action,
            entity: 'Booking',
            entityId: row.id,
            summary: `Return reminder (${target.daysBefore} day${target.daysBefore === 1 ? '' : 's'} before) sent to ${row.customer.name}`,
          },
        })
        sent += 1
      } catch (error) {
        console.error(`Return reminder for ${booking.id} failed:`, error)
      }
    }
  }
  return sent
}

// ── account ───────────────────────────────────────────────────────────────

/** The one-tap sign-in link, emailed when a customer asks for it. */
export async function sendMagicLinkEmail(to: string, toName: string | null, url: string): Promise<void> {
  try {
    await sendTemplatedEmail({
      kind: 'magic_link',
      to,
      toName: toName ?? undefined,
      vars: {
        firstName: firstName(toName ?? 'there'),
        url,
      },
    })
  } catch (error) {
    console.error(`Magic link email to ${to} failed:`, error)
  }
}

// ── inquiries ─────────────────────────────────────────────────────────────

export async function sendInquiryAcknowledgement(inquiryId: string): Promise<void> {
  try {
    const inquiry = await prisma.inquiry.findUnique({ where: { id: inquiryId } })
    if (!inquiry) return
    await sendTemplatedEmail({
      kind: 'inquiry_received',
      to: inquiry.guestEmail,
      toName: inquiry.guestName,
      reference: inquiry.id,
      replyTo: inquiryReplyTo(inquiry.id),
      vars: {
        firstName: firstName(inquiry.guestName),
        subject: inquiry.subject,
      },
    })
  } catch (error) {
    console.error(`Inquiry acknowledgement for ${inquiryId} failed:`, error)
  }
}

export async function sendInquiryReply(inquiryId: string, staffName: string, replyBody: string): Promise<void> {
  try {
    const inquiry = await prisma.inquiry.findUnique({ where: { id: inquiryId } })
    if (!inquiry) return
    await sendTemplatedEmail({
      kind: 'inquiry_reply',
      to: inquiry.guestEmail,
      toName: inquiry.guestName,
      reference: inquiry.id,
      replyTo: inquiryReplyTo(inquiry.id),
      vars: {
        firstName: firstName(inquiry.guestName),
        subject: inquiry.subject,
        reply: replyBody,
        staffName,
      },
    })
  } catch (error) {
    console.error(`Inquiry reply email for ${inquiryId} failed:`, error)
  }
}
