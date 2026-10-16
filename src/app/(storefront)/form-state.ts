import type { InquiryTopic } from '@prisma/client'

/** Shared shape for every customer-facing form that reports back inline. */
export type FormState = {
  status: 'idle' | 'ok' | 'error'
  message?: string
  suggestions?: string[]
}

export const IDLE_FORM: FormState = { status: 'idle' }

export const INQUIRY_TOPIC_CHOICES: Array<{ value: InquiryTopic; label: string }> = [
  { value: 'SIZING', label: 'Sizing and fit' },
  { value: 'BOOKING_CHANGE', label: 'Booking change' },
  { value: 'GROUP_BOOKING', label: 'Group or bridal party' },
  { value: 'DELIVERY', label: 'Delivery and returns' },
  { value: 'DAMAGE', label: 'Care and damage' },
  { value: 'GENERAL', label: 'Something else' },
]

export function isInquiryTopic(value: string): value is InquiryTopic {
  return INQUIRY_TOPIC_CHOICES.some((choice) => choice.value === value)
}
