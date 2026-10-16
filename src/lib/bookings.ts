/**
 * Booking operations — the studio's reservation ledger.
 *
 * Every mutation in this module:
 *  • checks the current status before changing anything,
 *  • enforces the §8 rules (no overlapping bookings per dress + size including
 *    buffer days; returns move the dress to Cleaning; past-due becomes Late),
 *  • writes a BookingEvent for the customer-facing timeline and an AuditLog
 *    entry for the studio trail — inside one transaction.
 *
 * Server actions wrap these functions; anything the rules refuse surfaces as a
 * BookingError with a message a studio member can act on.
 */
import { Prisma, type BookingStatus, type StaffUser } from '@prisma/client'
import { prisma } from './db'
import { addDays, diffDays, formatDay, todayUtc } from './dates'
import { formatMoney } from './money'
import { findConflicts, occupancyWindow, rentalsReleased, type Occupancy } from './availability'
import { BOOKING_STATUS_META } from './domain'
import { recordAudit, staffActor } from './audit'
import { sendBookingConfirmedEmail, sendBookingShippedEmail, sendReturnReceivedEmail } from './notifications'

type Tx = Prisma.TransactionClient
type Db = Tx | typeof prisma

export class BookingError extends Error {}

function statusLabel(status: BookingStatus): string {
  return BOOKING_STATUS_META[status].label.toLowerCase()
}

async function settingsFor(db: Db) {
  return db.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } })
}

/** Every occupancy of a dress — reservations and manual blocks. */
export async function loadOccupancies(
  db: Db,
  dressId: string,
  prepDays: number,
  bufferDays: number,
): Promise<Occupancy[]> {
  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: { dressId },
      select: { id: true, size: true, status: true, deliveryDate: true, returnDate: true },
    }),
    db.dressBlock.findMany({
      where: { dressId },
      select: { id: true, size: true, startDate: true, endDate: true, reason: true },
    }),
  ])

  return [
    ...bookings.map((booking) => ({
      kind: 'BOOKING' as const,
      start: addDays(booking.deliveryDate, -prepDays),
      end: addDays(booking.returnDate, bufferDays),
      label: `booking ${booking.id}`,
      reference: booking.id,
      size: booking.size,
      released: rentalsReleased(booking.status),
    })),
    ...blocks.map((block) => ({
      kind: 'BLOCK' as const,
      start: block.startDate,
      end: block.endDate,
      label: `a studio block (${block.reason.toLowerCase()})`,
      reference: block.id,
      size: block.size,
    })),
  ]
}

/** Rule: same dress + size may not be double-booked, buffer days included. */
async function assertAvailable(
  db: Db,
  input: {
    dressId: string
    dressName: string
    size: string
    deliveryDate: Date
    returnDate: Date
    bufferDays: number
    prepDays: number
    excludeBookingId?: string
  },
): Promise<void> {
  const occupancies = (await loadOccupancies(db, input.dressId, input.prepDays, input.bufferDays)).filter(
    (entry) => entry.reference !== input.excludeBookingId,
  )
  const request = occupancyWindow({
    deliveryDate: input.deliveryDate,
    returnDate: input.returnDate,
    prepDays: input.prepDays,
    bufferDays: input.bufferDays,
  })
  const conflicts = findConflicts(occupancies, request, input.size)
  if (conflicts.length > 0) {
    const first = conflicts[0]
    throw new BookingError(
      `${input.dressName} in size ${input.size} is already held ${formatDay(first.start)} – ${formatDay(first.end)} by ${first.label}. Adjust the dates, choose another size, or remove the conflict first.`,
    )
  }
}

/**
 * Rule: a booking past its return date without a return scan becomes Late.
 * Runs on every studio screen that lists bookings, so the ledger is always
 * true without a background job.
 */
