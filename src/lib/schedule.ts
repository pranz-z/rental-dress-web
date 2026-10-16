/**
 * Schedule helpers — the copy and small conventions shared by the schedule
 * board and its printable run sheet.
 */

export const SCHEDULE_DONE_MESSAGES: Record<string, string> = {
  shipped: 'Booking marked as shipped — its tracking is on the timeline.',
  delivered: 'Booking marked as delivered — the dress is with the customer.',
  returned: 'Booking checked back in — the dress moved to cleaning and inspection.',
  cleaned: 'Cleaning signed off — the dress is back on the rack and available.',
}

export const SCHEDULE_TYPES = ['DELIVERY', 'RETURN', 'CLEANING'] as const
export type ScheduleType = (typeof SCHEDULE_TYPES)[number]

export const SCHEDULE_TYPE_LABEL: Record<ScheduleType, string> = {
  DELIVERY: 'Deliveries',
  RETURN: 'Returns',
  CLEANING: 'Cleaning',
}

export const SCHEDULE_RANGES = [7, 14, 30] as const
export type ScheduleRange = (typeof SCHEDULE_RANGES)[number]

export function parseScheduleTypes(value: string | undefined): ScheduleType[] {
  if (value === undefined) return [...SCHEDULE_TYPES]
  const chosen = value
    .split(',')
    .map((part) => part.trim().toUpperCase())
    .filter((part): part is ScheduleType => (SCHEDULE_TYPES as readonly string[]).includes(part))
  return [...new Set(chosen)]
}

export function parseScheduleRange(value: string | undefined): ScheduleRange {
  const parsed = Number(value)
  return (SCHEDULE_RANGES as readonly number[]).includes(parsed) ? (parsed as ScheduleRange) : 14
}

/** The schedule board URL for a set of filters — also the actions' return path. */
export function scheduleHref(input: { types: ScheduleType[]; range: ScheduleRange }): string {
  const params = new URLSearchParams()
  if (input.types.length !== SCHEDULE_TYPES.length) params.set('type', input.types.join(','))
  if (input.range !== 14) params.set('range', String(input.range))
  const query = params.toString()
  return query ? `/studio/schedule?${query}` : '/studio/schedule'
}
