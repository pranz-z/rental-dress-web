/**
 * Client operations.
 *
 * The customers section is a careful read: profiles, measurements, rental
 * history and linked inquiries. The one write from the studio side is an
 * internal note — kept on the profile and mirrored into the audit trail in the
 * same transaction, like every other studio edit.
 */
import type { StaffUser } from '@prisma/client'
import { recordAudit, staffActor } from './audit'
import { prisma } from './db'

export class CustomersError extends Error {}

export const CUSTOMERS_DONE_MESSAGES: Record<string, string> = {
  note_added: 'has a new internal note on the profile.',
}

const MAX_NOTE_LENGTH = 600

function snippet(text: string, length: number): string {
  return text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`
}

export async function addCustomerNote(staff: StaffUser, customerId: string, body: string): Promise<void> {
  const text = body.trim()
  if (text.length < 3) {
    throw new CustomersError('Write the note before saving — the team reads these on the profile.')
  }
  if (text.length > MAX_NOTE_LENGTH) {
    throw new CustomersError(`Keep a note under ${MAX_NOTE_LENGTH} characters — link the booking or inquiry for the full story.`)
  }

  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true },
    })
    if (!customer) throw new CustomersError('That client no longer exists.')

    await tx.customerNote.create({
      data: { customerId, staffId: staff.id, body: text },
    })

    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'customer.note_added',
      entity: 'Customer',
      entityId: customerId,
      summary: `Added a note on ${customer.name} — “${snippet(text, 80)}”`,
      metadata: { length: text.length },
    })
  })
}