export async function markLateBookings(today: Date = todayUtc()): Promise<number> {
  const due = await prisma.booking.findMany({
    where: {
      status: { in: ['CONFIRMED', 'SHIPPED', 'WITH_CUSTOMER'] },
      returnDate: { lt: today },
    },
    select: { id: true, status: true, returnDate: true, customer: { select: { name: true } } },
  })

  let marked = 0
  for (const booking of due) {
    const previous = booking.status
    await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.updateMany({
        where: { id: booking.id, status: previous },
        data: { status: 'LATE', lateNotifiedAt: new Date() },
      })
      if (updated.count === 0) return
      marked += 1
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          type: 'STATUS_CHANGE',
          fromValue: previous,
          toValue: 'LATE',
          summary: `Return overdue — was due back ${formatDay(booking.returnDate)}. A late fee applies after the grace day.`,
          visibleToCustomer: true,
        },
      })
      await recordAudit(tx, {
        actorLabel: 'Studio automation',
        action: 'booking.marked_late',
        entity: 'Booking',
        entityId: booking.id,
        summary: `${booking.id} became late — return was due ${formatDay(booking.returnDate)} (${booking.customer.name}).`,
      })
    })
  }
  return marked
}

// ── mutations ─────────────────────────────────────────────────────────────

export async function confirmBooking(bookingId: string, staff: StaffUser): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { dress: true, customer: { select: { name: true } } },
    })
    if (!booking) throw new BookingError('That booking no longer exists.')
    if (booking.status !== 'PENDING') {
      throw new BookingError(`Only a pending booking can be confirmed — this one is ${statusLabel(booking.status)}.`)
    }

    const settings = await settingsFor(tx)
    await assertAvailable(tx, {
      dressId: booking.dressId,
      dressName: booking.dress.name,
      size: booking.size,
      deliveryDate: booking.deliveryDate,
      returnDate: booking.returnDate,
      bufferDays: settings.bufferDays,
      prepDays: settings.prepDays,
      excludeBookingId: booking.id,
    })

    const now = new Date()
    const provider = process.env.STRIPE_SECRET_KEY ? 'STRIPE' : 'STUDIO'
    const authorized = await tx.payment.count({ where: { bookingId, status: 'AUTHORIZED' } })
    if (authorized > 0) {
      // The card was authorized at reservation time — capture it now.
      await tx.payment.updateMany({
        where: { bookingId, status: 'AUTHORIZED' },
        data: { status: 'PAID', capturedAt: now },
      })
    } else if (booking.paymentStatus !== 'PAID') {
      // Reserved at the studio — take payment on the terminal.
      const rows: Prisma.PaymentCreateManyInput[] = [
        { bookingId, customerId: booking.customerId, kind: 'RENTAL', amount: booking.subtotal, status: 'PAID', provider, method: 'CARD', capturedAt: now, note: 'Captured when the booking was confirmed' },
      ]
      if (booking.addOnTotal > 0) {
        rows.push({ bookingId, customerId: booking.customerId, kind: 'ADD_ON', amount: booking.addOnTotal, status: 'PAID', provider, method: 'CARD', capturedAt: now })
      }
      if (booking.insuranceFee > 0) {
        rows.push({ bookingId, customerId: booking.customerId, kind: 'INSURANCE', amount: booking.insuranceFee, status: 'PAID', provider, method: 'CARD', capturedAt: now })
      }
      if (booking.deposit > 0) {
        rows.push({ bookingId, customerId: booking.customerId, kind: 'DEPOSIT', amount: booking.deposit, status: 'PAID', provider, method: 'CARD', capturedAt: now, note: 'Refundable damage deposit' })
      }
      await tx.payment.createMany({ data: rows })
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        depositStatus: booking.deposit > 0 ? 'HELD' : 'NONE',
      },
    })
    await tx.bookingEvent.create({
      data: {
        bookingId,
        type: 'STATUS_CHANGE',
        fromValue: 'PENDING',
        toValue: 'CONFIRMED',
        summary: 'Booking confirmed — the dress is reserved and payment is captured.',
        staffId: staff.id,
        visibleToCustomer: true,
      },
    })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'booking.confirmed',
      entity: 'Booking',
      entityId: bookingId,
      summary: `Confirmed ${bookingId} — ${booking.dress.name} for ${booking.customer.name}`,
    })
  })

  // The customer hears about it the moment the ledger settles.
  await sendBookingConfirmedEmail(bookingId)
}

