import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Inbox, MailCheck, TriangleAlert } from 'lucide-react'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { requireCapability } from '@/lib/auth/guards'
import { emailProvider } from '@/lib/email/send'
import { listOutboxMessages } from '@/lib/email/outbox'
import { formatDateTime } from '@/lib/dates'

export const metadata: Metadata = { title: 'Outbox' }
export const dynamic = 'force-dynamic'

/**
 * The local outbox — every customer email this deployment has composed, newest
 * first. It exists because a studio without an email key should still be able
 * to read exactly what would have gone out, so it 404s the moment a live email
 * provider is configured: a production studio never serves this screen.
 */
export default async function OutboxPage() {
  await requireCapability('settings.view')
  if (emailProvider() !== 'outbox') notFound()

  const messages = await listOutboxMessages(60)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outbox"
        description="Every message the app composed, as the customer would have received it."
      >
        <Chip tone="gold">Local outbox — no email key configured</Chip>
      </PageHeader>

      <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-ink-muted">
        No transactional email key is set, so every message is written here instead of being delivered. Set{' '}
        <code className="rounded bg-surface-muted px-1.5 py-0.5 text-[12px]">RESEND_API_KEY</code> to send for real — this
        screen then disappears. Nothing on the storefront mentions this page.
      </p>

      {messages.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing sent yet"
          description="Confirm a booking, reply to an inquiry, or request a sign-in link — the message lands here within a moment."
        />
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <details key={message.id} className="group rounded-xl border border-line bg-surface">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <MailCheck className="size-4 shrink-0 text-mulberry" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{message.subject}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    to {message.toName ? `${message.toName} · ` : ''}
                    {message.to}
                    {message.reference ? ` · ${message.reference}` : ''} · {formatDateTime(message.createdAt)}
                  </span>
                </span>
                <Chip tone={message.error ? 'rose' : 'gold'}>{message.kind}</Chip>
                {message.error ? (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-danger-ink">
                    <TriangleAlert className="size-3.5" strokeWidth={2} aria-hidden />
                    {message.error}
                  </span>
                ) : null}
              </summary>
              <div className="border-t border-line px-5 py-4">
                {message.replyTo ? <p className="mb-3 text-xs text-ink-muted">Reply-To: {message.replyTo}</p> : null}
                <iframe
                  title={`${message.kind} — ${message.subject}`}
                  srcDoc={message.html}
                  sandbox=""
                  className="h-[420px] w-full rounded-lg border border-line bg-white"
                />
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-bold text-ink-muted hover:text-mulberry">Plain-text version</summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-line bg-surface-muted/60 p-4 text-xs leading-relaxed whitespace-pre-wrap text-ink">
                    {message.text}
                  </pre>
                </details>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
