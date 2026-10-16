'use server'

/**
 * Customers actions. The profile is a read for every role that can open it —
 * the stylists' one write is an internal note, which funnels through
 * lib/customers.ts so the audit entry and the profile stay in step.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireCapability } from '@/lib/auth/guards'
import { CustomersError, addCustomerNote } from '@/lib/customers'

export async function addCustomerNoteAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('customers.note')
  const customerId = String(formData.get('customerId') ?? '')
  const body = String(formData.get('body') ?? '')
  const base = `/studio/customers/${customerId}`

  try {
    await addCustomerNote(staff, customerId, body)
  } catch (error) {
    if (error instanceof CustomersError) {
      redirect(`${base}?error=${encodeURIComponent(error.message)}`)
    }
    console.error('Customer note failed:', error)
    redirect(`${base}?error=${encodeURIComponent('Something went wrong — the note was not saved.')}`)
  }

  revalidatePath('/studio/customers')
  revalidatePath(base)
  redirect(`${base}?done=note_added`)
}