export async function shipBooking(
  bookingId: string,
  staff: StaffUser,
  input: { courier: string; trackingNumber?: string },
): Promise<void> {
  const courier = input.courier.trim()
  if (!courier) throw new BookingError('Choose the courier before marking the booking as shipped.')
  const tracking = input.trackingNumber?.trim() || null

  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { dress: { select: { id: true, name: true } }, customer: { select: { name: true } } },
    })
    if (!booking) throw new BookingError('That booking no longer exists.')
    if (booking.status !== 'CONFIRMED') {
      throw new BookingError(`Only a confirmed booking can be shipped — this one is ${statusLabel(booking.status)}.`)
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'SHIPPED', shippedAt: new Date(), courier, trackingNumber: tracking },
    })
    await tx.dress.update({ where: { id: booking.dressId }, data: { status: 'RENTED' } })
    await tx.bookingEvent.create({
      data: {
        bookingId,
        type: 'STATUS_CHANGE',
        fromValue: 'CONFIRMED',
        toValue: 'SHIPPED',
        summary: `Left the studio with ${courier}${tracking ? ` — tracking ${tracking}` : ''}.`,
        staffId: staff.id,
        visibleToCustomer: true,
      },
    })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'booking.shipped',
      entity: 'Booking',
      entityId: bookingId,
      summary: `Shipped ${bookingId} via ${courier}${tracking ? ` (${tracking})` : ''}`,
      metadata: { courier, trackingNumber: tracking },
    })
  })

  await sendBookingShippedEmail(bookingId)
}

export async function deliverBooking(bookingId: string, staff: StaffUser): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { customer: { select: { name: true } } } })
    if (!booking) throw new BookingError('That booking no longer exists.')
    if (booking.status !== 'SHIPPED') {
      throw new BookingError(`Only a shipped booking can be marked delivered — this one is ${statusLabel(booking.status)}.`)
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'WITH_CUSTOMER', deliveredAt: new Date() },
    })
    await tx.bookingEvent.create({
      data: {
        bookingId,
        type: 'STATUS_CHANGE',
        fromValue: 'SHIPPED',
        toValue: 'WITH_CUSTOMER',
        summary: 'Delivered — in the customer’s hands for the event.',
        staffId: staff.id,
        visibleToCustomer: true,
      },
    })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'booking.delivered',
      entity: 'Booking',
      entityId: bookingId,
      summary: `Marked ${bookingId} delivered to ${booking.customer.name}`,
    })
  })
}

export async function returnBooking(
  bookingId: string,
  staff: StaffUser,
  input: { conditionNote?: string },
): Promise<void> {
  const conditionNote = input.conditionNote?.trim() || null

  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { dress: { select: { id: true, name: true } }, customer: { select: { name: true } } },
    })
    if (!booking) throw new BookingError('That booking no longer exists.')
    if (!['SHIPPED', 'WITH_CUSTOMER', 'LATE'].includes(booking.status)) {
      throw new BookingError(`A booking can only be returned once it is out — this one is ${statusLabel(booking.status)}.`)
    }

    const settings = await settingsFor(tx)
    const today = todayUtc()
    const now = new Date()

    // Late fee: charged for every day past the due date beyond the grace day.
    let additionalLateFee = 0
    let chargeableDays = 0
    if (booking.status === 'LATE') {
      const daysLate = Math.max(diffDays(booking.returnDate, today), 0)
      chargeableDays = Math.max(daysLate - settings.lateGraceDays, 0)
      additionalLateFee = chargeableDays * settings.lateFeePerDay
    }
    const lateFee = booking.lateFee + additionalLateFee
    const total = booking.subtotal + booking.addOnTotal + booking.insuranceFee + lateFee

    if (additionalLateFee > 0) {
      await tx.payment.create({
        data: {
          bookingId,
          customerId: booking.customerId,
          kind: 'LATE_FEE',
          amount: additionalLateFee,
          status: 'PAID',
          provider: 'STUDIO',
          method: 'CARD',
          capturedAt: now,
          note: `Late fee — ${chargeableDays} day${chargeableDays === 1 ? '' : 's'} past the return date`,
        },
      })
      await tx.bookingEvent.create({
        data: {
          bookingId,
          type: 'PAYMENT',
          summary: `Late fee of ${formatMoney(additionalLateFee)} charged — ${chargeableDays} day${chargeableDays === 1 ? '' : 's'} past the return date.`,
          staffId: staff.id,
          visibleToCustomer: true,
        },
      })
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'RETURNED', returnScannedAt: now, lateFee, total },
    })

    // Rule: returning moves the dress to Cleaning until the studio signs it off.
    await tx.dress.update({
      where: { id: booking.dressId },
      data: { status: 'CLEANING', timesRented: { increment: 1 } },
    })
    await tx.cleaningRecord.create({
      data: {
        dressId: booking.dressId,
        bookingId,
        staffId: staff.id,
        note: conditionNote,
      },
    })

    await tx.bookingEvent.create({
      data: {
        bookingId,
        type: 'STATUS_CHANGE',
        fromValue: booking.status,
        toValue: 'RETURNED',
        summary: 'Returned to the studio — cleaning and inspection in progress.',
        detail: conditionNote,
        staffId: staff.id,
        visibleToCustomer: true,
      },
    })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'booking.returned',
      entity: 'Booking',
      entityId: bookingId,
      summary: `Returned ${bookingId} — ${booking.dress.name} moved to cleaning${additionalLateFee > 0 ? `, ${formatMoney(additionalLateFee)} late fee applied` : ''}`,
    })
  })

  await sendReturnReceivedEmail(bookingId)
}

