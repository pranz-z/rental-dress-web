/**
 * The availability engine — the studio's oldest rulebook.
 *
 * Booking windows occupy calendar days from prep (delivery minus prep days)
 * through cleaning (return plus buffer days), and two rentals of the same
 * dress in the same size may never overlap, buffer days included.
 */
import { describe, expect, it } from 'vitest'
import {
  findConflicts,
  isAvailable,
  occupancyWindow,
  rentalLength,
  rentalsReleased,
  type Occupancy,
} from '@/lib/availability'
import { day } from './helpers'

function occupancy(entry: Partial<Occupancy> & { start: Date; end: Date }): Occupancy {
  return { kind: 'BOOKING', label: 'an existing reservation', ...entry }
}

describe('occupancyWindow', () => {
  it('extends the rental by prep days before delivery and buffer days after return', () => {
    const window = occupancyWindow({
      deliveryDate: day('2027-03-10'),
      returnDate: day('2027-03-13'),
      prepDays: 1,
      bufferDays: 2,
    })
    expect(window.start.toISOString()).toBe(day('2027-03-09').toISOString())
    expect(window.end.toISOString()).toBe(day('2027-03-15').toISOString())
  })
})

describe('overlap rule — one dress, one size', () => {
  it('treats the blocking window as inclusive on both ends', () => {
    const held = occupancy({ start: day('2027-03-10'), end: day('2027-03-15') })

    // The return/buffer day itself is still taken.
    expect(isAvailable([held], { start: day('2027-03-15'), end: day('2027-03-18') })).toBe(false)
    // The day after the window is free.
    expect(isAvailable([held], { start: day('2027-03-16'), end: day('2027-03-18') })).toBe(true)
  })

  it('only blocks the size that is held', () => {
    const held = occupancy({ start: day('2027-03-10'), end: day('2027-03-15'), size: 'M' })

    expect(isAvailable([held], { start: day('2027-03-11'), end: day('2027-03-13') }, 'M')).toBe(false)
    expect(isAvailable([held], { start: day('2027-03-11'), end: day('2027-03-13') }, 'S')).toBe(true)
  })

  it('lets a studio block without a size close every size', () => {
    const block = occupancy({ kind: 'BLOCK', label: 'a studio hold', size: null, start: day('2027-03-10'), end: day('2027-03-15') })

    expect(isAvailable([block], { start: day('2027-03-11'), end: day('2027-03-13') }, 'S')).toBe(false)
    expect(isAvailable([block], { start: day('2027-03-11'), end: day('2027-03-13') }, 'M')).toBe(false)
  })

  it('ignores released rentals and cancelled bookings', () => {
    const returned = occupancy({ start: day('2027-03-10'), end: day('2027-03-15'), released: true })

    expect(rentalsReleased('RETURNED')).toBe(true)
    expect(rentalsReleased('CANCELLED')).toBe(true)
    expect(rentalsReleased('CONFIRMED')).toBe(false)
    expect(isAvailable([returned], { start: day('2027-03-11'), end: day('2027-03-13') }, 'M')).toBe(true)
  })

  it('reports every conflict sorted by start date', () => {
    const later = occupancy({ start: day('2027-04-20'), end: day('2027-04-22') })
    const earlier = occupancy({ start: day('2027-04-10'), end: day('2027-04-12') })

    const conflicts = findConflicts([later, earlier], { start: day('2027-04-10'), end: day('2027-04-22') }, 'M')
    expect(conflicts.map((conflict) => conflict.start.toISOString())).toEqual([
      day('2027-04-10').toISOString(),
      day('2027-04-20').toISOString(),
    ])
  })
})

describe('buffer days', () => {
  it('keeps the dress out of circulation through the buffer, then a prep day before the next rental', () => {
    // Held: delivery Mar 10, returned Mar 13 — occupied Mar 9 through Mar 14.
    const held = occupancyWindow({
      deliveryDate: day('2027-03-10'),
      returnDate: day('2027-03-13'),
      prepDays: 1,
      bufferDays: 1,
    })
    expect(held.end.toISOString()).toBe(day('2027-03-14').toISOString())

    const occupancies = [occupancy(held)]

    // Next delivery Mar 15 — the prep day (Mar 14) is still buffer time: refused.
    const tooSoon = occupancyWindow({ deliveryDate: day('2027-03-15'), returnDate: day('2027-03-18'), prepDays: 1, bufferDays: 1 })
    expect(isAvailable(occupancies, tooSoon, 'M')).toBe(false)

    // Next delivery Mar 16 — prep starts Mar 15, the first free day: allowed.
    const fine = occupancyWindow({ deliveryDate: day('2027-03-16'), returnDate: day('2027-03-19'), prepDays: 1, bufferDays: 1 })
    expect(isAvailable(occupancies, fine, 'M')).toBe(true)
  })

  it('a larger buffer pushes the next free collection out further', () => {
    const held = occupancyWindow({
      deliveryDate: day('2027-03-10'),
      returnDate: day('2027-03-13'),
      prepDays: 1,
      bufferDays: 3,
    })
    expect(held.end.toISOString()).toBe(day('2027-03-16').toISOString())

    const occupancies = [occupancy(held)]
    expect(isAvailable(occupancies, occupancyWindow({ deliveryDate: day('2027-03-17'), returnDate: day('2027-03-20'), prepDays: 1, bufferDays: 1 }), 'M')).toBe(false)
    expect(isAvailable(occupancies, occupancyWindow({ deliveryDate: day('2027-03-18'), returnDate: day('2027-03-21'), prepDays: 1, bufferDays: 1 }), 'M')).toBe(true)
  })
})

describe('rentalLength', () => {
  it('counts both the collection and return days', () => {
    expect(rentalLength(day('2027-03-10'), day('2027-03-13'))).toBe(4)
    expect(rentalLength(day('2027-03-10'), day('2027-03-10'))).toBe(1)
  })
})
