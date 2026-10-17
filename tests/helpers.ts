/**
 * Shared fixtures for the database-backed rule tests.
 *
 * Everything a test creates carries a zztest marker, and cleanup removes by
 * marker — so a crashed earlier run can never poison a later one, and studio
 * data is never touched.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const hasDatabase = process.env.ZZ_TEST_DATABASE === '1'
export const TEST_EMAIL_SUFFIX = '@zztest.local'
export const TEST_BOOKING_PREFIX = 'MR-ZZ-'
export const TEST_DRESS_SLUG_PREFIX = 'zztest-'

/** UTC-midnight day, matching how @db.Date columns round-trip. */
export function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

export const DEFAULT_SETTINGS = {
  rentalPercent4: 35,
  rentalPercent8: 55,
  bufferDays: 1,
  prepDays: 1,
  extensionFeePerDay: 4500,
  lateFeePerDay: 2500,
  lateGraceDays: 1,
  depositPercent: 20,
  insuranceFee: 1500,
  cancellationWindowDays: 7,
  cancellationRefundPercent: 50,
  autoConfirmBookings: false,
  businessHours: [] as Prisma.InputJsonValue,
  deliveryZones: [] as Prisma.InputJsonValue,
}

/** Removes every row a test run may have left behind. Safe to call twice. */
export async function cleanupFixtures(): Promise<void> {
  const bookings = await prisma.booking.findMany({
    where: { id: { startsWith: TEST_BOOKING_PREFIX } },
    select: { id: true },
  })
  const bookingIds = bookings.map((booking) => booking.id)
  if (bookingIds.length > 0) {
    await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } })
    await prisma.bookingEvent.deleteMany({ where: { bookingId: { in: bookingIds } } })
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } })
  }

  // Blocks, sizes, images and logs cascade from the dress.
  await prisma.dress.deleteMany({ where: { slug: { startsWith: TEST_DRESS_SLUG_PREFIX } } })
  await prisma.customer.deleteMany({ where: { email: { endsWith: TEST_EMAIL_SUFFIX } } })

  const staff = await prisma.staffUser.findMany({
    where: { email: { endsWith: TEST_EMAIL_SUFFIX } },
    select: { id: true },
  })
  const staffIds = staff.map((member) => member.id)
  if (staffIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { staffId: { in: staffIds } } })
    await prisma.staffUser.deleteMany({ where: { id: { in: staffIds } } })
  }
}

/** The settings singleton always exists once this returns. */
export async function ensureSettings() {
  return prisma.studioSettings.upsert({
    where: { id: 'studio' },
    update: {},
    create: { id: 'studio', ...DEFAULT_SETTINGS },
  })
}

export async function createTestStaff() {
  return prisma.staffUser.create({
    data: {
      name: 'ZZ Test Owner',
      email: `zztest-owner${TEST_EMAIL_SUFFIX}`,
      passwordHash: 'not-a-real-hash',
      role: 'OWNER',
      title: 'Test',
    },
  })
}

export async function createTestCustomer() {
  return prisma.customer.create({
    data: {
      name: 'ZZ Test Customer',
      email: `zztest-customer${TEST_EMAIL_SUFFIX}`,
      tier: 'GUEST',
    },
  })
}

export async function createTestDress(slug = `${TEST_DRESS_SLUG_PREFIX}dress`) {
  return prisma.dress.create({
    data: {
      slug,
      name: 'ZZ Test Gown',
      designer: 'Test Atelier',
      category: 'Gown',
      occasion: 'Gala',
      color: 'Ink',
      colorHex: '#111111',
      length: 'Floor',
      neckline: 'V-neck',
      sleeve: 'Sleeveless',
      fabric: 'Silk',
      retailValue: 50000,
      careNotes: 'Dry clean only.',
      fitNotes: 'True to size.',
      story: 'Test fixture.',
      artTone: 'mulberry',
      sizes: { create: [{ size: 'M' }, { size: 'S' }] },
    },
  })
}

export type TestBookingInput = {
  id: string
  customerId: string
  dressId: string
  size?: string
  eventDate: Date
  deliveryDate: Date
  returnDate: Date
  status?: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'WITH_CUSTOMER' | 'LATE' | 'RETURNED' | 'CANCELLED'
  paymentStatus?: 'UNPAID' | 'AUTHORIZED' | 'PAID' | 'REFUNDED' | 'FAILED'
  depositStatus?: 'NONE' | 'HELD' | 'REFUNDED' | 'FORFEITED'
  subtotal?: number
  addOnTotal?: number
  insuranceFee?: number
  deposit?: number
}

export async function createTestBooking(input: TestBookingInput) {
  const subtotal = input.subtotal ?? 17500
  const addOnTotal = input.addOnTotal ?? 0
  const insuranceFee = input.insuranceFee ?? 0
  const deposit = input.deposit ?? 0
  return prisma.booking.create({
    data: {
      id: input.id,
      customerId: input.customerId,
      dressId: input.dressId,
      size: input.size ?? 'M',
      eventType: 'Gala',
      eventDate: input.eventDate,
      deliveryDate: input.deliveryDate,
      returnDate: input.returnDate,
      status: input.status ?? 'CONFIRMED',
      subtotal,
      addOnTotal,
      insuranceFee,
      total: subtotal + addOnTotal + insuranceFee + deposit,
      deposit,
      paymentStatus: input.paymentStatus ?? 'UNPAID',
      depositStatus: input.depositStatus ?? 'NONE',
      shipName: 'ZZ Test Customer',
      addressLine1: '1 Test Street',
      city: 'Boston',
      region: 'MA',
      postalCode: '02115',
      country: 'United States',
    },
  })
}