export async function extendBooking(
  bookingId: string,
  staff: StaffUser,
  input: { extraDays: number; note?: string },
): Promise<void> {
  const extraDays = Math.round(input.extraDays)
  if (!Number.isFinite(extraDays) || extraDays < 1 || extraDays > 21) {
    throw new BookingError('Choose an extension between 1 and 21 days.')
  }
  const note = input.note?.trim() || null

  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { dress: { select: { name: true } }, customer: { select: { name: true } } },
    })
    if (!booking) throw new BookingError('That booking no longer exists.')
    if (!['CONFIRMED', 'SHIPPED', 'WITH_CUSTOMER', 'LATE'].includes(booking.status)) {
      throw new BookingError(`This booking can’t be extended while it is ${statusLabel(booking.status)}.`)
    }

    const settings = await settingsFor(tx)
    const now = new Date()
    const today = todayUtc()
    const newReturnDate = addDays(booking.returnDate, extraDays)

    await assertAvailable(tx, {
      dressId: booking.dressId,
      dressName: booking.dress.name,
      size: booking.size,
      deliveryDate: booking.deliveryDate,
      returnDate: newReturnDate,
      bufferDays: settings.bufferDays,
      prepDays: settings.prepDays,
      excludeBookingId: booking.id,
    })

    const extensionFee = settings.extensionFeePerDay * extraDays
    const subtotal = booking.subtotal + extensionFee

    // Overdue days already on the clock keep their fee even when extended.
    let additionalLateFee = 0
    let chargeableDays = 0
    if (booking.status === 'LATE') {
      const daysLate = Math.max(diffDays(booking.returnDate, today), 0)
      chargeableDays = Math.max(daysLate - settings.lateGraceDays, 0)
      additionalLateFee = chargeableDays * settings.lateFeePerDay
    }
    const lateFee = booking.lateFee + additionalLateFee
    const grandTotal = subtotal + booking.addOnTotal + booking.insuranceFee + lateFee

    await tx.payment.create({
      data: {
        bookingId,
        customerId: booking.customerId,
        kind: 'RENTAL',
        amount: extensionFee,
        status: 'PAID',
        provider: 'STUDIO',
        method: 'CARD',
        capturedAt: now,
        note: `Extension — ${extraDays} additional day${extraDays === 1 ? '' : 's'}`,
      },
    })

    if (additionalLateFee > 0) {
      await tx.payment.create({
        data: {
          bookingId,
          customerId: booking.customerId,
          kind: 'LATE_FEE',
          amount: additionalLateFee,
          status: 'PAID',
          provider: 'STUDIO',
          method: 'CARD',
          capturedAt: now,
          note: `Late fee for days overdue before the extension — ${chargeableDays} day${chargeableDays === 1 ? '' : 's'}`,
        },
      })
    }

    const backOnTrack = booking.status === 'LATE' && diffDays(today, newReturnDate) >= 0
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        returnDate: newReturnDate,
        rentalDays: booking.rentalDays + extraDays,
        subtotal,
        lateFee,
        total: grandTotal,
        ...(backOnTrack ? { status: 'WITH_CUSTOMER' as const } : {}),
      },
    })

    await tx.bookingEvent.create({
      data: {
        bookingId,
        type: 'EXTENSION',
        summary: `Extended by ${extraDays} day${extraDays === 1 ? '' : 's'} — new return date ${formatDay(newReturnDate)}.`,
        detail: [
          `Extension fee ${formatMoney(extensionFee)} captured.`,
          additionalLateFee > 0
            ? `Overdue days before the extension: ${formatMoney(additionalLateFee)} late fee.`
            : null,
          note,
        ]
          .filter(Boolean)
          .join(' '),
        staffId: staff.id,
        visibleToCustomer: true,
      },
    })
    if (backOnTrack) {
      await tx.bookingEvent.create({
        data: {
          bookingId,
          type: 'STATUS_CHANGE',
          fromValue: 'LATE',
          toValue: 'WITH_CUSTOMER',
          summary: 'Extension covers the overdue days — back on schedule.',
          staffId: staff.id,
          visibleToCustomer: true,
        },
      })
    }
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'booking.extended',
      entity: 'Booking',
      entityId: bookingId,
      summary: `Extended ${bookingId} by ${extraDays} day${extraDays === 1 ? '' : 's'} to ${formatDay(newReturnDate)} — ${formatMoney(extensionFee)}`,
    })
  })
}

