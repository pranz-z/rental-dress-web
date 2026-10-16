'use server'

/**
 * Booking actions. Each one checks the staff member's capability, runs the
 * domain operation (which enforces the studio's rules), then revalidates the
 * affected screens and reports back through the URL — `?done=` for success,
 * `?error=` with a message the studio can act on.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireCapability } from '@/lib/auth/guards'
import {
  BookingError,
  addBookingNote,
  cancelBooking,
  confirmBooking,
  deliverBooking,
  extendBooking,
  returnBooking,
  shipBooking,
} from '@/lib/bookings'

const BOOKINGS_PATH = '/studio/bookings'

function revalidateBookingViews(bookingId: string): void {
  revalidatePath(BOOKINGS_PATH)
  revalidatePath(`${BOOKINGS_PATH}/${bookingId}`)
  revalidatePath('/studio')
  revalidatePath('/studio/schedule')
}

async function runBookingAction(
  bookingId: string,
  operation: () => Promise<void>,
  doneCode: string,
): Promise<never> {
  let failure: string | null = null
  try {
    await operation()
  } catch (error) {
    failure = error instanceof BookingError ? error.message : 'Something went wrong — the change was not saved.'
    if (!(error instanceof BookingError)) console.error('Booking action failed:', error)
  }

  if (failure) {
    redirect(`${BOOKINGS_PATH}/${bookingId}?error=${encodeURIComponent(failure)}`)
  }
  revalidateBookingViews(bookingId)
  redirect(`${BOOKINGS_PATH}/${bookingId}?done=${doneCode}`)
}

export async function confirmBookingAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get('bookingId') ?? '')
  const staff = await requireCapability('bookings.confirm')
  return runBookingAction(bookingId, () => confirmBooking(bookingId, staff), 'confirmed')
}

export async function shipBookingAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get('bookingId') ?? '')
  const staff = await requireCapability('bookings.ship')
  const courier = String(formData.get('courier') ?? '')
  const trackingNumber = String(formData.get('trackingNumber') ?? '')
  return runBookingAction(bookingId, () => shipBooking(bookingId, staff, { courier, trackingNumber }), 'shipped')
}

export async function deliverBookingAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get('bookingId') ?? '')
  const staff = await requireCapability('bookings.deliver')
  return runBookingAction(bookingId, () => deliverBooking(bookingId, staff), 'delivered')
}

export async function returnBookingAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get('bookingId') ?? '')
  const staff = await requireCapability('bookings.return')
  const conditionNote = String(formData.get('conditionNote') ?? '')
  return runBookingAction(bookingId, () => returnBooking(bookingId, staff, { conditionNote }), 'returned')
}

export async function extendBookingAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get('bookingId') ?? '')
  const staff = await requireCapability('bookings.extend')
  const extraDays = Number(formData.get('extraDays') ?? 0)
  const note = String(formData.get('note') ?? '')
  return runBookingAction(bookingId, () => extendBooking(bookingId, staff, { extraDays, note }), 'extended')
}

export async function cancelBookingAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get('bookingId') ?? '')
  const staff = await requireCapability('bookings.cancel')
  const reason = String(formData.get('reason') ?? '')
  return runBookingAction(bookingId, () => cancelBooking(bookingId, staff, { reason }), 'cancelled')
}

export async function addBookingNoteAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get('bookingId') ?? '')
  const staff = await requireCapability('bookings.note')
  const body = String(formData.get('body') ?? '')
  return runBookingAction(bookingId, () => addBookingNote(bookingId, staff, { body }), 'note')
}
