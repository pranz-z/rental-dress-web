/**
 * Wardrobe operations.
 *
 * A piece is created, edited, blocked, retired and restored from the studio.
 * Every write lands in the audit trail in the same transaction, and blocking a
 * range refuses to collide with a live rental — blocks are stored as
 * DressBlock rows, which the availability engine already reads (see
 * loadOccupancies in bookings.ts), so the same overlap rule that stops double
 * bookings also stops bookings over a block.
 */
import type { Prisma, StaffUser } from '@prisma/client'
import { recordAudit, staffActor } from './audit'
import { addDays, diffDays, formatDay, isoDay, rangesOverlap, todayUtc } from './dates'
import { prisma } from './db'

export class InventoryError extends Error {}

export const INVENTORY_DONE_MESSAGES: Record<string, string> = {
  created: 'is now part of the wardrobe.',
  updated: 'the changes are saved and live across the studio.',
  blocked: 'those dates are blocked — the calendar holds them out of availability.',
  unblocked: 'that block is removed — the dates are open again.',
  retired: 'is retired from rotation.',
  restored: 'is back in rotation.',
  cleaned: 'cleaning signed off — back on the rack and available.',
}

const MAX_NAME_LENGTH = 80
const MAX_BLOCK_DAYS = 120
const MAX_BLOCK_REASON = 160
const DEFAULT_COLOR_HEX = '#d8c9c4'

export type DressFormInput = {
  name: string
  designer: string
  category: string
  color: string
  colorHex: string
  sizes: string[]
  occasion: string
  fabric: string
  length: string
  neckline: string
  sleeve: string
  retailValue: number
  careNotes: string
  fitNotes: string
}

// ── form parsing ──────────────────────────────────────────────────────────

function fieldText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

function priceCents(formData: FormData, key: string, label: string, options: { required?: boolean } = {}): number {
  const raw = fieldText(formData, key)
    .replace(/[$\s]/g, '')
    .replace(/,/g, '')
  if (!raw) {
    if (options.required) throw new InventoryError(`Add the ${label}.`)
    return 0
  }
  const dollars = Number(raw)
  if (!Number.isFinite(dollars) || dollars < 0) {
    throw new InventoryError(`Check the ${label} — enter a dollar amount such as 1,250.`)
  }
  return Math.round(dollars * 100)
}

function parseSizes(raw: string): string[] {
  const sizes: string[] = []
  for (const token of raw.split(/[\s,;·/]+/)) {
    const size = token.trim().toUpperCase()
    if (!size) continue
    if (size.length > 4) {
      throw new InventoryError(`"${token.trim()}" is too long for a size — use short labels such as XS, S, M, L, XL.`)
    }
    if (!sizes.includes(size)) sizes.push(size)
  }
  if (sizes.length === 0) {
    throw new InventoryError('List the sizes this piece comes in — for example XS, S, M, L.')
  }
  if (sizes.length > 8) {
    throw new InventoryError('That is more than eight sizes — check the list and try again.')
  }
  return sizes
}

export function parseDressForm(formData: FormData): DressFormInput {
  const name = fieldText(formData, 'name')
  if (!name) throw new InventoryError('Give the piece a name.')
  if (name.length > MAX_NAME_LENGTH) throw new InventoryError(`Keep the name under ${MAX_NAME_LENGTH} characters.`)

  const category = fieldText(formData, 'category')
  if (!category) throw new InventoryError('Choose a category for the piece.')

  const colorHexRaw = fieldText(formData, 'colorHex').toLowerCase()
  let colorHex = DEFAULT_COLOR_HEX
  if (colorHexRaw) {
    if (!/^#[0-9a-f]{6}$/.test(colorHexRaw)) {
      throw new InventoryError('Check the colour — pick one with the swatch, or use a hex value like #7a3e4d.')
    }
    colorHex = colorHexRaw
  }

  return {
    name,
    designer: fieldText(formData, 'designer'),
    category,
    color: fieldText(formData, 'color'),
    colorHex,
    sizes: parseSizes(fieldText(formData, 'sizes')),
    occasion: fieldText(formData, 'occasion'),
    fabric: fieldText(formData, 'fabric'),
    length: fieldText(formData, 'length'),
    neckline: fieldText(formData, 'neckline'),
    sleeve: fieldText(formData, 'sleeve'),
    retailValue: priceCents(formData, 'retailValue', 'retail value', { required: true }),
    careNotes: fieldText(formData, 'careNotes'),
    fitNotes: fieldText(formData, 'fitNotes'),
  }
}

export function parseDateInput(raw: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new InventoryError(`Choose the ${label}.`)
  const [year, month, day] = raw.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day))
  if (isoDay(value) !== raw) throw new InventoryError(`The ${label} is not a real date — check it and try again.`)
  return value
}

/** 120000 cents → "1200" / 120050 → "1200.50" for form inputs. */
export function moneyInputValue(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)
}