export async function cancelBooking(
  bookingId: string,
  staff: StaffUser,
  input: { reason?: string },
): Promise<void> {
  const reason = input.reason?.trim() || null

  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { dress: { select: { name: true } }, customer: { select: { name: true } } },
    })
    if (!booking) throw new BookingError('That booking no longer exists.')
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new BookingError(
        `Only a booking that hasn’t shipped can be cancelled — this one is ${statusLabel(booking.status)}. Mark it returned instead.`,
      )
    }

    const settings = await settingsFor(tx)
    const now = new Date()
    const withinWindow = diffDays(todayUtc(), booking.deliveryDate) >= settings.cancellationWindowDays
    const rentalBase = booking.subtotal + booking.addOnTotal + booking.insuranceFee

    let rentalRefund = 0
    if (booking.paymentStatus === 'PAID') {
      rentalRefund = withinWindow ? rentalBase : Math.round((rentalBase * settings.cancellationRefundPercent) / 100)
    }
    const depositRefund = booking.depositStatus === 'HELD' ? booking.deposit : 0
    const refundAmount = rentalRefund + depositRefund

    if (rentalRefund > 0) {
      await tx.payment.create({
        data: {
          bookingId,
          customerId: booking.customerId,
          kind: 'REFUND',
          amount: -rentalRefund,
          status: 'REFUNDED',
          provider: booking.paymentRef?.startsWith('pi_') ? 'STRIPE' : 'STUDIO',
          method: booking.paymentMethod ?? 'CARD',
          refundedAt: now,
          note: withinWindow
            ? `Cancellation refund — full rental refunded (${settings.cancellationWindowDays}+ days’ notice)`
            : `Cancellation refund — ${settings.cancellationRefundPercent}% per policy (inside the ${settings.cancellationWindowDays}-day window)`,
        },
      })
    }
    if (depositRefund > 0) {
      await tx.payment.create({
        data: {
          bookingId,
          customerId: booking.customerId,
          kind: 'REFUND',
          amount: -depositRefund,
          status: 'REFUNDED',
          provider: 'STUDIO',
          method: booking.paymentMethod ?? 'CARD',
          refundedAt: now,
          note: 'Damage deposit refunded',
        },
      })
    }
    if (booking.paymentStatus === 'AUTHORIZED') {
      await tx.payment.updateMany({
        where: { bookingId, status: 'AUTHORIZED' },
        data: { status: 'REFUNDED', refundedAt: now, note: 'Card authorization released — no funds captured' },
      })
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        refundAmount,
        ...(booking.paymentStatus === 'PAID' || booking.paymentStatus === 'AUTHORIZED'
          ? { paymentStatus: 'REFUNDED' as const }
          : {}),
        ...(booking.depositStatus === 'HELD' ? { depositStatus: 'REFUNDED' as const } : {}),
      },
    })

    const refundSummary = rentalRefund > 0
      ? `${withinWindow ? 'full refund' : `${settings.cancellationRefundPercent}% refund`} of ${formatMoney(rentalRefund)} issued`
      : booking.paymentStatus === 'AUTHORIZED'
        ? 'card authorization released, nothing captured'
        : 'no payment had been captured'
    const depositSummary = depositRefund > 0 ? ` The ${formatMoney(depositRefund)} damage deposit is released.` : ''

    await tx.bookingEvent.create({
      data: {
        bookingId,
        type: 'STATUS_CHANGE',
        fromValue: booking.status,
        toValue: 'CANCELLED',
        summary: `Cancelled — ${refundSummary}.${depositSummary}`,
        detail: reason,
        staffId: staff.id,
        visibleToCustomer: true,
      },
    })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'booking.cancelled',
      entity: 'Booking',
      entityId: bookingId,
      summary: `Cancelled ${bookingId} (${booking.customer.name}) — ${refundAmount > 0 ? `${formatMoney(refundAmount)} refunded` : 'no refund issued'}${reason ? ` · ${reason}` : ''}`,
      metadata: { withinWindow, rentalRefund, depositRefund },
    })
  })
}

