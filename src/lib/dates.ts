/**
 * Date helpers.
 *
 * Every calendar date in the studio (event, delivery, return, blocks) is stored
 * as a Postgres `date` and handled as a UTC-midnight instant, so a booking made
 * in Boston and a booking made in Los Angeles describe the same calendar day.
 * "Today" is resolved in the studio's timezone, never the viewer's.
 */

export const STUDIO_TIMEZONE = process.env.STUDIO_TIMEZONE || 'America/New_York'

const MS_PER_DAY = 86_400_000

/** UTC-midnight Date for a calendar date. */
export function dayUtc(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day))
}

/** Midnight-in-a-timezone as a UTC-midnight calendar date. */
export function todayUtc(timeZone: string = STUDIO_TIMEZONE): Date {
  return toStudioDay(new Date(), timeZone)
}

/** The studio-timezone calendar date for any instant (timestamps included). */
export function toStudioDay(value: Date | string, timeZone: string = STUDIO_TIMEZONE): Date {
  const d = typeof value === 'string' ? new Date(value) : value
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  return dayUtc(get('year'), get('month') - 1, get('day'))
}

/** Normalises any Date/string to a UTC-midnight calendar date. */
export function toDay(value: Date | string): Date {
  const d = typeof value === 'string' ? new Date(value) : value
  return dayUtc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function addDays(value: Date | string, days: number): Date {
  const d = toDay(value)
  return new Date(d.getTime() + days * MS_PER_DAY)
}

export function addMonths(value: Date | string, months: number): Date {
  const d = toDay(value)
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  target.setUTCMonth(target.getUTCMonth() + months)
  const day = Math.min(d.getUTCDate(), daysInMonth(target.getUTCFullYear(), target.getUTCMonth()))
  return dayUtc(target.getUTCFullYear(), target.getUTCMonth(), day)
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/** Whole days between two calendar dates (b - a). */
export function diffDays(a: Date | string, b: Date | string): number {
  return Math.round((toDay(b).getTime() - toDay(a).getTime()) / MS_PER_DAY)
}

export function startOfMonth(value: Date | string): Date {
  const d = toDay(value)
  return dayUtc(d.getUTCFullYear(), d.getUTCMonth(), 1)
}

export function endOfMonth(value: Date | string): Date {
  const d = toDay(value)
  return dayUtc(d.getUTCFullYear(), d.getUTCMonth(), daysInMonth(d.getUTCFullYear(), d.getUTCMonth()))
}

/** Inclusive range check on calendar dates. */
export function isBetween(day: Date | string, start: Date | string, end: Date | string): boolean {
  const d = toDay(day).getTime()
  return d >= toDay(start).getTime() && d <= toDay(end).getTime()
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return toDay(aStart).getTime() <= toDay(bEnd).getTime() && toDay(bStart).getTime() <= toDay(aEnd).getTime()
}

/** The first day after the returned dress has been cleaned and inspected. */
export function blockedUntil(returnDate: Date | string, bufferDays: number): Date {
  return addDays(returnDate, Math.max(bufferDays, 0))
}

export function eachDay(start: Date | string, end: Date | string): Date[] {
  const out: Date[] = []
  for (let d = toDay(start); d.getTime() <= toDay(end).getTime(); d = addDays(d, 1)) out.push(d)
  return out
}

// ── formatting (always UTC so the studio's calendar day never shifts) ──

function fmt(value: Date | string, options: Intl.DateTimeFormatOptions, timeZone = 'UTC') {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(toDay(value))
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function formatDay(value: Date | string): string {
  const d = toDay(value)
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`
}

export function formatDayLong(value: Date | string): string {
  return fmt(value, { month: 'long', day: 'numeric', year: 'numeric' })
}

export function formatMonthDay(value: Date | string): string {
  return fmt(value, { month: 'long', day: 'numeric' })
}

export function formatMonthYear(value: Date | string): string {
  return fmt(value, { month: 'long', year: 'numeric' })
}

export function formatMonthShort(value: Date | string): string {
  return MONTHS_SHORT[toDay(value).getUTCMonth()]
}

export function weekdayName(value: Date | string): string {
  return WEEKDAYS[toDay(value).getUTCDay()]
}

export function formatWeekday(value: Date | string): string {
  return fmt(value, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatWeekdayLong(value: Date | string): string {
  return `${WEEKDAYS[toDay(value).getUTCDay()]}, ${formatMonthDay(value)}`
}

export function formatTime(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: STUDIO_TIMEZONE,
  }).format(d)
}

export function formatDateTime(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: STUDIO_TIMEZONE,
  }).format(d)
}

export function relativeFromNow(value: Date | string, now: Date = new Date()): string {
  const d = typeof value === 'string' ? new Date(value) : value
  const minutes = Math.round((now.getTime() - d.getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return formatDay(d)
}

/** "in 3 days" / "today" / "2 days ago" for schedule copy. */
export function relativeDayLabel(value: Date | string, today: Date = todayUtc()): string {
  const delta = diffDays(today, value)
  if (delta === 0) return 'Today'
  if (delta === 1) return 'Tomorrow'
  if (delta === -1) return 'Yesterday'
  if (delta > 1) return `In ${delta} days`
  return `${Math.abs(delta)} days ago`
}

export function isoDay(value: Date | string): string {
  return toDay(value).toISOString().slice(0, 10)
}

export function isWeekend(day: Date | string): boolean {
  const dayOfWeek = toDay(day).getUTCDay()
  return dayOfWeek === 0 || dayOfWeek === 6
}

/** "October 2026" month key, used for grouping revenue. */
export function monthKey(value: Date | string): string {
  return isoDay(value).slice(0, 7)
}
