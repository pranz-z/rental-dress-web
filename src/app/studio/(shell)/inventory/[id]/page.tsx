import type { Metadata } from 'next'
import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Archive, ArrowLeft, Ban, CalendarPlus, Pencil, RotateCcw, Sparkles } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { FieldHint, FieldLabel, Input, Select } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { DressArt } from '@/components/studio/inventory/dress-art'
import {
  blockDatesAction,
  completeCleaningFromInventoryAction,
  removeBlockAction,
  restoreDressAction,
  retireDressAction,
} from '../actions'
import { requireCapability } from '@/lib/auth/guards'
import {
  addDays,
  eachDay,
  formatDateTime,
  formatDay,
  formatMonthDay,
  formatMonthShort,
  isoDay,
  isWeekend,
  todayUtc,
} from '@/lib/dates'
import { prisma } from '@/lib/db'
import { CONDITION_SEVERITY_META, DRESS_IMAGE_KIND_LABEL, DRESS_STATUS_META, can, type Tone } from '@/lib/domain'
import { INVENTORY_DONE_MESSAGES, windowLabel } from '@/lib/inventory'
import { formatMoney } from '@/lib/money'
import { depositFor, rentalPriceFor } from '@/lib/pricing'
import { cn } from '@/lib/cn'

export const dynamic = 'force-dynamic'

const CALENDAR_DAYS = 30

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const dress = await prisma.dress.findUnique({ where: { id }, select: { name: true } })
  return { title: dress?.name ?? 'Inventory' }
}

// ── rental calendar ───────────────────────────────────────────────────────

type DayState = 'FREE' | 'PREP' | 'BOOKED' | 'BUFFER' | 'BLOCK'

const STATE_TONE: Record<Exclude<DayState, 'FREE'>, Tone> = {
  BOOKED: 'mulberry',
  PREP: 'rose',
  BUFFER: 'gold',
  BLOCK: 'clay',
}

const STATE_RANK: Record<DayState, number> = { BOOKED: 4, BLOCK: 3, PREP: 2, BUFFER: 2, FREE: 0 }

type CalendarCell = { day: Date; state: DayState; note?: string }
type CalendarRow = { size: string; cells: CalendarCell[]; summary: string }

type CalendarBooking = {
  id: string
  size: string
  status: string
  deliveryDate: Date
  returnDate: Date
  customer: { name: string }
}

type CalendarBlock = { size: string | null; startDate: Date; endDate: Date; reason: string }

function buildCalendarRows(
  sizes: string[],
  bookings: CalendarBooking[],
  blocks: CalendarBlock[],
  prepDays: number,
  bufferDays: number,
  days: Date[],
  today: Date,
): CalendarRow[] {
  const startMs = today.getTime()
  const lastDay = days[days.length - 1]

  return sizes.map((size) => {
    const cells: CalendarCell[] = days.map((day) => ({ day, state: 'FREE' }))
    const parts: string[] = []

    const paint = (from: Date, to: Date, state: DayState, note: string) => {
      const startIndex = Math.max(Math.round((from.getTime() - startMs) / 86_400_000), 0)
      const endIndex = Math.min(Math.round((to.getTime() - startMs) / 86_400_000), CALENDAR_DAYS - 1)
      for (let index = startIndex; index <= endIndex; index += 1) {
        const cell = cells[index]
        if (STATE_RANK[state] >= STATE_RANK[cell.state]) {
          cell.state = state
          cell.note = note
        }
      }
    }

    for (const booking of bookings) {
      if (booking.size !== size) continue
      if (booking.status === 'RETURNED' || booking.status === 'CANCELLED') continue
      const holdEnd =
        booking.status === 'LATE'
          ? new Date(Math.max(addDays(booking.returnDate, bufferDays).getTime(), today.getTime()))
          : booking.returnDate
      paint(
        addDays(booking.deliveryDate, -prepDays),
        addDays(booking.deliveryDate, -1),
        'PREP',
        `Prep for ${booking.id} — ${booking.customer.name}`,
      )
      paint(booking.deliveryDate, holdEnd, 'BOOKED', `${booking.id} — ${booking.customer.name}, out until ${formatDay(booking.returnDate)}`)
      if (booking.status !== 'LATE') {
        paint(
          addDays(booking.returnDate, 1),
          addDays(booking.returnDate, bufferDays),
          'BUFFER',
          `Cleaning buffer after ${booking.id}`,
        )
      }
      if (holdEnd.getTime() >= today.getTime() && booking.deliveryDate.getTime() <= lastDay.getTime()) {
        parts.push(`${booking.id} out ${formatDay(booking.deliveryDate)}–${formatDay(booking.returnDate)}`)
      }
    }

    for (const block of blocks) {
      if (block.size && block.size !== size) continue
      paint(block.startDate, block.endDate, 'BLOCK', `Blocked — ${block.reason}`)
      if (block.endDate.getTime() >= today.getTime() && block.startDate.getTime() <= lastDay.getTime()) {
        parts.push(`blocked ${windowLabel(block.startDate, block.endDate)} (${block.reason})`)
      }
    }

    return {
      size,
      cells,
      summary: parts.length > 0 ? parts.join('; ') : 'free for the next 30 days',
    }
  })
}

