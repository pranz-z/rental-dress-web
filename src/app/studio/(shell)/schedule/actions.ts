'use server'

/**
 * Schedule quick actions. These reuse the same domain operations as the
 * bookings section, so every rule (shipping needs a courier, late fees,
 * cleaning hand-off) is enforced exactly once. Success and failure come back
 * through the URL so the board stays a plain, refreshable page.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireCapability } from '@/lib/auth/guards'
import { BookingError, deliverBooking, returnBooking, shipBooking } from '@/lib/bookings'
import { CleaningError, completeCleaning } from '@/lib/cleaning'

const SCHEDULE_PATH = '/studio/schedule'

function revalidateScheduleViews(bookingId?: string): void {
  revalidatePath(SCHEDULE_PATH)
  revalidatePath('/studio')
  revalidatePath('/studio/bookings')
  if (bookingId) revalidatePath(`/studio/bookings/${bookingId}`)
}

/** Only ever bounce back inside the schedule board. */
function returnTo(formData: FormData): string {
  const raw = String(formData.get('returnTo') ?? '')
  return raw.startsWith(SCHEDULE_PATH) ? raw : SCHEDULE_PATH
}

async function runScheduleAction(formData: FormData, operation: () => Promise<void>, doneCode: string): Promise<never> {
  const back = returnTo(formData)
  let failure: string | null = null
  try {
    await operation()
  } catch (error) {
    if (error instanceof BookingError || error instanceof CleaningError) {
      failure = error.message
    } else {
      failure = 'Something went wrong — the change was not saved.'
      console.error('Schedule action failed:', error)
    }
  }

  if (failure) {
    redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent(failure)}`)
  }
  revalidateScheduleViews()
  redirect(`${back}${back.includes('?') ? '&' : '?'}done=${doneCode}`)
}

export async function shipFromScheduleAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get('bookingId') ?? '')
  const staff = await requireCapability('bookings.ship')
  const courier = String(formData.get('courier') ?? '')
  const trackingNumber = String(formData.get('trackingNumber') ?? '')
  return runScheduleAction(formData, () => shipBooking(bookingId, staff, { courier, trackingNumber }), 'shipped')
}

export async function deliverFromScheduleAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get('bookingId') ?? '')
  const staff = await requireCapability('bookings.deliver')
  return runScheduleAction(formData, () => deliverBooking(bookingId, staff), 'delivered')
}

export async function returnFromScheduleAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get('bookingId') ?? '')
  const staff = await requireCapability('bookings.return')
  return runScheduleAction(formData, () => returnBooking(bookingId, staff, {}), 'returned')
}

export async function completeCleaningAction(formData: FormData): Promise<void> {
  const recordId = String(formData.get('recordId') ?? '')
  const staff = await requireCapability('inventory.cleaning')
  return runScheduleAction(formData, () => completeCleaning(recordId, staff), 'cleaned')
}
