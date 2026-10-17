/**
 * The rules that cost money when they break — executed against a real
 * PostgreSQL database:
 *
 *  • one dress + one size never carries two overlapping rentals (the checkout
 *    race resolves to exactly one winner, the same way placeOrder settles it)
 *  • buffer days and manual blocks keep the calendar honest
 *  • a rental past its return date becomes LATE
 *  • cancellation refunds follow the studio's percentages
 *
 * Skipped when no database is configured; CI always provides one.
 */
import type { StaffUser, StudioSettings } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { addDays, todayUtc } from '@/lib/dates'
import { availabilityFor, loadStorefrontOccupancies } from '@/lib/storefront/availability'
import { cancelBooking, markLateBookings } from '@/lib/bookings'
import {
  cleanupFixtures,
  createTestBooking,
  createTestCustomer,
  createTestDress,
  createTestStaff,
  day,
  ensureSettings,
  hasDatabase,
  TEST_DRESS_SLUG_PREFIX,
} from './helpers'

const PREP_DAYS = 1
const BUFFER_DAYS = 1

describe.skipIf(!hasDatabase)('booking rules against a real database', () => {
  let staff: StaffUser
  let customerId: string
  let dressId: string
  let originalSettings: StudioSettings | null = null

  beforeAll(async () => {
    await cleanupFixtures()
    originalSettings = await prisma.studioSettings.findUnique({ where: { id: 'studio' } })
    await ensureSettings()
    await prisma.studioSettings.update({
      where: { id: 'studio' },
      data: {
        prepDays: PREP_DAYS,
        bufferDays: BUFFER_DAYS,
        cancellationWindowDays: 7,
        cancellationRefundPercent: 50,
        lateGraceDays: 1,
        lateFeePerDay: 2500,
      },
    })

    staff = await createTestStaff()
    const customer = await createTestCustomer()
    customerId = customer.id
    const dress = await createTestDress(`${TEST_DRESS_SLUG_PREFIX}rules`)
    dressId = dress.id
  })

  afterAll(async () => {
    await cleanupFixtures()
    if (originalSettings) {
      // Restore exactly the fields this suite pins — the row also carries JSON
      // columns that must not round-trip through a spread.
      await prisma.studioSettings.update({
        where: { id: 'studio' },
        data: {
          prepDays: originalSettings.prepDays,
          bufferDays: originalSettings.bufferDays,
          cancellationWindowDays: originalSettings.cancellationWindowDays,
          cancellationRefundPercent: originalSettings.cancellationRefundPercent,
          lateGraceDays: originalSettings.lateGraceDays,
          lateFeePerDay: originalSettings.lateFeePerDay,
        },
      })
    } else {
      await prisma.studioSettings.delete({ where: { id: 'studio' } })
    }
  })

  async function occupanciesOf(): Promise<ReturnType<typeof loadStorefrontOccupancies>> {
    return loadStorefrontOccupancies(prisma, [dressId], PREP_DAYS, BUFFER_DAYS)
  }

  describe('no overlapping bookings per dress and size', () => {
    const held = { delivery: day('2027-05-10'), returned: day('2027-05-13') }

    beforeAll(async () => {
      await createTestBooking({
        id: 'MR-ZZ-OVERLAP',
        customerId,
        dressId,
        size: 'M',
        eventDate: day('2027-05-11'),
        deliveryDate: held.delivery,
        returnDate: held.returned,
        status: 'CONFIRMED',
      })
    })

    it('refuses a second rental that overlaps the held window', async () => {
      const occupancies = await occupanciesOf()
      const result = availabilityFor(occupancies.get(dressId) ?? [], day('2027-05-11'), day('2027-05-14'), 'M', PREP_DAYS, BUFFER_DAYS)
      expect(result.available).toBe(false)
      expect(result.conflictLabel).toContain('an existing reservation')
    })

    it('refuses a rental that only touches the buffer tail', async () => {
      // Held window ends May 14 (return May 13 + one buffer day). A May 15
      // collection would prep on May 14 — still buffer time — so it is refused.
      const occupancies = await occupanciesOf()
      const tooSoon = availabilityFor(occupancies.get(dressId) ?? [], day('2027-05-15'), day('2027-05-18'), 'M', PREP_DAYS, BUFFER_DAYS)
      expect(tooSoon.available).toBe(false)

      const firstFree = availabilityFor(occupancies.get(dressId) ?? [], day('2027-05-16'), day('2027-05-19'), 'M', PREP_DAYS, BUFFER_DAYS)
      expect(firstFree.available).toBe(true)
    })

    it('allows the same dates in a different size', async () => {
      const occupancies = await occupanciesOf()
      const result = availabilityFor(occupancies.get(dressId) ?? [], held.delivery, held.returned, 'S', PREP_DAYS, BUFFER_DAYS)
      expect(result.available).toBe(true)
    })

    it('frees the window again once the booking is released', async () => {
      await prisma.booking.update({ where: { id: 'MR-ZZ-OVERLAP' }, data: { status: 'CANCELLED' } })
      const occupancies = await occupanciesOf()
      const result = availabilityFor(occupancies.get(dressId) ?? [], held.delivery, held.returned, 'M', PREP_DAYS, BUFFER_DAYS)
      expect(result.available).toBe(true)
    })
  })

  describe('blocked dates', () => {
    beforeAll(async () => {
      await prisma.dressBlock.create({
        data: { dressId, size: null, startDate: day('2027-06-01'), endDate: day('2027-06-03'), reason: 'Editorial shoot' },
      })
      await prisma.dressBlock.create({
        data: { dressId, size: 'S', startDate: day('2027-06-10'), endDate: day('2027-06-12'), reason: 'Repair' },
      })
    })

    it('a block without a size closes every size, prep included', async () => {
      const occupancies = await occupanciesOf()
      for (const size of ['M', 'S']) {
        const inside = availabilityFor(occupancies.get(dressId) ?? [], day('2027-06-02'), day('2027-06-05'), size, PREP_DAYS, BUFFER_DAYS)
        expect(inside.available, `size ${size} inside the block`).toBe(false)
      }
      // Collection June 4 preps June 3 — the block's last day: refused.
      const prepClash = availabilityFor(occupancies.get(dressId) ?? [], day('2027-06-04'), day('2027-06-07'), 'M', PREP_DAYS, BUFFER_DAYS)
      expect(prepClash.available).toBe(false)
      // Collection June 5 preps June 4 — the first free day: allowed.
      const firstFree = availabilityFor(occupancies.get(dressId) ?? [], day('2027-06-05'), day('2027-06-08'), 'M', PREP_DAYS, BUFFER_DAYS)
      expect(firstFree.available).toBe(true)
    })

    it('a block with a size only closes that size', async () => {
      const occupancies = await occupanciesOf()
      const inS = availabilityFor(occupancies.get(dressId) ?? [], day('2027-06-11'), day('2027-06-14'), 'S', PREP_DAYS, BUFFER_DAYS)
      expect(inS.available).toBe(false)
      const inM = availabilityFor(occupancies.get(dressId) ?? [], day('2027-06-11'), day('2027-06-14'), 'M', PREP_DAYS, BUFFER_DAYS)
      expect(inM.available).toBe(true)
    })
  })

  describe('concurrent checkout — exactly one winner', () => {
    it('lets one of six simultaneous requests hold the dress', async () => {
      const delivery = day('2027-07-10')
      const returnDate = day('2027-07-13')

      // The same critical section placeOrder runs: lock the dress row, re-read
      // occupancies under the lock, refuse conflicts, then write the booking.
      async function attempt(id: string) {
        return prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM "Dress" WHERE id = ${dressId} FOR UPDATE`
            const occupancies = await loadStorefrontOccupancies(tx, [dressId], PREP_DAYS, BUFFER_DAYS)
            const result = availabilityFor(occupancies.get(dressId) ?? [], delivery, returnDate, 'M', PREP_DAYS, BUFFER_DAYS)
            if (!result.available) return { ok: false as const, conflict: result.conflictLabel }
            await tx.booking.create({
              data: {
                id,
                customerId,
                dressId,
                size: 'M',
                eventType: 'Gala',
                eventDate: day('2027-07-11'),
                deliveryDate: delivery,
                returnDate,
                status: 'PENDING',
                subtotal: 17500,
                total: 17500,
                shipName: 'ZZ Test Customer',
                addressLine1: '1 Test Street',
                city: 'Boston',
                region: 'MA',
                postalCode: '02115',
                country: 'United States',
              },
            })
            return { ok: true as const }
          },
          { timeout: 15_000 },
        )
      }

      const outcomes = await Promise.all(
        Array.from({ length: 6 }, (_, index) => attempt(`MR-ZZ-RACE-${index}`)),
      )

      const winners = outcomes.filter((outcome) => outcome.ok)
      expect(winners).toHaveLength(1)
      for (const loser of outcomes.filter((outcome) => !outcome.ok)) {
        expect(loser.conflict).toContain('an existing reservation')
      }

      const held = await prisma.booking.count({
        where: { id: { startsWith: 'MR-ZZ-RACE-' }, status: { not: 'CANCELLED' } },
      })
      expect(held).toBe(1)
    })
  })

  describe('late status', () => {
    const TODAY = day('2027-08-10')

    beforeAll(async () => {
      await createTestBooking({ id: 'MR-ZZ-LATE-1', customerId, dressId, eventDate: day('2027-08-05'), deliveryDate: day('2027-08-02'), returnDate: day('2027-08-09'), status: 'CONFIRMED' })
      await createTestBooking({ id: 'MR-ZZ-LATE-2', customerId, dressId, eventDate: day('2027-08-05'), deliveryDate: day('2027-08-03'), returnDate: day('2027-08-10'), status: 'CONFIRMED' })
      await createTestBooking({ id: 'MR-ZZ-LATE-3', customerId, dressId, eventDate: day('2027-07-25'), deliveryDate: day('2027-07-22'), returnDate: day('2027-08-01'), status: 'RETURNED' })
    })

    it('marks bookings past their return date and leaves the rest alone', async () => {
      const marked = await markLateBookings(TODAY)
      expect(marked).toBeGreaterThanOrEqual(1)

      const late = await prisma.booking.findUniqueOrThrow({ where: { id: 'MR-ZZ-LATE-1' } })
      expect(late.status).toBe('LATE')
      expect(late.lateNotifiedAt).not.toBeNull()
      expect(await prisma.bookingEvent.count({ where: { bookingId: 'MR-ZZ-LATE-1', toValue: 'LATE' } })).toBe(1)

      const dueToday = await prisma.booking.findUniqueOrThrow({ where: { id: 'MR-ZZ-LATE-2' } })
      expect(dueToday.status).toBe('CONFIRMED')

      const returned = await prisma.booking.findUniqueOrThrow({ where: { id: 'MR-ZZ-LATE-3' } })
      expect(returned.status).toBe('RETURNED')
    })

    it('is idempotent — a second sweep does not re-mark or double-log', async () => {
      await markLateBookings(TODAY)
      expect(await prisma.bookingEvent.count({ where: { bookingId: 'MR-ZZ-LATE-1', toValue: 'LATE' } })).toBe(1)
    })
  })

  describe('cancellation refunds', () => {
    it('refunds the full rental plus deposit when cancelled outside the window', async () => {
      await createTestBooking({
        id: 'MR-ZZ-REF-1',
        customerId,
        dressId,
        eventDate: addDays(todayUtc(), 32),
        deliveryDate: addDays(todayUtc(), 30),
        returnDate: addDays(todayUtc(), 33),
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        depositStatus: 'HELD',
        subtotal: 20000,
        addOnTotal: 5000,
        deposit: 20000,
      })

      await cancelBooking('MR-ZZ-REF-1', staff, { reason: 'Plans changed' })

      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: 'MR-ZZ-REF-1' } })
      expect(booking.status).toBe('CANCELLED')
      expect(booking.paymentStatus).toBe('REFUNDED')
      expect(booking.depositStatus).toBe('REFUNDED')
      // 25000 rental base fully refunded + 20000 deposit.
      expect(booking.refundAmount).toBe(45000)

      const refunds = await prisma.payment.findMany({ where: { bookingId: 'MR-ZZ-REF-1', kind: 'REFUND' } })
      expect(refunds.reduce((sum, payment) => sum + payment.amount, 0)).toBe(-45000)
    })

    it('keeps the studio’s percentage when cancelled inside the window', async () => {
      await createTestBooking({
        id: 'MR-ZZ-REF-2',
        customerId,
        dressId,
        eventDate: addDays(todayUtc(), 5),
        deliveryDate: addDays(todayUtc(), 3),
        returnDate: addDays(todayUtc(), 6),
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        depositStatus: 'HELD',
        subtotal: 20000,
        addOnTotal: 5000,
        deposit: 20000,
      })

      await cancelBooking('MR-ZZ-REF-2', staff, {})

      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: 'MR-ZZ-REF-2' } })
      // 50% of the 25000 rental base + the full 20000 deposit.
      expect(booking.refundAmount).toBe(32500)

      const refunds = await prisma.payment.findMany({ where: { bookingId: 'MR-ZZ-REF-2', kind: 'REFUND' } })
      expect(refunds.reduce((sum, payment) => sum + payment.amount, 0)).toBe(-32500)
    })

    it('treats the exact window boundary as inside the window', async () => {
      await createTestBooking({
        id: 'MR-ZZ-REF-3',
        customerId,
        dressId,
        eventDate: addDays(todayUtc(), 9),
        deliveryDate: addDays(todayUtc(), 7),
        returnDate: addDays(todayUtc(), 10),
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        subtotal: 10000,
      })

      await cancelBooking('MR-ZZ-REF-3', staff, {})

      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: 'MR-ZZ-REF-3' } })
      expect(booking.refundAmount).toBe(10000)
    })

    it('refunds nothing when no payment was captured', async () => {
      await createTestBooking({
        id: 'MR-ZZ-REF-4',
        customerId,
        dressId,
        eventDate: addDays(todayUtc(), 32),
        deliveryDate: addDays(todayUtc(), 30),
        returnDate: addDays(todayUtc(), 33),
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        depositStatus: 'NONE',
        subtotal: 15000,
      })

      await cancelBooking('MR-ZZ-REF-4', staff, {})

      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: 'MR-ZZ-REF-4' } })
      expect(booking.status).toBe('CANCELLED')
      expect(booking.refundAmount).toBe(0)
      expect(booking.paymentStatus).toBe('UNPAID')
      expect(await prisma.payment.count({ where: { bookingId: 'MR-ZZ-REF-4', kind: 'REFUND' } })).toBe(0)
    })
  })
})
