/**
 * Audit trail. Every status change, refund, reply and edit in the studio is
 * recorded here — who did it, what changed, and when.
 */
import type { Prisma } from '@prisma/client'
import type { StaffUser } from '@prisma/client'

type Tx = Prisma.TransactionClient

export type AuditInput = {
  staffId?: string | null
  actorLabel: string
  action: string
  entity: string
  entityId: string
  summary: string
  metadata?: Prisma.InputJsonValue
}

export async function recordAudit(tx: Tx, input: AuditInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      staffId: input.staffId ?? null,
      actorLabel: input.actorLabel,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      summary: input.summary,
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    },
  })
}

export function staffActor(staff: StaffUser | { id: string; name: string }): { staffId: string; actorLabel: string } {
  return { staffId: staff.id, actorLabel: staff.name }
}
