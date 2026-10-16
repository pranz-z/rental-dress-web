/**
 * Availability engine.
 *
 * A garment occupies its calendar window from the day it is prepped (delivery
 * date minus prep days) through the day cleaning and inspection finish (return
 * date plus buffer days). Two rentals of the same dress in the same size may
 * never overlap, buffer days included.
 */

import { addDays, diffDays, eachDay, isoDay, rangesOverlap, toDay } from './dates'

export type OccupancyKind = 'BOOKING' | 'BLOCK' | 'CLEANING'

export type Occupancy = {
  kind: OccupancyKind
  /** First occupied day (inclusive, UTC midnight). */
  start: Date
  /** Last occupied day (inclusive, UTC midnight). */
  end: Date
  label: string
  reference?: string
  size?: string | null
  /** Bookings that no longer hold stock. */
  released?: boolean
}

export type OccupancyWindow = {
  /** Collection date the customer receives the dress. */
  deliveryDate: Date
  /** Date the customer returns the dress. */
  returnDate: Date
  prepDays?: number
  bufferDays?: number
}

/** Turns a requested rental into the calendar window it would occupy. */
export function occupancyWindow({
  deliveryDate,
  returnDate,
  prepDays = 1,
  bufferDays = 1,
}: OccupancyWindow): { start: Date; end: Date } {
  return {
    start: addDays(deliveryDate, -Math.max(prepDays, 0)),
    end: addDays(returnDate, Math.max(bufferDays, 0)),
  }
}

export function rentalsReleased(status: string): boolean {
  return status === 'RETURNED' || status === 'CANCELLED'
}

export type Conflict = {
  kind: OccupancyKind
  start: Date
  end: Date
  label: string
  reference?: string
}

/** Every occupancy that collides with the requested window. */
export function findConflicts(
  occupancies: Occupancy[],
  request: { start: Date; end: Date },
  size?: string | null,
): Conflict[] {
  return occupancies
    .filter((entry) => !entry.released)
    .filter((entry) => (size ? !entry.size || entry.size === size : true))
    .filter((entry) => rangesOverlap(entry.start, entry.end, request.start, request.end))
    .map((entry) => ({
      kind: entry.kind,
      start: entry.start,
      end: entry.end,
      label: entry.label,
      reference: entry.reference,
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

export function isAvailable(
  occupancies: Occupancy[],
  request: { start: Date; end: Date },
  size?: string | null,
): boolean {
  return findConflicts(occupancies, request, size).length === 0
}

/** Day-level availability for a calendar: which days are taken. */
export function occupiedDays(occupancies: Occupancy[], size?: string | null): Set<string> {
  const days = new Set<string>()
  for (const entry of occupancies) {
    if (entry.released) continue
    if (size && entry.size && entry.size !== size) continue
    for (const day of eachDay(entry.start, entry.end)) days.add(isoDay(day))
  }
  return days
}

/** The earliest collection date a garment frees up after the given day. */
export function nextFreeDay(occupancies: Occupancy[], after: Date, prepDays = 1): Date {
  const relevant = occupancies
    .filter((entry) => !entry.released && toDay(entry.end).getTime() >= toDay(after).getTime())
    .sort((a, b) => a.end.getTime() - b.end.getTime())
  if (relevant.length === 0) return toDay(after)
  const last = relevant[relevant.length - 1]
  return addDays(last.end, Math.max(prepDays, 0) + 1)
}

/** Nights a rental covers, inclusive of both the collection and return days. */
export function rentalLength(deliveryDate: Date, returnDate: Date): number {
  return diffDays(deliveryDate, returnDate) + 1
}

export function rentalWindowFromEvent(eventDate: Date, rentalDays: number): { deliveryDate: Date; returnDate: Date } {
  const deliveryDate = addDays(eventDate, -1)
  return { deliveryDate, returnDate: addDays(deliveryDate, Math.max(rentalDays - 1, 1)) }
}

/** Human summary of an occupancy window: "Oct 12 – Oct 16" */
export function summarizeWindow(start: Date, end: Date): string {
  return `${start.toISOString().slice(5, 10).replace('-', '/')} – ${end.toISOString().slice(5, 10).replace('-', '/')}`
}
