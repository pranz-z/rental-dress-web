import type { Metadata } from 'next'
import Link from 'next/link'
import { MessagesSquare, Search, SearchX } from 'lucide-react'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/table'
import { requireCapability } from '@/lib/auth/guards'
import { cn } from '@/lib/cn'
import { relativeFromNow } from '@/lib/dates'
import { prisma } from '@/lib/db'
import {
  INQUIRY_STATUS_META,
  INQUIRY_TOPICS,
  INQUIRY_TOPIC_META,
  type InquiryStatus,
  type InquiryTopic,
} from '@/lib/domain'
import { formatReplyHours } from '@/lib/inquiries'
import { parseBusinessHours, replyDueAt } from '@/lib/business-hours'

export const metadata: Metadata = { title: 'Inquiries' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20
const FILTER_STATUSES: InquiryStatus[] = ['OPEN', 'RESOLVED']

type AssignFilter = 'mine' | 'unassigned'

function parseStatus(raw: string | undefined): InquiryStatus | null {
  return raw === 'OPEN' || raw === 'RESOLVED' ? raw : null
}

function parseTopics(raw: string | undefined): InquiryTopic[] {
  if (!raw) return []
  const wanted = new Set(raw.split(','))
  return INQUIRY_TOPICS.filter((topic) => wanted.has(topic))
}

function parseAssign(raw: string | undefined): AssignFilter | null {
  return raw === 'mine' || raw === 'unassigned' ? raw : null
}

function inquiriesHref(params: {
  q?: string
  status?: InquiryStatus | null
  topics?: InquiryTopic[]
  assign?: AssignFilter | null
  page?: number
}): string {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.status) search.set('status', params.status)
  if (params.topics && params.topics.length > 0) search.set('topic', params.topics.join(','))
  if (params.assign) search.set('assign', params.assign)
  if (params.page && params.page > 1) search.set('page', String(params.page))
  const query = search.toString()
  return query ? `/studio/inquiries?${query}` : '/studio/inquiries'
}

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; topic?: string; assign?: string; page?: string }>
}) {
  const staff = await requireCapability('inquiries.view')
  const params = await searchParams
  const q = (params.q ?? '').trim()
  const status = parseStatus(params.status)
  const topics = parseTopics(params.topic)
  const assign = parseAssign(params.assign)
  const requestedPage = Math.max(Number(params.page ?? '1') || 1, 1)

  const searchFilter = q
    ? {
        OR: [
          { guestName: { contains: q, mode: 'insensitive' as const } },
          { guestEmail: { contains: q, mode: 'insensitive' as const } },
          { subject: { contains: q, mode: 'insensitive' as const } },
          { message: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {}
  const topicFilter = topics.length > 0 ? { topic: { in: topics } } : {}
  const assignFilter: { assignedToId?: string | null } =
    assign === 'mine' ? { assignedToId: staff.id } : assign === 'unassigned' ? { assignedToId: null } : {}

  const baseFilter = { ...searchFilter, ...topicFilter, ...assignFilter }
  const where = { ...baseFilter, ...(status ? { status } : {}) }

  const [settings, openAll, statusCounts, topicCounts, totalAll, totalMatching] = await Promise.all([
    prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } }),
    prisma.inquiry.count({ where: { status: 'OPEN' } }),
    prisma.inquiry.groupBy({ by: ['status'], where: baseFilter, _count: { _all: true } }),
    prisma.inquiry.groupBy({ by: ['topic'], where: { ...searchFilter, ...assignFilter, ...(status ? { status } : {}) }, _count: { _all: true } }),
    prisma.inquiry.count(),
    prisma.inquiry.count({ where }),
  ])

  const pageCount = Math.max(Math.ceil(totalMatching / PAGE_SIZE), 1)
  const page = Math.min(requestedPage, pageCount)
  // The reply clock counts only opening hours (Settings → Hours & delivery).
  const businessHours = parseBusinessHours(settings.businessHours)
  const inquiries = await prisma.inquiry.findMany({
    where,
    orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      guestName: true,
      guestEmail: true,
      subject: true,
      topic: true,
      message: true,
      status: true,
      receivedAt: true,
      firstReplyAt: true,
      assignedTo: { select: { name: true } },
    },
  })

  const countsByStatus = new Map(statusCounts.map((row) => [row.status, row._count._all]))
  const countsByTopic = new Map(topicCounts.map((row) => [row.topic, row._count._all]))
  const filtersActive = q.length > 0 || status !== null || topics.length > 0 || assign !== null

  const filterLinks = { q, status, topics, assign }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inquiries"
        description={`${openAll} open · first-reply target ${settings.replyTargetHours} hours during studio hours.`}
      />

      <div className="space-y-3.5">
        <form action="/studio/inquiries" method="get" className="flex max-w-md items-center gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {topics.length > 0 ? <input type="hidden" name="topic" value={topics.join(',')} /> : null}
          {assign ? <input type="hidden" name="assign" value={assign} /> : null}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.75} aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Charlotte, sizing, Langham…"
              aria-label="Search inquiries"
              className="h-11 w-full rounded-full border border-line bg-surface pr-4 pl-10 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
            />
          </div>
          <button
            type="submit"
            className="h-11 rounded-full bg-accent px-5 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={inquiriesHref({ ...filterLinks, status: null })}
            aria-current={status === null ? 'true' : undefined}
            className={cn(
              'chip transition-shadow',
              status === null ? 'ring-2 ring-accent/45 ring-offset-2 ring-offset-page' : 'hover:ring-2 hover:ring-accent/20',
            )}
          >
            All · {totalAll}
          </Link>
          {FILTER_STATUSES.map((option) => {
            const meta = INQUIRY_STATUS_META[option]
            return (
              <Link
                key={option}
                href={inquiriesHref({ ...filterLinks, status: option })}
                aria-current={status === option ? 'true' : undefined}
                className={cn(
                  'chip transition-shadow',
                  status === option ? 'ring-2 ring-accent/45 ring-offset-2 ring-offset-page' : 'hover:ring-2 hover:ring-accent/20',
                )}
              >
                {meta.label} · {countsByStatus.get(option) ?? 0}
              </Link>
            )
          })}
          {filtersActive ? (
            <Link
              href="/studio/inquiries"
              className="ml-1 text-[13px] font-bold text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              Clear
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {INQUIRY_TOPICS.map((topic) => {
            const active = topics.includes(topic)
            const nextTopics = active ? topics.filter((value) => value !== topic) : INQUIRY_TOPICS.filter((value) => value === topic || topics.includes(value))
            return (
              <Link
                key={topic}
                href={inquiriesHref({ ...filterLinks, topics: [...nextTopics] })}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'chip transition-shadow',
                  active ? 'ring-2 ring-accent/45 ring-offset-2 ring-offset-page' : 'hover:ring-2 hover:ring-accent/20',
                )}
              >
                {INQUIRY_TOPIC_META[topic].label} · {countsByTopic.get(topic) ?? 0}
              </Link>
            )
          })}
          <span aria-hidden className="mx-1 hidden h-4 w-px bg-line sm:block" />
          <Link
            href={inquiriesHref({ ...filterLinks, assign: null })}
            aria-current={assign === null ? 'true' : undefined}
            className={cn(
              'chip transition-shadow',
              assign === null ? 'ring-2 ring-accent/45 ring-offset-2 ring-offset-page' : 'hover:ring-2 hover:ring-accent/20',
            )}
          >
            Everyone
          </Link>
          <Link
            href={inquiriesHref({ ...filterLinks, assign: 'mine' })}
            aria-current={assign === 'mine' ? 'true' : undefined}
            className={cn(
              'chip transition-shadow',
              assign === 'mine' ? 'ring-2 ring-accent/45 ring-offset-2 ring-offset-page' : 'hover:ring-2 hover:ring-accent/20',
            )}
          >
            Mine
          </Link>
          <Link
            href={inquiriesHref({ ...filterLinks, assign: 'unassigned' })}
            aria-current={assign === 'unassigned' ? 'true' : undefined}
            className={cn(
              'chip transition-shadow',
              assign === 'unassigned' ? 'ring-2 ring-accent/45 ring-offset-2 ring-offset-page' : 'hover:ring-2 hover:ring-accent/20',
            )}
          >
            Unassigned
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
        {inquiries.length === 0 ? (
          <EmptyState
            icon={filtersActive ? SearchX : MessagesSquare}
            title={filtersActive ? 'No inquiries match' : 'Inbox is quiet'}
            description={
              filtersActive
                ? 'Try a different name or subject, or clear the filters.'
                : 'Questions from the contact form, dress pages and email land here.'
            }
            action={
              filtersActive ? (
                <Link href="/studio/inquiries" className="text-sm font-bold text-accent underline-offset-4 hover:underline">
                  Clear filters
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>From</Th>
                    <Th>Subject</Th>
                    <Th>Topic</Th>
                    <Th>Received</Th>
                    <Th>Assigned</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {inquiries.map((inquiry) => {
                    const meta = INQUIRY_STATUS_META[inquiry.status]
                    const topicMeta = INQUIRY_TOPIC_META[inquiry.topic]
                    const indicator = replyIndicator(
                      inquiry,
                      replyDueAt(inquiry.receivedAt, settings.replyTargetHours, businessHours),
                      settings.replyTargetHours,
                    )
                    return (
                      <Tr key={inquiry.id} className="relative">
                        <Td>
                          <Link
                            href={`/studio/inquiries/${inquiry.id}`}
                            className="font-bold text-ink after:absolute after:inset-0 after:content-['']"
                          >
                            {inquiry.guestName}
                          </Link>
                          <p className="mt-0.5 text-xs text-ink-muted">{inquiry.guestEmail}</p>
                        </Td>
                        <Td>
                          <p className="font-bold text-ink">{inquiry.subject}</p>
                          <p className="mt-0.5 line-clamp-1 max-w-[420px] text-xs text-ink-muted">{inquiry.message}</p>
                        </Td>
                        <Td>
                          <Chip tone={topicMeta.tone}>{topicMeta.label}</Chip>
                        </Td>
                        <Td>
                          <p className="text-ink">{relativeFromNow(inquiry.receivedAt)}</p>
                          {indicator ? (
                            <p className={cn('mt-0.5 text-xs', indicator.danger ? 'font-bold text-danger-ink' : 'text-ink-muted')}>
                              {indicator.text}
                            </p>
                          ) : null}
                        </Td>
                        <Td className="text-ink-muted">{inquiry.assignedTo?.name ?? 'Unassigned'}</Td>
                        <Td>
                          <Chip tone={meta.tone}>{meta.label}</Chip>
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableWrap>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3.5">
              <p className="text-[13px] text-ink-muted">
                Showing {totalMatching === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalMatching)} of{' '}
                {totalMatching} {totalMatching === 1 ? 'inquiry' : 'inquiries'}
                {filtersActive ? ' matching' : ''}
              </p>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={inquiriesHref({ ...filterLinks, page: page - 1 })}
                    className="inline-flex h-9 items-center rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-bold text-ink transition-colors hover:bg-surface-muted"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="inline-flex h-9 items-center rounded-full border border-line px-3.5 text-[13px] font-bold text-ink-muted">
                    Previous
                  </span>
                )}
                <p className="px-1 text-[13px] text-ink-muted">
                  Page {page} of {pageCount}
                </p>
                {page < pageCount ? (
                  <Link
                    href={inquiriesHref({ ...filterLinks, page: page + 1 })}
                    className="inline-flex h-9 items-center rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-bold text-ink transition-colors hover:bg-surface-muted"
                  >
                    Next
                  </Link>
                ) : (
                  <span className="inline-flex h-9 items-center rounded-full border border-line px-3.5 text-[13px] font-bold text-ink-muted">
                    Next
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** First-reply status line shown under the received time. */
function replyIndicator(
  inquiry: { status: InquiryStatus; receivedAt: Date; firstReplyAt: Date | null },
  dueAt: Date,
  targetHours: number,
): { text: string; danger: boolean } | null {
  if (inquiry.firstReplyAt) {
    const hours = (inquiry.firstReplyAt.getTime() - inquiry.receivedAt.getTime()) / 3_600_000
    return { text: `First reply in ${formatReplyHours(hours)}`, danger: false }
  }
  if (inquiry.status !== 'OPEN') return null
  const overdue = Date.now() > dueAt.getTime()
  return {
    text: overdue ? `Past the ${targetHours}-hour reply target` : 'Awaiting the first reply',
    danger: overdue,
  }
}