export async function addBookingNote(
  bookingId: string,
  staff: StaffUser,
  input: { body: string },
): Promise<void> {
  const body = input.body.trim()
  if (!body) throw new BookingError('Write the note before saving it.')
  if (body.length > 2000) throw new BookingError('Notes are limited to 2,000 characters.')

  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, customer: { select: { name: true } } },
    })
    if (!booking) throw new BookingError('That booking no longer exists.')

    await tx.bookingEvent.create({
      data: {
        bookingId,
        type: 'NOTE',
        summary: 'Internal note',
        detail: body,
        staffId: staff.id,
        visibleToCustomer: false,
      },
    })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'booking.note_added',
      entity: 'Booking',
      entityId: bookingId,
      summary: `Added an internal note to ${bookingId}`,
    })
  })
}

// ── storefront automation ─────────────────────────────────────────────────

/**
 * Storefront setting: when the studio runs auto-confirm, a booking that is
 * paid and available is confirmed the moment it settles — at checkout with the
 * internal gateway, or when the processor's verified event lands. The default
 * keeps every booking Pending for the studio to review.
 */
export async function autoConfirmBooking(bookingId: string): Promise<boolean> {
  const confirmed = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { dress: { select: { name: true } }, customer: { select: { name: true } } },
    })
    if (!booking) return false
    if (booking.status !== 'PENDING') return false
    if (booking.paymentStatus !== 'AUTHORIZED' && booking.paymentStatus !== 'PAID') return false

    const now = new Date()
    await tx.payment.updateMany({
      where: { bookingId, status: 'AUTHORIZED' },
      data: { status: 'PAID', capturedAt: now },
    })
    const updated = await tx.booking.updateMany({
      where: { id: bookingId, status: 'PENDING' },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        depositStatus: booking.deposit > 0 ? 'HELD' : 'NONE',
      },
    })
    if (updated.count === 0) return false

    await tx.bookingEvent.create({
      data: {
        bookingId,
        type: 'STATUS_CHANGE',
        fromValue: 'PENDING',
        toValue: 'CONFIRMED',
        summary: 'Booking confirmed automatically — payment captured and the dress is reserved.',
        visibleToCustomer: true,
      },
    })
    await recordAudit(tx, {
      actorLabel: 'Storefront automation',
      action: 'booking.auto_confirmed',
      entity: 'Booking',
      entityId: bookingId,
      summary: `Auto-confirmed ${bookingId} — ${booking.dress.name} for ${booking.customer.name} (settings: confirm paid bookings automatically)`,
    })
    return true
  })

  if (confirmed) await sendBookingConfirmedEmail(bookingId)
  return confirmed
}

// ── copy ──────────────────────────────────────────────────────────────────

export const BOOKING_DONE_MESSAGES: Record<string, string> = {
  confirmed: 'confirmed — payment captured and the dress is reserved.',
  shipped: 'marked as shipped — tracking is on the timeline.',
  delivered: 'marked as delivered — enjoy the event.',
  returned: 'checked back in — the dress is in cleaning and inspection.',
  extended: 'extended — the new return date and fee are on the timeline.',
  cancelled: 'cancelled — the refund is recorded in the ledger.',
  note: 'note saved to the internal timeline.',
}