/** "Oct 20" or "Oct 20 – Oct 27" — shared calendar copy. */
export function windowLabel(start: Date, end: Date): string {
  return isoDay(start) === isoDay(end) ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`
}

// ── writes ────────────────────────────────────────────────────────────────

function slugBase(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return base || 'dress'
}

async function uniqueSlug(tx: Prisma.TransactionClient, name: string): Promise<string> {
  const base = slugBase(name)
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 6).padEnd(4, '0')
    const slug = `${base}-${suffix}`
    const exists = await tx.dress.findUnique({ where: { slug }, select: { id: true } })
    if (!exists) return slug
  }
  return `${base}-${Date.now().toString(36)}`
}

function sizeRows(input: DressFormInput) {
  return input.sizes.map((size, index) => ({ size, quantity: 1, position: index }))
}

export async function createDress(staff: StaffUser, input: DressFormInput): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const dress = await tx.dress.create({
      data: {
        slug: await uniqueSlug(tx, input.name),
        name: input.name,
        designer: input.designer,
        category: input.category,
        occasion: input.occasion,
        color: input.color,
        colorHex: input.colorHex,
        length: input.length,
        neckline: input.neckline,
        sleeve: input.sleeve,
        fabric: input.fabric,
        retailValue: input.retailValue,
        status: 'AVAILABLE',
        careNotes: input.careNotes,
        fitNotes: input.fitNotes,
        story: '',
        artTone: 'ivory',
        isNewArrival: true,
        sizes: { create: sizeRows(input) },
      },
      select: { id: true, name: true },
    })

    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'dress.created',
      entity: 'Dress',
      entityId: dress.id,
      summary: `Added ${dress.name} to the wardrobe — ${input.category}, sizes ${input.sizes.join('/')}`,
      metadata: { category: input.category, sizes: input.sizes },
    })

    return dress.id
  })
}

export async function updateDress(staff: StaffUser, dressId: string, input: DressFormInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const dress = await tx.dress.findUnique({
      where: { id: dressId },
      include: { sizes: { orderBy: { position: 'asc' } } },
    })
    if (!dress) throw new InventoryError('That piece no longer exists.')

    const changed: string[] = []
    if (dress.name !== input.name) changed.push('name')
    if (dress.designer !== input.designer) changed.push('designer')
    if (dress.category !== input.category) changed.push('category')
    if (dress.color !== input.color || dress.colorHex.toLowerCase() !== input.colorHex.toLowerCase()) changed.push('colour')
    const sizesChanged = dress.sizes.map((row) => row.size).join(',') !== input.sizes.join(',')
    if (sizesChanged) changed.push('sizes')
    if (dress.occasion !== input.occasion) changed.push('occasion')
    if (dress.fabric !== input.fabric) changed.push('fabric')
    if (dress.length !== input.length) changed.push('length')
    if (dress.neckline !== input.neckline) changed.push('neckline')
    if (dress.sleeve !== input.sleeve) changed.push('sleeve')
    if (dress.retailValue !== input.retailValue) changed.push('retail value')
    if (dress.careNotes !== input.careNotes) changed.push('care notes')
    if (dress.fitNotes !== input.fitNotes) changed.push('fit notes')
    if (changed.length === 0) return

    await tx.dress.update({
      where: { id: dressId },
      data: {
        name: input.name,
        designer: input.designer,
        category: input.category,
        occasion: input.occasion,
        color: input.color,
        colorHex: input.colorHex,
        length: input.length,
        neckline: input.neckline,
        sleeve: input.sleeve,
        fabric: input.fabric,
        retailValue: input.retailValue,
        careNotes: input.careNotes,
        fitNotes: input.fitNotes,
        ...(sizesChanged ? { sizes: { deleteMany: {}, create: sizeRows(input) } } : {}),
      },
    })

    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'dress.updated',
      entity: 'Dress',
      entityId: dressId,
      summary: `Updated ${input.name} — ${changed.join(', ')}`,
      metadata: { changed },
    })
  })
}

export type BlockDatesInput = {
  dressId: string
  size: string | null
  startDate: Date
  endDate: Date
  reason: string
}

export async function blockDressDates(staff: StaffUser, input: BlockDatesInput): Promise<void> {
  const reason = input.reason.trim()
  if (reason.length < 3) {
    throw new InventoryError('Add a short reason for the block — the studio will see it on the calendar.')
  }
  if (reason.length > MAX_BLOCK_REASON) {
    throw new InventoryError(`Keep the reason under ${MAX_BLOCK_REASON} characters.`)
  }
  if (input.endDate.getTime() < input.startDate.getTime()) {
    throw new InventoryError('The block ends before it starts — check the dates.')
  }
  if (input.endDate.getTime() < todayUtc().getTime()) {
    throw new InventoryError('That block is already in the past — pick a range that reaches into today or later.')
  }
  if (diffDays(input.startDate, input.endDate) > MAX_BLOCK_DAYS) {
    throw new InventoryError(`Keep a single block under ${MAX_BLOCK_DAYS} days — split longer holds into two.`)
  }
  const size = input.size?.trim() || null

  await prisma.$transaction(async (tx) => {
    const dress = await tx.dress.findUnique({
      where: { id: input.dressId },
      select: { id: true, name: true, status: true },
    })
    if (!dress) throw new InventoryError('That piece no longer exists.')
    if (dress.status === 'RETIRED') {
      throw new InventoryError(`${dress.name} is retired — restore it to rotation before blocking dates.`)
    }

    if (size) {
      const stocked = await tx.dressSize.findUnique({
        where: { dressId_size: { dressId: input.dressId, size } },
        select: { id: true },
      })
      if (!stocked) throw new InventoryError(`This piece is not stocked in size ${size}.`)
    }

    // A block may never sit on top of a rental: same overlap rule as booking.
    const settings = await tx.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } })
    const bookings = await tx.booking.findMany({
      where: { dressId: input.dressId, status: { in: ['PENDING', 'CONFIRMED', 'SHIPPED', 'WITH_CUSTOMER', 'LATE'] } },
      select: {
        id: true,
        size: true,
        deliveryDate: true,
        returnDate: true,
        customer: { select: { name: true } },
      },
    })
    const clash = bookings.find((booking) => {
      if (size && booking.size !== size) return false
      const heldFrom = addDays(booking.deliveryDate, -settings.prepDays)
      const heldUntil = addDays(booking.returnDate, settings.bufferDays)
      return rangesOverlap(heldFrom, heldUntil, input.startDate, input.endDate)
    })
    if (clash) {
      const heldFrom = addDays(clash.deliveryDate, -settings.prepDays)
      const heldUntil = addDays(clash.returnDate, settings.bufferDays)
      throw new InventoryError(
        `${clash.id} (${clash.customer.name}) holds this piece ${formatDay(heldFrom)}–${formatDay(heldUntil)}. Choose days outside the booking window.`,
      )
    }

    const block = await tx.dressBlock.create({
      data: {
        dressId: input.dressId,
        size,
        startDate: input.startDate,
        endDate: input.endDate,
        reason,
        staffId: staff.id,
      },
      select: { id: true },
    })

    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'dress.blocked',
      entity: 'Dress',
      entityId: dress.id,
      summary: `Blocked ${windowLabel(input.startDate, input.endDate)} on ${dress.name} (${size ? `size ${size}` : 'all sizes'}) — ${reason}`,
      metadata: { blockId: block.id, size, start: isoDay(input.startDate), end: isoDay(input.endDate), reason },
    })
  })
}

export async function removeDressBlock(staff: StaffUser, blockId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const block = await tx.dressBlock.findUnique({
      where: { id: blockId },
      include: { dress: { select: { id: true, name: true } } },
    })
    if (!block) throw new InventoryError('That block has already been removed.')

    await tx.dressBlock.delete({ where: { id: blockId } })

    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'dress.unblocked',
      entity: 'Dress',
      entityId: block.dress.id,
      summary: `Removed the ${windowLabel(block.startDate, block.endDate)} block on ${block.dress.name}${block.size ? ` (size ${block.size})` : ''} — ${block.reason}`,
      metadata: { blockId, size: block.size, reason: block.reason },
    })
  })
}

export async function retireDress(staff: StaffUser, dressId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const dress = await tx.dress.findUnique({ where: { id: dressId }, select: { id: true, name: true, status: true } })
    if (!dress) throw new InventoryError('That piece no longer exists.')
    if (dress.status === 'RETIRED') throw new InventoryError(`${dress.name} is already retired.`)
    if (dress.status === 'RENTED') {
      throw new InventoryError(`${dress.name} is still with a customer — check it back in before retiring it.`)
    }

    const upcoming = await tx.booking.findFirst({
      where: { dressId, status: { in: ['PENDING', 'CONFIRMED'] } },
      orderBy: { deliveryDate: 'asc' },
      select: { id: true },
    })
    if (upcoming) {
      throw new InventoryError(`${upcoming.id} is still on the books for this piece. Cancel or move the booking before retiring it.`)
    }

    await tx.dress.update({ where: { id: dressId }, data: { status: 'RETIRED', retiredAt: new Date() } })

    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'dress.retired',
      entity: 'Dress',
      entityId: dressId,
      summary: `Retired ${dress.name} from rotation`,
    })
  })
}

export async function restoreDress(staff: StaffUser, dressId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const dress = await tx.dress.findUnique({ where: { id: dressId }, select: { id: true, name: true, status: true } })
    if (!dress) throw new InventoryError('That piece no longer exists.')
    if (dress.status !== 'RETIRED') throw new InventoryError(`${dress.name} is not retired — nothing to restore.`)

    const openCleaning = await tx.cleaningRecord.count({ where: { dressId, completedAt: null } })
    await tx.dress.update({
      where: { id: dressId },
      data: { status: openCleaning > 0 ? 'CLEANING' : 'AVAILABLE', retiredAt: null },
    })

    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'dress.restored',
      entity: 'Dress',
      entityId: dressId,
      summary: `Restored ${dress.name} to rotation${openCleaning > 0 ? ' — a cleaning ticket is still open' : ''}`,
    })
  })
}
