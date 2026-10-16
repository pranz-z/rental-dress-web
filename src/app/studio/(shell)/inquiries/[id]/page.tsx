import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Mail,
  Phone,
  RotateCcw,
  Send,
  UserPlus,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { FieldHint, FieldLabel, Select, Textarea } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { requireCapability } from '@/lib/auth/guards'
import { cn } from '@/lib/cn'
import { formatDateTime, formatDay } from '@/lib/dates'
import { prisma } from '@/lib/db'
import {
  BOOKING_STATUS_META,
  INQUIRY_CHANNEL_LABEL,
  INQUIRY_STATUS_META,
  INQUIRY_TOPIC_META,
  ROLE_META,
  TIER_META,
  can,
} from '@/lib/domain'
import { INQUIRY_DONE_MESSAGES, formatReplyHours } from '@/lib/inquiries'
import { parseBusinessHours, replyDueAt } from '@/lib/business-hours'
import {
  assignInquiryAction,
  reopenInquiryAction,
  replyToInquiryAction,
  resolveInquiryAction,
} from '../actions'

export const metadata: Metadata = { title: 'Inquiry' }
export const dynamic = 'force-dynamic'

export default async function InquiryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ done?: string; error?: string }>
}) {
  const { id } = await params
  const { done, error } = await searchParams
  const staff = await requireCapability('inquiries.view')

  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    include: {
      replies: {
        orderBy: { sentAt: 'asc' },
        include: { staff: { select: { name: true } } },
      },
      customer: {
        select: {
          id: true,
          name: true,
          tier: true,
          email: true,
          phone: true,
          memberSince: true,
          rentalsCount: true,
        },
      },
      booking: {
        select: {
          id: true,
          status: true,
          size: true,
          eventDate: true,
          dress: { select: { name: true } },
        },
      },
      assignedTo: { select: { id: true, name: true } },
      resolvedBy: { select: { name: true } },
    },
  })
  if (!inquiry) notFound()

  const caps = {
    reply: can(staff.role, 'inquiries.reply'),
    assign: can(staff.role, 'inquiries.assign'),
  }

  const [settings, team] = await Promise.all([
    prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } }),
    caps.assign
      ? prisma.staffUser.findMany({
          where: { active: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ])

  const doneMessage = done ? (INQUIRY_DONE_MESSAGES[done] ?? null) : null
  const topicMeta = INQUIRY_TOPIC_META[inquiry.topic]
  const statusMeta = INQUIRY_STATUS_META[inquiry.status]
  const firstReplyHours =
    inquiry.firstReplyAt === null
      ? null
      : (inquiry.firstReplyAt.getTime() - inquiry.receivedAt.getTime()) / 3_600_000
  // The reply target counts only opening hours (Settings → Hours & delivery).
  const replyDue = replyDueAt(inquiry.receivedAt, settings.replyTargetHours, parseBusinessHours(settings.businessHours))
  const targetOverdue =
    inquiry.firstReplyAt === null && inquiry.status === 'OPEN' && Date.now() > replyDue.getTime()

  return (
    <div className="space-y-6">
      <Link
        href="/studio/inquiries"
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
        Back to the inbox
      </Link>

      <PageHeader
        title={inquiry.subject}
        description={`${inquiry.guestName} · ${inquiry.guestEmail} · received ${formatDateTime(inquiry.receivedAt)}`}
      >
        <Chip tone={topicMeta.tone}>{topicMeta.label}</Chip>
        <Chip tone="neutral">{INQUIRY_CHANNEL_LABEL[inquiry.channel]}</Chip>
        <Chip tone={statusMeta.tone}>{statusMeta.label}</Chip>
      </PageHeader>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger-line bg-surface px-4 py-3 text-sm font-bold text-danger-ink"
        >
          {error}
        </div>
      ) : null}
      {doneMessage ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden />
            {doneMessage}
          </span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Conversation"
              description="Original message and every reply, oldest first."
              action={
                firstReplyHours !== null ? (
                  <span className="text-[13px] text-ink-muted">
                    First reply in {formatReplyHours(firstReplyHours)}
                  </span>
                ) : targetOverdue ? (
                  <Chip tone="clay">Past the {settings.replyTargetHours}-hour target</Chip>
                ) : (
                  <span className="text-[13px] text-ink-muted">
                    Reply within {settings.replyTargetHours} h
                  </span>
                )
              }
            />
            <CardBody className="space-y-4">
              <div className="flex gap-4">
                <Avatar name={inquiry.guestName} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="text-sm font-bold text-ink">{inquiry.guestName}</p>
                    <span className="text-xs text-ink-muted">Customer · {formatDateTime(inquiry.receivedAt)}</span>
                  </div>
                  <p className="mt-2 rounded-lg bg-surface-muted px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-ink">
                    {inquiry.message}
                  </p>
                </div>
              </div>

              {inquiry.replies.length > 0 ? (
                <ol className="space-y-4 border-t border-line pt-4">
                  {inquiry.replies.map((reply) => (
                    <li key={reply.id} className="flex gap-4">
                      <Avatar name={reply.staff?.name ?? 'Studio'} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-sm font-bold text-ink">{reply.staff?.name ?? 'Studio'}</p>
                          <span className="text-xs text-ink-muted">
                            {reply.internal ? 'Internal note' : 'Reply'} · {formatDateTime(reply.sentAt)}
                          </span>
                          {reply.internal ? <Chip tone="neutral">Internal</Chip> : null}
                        </div>
                        <p
                          className={cn(
                            'mt-2 rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-ink',
                            reply.internal
                              ? 'border border-dashed border-line-strong bg-surface'
                              : 'bg-surface-muted',
                          )}
                        >
                          {reply.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Actions" description="Reply, resolve and route this conversation." />
            <CardBody className="space-y-5">
              {caps.reply ? (
                <section className="space-y-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">Reply</h3>
                  <form action={replyToInquiryAction} className="space-y-3">
                    <input type="hidden" name="inquiryId" value={inquiry.id} />
                    <div>
                      <FieldLabel htmlFor="reply-body">Your reply</FieldLabel>
                      <Textarea
                        id="reply-body"
                        name="body"
                        rows={5}
                        required
                        placeholder={`Write to ${inquiry.guestName}…`}
                      />
                    </div>
                    <label className="flex items-start gap-2.5 text-[13px] text-ink">
                      <input type="checkbox" name="internal" className="mt-0.5 size-4" />
                      <span>
                        Keep it internal — a note for the studio only.
                        <span className="block text-xs text-ink-muted">
                          Internal notes are never emailed to the customer.
                        </span>
                      </span>
                    </label>
                    <Button type="submit" size="sm">
                      <Send className="size-4" strokeWidth={1.75} aria-hidden />
                      Send reply
                    </Button>
                  </form>
                  <FieldHint>Replies are emailed to {inquiry.guestEmail}.</FieldHint>
                </section>
              ) : (
                <p className="text-[13px] text-ink-muted">Your role can read this inbox but not reply.</p>
              )}

              <section className="space-y-3 border-t border-line pt-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">Status</h3>
                {inquiry.status === 'OPEN' ? (
                  <>
                    <p className="text-[13px] text-ink-muted">
                      Resolving clears it from the open list — anyone can reopen it later.
                    </p>
                    {caps.reply ? (
                      <form action={resolveInquiryAction}>
                        <input type="hidden" name="inquiryId" value={inquiry.id} />
                        <Button type="submit" size="sm" variant="secondary">
                          <CheckCircle2 className="size-4" strokeWidth={1.75} aria-hidden />
                          Mark resolved
                        </Button>
                      </form>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="text-[13px] text-ink-muted">
                      Resolved{inquiry.resolvedBy ? ` by ${inquiry.resolvedBy.name}` : ''}
                      {inquiry.resolvedAt ? ` · ${formatDateTime(inquiry.resolvedAt)}` : ''}.
                    </p>
                    {caps.reply ? (
                      <form action={reopenInquiryAction}>
                        <input type="hidden" name="inquiryId" value={inquiry.id} />
                        <Button type="submit" size="sm" variant="secondary">
                          <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden />
                          Reopen inquiry
                        </Button>
                      </form>
                    ) : null}
                  </>
                )}
              </section>

              {caps.assign ? (
                <section className="space-y-3 border-t border-line pt-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">Assignee</h3>
                  <form action={assignInquiryAction} className="space-y-3">
                    <input type="hidden" name="inquiryId" value={inquiry.id} />
                    <div>
                      <FieldLabel htmlFor="assignee">Teammate</FieldLabel>
                      <Select id="assignee" name="assigneeId" defaultValue={inquiry.assignedTo?.id ?? ''}>
                        <option value="">Unassigned</option>
                        {team.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Button type="submit" size="sm" variant="secondary">
                      <UserPlus className="size-4" strokeWidth={1.75} aria-hidden />
                      Save assignment
                    </Button>
                  </form>
                  <FieldHint>
                    {inquiry.assignedTo
                      ? `Currently with ${inquiry.assignedTo.name}.`
                      : 'Not with anyone yet — route it to the teammate who should answer.'}
                  </FieldHint>
                </section>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Customer" />
            <CardBody className="space-y-3">
              {inquiry.customer ? (
                <>
                  <div className="flex items-center gap-3">
                    <Avatar name={inquiry.customer.name} />
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{inquiry.customer.name}</p>
                      <div className="mt-0.5">
                        <Chip tone={TIER_META[inquiry.customer.tier].tone}>
                          {TIER_META[inquiry.customer.tier].label}
                        </Chip>
                      </div>
                    </div>
                  </div>
                  <ContactRow icon={Mail} label="Email">
                    <a
                      href={`mailto:${inquiry.customer.email}`}
                      className="text-ink underline-offset-4 hover:underline"
                    >
                      {inquiry.customer.email}
                    </a>
                  </ContactRow>
                  {inquiry.customer.phone ? (
                    <ContactRow icon={Phone} label="Phone">
                      <a
                        href={`tel:${inquiry.customer.phone}`}
                        className="text-ink underline-offset-4 hover:underline"
                      >
                        {inquiry.customer.phone}
                      </a>
                    </ContactRow>
                  ) : null}
                  <p className="border-t border-line pt-3 text-[13px] text-ink-muted">
                    {inquiry.customer.rentalsCount} rental
                    {inquiry.customer.rentalsCount === 1 ? '' : 's'} · member since{' '}
                    {formatDay(inquiry.customer.memberSince)}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Avatar name={inquiry.guestName} />
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{inquiry.guestName}</p>
                      <p className="text-xs text-ink-muted">Not linked to a customer profile yet</p>
                    </div>
                  </div>
                  <ContactRow icon={Mail} label="Email">
                    <a
                      href={`mailto:${inquiry.guestEmail}`}
                      className="text-ink underline-offset-4 hover:underline"
                    >
                      {inquiry.guestEmail}
                    </a>
                  </ContactRow>
                  {inquiry.guestPhone ? (
                    <ContactRow icon={Phone} label="Phone">
                      <a
                        href={`tel:${inquiry.guestPhone}`}
                        className="text-ink underline-offset-4 hover:underline"
                      >
                        {inquiry.guestPhone}
                      </a>
                    </ContactRow>
                  ) : null}
                </>
              )}
            </CardBody>
          </Card>

          {inquiry.booking ? (
            <Card>
              <CardHeader
                title="Linked booking"
                action={
                  <Link
                    href={`/studio/bookings/${inquiry.booking.id}`}
                    className="text-[13px] font-bold text-ink-muted transition-colors hover:text-ink"
                  >
                    Open booking →
                  </Link>
                }
              />
              <CardBody className="space-y-2.5">
                <p className="text-sm text-ink">
                  {inquiry.booking.dress.name} <span className="text-ink-muted">· size {inquiry.booking.size}</span>
                </p>
                <p className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                  <CalendarDays className="size-3.5" strokeWidth={1.75} aria-hidden />
                  Event {formatDay(inquiry.booking.eventDate)}
                </p>
                <Chip tone={BOOKING_STATUS_META[inquiry.booking.status].tone}>
                  {BOOKING_STATUS_META[inquiry.booking.status].label}
                </Chip>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Access" />
            <CardBody className="space-y-2 text-[13px] text-ink-muted">
              <p>
                Signed in as <span className="font-bold text-ink">{staff.name}</span> — {ROLE_META[staff.role].label}.
              </p>
              <p>
                {caps.reply ? 'You can reply, resolve and reopen this inquiry.' : 'Read-only for your role.'}
                {caps.assign ? ' You can route it to a teammate.' : ''}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ContactRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden />
      <span className="w-12 shrink-0 text-xs text-ink-muted">{label}</span>
      <span className="min-w-0 flex-1 text-[13px]">{children}</span>
    </div>
  )
}