function CalendarLegend() {
  const items: { label: string; state: DayState }[] = [
    { label: 'Booked', state: 'BOOKED' },
    { label: 'Prep', state: 'PREP' },
    { label: 'Cleaning buffer', state: 'BUFFER' },
    { label: 'Blocked', state: 'BLOCK' },
    { label: 'Free', state: 'FREE' },
  ]
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            data-tone={item.state === 'FREE' ? undefined : STATE_TONE[item.state]}
            className={cn('size-3 rounded-[3px] border', item.state === 'FREE' ? 'border-line-strong bg-surface-muted/60' : '')}
            style={
              item.state === 'FREE' ? undefined : { background: 'var(--tone-bg)', borderColor: 'var(--tone-line)' }
            }
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

// ── page ──────────────────────────────────────────────────────────────────

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">{label}</dt>
      <dd className="text-right text-sm text-ink">{value}</dd>
    </div>
  )
}

function orDash(value: string | null | undefined): ReactNode {
  return value ? value : <span className="text-ink-muted">Not on file</span>
}

const SUMMARY_CLASS =
  'inline-flex h-11 w-full cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-5 text-sm font-bold text-ink transition-colors select-none hover:bg-surface-muted [&::-webkit-details-marker]:hidden'
const SUMMARY_DANGER_CLASS =
  'inline-flex h-11 w-full cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-danger-line bg-surface px-5 text-sm font-bold text-danger-ink transition-colors select-none hover:bg-danger-ink/5 [&::-webkit-details-marker]:hidden'

