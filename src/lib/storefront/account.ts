/**
 * Customer account writes — favorites, measurements, event lists and the
 * newsletter. Each one lands in the same audit trail the studio reads, written
 * with a customer actor so the office can see what the customer did and when.
 */
import { prisma } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { addDays, toDay, todayUtc } from '@/lib/dates'

export class AccountError extends Error {}

export async function toggleFavorite(customerId: string, dressId: string): Promise<{ saved: boolean }> {
  const dress = await prisma.dress.findUnique({ where: { id: dressId }, select: { id: true, name: true, status: true } })
  if (!dress || dress.status === 'RETIRED') throw new AccountError('That dress is no longer in the collection.')

  const existing = await prisma.favorite.findUnique({
    where: { customerId_dressId: { customerId, dressId } },
    select: { id: true },
  })

  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { name: true } })

  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.favorite.delete({ where: { id: existing.id } })
      await recordAudit(tx, {
        staffId: null,
        actorLabel: `${customer.name} (customer)`,
        action: 'favorite.removed',
        entity: 'Dress',
        entityId: dressId,
        summary: `Removed ${dress.name} from favorites`,
      })
    })
    return { saved: false }
  }

  await prisma.$transaction(async (tx) => {
    await tx.favorite.create({ data: { customerId, dressId } })
    await recordAudit(tx, {
      staffId: null,
      actorLabel: `${customer.name} (customer)`,
      action: 'favorite.added',
      entity: 'Dress',
      entityId: dressId,
      summary: `Saved ${dress.name} to favorites`,
    })
  })
  return { saved: true }
}

export type MeasurementInput = {
  heightCm?: number | null
  bustCm?: number | null
  waistCm?: number | null
  hipsCm?: number | null
  dressSizeLabel?: string | null
  backupSize?: string | null
  shoeSize?: string | null
  notes?: string | null
}

function clampMeasure(value: number | null | undefined, min: number, max: number): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value)) return null
  const rounded = Math.round(value)
  if (rounded < min || rounded > max) throw new AccountError(`Measurements look off — use centimetres between ${min} and ${max}.`)
  return rounded
}

function cleanText(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim() || ''
  if (!trimmed) return null
  if (trimmed.length > max) throw new AccountError('That note is longer than the form can hold.')
  return trimmed
}

export async function saveMeasurements(customerId: string, input: MeasurementInput): Promise<void> {
  const data = {
    heightCm: clampMeasure(input.heightCm, 90, 230),
    bustCm: clampMeasure(input.bustCm, 50, 200),
    waistCm: clampMeasure(input.waistCm, 40, 200),
    hipsCm: clampMeasure(input.hipsCm, 50, 220),
    dressSizeLabel: cleanText(input.dressSizeLabel, 40),
    backupSize: cleanText(input.backupSize, 40),
    shoeSize: cleanText(input.shoeSize, 20),
    notes: cleanText(input.notes, 600),
  }

  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId }, select: { name: true } })
    await tx.measurement.upsert({
      where: { customerId },
      create: { customerId, ...data },
      update: data,
    })
    await recordAudit(tx, {
      staffId: null,
      actorLabel: `${customer.name} (customer)`,
      action: 'measurements.saved',
      entity: 'Customer',
      entityId: customerId,
      summary: 'Updated saved measurements from the account page',
    })
  })
}

export async function createEventList(
  customerId: string,
  input: { name: string; eventDate?: string | null; occasion?: string | null; notes?: string | null },
): Promise<string> {
  const name = input.name.trim()
  if (name.length < 2) throw new AccountError('Give the list a name — the event, or the person it is for.')
  if (name.length > 80) throw new AccountError('Keep list names under 80 characters.')

  const eventDate = input.eventDate ? toDay(input.eventDate) : null
  if (eventDate && eventDate.getTime() < addDays(todayUtc(), -1).getTime()) {
    throw new AccountError('That event date is in the past.')
  }

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId }, select: { name: true } })
    const list = await tx.eventList.create({
      data: {
        customerId,
        name,
        eventDate,
        occasion: cleanText(input.occasion, 60),
        notes: cleanText(input.notes, 600),
      },
      select: { id: true },
    })
    await recordAudit(tx, {
      staffId: null,
      actorLabel: `${customer.name} (customer)`,
      action: 'event_list.created',
      entity: 'Customer',
      entityId: customerId,
      summary: `Started event list “${name}”`,
    })
    return list.id
  })
}

export async function addToEventList(
  customerId: string,
  input: { listId: string; dressId: string; size?: string | null },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const [customer, list, dress] = await Promise.all([
      tx.customer.findUniqueOrThrow({ where: { id: customerId }, select: { name: true } }),
      tx.eventList.findFirst({ where: { id: input.listId, customerId }, select: { id: true, name: true } }),
      tx.dress.findUnique({ where: { id: input.dressId }, select: { id: true, name: true, status: true } }),
    ])
    if (!list) throw new AccountError('That event list no longer exists.')
    if (!dress || dress.status === 'RETIRED') throw new AccountError('That dress is no longer in the collection.')

    await tx.eventListItem.upsert({
      where: { eventListId_dressId: { eventListId: list.id, dressId: dress.id } },
      create: { eventListId: list.id, dressId: dress.id, size: input.size?.trim() || null },
      update: { size: input.size?.trim() || null },
    })
    await recordAudit(tx, {
      staffId: null,
      actorLabel: `${customer.name} (customer)`,
      action: 'event_list.item_added',
      entity: 'Customer',
      entityId: customerId,
      summary: `Added ${dress.name} to “${list.name}”`,
    })
  })
}

export async function removeFromEventList(customerId: string, itemId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const item = await tx.eventListItem.findFirst({
      where: { id: itemId, eventList: { customerId } },
      select: { id: true, dress: { select: { name: true } }, eventList: { select: { name: true } } },
    })
    if (!item) throw new AccountError('That item is no longer on the list.')
    const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId }, select: { name: true } })
    await tx.eventListItem.delete({ where: { id: item.id } })
    await recordAudit(tx, {
      staffId: null,
      actorLabel: `${customer.name} (customer)`,
      action: 'event_list.item_removed',
      entity: 'Customer',
      entityId: customerId,
      summary: `Removed ${item.dress.name} from “${item.eventList.name}”`,
    })
  })
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function subscribeToNewsletter(email: string, source: string): Promise<void> {
  const clean = email.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(clean) || clean.length > 160) throw new AccountError('That email address does not look right.')

  await prisma.$transaction(async (tx) => {
    const existing = await tx.subscriber.findUnique({ where: { email: clean }, select: { id: true } })
    if (!existing) {
      await tx.subscriber.create({ data: { email: clean, source } })
    }
    await recordAudit(tx, {
      staffId: null,
      actorLabel: `${clean} (customer)`,
      action: existing ? 'newsletter.resubscribed' : 'newsletter.subscribed',
      entity: 'Subscriber',
      entityId: existing?.id ?? clean,
      summary: `${existing ? 'Rejoined' : 'Joined'} the newsletter from ${source}`,
    })
  })
}
