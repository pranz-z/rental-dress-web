/**
 * Inquiry operations — the shared inbox ledger.
 *
 * Every mutation checks the inquiry before changing anything, writes the
 * conversation row the studio sees, and lands in the audit trail inside one
 * transaction. Replies are recorded as sent by email; internal notes never
 * leave the studio.
 */
import type { InquiryTopic, Prisma, StaffUser } from '@prisma/client'
import { prisma } from './db'
import { recordAudit, staffActor } from './audit'
import { INQUIRY_TOPICS } from './domain'
import { sendInquiryAcknowledgement, sendInquiryReply } from './notifications'

export class InquiryError extends Error {}

export async function replyToInquiry(
  inquiryId: string,
  staff: StaffUser,
  input: { body: string; internal: boolean },
): Promise<{ internal: boolean }> {
  const body = input.body.trim()
  if (!body) throw new InquiryError(input.internal ? 'Write the note before saving it.' : 'Write the reply before sending it.')
  if (body.length > 5000) throw new InquiryError('Replies are limited to 5,000 characters.')

  await prisma.$transaction(async (tx) => {
    const inquiry = await tx.inquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, subject: true, guestName: true, firstReplyAt: true },
    })
    if (!inquiry) throw new InquiryError('That inquiry no longer exists.')

    const now = new Date()
    await tx.reply.create({
      data: {
        inquiryId,
        staffId: staff.id,
        body,
        internal: input.internal,
        channel: input.internal ? 'internal' : 'email',
        sentAt: now,
      },
    })
    await tx.inquiry.update({
      where: { id: inquiryId },
      data: {
        repliesCount: { increment: 1 },
        ...(input.internal || inquiry.firstReplyAt ? {} : { firstReplyAt: now }),
      },
    })

    await recordAudit(tx, {
      ...staffActor(staff),
      action: input.internal ? 'inquiry.note_added' : 'inquiry.replied',
      entity: 'Inquiry',
      entityId: inquiryId,
      summary: input.internal
        ? `Added an internal note on “${inquiry.subject}”`
        : `Replied to ${inquiry.guestName} — “${inquiry.subject}”`,
    })
  })

  // The reply leaves the building as a real email; internal notes never do.
  if (!input.internal) await sendInquiryReply(inquiryId, staff.name, body)
  return { internal: input.internal }
}

export async function resolveInquiry(inquiryId: string, staff: StaffUser): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const inquiry = await tx.inquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, subject: true, status: true },
    })
    if (!inquiry) throw new InquiryError('That inquiry no longer exists.')
    if (inquiry.status === 'RESOLVED') throw new InquiryError('This inquiry is already resolved.')

    await tx.inquiry.update({
      where: { id: inquiryId },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedById: staff.id },
    })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'inquiry.resolved',
      entity: 'Inquiry',
      entityId: inquiryId,
      summary: `Marked resolved — “${inquiry.subject}”`,
    })
  })
}

export async function reopenInquiry(inquiryId: string, staff: StaffUser): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const inquiry = await tx.inquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, subject: true, status: true },
    })
    if (!inquiry) throw new InquiryError('That inquiry no longer exists.')
    if (inquiry.status === 'OPEN') throw new InquiryError('This inquiry is already open.')

    await tx.inquiry.update({
      where: { id: inquiryId },
      data: { status: 'OPEN', resolvedAt: null, resolvedById: null },
    })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'inquiry.reopened',
      entity: 'Inquiry',
      entityId: inquiryId,
      summary: `Reopened — “${inquiry.subject}”`,
    })
  })
}

export async function assignInquiry(
  inquiryId: string,
  staff: StaffUser,
  assigneeId: string | null,
): Promise<string | null> {
  const target = assigneeId?.trim() || null

  const assigneeName = await prisma.$transaction(async (tx) => {
    const inquiry = await tx.inquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, subject: true },
    })
    if (!inquiry) throw new InquiryError('That inquiry no longer exists.')

    let name: string | null = null
    if (target) {
      const assignee = await tx.staffUser.findUnique({
        where: { id: target },
        select: { id: true, name: true, active: true },
      })
      if (!assignee || !assignee.active) throw new InquiryError('That teammate is not an active studio account.')
      name = assignee.name
    }

    await tx.inquiry.update({ where: { id: inquiryId }, data: { assignedToId: target } })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: target ? 'inquiry.assigned' : 'inquiry.unassigned',
      entity: 'Inquiry',
      entityId: inquiryId,
      summary: target
        ? `Assigned “${inquiry.subject}” to ${name}`
        : `Unassigned “${inquiry.subject}”`,
    })
    return name
  })
  return assigneeName
}

// ── storefront entry points ───────────────────────────────────────────────

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type CreateInquiryInput = {
  guestName: string
  guestEmail: string
  guestPhone?: string
  subject: string
  topic: InquiryTopic
  message: string
  channel: 'CONTACT_FORM' | 'DRESS_PAGE'
}

/** Next in the INQ- series, matched to the ledger style the studio uses. */
async function nextInquiryId(tx: Prisma.TransactionClient): Promise<string> {
  const latest = await tx.inquiry.findMany({ orderBy: { receivedAt: 'desc' }, take: 40, select: { id: true } })
  const max = latest.reduce((best, row) => {
    const parsed = Number.parseInt(row.id.replace(/^INQ-/, ''), 10)
    return Number.isFinite(parsed) && parsed > best ? parsed : best
  }, 1100)
  return `INQ-${max + 1}`
}