export default async function DressDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ done?: string; error?: string }>
}) {
  const { id } = await params
  const { done, error } = await searchParams
  const staff = await requireCapability('inventory.view')

  const [dress, settings] = await Promise.all([
    prisma.dress.findUnique({
      where: { id },
      include: {
        sizes: { orderBy: { position: 'asc' } },
        images: { orderBy: { position: 'asc' } },
        blocks: { orderBy: { startDate: 'asc' }, include: { staff: { select: { name: true } } } },
        cleaningRecords: {
          orderBy: { startedAt: 'desc' },
          take: 20,
          include: { staff: { select: { name: true } }, booking: { select: { id: true } } },
        },
        conditionLogs: { orderBy: { loggedAt: 'desc' }, include: { staff: { select: { name: true } } } },
        bookings: {
          where: { status: { not: 'CANCELLED' } },
          select: {
            id: true,
            size: true,
            status: true,
            deliveryDate: true,
            returnDate: true,
            customer: { select: { name: true } },
          },
        },
      },
    }),
    prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } }),
  ])
  if (!dress) notFound()

  const caps = {
    manage: can(staff.role, 'inventory.manage'),
    cleaning: can(staff.role, 'inventory.cleaning'),
    payments: can(staff.role, 'bookings.payments'),
  }

  const today = todayUtc()
  const calendarDays = eachDay(today, addDays(today, CALENDAR_DAYS - 1))
  const calendarRows = buildCalendarRows(
    dress.sizes.map((row) => row.size),
    dress.bookings,
    dress.blocks,
    settings.prepDays,
    settings.bufferDays,
    calendarDays,
    today,
  )

  const statusMeta = DRESS_STATUS_META[dress.status]
  const doneMessage = done ? (INVENTORY_DONE_MESSAGES[done] ?? null) : null
  const sizesLabel =
    dress.sizes.length > 0
      ? dress.sizes.map((row) => (row.quantity > 1 ? `${row.size} ×${row.quantity}` : row.size)).join(' · ')
      : null
  const upcomingBlocks = dress.blocks.filter((block) => block.endDate.getTime() >= today.getTime())
  const pastBlockCount = dress.blocks.length - upcomingBlocks.length

  return (
    <div className="space-y-6">
      <Link
        href="/studio/inventory"
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
        All inventory
      </Link>

      <PageHeader
        title={dress.name}
        description={[dress.designer, dress.category, dress.color].filter(Boolean).join(' · ')}
      >
        <Chip tone={statusMeta.tone}>{statusMeta.label}</Chip>
      </PageHeader>

      {error ? (
        <div role="alert" className="rounded-xl border border-danger-line bg-surface px-4 py-3 text-sm font-bold text-danger-ink">
          {error}
        </div>
      ) : null}
      {doneMessage ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink">
          <span className="font-bold">{dress.name}</span> {doneMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Rental calendar"
              description={`Next 30 days by size · ${formatMonthDay(calendarDays[0])} – ${formatMonthDay(calendarDays[CALENDAR_DAYS - 1])}`}
            />
            <CardBody className="space-y-4">
              <CalendarLegend />
              {calendarRows.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No sizes on file yet{caps.manage ? ' — edit the piece to add them.' : '.'}
                </p>
              ) : (
                <div className="overflow-x-auto pb-1">
                  <div className="grid min-w-[760px] grid-cols-[72px_repeat(30,minmax(0,1fr))] gap-px">
                    <div aria-hidden />
                    {calendarDays.map((day, index) => {
                      const isToday = isoDay(day) === isoDay(today)
                      const monthLabel = index === 0 || day.getUTCDate() === 1 ? formatMonthShort(day) : ''
                      return (
                        <div
                          key={isoDay(day)}
                          className={cn('text-center text-[10px] leading-tight', isToday ? 'font-bold text-accent' : 'text-ink-muted')}
                        >
                          <span className="block tabular-nums">{day.getUTCDate()}</span>
                          <span className="block h-3 text-[9px] uppercase tracking-wide">{monthLabel}</span>
                        </div>
                      )
                    })}
                    {calendarRows.map((row) => (
                      <Fragment key={row.size}>
                        <div className="flex items-center pr-2 text-xs font-bold text-ink">Size {row.size}</div>
                        {row.cells.map((cell) => {
                          const free = cell.state === 'FREE'
                          return (
                            <div
                              key={isoDay(cell.day)}
                              title={
                                cell.note
                                  ? `${formatMonthDay(cell.day)} — ${cell.note}`
                                  : `${formatMonthDay(cell.day)} — free`
                              }
                              data-tone={free ? undefined : STATE_TONE[cell.state as Exclude<DayState, 'FREE'>]}
                              className={cn(
                                'h-7 rounded-[4px] border',
                                free
                                  ? cn('border-line/70', isWeekend(cell.day) ? 'bg-surface-muted' : 'bg-surface-muted/40')
                                  : 'border-transparent',
                                isoDay(cell.day) === isoDay(today) ? 'ring-1 ring-inset ring-accent/45' : '',
                              )}
                              style={
                                free ? undefined : { background: 'var(--tone-bg)', borderColor: 'var(--tone-line)' }
                              }
                            />
                          )
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>
              )}
              <ul className="sr-only">
                {calendarRows.map((row) => (
                  <li key={row.size}>
                    Size {row.size}: {row.summary}.
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Photographs"
              description={
                dress.images.length > 0
                  ? 'The studio’s shot list — the garment art renders in the piece’s own palette.'
                  : undefined
              }
            />
            <CardBody>
              {dress.images.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No photographs on file yet — the studio shoots each new piece on the mannequin before its first rental.
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {dress.images.map((image) => (
                    <li key={image.id}>
                      <div
                        title={image.alt}
                        className="flex aspect-[3/4] items-end justify-center rounded-lg border border-line p-2"
                        style={{ background: `color-mix(in srgb, ${dress.colorHex} 14%, var(--surface))` }}
                      >
                        <DressArt color={dress.colorHex} className="h-[86%] w-auto" />
                      </div>
                      <p className="mt-1.5 text-xs font-bold text-ink">
                        {image.caption ?? DRESS_IMAGE_KIND_LABEL[image.kind]}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Care & fit" description="Instructions for handling this piece." />
            <CardBody className="space-y-4">
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">Care notes</h3>
                <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-ink">
                  {dress.careNotes || 'No care notes on file yet.'}
                </p>
              </div>
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">Fit notes</h3>
                <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-ink">
                  {dress.fitNotes || 'No fit notes on file yet.'}
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Condition log" description="Flags from inspection and cleaning — newest first." />
            {dress.conditionLogs.length === 0 ? (
              <CardBody>
                <p className="text-sm text-ink-muted">No condition notes on record — the piece has a clean sheet.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {dress.conditionLogs.map((log) => (
                  <li key={log.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-ink">{log.summary}</p>
                      <Chip tone={CONDITION_SEVERITY_META[log.severity].tone}>
                        {CONDITION_SEVERITY_META[log.severity].label}
                      </Chip>
                      <Chip tone={log.resolved ? 'sage' : 'blush'}>{log.resolved ? 'Resolved' : 'Open'}</Chip>
                    </div>
                    {log.detail ? (
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{log.detail}</p>
                    ) : null}
                    <p className="mt-1.5 text-xs text-ink-muted">
                      {log.staff?.name ?? 'Studio record'} · {formatDateTime(log.loggedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Cleaning history"
              description="Tickets from the cleaning house and the studio's inspection bench."
            />
            {dress.cleaningRecords.length === 0 ? (
              <CardBody>
                <p className="text-sm text-ink-muted">No cleaning tickets on file yet.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {dress.cleaningRecords.map((record) => (
                  <li key={record.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-ink">{record.method}</p>
                        <Chip tone={record.completedAt ? 'sage' : 'gold'}>
                          {record.completedAt ? 'Complete' : 'In progress'}
                        </Chip>
                      </div>
                      {!record.completedAt && caps.cleaning ? (
                        <form action={completeCleaningFromInventoryAction}>
                          <input type="hidden" name="dressId" value={dress.id} />
                          <input type="hidden" name="recordId" value={record.id} />
                          <Button type="submit" size="sm">
                            <Sparkles className="size-4" strokeWidth={1.75} aria-hidden />
                            Mark cleaning complete
                          </Button>
                        </form>
                      ) : null}
                    </div>
                    {record.note ? <p className="mt-1 text-[13px] text-ink-muted">{record.note}</p> : null}
                    <p className="mt-1.5 text-xs text-ink-muted">
                      Started {formatDateTime(record.startedAt)} ·{' '}
                      {record.completedAt ? `signed off ${formatDateTime(record.completedAt)}` : 'awaiting sign-off'} ·{' '}
                      {record.staff?.name ?? 'studio'}
                      {record.booking ? (
                        <>
                          {' · '}
                          <Link
                            href={`/studio/bookings/${record.booking.id}`}
                            className="font-bold text-ink underline-offset-4 hover:underline"
                          >
                            {record.booking.id}
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" description={statusMeta.description} />
            <CardBody>
              <dl className="divide-y divide-line">
                <Fact label="Category" value={dress.category} />
                <Fact label="Sizes" value={sizesLabel ?? <span className="text-ink-muted">Not on file</span>} />
                <Fact
                  label="Colour"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="size-2.5 rounded-full border border-line-strong"
                        style={{ backgroundColor: dress.colorHex }}
                      />
                      {orDash(dress.color)}
                    </span>
                  }
                />
                <Fact label="Occasion" value={orDash(dress.occasion)} />
                <Fact label="Fabric" value={orDash(dress.fabric)} />
                <Fact label="Length" value={orDash(dress.length)} />
                <Fact label="Neckline" value={orDash(dress.neckline)} />
                <Fact label="Sleeve" value={orDash(dress.sleeve)} />
                <Fact label="Added" value={formatDay(dress.createdAt)} />
                <Fact label="Times rented" value={String(dress.timesRented)} />
                {dress.retiredAt ? <Fact label="Retired" value={formatDay(dress.retiredAt)} /> : null}
                {caps.payments ? (
                  <>
                    <Fact label="Retail value" value={formatMoney(dress.retailValue)} />
                    <Fact label="4-day rental" value={formatMoney(rentalPriceFor(dress.retailValue, 4, settings))} />
                    <Fact label="8-day rental" value={formatMoney(rentalPriceFor(dress.retailValue, 8, settings))} />
                    <Fact label="Deposit" value={formatMoney(depositFor(dress.retailValue, settings))} />
                  </>
                ) : null}
              </dl>
            </CardBody>
          </Card>

          {caps.manage ? (
            <Card>
              <CardHeader
                title="Actions"
                description="Every change is written to the audit trail and applies immediately."
              />
              <CardBody className="space-y-3">
                <ButtonLink href={`/studio/inventory/${dress.id}/edit`} variant="secondary" className="w-full">
                  <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
                  Edit dress
                </ButtonLink>

                <details>
                  <summary className={SUMMARY_CLASS}>
                    <CalendarPlus className="size-4" strokeWidth={1.75} aria-hidden />
                    Block dates
                  </summary>
                  <form
                    action={blockDatesAction}
                    className="mt-3 space-y-3 rounded-lg border border-line bg-surface-muted/50 p-3.5"
                  >
                    <input type="hidden" name="dressId" value={dress.id} />
                    <div>
                      <FieldLabel htmlFor="block-size">Size</FieldLabel>
                      <Select id="block-size" name="size" defaultValue="">
                        <option value="">All sizes</option>
                        {dress.sizes.map((row) => (
                          <option key={row.size} value={row.size}>
                            Size {row.size}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel htmlFor="block-start">From</FieldLabel>
                        <Input id="block-start" name="startDate" type="date" required defaultValue={isoDay(today)} min={isoDay(today)} />
                      </div>
                      <div>
                        <FieldLabel htmlFor="block-end">To</FieldLabel>
                        <Input id="block-end" name="endDate" type="date" required min={isoDay(today)} />
                      </div>
                    </div>
                    <div>
                      <FieldLabel htmlFor="block-reason">Reason</FieldLabel>
                      <Input
                        id="block-reason"
                        name="reason"
                        required
                        maxLength={160}
                        placeholder="Editorial shoot, sleeve repair, fitting hold…"
                      />
                      <FieldHint>Blocked days read as unavailable in the booking calendar — a booking cannot overlap them.</FieldHint>
                    </div>
                    <Button type="submit" size="sm" variant="secondary">
                      <Ban className="size-4" strokeWidth={1.75} aria-hidden />
                      Block these dates
                    </Button>
                  </form>
                </details>

                {dress.status === 'RETIRED' ? (
                  <form action={restoreDressAction}>
                    <input type="hidden" name="dressId" value={dress.id} />
                    <Button type="submit" variant="secondary" className="w-full">
                      <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden />
                      Restore to rotation
                    </Button>
                  </form>
                ) : (
                  <details>
                    <summary className={SUMMARY_DANGER_CLASS}>
                      <Archive className="size-4" strokeWidth={1.75} aria-hidden />
                      Retire dress
                    </summary>
                    <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                      Retiring takes {dress.name} off the rack and out of availability. Its history stays on file, and you
                      can restore it at any time.
                    </p>
                    <form action={retireDressAction} className="mt-3">
                      <input type="hidden" name="dressId" value={dress.id} />
                      <Button type="submit" variant="danger" size="sm">
                        Retire this dress
                      </Button>
                    </form>
                  </details>
                )}
              </CardBody>
            </Card>
          ) : null}

          {upcomingBlocks.length > 0 || caps.manage ? (
            <Card>
              <CardHeader
                title="Blocked dates"
                description={
                  upcomingBlocks.length > 0
                    ? `${upcomingBlocks.length} ${upcomingBlocks.length === 1 ? 'hold' : 'holds'} out of availability.`
                    : 'Nothing is blocked right now.'
                }
              />
              {upcomingBlocks.length > 0 ? (
                <ul className="divide-y divide-line">
                  {upcomingBlocks.map((block) => (
                    <li key={block.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink">
                          {windowLabel(block.startDate, block.endDate)}
                          <span className="ml-2 align-middle text-xs font-bold text-ink-muted">
                            {block.size ? `Size ${block.size}` : 'All sizes'}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[13px] text-ink-muted">{block.reason}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">Blocked by {block.staff?.name ?? 'the studio'}</p>
                      </div>
                      {caps.manage ? (
                        <form action={removeBlockAction} className="shrink-0">
                          <input type="hidden" name="dressId" value={dress.id} />
                          <input type="hidden" name="blockId" value={block.id} />
                          <Button type="submit" size="sm" variant="ghost">
                            Remove
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <CardBody>
                  <p className="text-sm text-ink-muted">
                    Blocks hold dates out of availability for repairs, shoots or fittings.
                  </p>
                </CardBody>
              )}
              {pastBlockCount > 0 ? (
                <CardFooter>
                  <p className="text-xs text-ink-muted">
                    {pastBlockCount} earlier {pastBlockCount === 1 ? 'block' : 'blocks'} on record
                  </p>
                </CardFooter>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
