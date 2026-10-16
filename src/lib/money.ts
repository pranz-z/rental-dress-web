/**
 * Money is stored as integer cents everywhere. These helpers are the only place
 * that turns cents into the strings the studio and the storefront display.
 */

export function formatMoney(cents: number, options: { cents?: boolean; signed?: boolean } = {}): string {
  const showCents = options.cents ?? cents % 100 !== 0
  const value = cents / 100
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(Math.abs(value))
  if (value < 0) return `−${formatted}`
  return options.signed && value > 0 ? `+${formatted}` : formatted
}

/** Compact form for dense admin tables: $18,420 · $1.2k */
export function formatMoneyCompact(cents: number): string {
  const dollars = cents / 100
  if (Math.abs(dollars) >= 10_000) {
    return `$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(dollars)}`
  }
  return formatMoney(cents)
}

export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.\-]/g, '')
  if (!cleaned) return null
  const value = Number.parseFloat(cleaned)
  if (Number.isNaN(value)) return null
  return Math.round(value * 100)
}

export function centsFromDollars(dollars: number): number {
  return Math.round(dollars * 100)
}

export function percentOf(value: number, percent: number): number {
  return Math.round((value * percent) / 100)
}

export function percent(part: number, whole: number): number {
  if (!whole) return 0
  return Math.round((part / whole) * 100)
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`
}
