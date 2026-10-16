/**
 * Cleaning operations.
 *
 * When a rental comes back, the dress moves to Cleaning until the studio signs
 * off the inspection. Signing off flips the dress back to Available, closes the
 * cleaning record, drops a note on the originating booking's timeline and lands
 * in the audit trail — all in one transaction.
 */
import { prisma } from './db'
import { recordAudit, staffActor } from './audit'
import type { StaffUser } from '@prisma/client'

export class CleaningError extends Error {}

export async function completeCleaning(recordId: string, staff: StaffUser): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const record = await tx.cleaningRecord.findUnique({
      where: { id: recordId },
      include: {
        dress: { select: { id: true, name: true, status: true } },
        booking: { select: { id: true } },
      },
    })
    if (!record) throw new CleaningError('That cleaning ticket no longer exists.')
    if (record.completedAt) throw new CleaningError('This cleaning has already been signed off.')

    await tx.cleaningRecord.update({
      where: { id: recordId },
      data: { completedAt: new Date(), staffId: staff.id },
    })

    // The dress is back on the rack unless another cleaning ticket is still open.
    const otherOpen = await tx.cleaningRecord.count({
      where: { dressId: record.dressId, completedAt: null, id: { not: recordId } },
    })
    if (otherOpen === 0 && record.dress.status === 'CLEANING') {
      await tx.dress.update({ where: { id: record.dressId }, data: { status: 'AVAILABLE' } })
    }

    if (record.booking) {
      await tx.bookingEvent.create({
        data: {
          bookingId: record.booking.id,
          type: 'CLEANING',
          summary: 'Cleaning and inspection complete — the dress is back on the rack.',
          staffId: staff.id,
          visibleToCustomer: false,
        },
      })
    }

    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'cleaning.completed',
      entity: 'Dress',
      entityId: record.dressId,
      summary: `${record.dress.name} cleaned and inspected${record.booking ? ` after ${record.booking.id}` : ''} — available for the next rental`,
    })
  })
}
