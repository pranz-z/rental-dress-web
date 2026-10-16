/**
 * Studio metrics.
 *
 * Every figure on the dashboard is derived from the same ledger the team works
 * from — payments for revenue, booking windows for utilization, replies for
 * response time. Nothing is hard-coded.
 *
 * Studio scripts (the seed) pass their own Prisma client; the app passes none.
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as appPrisma } from './db'
import { addDays, addMonths, eachDay, isoDay, monthKey, startOfMonth, todayUtc } from './dates'
import { ACTIVE_RENTAL_STATUSES } from './domain'

type Db = PrismaClient
const resolve = (client?: Db): Db => client ?? (appPrisma as unknown as Db)

const REVENUE_KINDS = ['RENTAL', 'ADD_ON', 'INSURANCE', 'LATE_FEE'] as const

/** Captured rental revenue inside a date range, refunds netted out. */
export async function revenueForRange(from: Date, to: Date, client?: Db): Promise<number> {
  const rows = await resolve(client).payment.aggregate({
    _sum: { amount: true },
    where: {
      kind: { in: [...REVENUE_KINDS] },
      status: { in: ['PAID', 'REFUNDED'] },
      createdAt: { gte: from, lt: to },
    },
  })
  return rows._sum.amount ?? 0
}

export async function revenueThisMonth(
  today: Date = todayUtc(),
  client?: Db,
): Promise<{ current: number; previous: number; delta: number }> {
  const monthStart = startOfMonth(today)
  const [current, previous] = await Promise.all([
    revenueForRange(monthStart, addMonths(monthStart, 1), client),
    revenueForRange(addMonths(monthStart, -1), monthStart, client),
  ])
  const delta = previous === 0 ? 0 : Math.round(((current - previous) / previous) * 100)
  return { current, previous, delta }
}

/**
 * Share of the coming month in which a dress is committed — out with a
 * customer, in cleaning, or held for a booking.
 */
export async function utilizationPercent(days = 30, today: Date = todayUtc(), client?: Db): Promise<number> {
  const db = resolve(client)
  const start = today
  const end = addDays(start, days)
  const [dresses, bookings, blocks] = await Promise.all([
    db.dress.count({ where: { status: { not: 'RETIRED' } } }),
    db.booking.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED', 'SHIPPED', 'WITH_CUSTOMER', 'LATE'] },
        returnDate: { gte: start },
        deliveryDate: { lt: end },
      },
      select: { dressId: true, deliveryDate: true, returnDate: true, bufferDays: true },
    }),
    db.dressBlock.findMany({
      where: { endDate: { gte: start }, startDate: { lt: end } },
      select: { dressId: true, startDate: true, endDate: true },
    }),
  ])

  const busy = new Map<string, Set<string>>()
  const mark = (dressId: string, from: Date, to: Date) => {
    const set = busy.get(dressId) ?? new Set<string>()
    for (const day of eachDay(from, to)) {
      const iso = isoDay(day)
      if (iso >= isoDay(start) && iso < isoDay(end)) set.add(iso)
    }
    busy.set(dressId, set)
  }
  for (const row of bookings) mark(row.dressId, row.deliveryDate, addDays(row.returnDate, row.bufferDays))
  for (const row of blocks) mark(row.dressId, row.startDate, row.endDate)

  let busyDays = 0
  for (const set of busy.values()) busyDays += set.size
  const capacity = dresses * days
  return capacity === 0 ? 0 : Math.round((busyDays / capacity) * 100)
}

/** Average minutes from an inquiry arriving to the studio's first reply. */
export async function averageFirstReplyMinutes(sinceDays = 30, client?: Db): Promise<number | null> {
  const since = new Date(Date.now() - sinceDays * 86_400_000)
  const rows = await resolve(client).inquiry.findMany({
    where: { firstReplyAt: { not: null }, receivedAt: { gte: since } },
    select: { receivedAt: true, firstReplyAt: true },
  })
  const deltas = rows
    .map((row) => (row.firstReplyAt!.getTime() - row.receivedAt.getTime()) / 60_000)
    .filter((value) => value >= 0)
  if (deltas.length === 0) return null
  return deltas.reduce((sum, value) => sum + value, 0) / deltas.length
}

export type OverviewSnapshot = {
  revenue: { current: number; previous: number; delta: number }
  activeRentals: number
  openInquiries: number
  unassignedInquiries: number
  utilization: number
  firstReplyMinutes: number | null
  returnsDueThisWeek: number
  lateReturns: number
  cleaningQueue: number
}

export async function overviewSnapshot(today: Date = todayUtc(), client?: Db): Promise<OverviewSnapshot> {
  const db = resolve(client)
  const weekAhead = addDays(today, 7)
  const [
    revenue,
    activeRentals,
    openInquiries,
    unassignedInquiries,
    utilization,
    firstReplyMinutes,
    returnsDueThisWeek,
    lateReturns,
    cleaningQueue,
  ] = await Promise.all([
    revenueThisMonth(today, client),
    db.booking.count({ where: { status: { in: [...ACTIVE_RENTAL_STATUSES] } } }),
    db.inquiry.count({ where: { status: 'OPEN' } }),
    db.inquiry.count({ where: { status: 'OPEN', assignedToId: null } }),
    utilizationPercent(30, today, client),
    averageFirstReplyMinutes(30, client),
    db.booking.count({
      where: { status: { in: [...ACTIVE_RENTAL_STATUSES] }, returnDate: { gte: today, lte: weekAhead } },
    }),
    db.booking.count({ where: { status: 'LATE' } }),
    db.dress.count({ where: { status: { in: ['CLEANING', 'RENTED'] } } }),
  ])

  return {
    revenue,
    activeRentals,
    openInquiries,
    unassignedInquiries,
    utilization,
    firstReplyMinutes,
    returnsDueThisWeek,
    lateReturns,
    cleaningQueue,
  }
}

/** Revenue for the last N months, for the dashboard trend. */
export async function revenueTrend(
  months = 6,
  today: Date = todayUtc(),
  client?: Db,
): Promise<Array<{ key: string; label: string; value: number }>> {
  const series: Array<{ key: string; label: string; value: number }> = []
  const monthStart = startOfMonth(today)
  for (let index = months - 1; index >= 0; index -= 1) {
    const start = addMonths(monthStart, -index)
    series.push({
      key: monthKey(start),
      label: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(start),
      value: await revenueForRange(start, addMonths(start, 1), client),
    })
  }
  return series
}
