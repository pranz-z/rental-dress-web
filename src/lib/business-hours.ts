/**
 * Business hours.
 *
 * The studio's opening times, edited in Settings → Hours & delivery. The
 * storefront shows them, and the inquiry reply clock counts only time inside
 * them — a note that arrives on Friday evening is due back within the target
 * hours counted from the next open morning.
 *
 * Times are wall-clock strings ("09:00") in the same frame the rest of the
 * app records timestamps (UTC), which keeps the math deterministic.
 */

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
export type Weekday = (typeof WEEKDAYS)[number]

export type DayHours = { open: string; close: string } | null
export type BusinessHours = Record<Weekday, DayHours>

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  monday: { open: '09:00', close: '18:00' },
  tuesday: { open: '09:00', close: '18:00' },
  wednesday: { open: '09:00', close: '18:00' },
  thursday: { open: '09:00', close: '18:00' },
  friday: { open: '09:00', close: '18:00' },
  saturday: { open: '10:00', close: '16:00' },
  sunday: null,
}

export function parseBusinessHours(json: unknown): BusinessHours {
  const source = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  const hours = {} as BusinessHours
  for (const day of WEEKDAYS) {
    const value = source[day]
    if (value && typeof value === 'object') {
      const row = value as Record<string, unknown>
      const open = typeof row.open === 'string' && TIME_PATTERN.test(row.open) ? row.open : null
      const close = typeof row.close === 'string' && TIME_PATTERN.test(row.close) ? row.close : null
      hours[day] = open && close && close > open ? { open, close } : null
    } else {
      hours[day] = null
    }
  }
  return hours
}

function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function weekdayOf(date: Date): Weekday {
  // getUTCDay: 0 = Sunday … 6 = Saturday
  return WEEKDAYS[(date.getUTCDay() + 6) % 7]!
}

function atMinutesSameDay(date: Date, minutes: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), Math.floor(minutes / 60), minutes % 60),
  )
}

function nextDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1))
}

/** Is the studio within opening hours at this instant? */
export function isOpenAt(schedule: BusinessHours, at: Date = new Date()): boolean {
  const hours = schedule[weekdayOf(at)]
  if (!hours) return false
  const minute = at.getUTCHours() * 60 + at.getUTCMinutes()
  return minute >= minutesOfDay(hours.open) && minute < minutesOfDay(hours.close)
}

/**
 * Adds N business minutes to a moment, counting only opening time. The result
 * never lands outside opening hours (unless every day is closed, in which case
 * the input is returned).
 */
export function addBusinessMinutes(from: Date, minutes: number, schedule: BusinessHours): Date {
  let cursor = new Date(from)
  let remaining = Math.max(0, Math.round(minutes))

  for (let guard = 0; guard < 1200 && remaining > 0; guard += 1) {
    const hours = schedule[weekdayOf(cursor)]
    if (!hours) {
      cursor = nextDayStart(cursor)
      continue
    }
    const open = minutesOfDay(hours.open)
    const close = minutesOfDay(hours.close)
    const minuteOfDay = cursor.getUTCHours() * 60 + cursor.getUTCMinutes()
    if (minuteOfDay < open) {
      cursor = atMinutesSameDay(cursor, open)
      continue
    }
    if (minuteOfDay >= close) {
      cursor = nextDayStart(cursor)
      continue
    }
    const available = close - minuteOfDay
    if (remaining <= available) {
      cursor = new Date(cursor.getTime() + remaining * 60_000)
      remaining = 0
    } else {
      remaining -= available
      cursor = nextDayStart(cursor)
    }
  }
  return cursor
}

export function addBusinessHours(from: Date, hours: number, schedule: BusinessHours): Date {
  return addBusinessMinutes(from, hours * 60, schedule)
}

/**
 * When the first reply to an inquiry is due: the target hours counted inside
 * opening hours, so a note that lands on Friday evening is due back within the
 * target from the next open morning.
 */
export function replyDueAt(receivedAt: Date, targetHours: number, schedule: BusinessHours): Date {
  return addBusinessHours(receivedAt, targetHours, schedule)
}

/** "09:00" → "9:00 AM" */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = (h ?? 0) >= 12 ? 'PM' : 'AM'
  const hour12 = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12
  return `${hour12}:${String(m ?? 0).padStart(2, '0')} ${period}`
}

export function dayLabel(day: Weekday): string {
  return day.charAt(0).toUpperCase() + day.slice(1)
}

export type HoursLine = { day: string; hours: string }

/** One line per weekday, for the storefront's studio-hours card. */
export function formatBusinessHours(schedule: BusinessHours): HoursLine[] {
  return WEEKDAYS.map((day) => ({
    day: dayLabel(day),
    hours: schedule[day] ? `${formatTime(schedule[day]!.open)} – ${formatTime(schedule[day]!.close)}` : 'Closed',
  }))
}

/** Compact one-liner for footers: "Mon–Fri 9:00 AM – 6:00 PM · Sat 10:00 AM – 4:00 PM · Sun closed". */
export function businessHoursSummary(schedule: BusinessHours): string {
  const parts: string[] = []
  const runs: Array<{ from: Weekday; to: Weekday; hours: DayHours }> = []
  for (const day of WEEKDAYS) {
    const hours = schedule[day]
    const previous = runs[runs.length - 1]
    const sameAsPrevious =
      previous &&
      ((previous.hours === null && hours === null) ||
        (previous.hours !== null &&
          hours !== null &&
          previous.hours.open === hours.open &&
          previous.hours.close === hours.close))
    if (sameAsPrevious) previous.to = day
    else runs.push({ from: day, to: day, hours })
  }
  for (const run of runs) {
    const label =
      run.from === run.to
        ? dayLabel(run.from).slice(0, 3)
        : `${dayLabel(run.from).slice(0, 3)}–${dayLabel(run.to).slice(0, 3)}`
    parts.push(run.hours ? `${label} ${formatTime(run.hours.open)} – ${formatTime(run.hours.close)}` : `${label} closed`)
  }
  return parts.join(' · ')
}
