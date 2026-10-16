'use server'

/**
 * Inquiry actions. Capability-checked, rule-checked in the domain layer, and
 * reported back through the URL — `?done=` for success, `?error=` with copy
 * the studio can act on.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireCapability } from '@/lib/auth/guards'
import { InquiryError, assignInquiry, replyToInquiry, reopenInquiry, resolveInquiry } from '@/lib/inquiries'

const INQUIRIES_PATH = '/studio/inquiries'

function revalidateInquiryViews(inquiryId: string): void {
  revalidatePath(INQUIRIES_PATH)
  revalidatePath(`${INQUIRIES_PATH}/${inquiryId}`)
  revalidatePath('/studio')
}

async function runInquiryAction(inquiryId: string, operation: () => Promise<void>, doneCode: string): Promise<never> {
  let failure: string | null = null
  try {
    await operation()
  } catch (error) {
    if (error instanceof InquiryError) {
      failure = error.message
    } else {
      failure = 'Something went wrong — the change was not saved.'
      console.error('Inquiry action failed:', error)
    }
  }

  if (failure) {
    redirect(`${INQUIRIES_PATH}/${inquiryId}?error=${encodeURIComponent(failure)}`)
  }
  revalidateInquiryViews(inquiryId)
  redirect(`${INQUIRIES_PATH}/${inquiryId}?done=${doneCode}`)
}

export async function replyToInquiryAction(formData: FormData): Promise<void> {
  const inquiryId = String(formData.get('inquiryId') ?? '')
  const staff = await requireCapability('inquiries.reply')
  const body = String(formData.get('body') ?? '')
  const internal = formData.get('internal') === 'on'
  return runInquiryAction(
    inquiryId,
    async () => {
      await replyToInquiry(inquiryId, staff, { body, internal })
    },
    internal ? 'noted' : 'replied',
  )
}

export async function resolveInquiryAction(formData: FormData): Promise<void> {
  const inquiryId = String(formData.get('inquiryId') ?? '')
  const staff = await requireCapability('inquiries.reply')
  return runInquiryAction(inquiryId, () => resolveInquiry(inquiryId, staff), 'resolved')
}

export async function reopenInquiryAction(formData: FormData): Promise<void> {
  const inquiryId = String(formData.get('inquiryId') ?? '')
  const staff = await requireCapability('inquiries.reply')
  return runInquiryAction(inquiryId, () => reopenInquiry(inquiryId, staff), 'reopened')
}

export async function assignInquiryAction(formData: FormData): Promise<void> {
  const inquiryId = String(formData.get('inquiryId') ?? '')
  const staff = await requireCapability('inquiries.assign')
  const assigneeId = String(formData.get('assigneeId') ?? '')
  return runInquiryAction(
    inquiryId,
    async () => {
      await assignInquiry(inquiryId, staff, assigneeId || null)
    },
    'assigned',
  )
}
