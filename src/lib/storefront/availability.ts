/**
 * Storefront availability — the studio's own engine, read politely.
 *
 * The same occupancy windows the studio enforces (prep days before, buffer
 * days after, bookings as good as kept until returned or cancelled, manual
 * blocks included) decide what a customer may reserve. Customers see "an
 * existing reservation", never a booking ID or a customer name.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { addDays, diffDays, eachDay, formatMonthDay, isoDay, todayUtc, toDay } from '@/lib/dates'
import { findConflicts, occupancyWindow, rentalsReleased, rentalWindowFromEvent, type Conflict, type Occupancy } from '@/lib/availability'

type Db = Prisma.TransactionClient | typeof prisma

export type StorefrontWindow = { deliveryDate: Date; returnDate: Date }

export function storefrontWindow(eventDate: Date, rentalDays: number): StorefrontWindow {
  return rentalWindowFromEvent(eventDate, rentalDays)
}

/** Bulk version of the studio's loadOccupancies — same mapping, one query set. */
export async function loadStorefrontOccupancies(
  db: Db,
  dressIds: string[],
  prepDays: number,
  bufferDays: number,
): Promise<Map<string, Occupancy[]>> {
  const map = new Map<string, Occupancy[]>()
  if (dressIds.length === 0) return map

  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: { dressId: { in: dressIds } },
      select: { id: true, dressId: true, size: true, status: true, deliveryDate: true, returnDate: true },
    }),
    db.dressBlock.findMany({
      where: { dressId: { in: dressIds } },
      select: { id: true, dressId: true, size: true, startDate: true, endDate: true },
    }),
  ])

  const push = (dressId: string, entry: Occupancy) => {
    const list = map.get(dressId)
    if (list) list.push(entry)
    else map.set(dressId, [entry])
  }

  for (const booking of bookings) {
    push(booking.dressId, {
      kind: 'BOOKING',
      start: addDays(booking.deliveryDate, -prepDays),
      end: addDays(booking.returnDate, bufferDays),
      label: 'an existing reservation',
      reference: booking.id,
      size: booking.size,
      released: rentalsReleased(booking.status),
    })
  }
  for (const block of blocks) {
    push(block.dressId, {
      kind: 'BLOCK',
      start: block.startDate,
      end: block.endDate,
      label: 'a studio hold',
      reference: block.id,
      size: block.size,
    })
  }
  return map
}

export type AvailabilityResult = {
  available: boolean
  conflicts: Conflict[]
  /** Customer-safe description of the first conflict. */
  conflictLabel?: string
}

/** Customer-safe conflict copy: "an existing reservation, Oct 22 – Oct 24". */
function describeConflict(conflict: Conflict): string {
  const start = formatMonthDay(conflict.start)
  const end = formatMonthDay(conflict.end)
  return `${conflict.label}, ${start} – ${end}`
}

export function availabilityFor(
  occupancies: Occupancy[],
  deliveryDate: Date,
  returnDate: Date,
  size: string,
  prepDays = 1,
  bufferDays = 1,
): AvailabilityResult {
  const request = occupancyWindow({ deliveryDate, returnDate, prepDays, bufferDays })
  const conflicts = findConflicts(occupancies, request, size)
  return {
    available: conflicts.length === 0,
    conflicts,
    conflictLabel: conflicts.length > 0 ? describeConflict(conflicts[0]!) : undefined,
  }
}

/** Every day (ISO) an occupant holds for a size — the calendar's grey days. */
export function busyDays(occupancies: Occupancy[], size: string | null): Set<string> {
  const days = new Set<string>()
  for (const entry of occupancies) {
    if (entry.released) continue
    if (entry.size && size && entry.size !== size) continue
    for (const day of eachDay(entry.start, entry.end)) days.add(isoDay(day))
  }
  return days
}

/** Requested windows that collide, for the calendar's explanatory tooltips. */
export function busyWindows(occupancies: Occupancy[], size: string | null): Array<{ start: string; end: string; label: string }> {
  return occupancies
    .filter((entry) => !entry.released)
    .filter((entry) => !(entry.size && size && entry.size !== size))
    .map((entry) => ({ start: isoDay(entry.start), end: isoDay(entry.end), label: entry.label }))
    .sort((a, b) => (a.start < b.start ? -1 : 1))
}

/** The next event dates the chosen size can carry, scanning forward. */
export function nextFreeEventDates(input: {
  occupancies: Occupancy[]
  size: string
  rentalDays: number
  prepDays: number
  bufferDays: number
  fromEventDate: Date
  count?: number
  maxScanDays?: number
}): Date[] {
  const found: Date[] = []
  const wanted = input.count ?? 3
  const maxScan = input.maxScanDays ?? 120
  for (let offset = 0; offset <= maxScan && found.length < wanted; offset += 1) {
    const eventDate = addDays(input.fromEventDate, offset)
    const { deliveryDate, returnDate } = storefrontWindow(eventDate, input.rentalDays)
    if (availabilityFor(input.occupancies, deliveryDate, returnDate, input.size, input.prepDays, input.bufferDays).available) {
      found.push(eventDate)
    }
  }
  return found
}

/** Other sizes of the same dress free on the requested window. */
export function alternateSizes(input: {
  occupancies: Occupancy[]
  sizes: string[]
  deliveryDate: Date
  returnDate: Date
  prepDays: number
  bufferDays: number
  exclude: string
  backupSize?: string | null
}): string[] {
  return input.sizes.filter((size) => {
    if (size === input.exclude) return false
    return availabilityFor(input.occupancies, input.deliveryDate, input.returnDate, size, input.prepDays, input.bufferDays).available
  })
}

/**
 * Friendly suggestions after a lost race: alternative sizes for the same
 * window, or the next open windows for the requested size.
 */
export function buildAlternatives(input: {
  dressName: string
  occupancies: Occupancy[]
  sizes: string[]
  size: string
  rentalDays: number
  deliveryDate: Date
  returnDate: Date
  prepDays: number
  bufferDays: number
}): string[] {
  const suggestions: string[] = []
  const sizes = alternateSizes({
    occupancies: input.occupancies,
    sizes: input.sizes,
    deliveryDate: input.deliveryDate,
    returnDate: input.returnDate,
    prepDays: input.prepDays,
    bufferDays: input.bufferDays,
    exclude: input.size,
  })
  if (sizes.length > 0) {
    suggestions.push(`size ${sizes.slice(0, 3).join(' or ')} is open for the same dates`)
  }

  const dates = nextFreeEventDates({
    occupancies: input.occupancies,
    size: input.size,
    rentalDays: input.rentalDays,
    prepDays: input.prepDays,
    bufferDays: input.bufferDays,
    fromEventDate: addDays(input.deliveryDate, 1),
    count: 2,
  })
  if (dates.length > 0) {
    suggestions.push(`the next open window in size ${input.size} starts ${dates.map((date) => formatMonthDay(date)).join(' or ')}`)
  }
  return suggestions
}

/** How many days ahead customers may book. */
export {
  /** How far ahead the storefront calendar opens — client-safe, see shop-params. */
  STOREFRONT_BOOKING_HORIZON_DAYS,
} from './shop-params'

/** Delivery must be possible: the day before the event, at minimum tomorrow. */
export function earliestEventDate(today: Date = todayUtc()): Date {
  return addDays(today, 2)
}

export function daysUntil(date: Date, from: Date = todayUtc()): number {
  return diffDays(from, date)
}
