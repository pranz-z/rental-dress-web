/**
 * Inquiry operations — the shared inbox ledger.
 *
 * Every mutation checks the inquiry before changing anything, writes the
 * conversation row the studio sees, and lands in the audit trail inside one
 * transaction. Replies are recorded as sent by email; internal notes never
 * leave the studio.
 */
import type { StaffUser } from '@prisma/client'
import { prisma } from './db'
import { recordAudit, staffActor } from './audit'

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