/**
 * A public inquiry — from the contact page or a dress page. Matched to the
 * customer book by email, or a guest profile is opened so the studio still has
 * someone to answer and follow up with.
 */
export async function createInquiry(input: CreateInquiryInput): Promise<{ id: string }> {
  const guestName = input.guestName.trim()
  const guestEmail = input.guestEmail.trim().toLowerCase()
  const guestPhone = input.guestPhone?.trim() || null
  const subject = input.subject.trim()
  const message = input.message.trim()

  if (guestName.length < 2) throw new InquiryError('Please share your name so the studio knows who to write back to.')
  if (guestName.length > 120) throw new InquiryError('That name is longer than the form can hold.')
  if (!EMAIL_PATTERN.test(guestEmail)) throw new InquiryError('That email address does not look right — check it and try again.')
  if (guestPhone && guestPhone.length > 40) throw new InquiryError('That phone number is longer than the form can hold.')
  if (subject.length < 3) throw new InquiryError('Add a short subject so the studio can route your note.')
  if (subject.length > 160) throw new InquiryError('Keep the subject under 160 characters.')
  if (message.length < 10) throw new InquiryError('Tell the studio a little more — a sentence or two helps them answer well.')
  if (message.length > 5000) throw new InquiryError('Notes are limited to 5,000 characters.')
  if (!INQUIRY_TOPICS.includes(input.topic)) throw new InquiryError('Choose one of the listed topics.')

  const inquiryId = await prisma.$transaction(async (tx) => {
    let customer = await tx.customer.findFirst({
      where: { email: { equals: guestEmail, mode: 'insensitive' } },
      select: { id: true },
    })
    if (!customer) {
      try {
        customer = await tx.customer.create({
          data: {
            name: guestName,
            email: guestEmail,
            phone: guestPhone,
            tier: 'GUEST',
          },
          select: { id: true },
        })
      } catch {
        customer = await tx.customer.findFirst({
          where: { email: { equals: guestEmail, mode: 'insensitive' } },
          select: { id: true },
        })
      }
    }

    let id = await nextInquiryId(tx)
    for (let attempt = 0; ; attempt += 1) {
      try {
        await tx.inquiry.create({
          data: {
            id,
            customerId: customer?.id ?? null,
            guestName,
            guestEmail,
            guestPhone,
            subject,
            topic: input.topic,
            channel: input.channel,
            message,
          },
        })
        break
      } catch (error) {
        if (attempt >= 3) throw error
        id = await nextInquiryId(tx)
      }
    }

    await recordAudit(tx, {
      staffId: null,
      actorLabel: `${guestName} (customer)`,
      action: 'inquiry.received',
      entity: 'Inquiry',
      entityId: id,
      summary: `New inquiry — “${subject}”`,
      metadata: { channel: input.channel, topic: input.topic },
    })
    return id
  })

  // The guest gets a receipt the moment the studio inbox has the note.
  await sendInquiryAcknowledgement(inquiryId)
  return { id: inquiryId }
}

/**
 * A customer's email reply, threaded back onto its inquiry by the reply-to
 * address (`reply+INQ-####@…`). Inbound is always treated as a customer voice:
 * it reopens a resolved inquiry and never counts toward first-reply time.
 */
export async function recordInboundInquiryReply(
  inquiryId: string,
  input: { body: string; fromEmail?: string },
): Promise<{ guestName: string }> {
  const body = input.body.trim()
  if (!body) throw new InquiryError('The incoming message was empty.')

  return prisma.$transaction(async (tx) => {
    const inquiry = await tx.inquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, subject: true, guestName: true, status: true },
    })
    if (!inquiry) throw new InquiryError('No inquiry matches that reply address.')

    const now = new Date()
    await tx.reply.create({
      data: { inquiryId, staffId: null, body, internal: false, channel: 'email', sentAt: now },
    })
    await tx.inquiry.update({
      where: { id: inquiryId },
      data: {
        repliesCount: { increment: 1 },
        ...(inquiry.status === 'RESOLVED' ? { status: 'OPEN', resolvedAt: null, resolvedById: null } : {}),
      },
    })
    await recordAudit(tx, {
      staffId: null,
      actorLabel: `${inquiry.guestName} (customer)`,
      action: 'inquiry.customer_replied',
      entity: 'Inquiry',
      entityId: inquiryId,
      summary: `${inquiry.guestName} replied by email${input.fromEmail ? ` from ${input.fromEmail}` : ''}`,
    })
    return { guestName: inquiry.guestName }
  })
}

// ── copy ──────────────────────────────────────────────────────────────────

/** "1.4 h" style duration for first-reply reporting. */
export function formatReplyHours(hours: number): string {
  if (hours < 1) return `${Math.max(Math.round(hours * 60), 1)} min`
  return hours < 10 ? `${hours.toFixed(1)} h` : `${Math.round(hours)} h`
}

export const INQUIRY_DONE_MESSAGES: Record<string, string> = {
  replied: 'Reply sent — it is on the thread and the customer receives it by email.',
  noted: 'Internal note added — only the studio can see it.',
  resolved: 'marked as resolved.',
  reopened: 'reopened — it is back in the inbox.',
  assigned: 'assignee updated.',
}
