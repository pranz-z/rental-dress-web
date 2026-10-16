import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/table'
import { requireCapability } from '@/lib/auth/guards'
import { formatDay } from '@/lib/dates'
import { can } from '@/lib/domain'
import { EDITABLE_EMAIL_KINDS, TEMPLATE_LABELS, type EditableEmailKind, templateCopy } from '@/lib/email/templates'
import { SETTINGS_DONE_MESSAGES } from '../messages'

export const metadata: Metadata = { title: 'Email templates · Settings' }
export const dynamic = 'force-dynamic'

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>
}) {
  const staff = await requireCapability('settings.view')
  const { done, error } = await searchParams
  const editable = can(staff.role, 'settings.templates')

  const rows = await Promise.all(
    EDITABLE_EMAIL_KINDS.map(async (kind: EditableEmailKind) => ({ kind, copy: await templateCopy(kind) })),
  )
  const doneMessage = done ? (SETTINGS_DONE_MESSAGES[done] ?? null) : null

  return (
    <div className="space-y-5">
      {error ? (
        <div role="alert" className="rounded-xl border border-danger-line bg-surface px-4 py-3 text-sm font-bold text-danger-ink">
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

      <Card>
        <CardHeader
          title="Transactional emails"
          description="Every message the studio and storefront send. The brand layout is fixed — subject and wording are yours."
          action={editable ? undefined : <Chip tone="neutral">Read only</Chip>}
        />
        <CardBody className="px-0 py-0 sm:px-0">
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Template</Th>
                  <Th>Subject line</Th>
                  <Th>Copy</Th>
                  <Th>Updated</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ kind, copy }) => (
                  <Tr key={kind} className="relative">
                    <Td>
                      <Link
                        href={`/studio/settings/templates/${kind}`}
                        className="font-bold text-ink after:absolute after:inset-0 after:content-['']"
                      >
                        {TEMPLATE_LABELS[kind]}
                      </Link>
                    </Td>
                    <Td className="max-w-[360px]">
                      <span className="line-clamp-1 text-ink-muted">{copy.subject}</span>
                    </Td>
                    <Td>
                      {copy.customized ? <Chip tone="gold">Customized</Chip> : <Chip tone="neutral">Factory</Chip>}
                    </Td>
                    <Td className="text-ink-muted">{copy.updatedAt ? formatDay(copy.updatedAt) : '—'}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </CardBody>
      </Card>

      <p className="text-[13px] leading-relaxed text-ink-muted">
        Sign-in codes and password resets are system messages with a fixed layout — they are not part of this set.
      </p>
    </div>
  )
}
