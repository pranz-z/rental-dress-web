import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2, RotateCcw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { FieldHint, FieldLabel, Input, Textarea } from '@/components/ui/field'
import { requireCapability } from '@/lib/auth/guards'
import { formatDateTime } from '@/lib/dates'
import { can } from '@/lib/domain'
import {
  DEFAULT_TEMPLATES,
  isEditableEmailKind,
  renderEmailPreview,
  TEMPLATE_LABELS,
  TEMPLATE_VARIABLES,
  templateCopy,
} from '@/lib/email/templates'
import { resetTemplateAction, saveTemplateAction, sendTemplateTestAction } from '../../actions'
import { SETTINGS_DONE_MESSAGES } from '../../messages'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const { kind } = await params
  const label = isEditableEmailKind(kind) ? TEMPLATE_LABELS[kind] : 'Email template'
  return { title: `${label} · Email templates · Settings` }
}

export default async function TemplateEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>
  searchParams: Promise<{ done?: string; error?: string }>
}) {
  const staff = await requireCapability('settings.view')
  const [{ kind }, { done, error }] = await Promise.all([params, searchParams])
  if (!isEditableEmailKind(kind)) notFound()

  const editable = can(staff.role, 'settings.templates')
  const copy = await templateCopy(kind)
  const preview = await renderEmailPreview(kind)
  const doneMessage = done ? (SETTINGS_DONE_MESSAGES[done] ?? null) : null

  return (
    <div className="space-y-5">
      <Link
        href="/studio/settings/templates"
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
        All email templates
      </Link>

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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        <div className="space-y-5">
          <form action={saveTemplateAction}>
            <Card>
              <CardHeader
                title={TEMPLATE_LABELS[kind]}
                description="Subject and body — the brand frame, buttons and footer stay fixed."
                action={
                  copy.customized ? (
                    <Chip tone="gold">Customized{copy.updatedAt ? ` · ${formatDateTime(copy.updatedAt)}` : ''}</Chip>
                  ) : (
                    <Chip tone="neutral">Factory copy</Chip>
                  )
                }
              />
              <CardBody className="space-y-4">
                <input type="hidden" name="kind" value={kind} />
                <div>
                  <FieldLabel htmlFor="template-subject">Subject line</FieldLabel>
                  <Input
                    id="template-subject"
                    name="subject"
                    defaultValue={copy.subject}
                    maxLength={160}
                    required
                    disabled={!editable}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="template-body">Message body</FieldLabel>
                  <Textarea
                    id="template-body"
                    name="body"
                    defaultValue={copy.body}
                    rows={14}
                    required
                    disabled={!editable}
                    className="font-mono text-[13px] leading-relaxed"
                  />
                  <FieldHint>
                    Paragraphs are separated by blank lines. Use the variables below — anything else is refused on save.
                  </FieldHint>
                </div>
                <div className="rounded-xl border border-line bg-surface-muted/50 p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">Available variables</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {TEMPLATE_VARIABLES[kind].map((variable) => (
                      <code
                        key={variable}
                        className="rounded-md border border-line bg-surface px-2 py-1 font-mono text-xs text-ink"
                      >
                        {`{{${variable}}}`}
                      </code>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                    The preview shows every variable with a sample value.
                  </p>
                </div>
              </CardBody>
              {editable ? (
                <CardFooter className="flex flex-wrap items-center gap-3">
                  <Button type="submit">Save template</Button>
                </CardFooter>
              ) : (
                <CardFooter>
                  <p className="text-[13px] text-ink-muted">
                    Email templates are edited by the Owner and the Studio Manager.
                  </p>
                </CardFooter>
              )}
            </Card>
          </form>

          {editable ? (
            <div className="flex flex-wrap items-center gap-3">
              <form action={sendTemplateTestAction}>
                <input type="hidden" name="kind" value={kind} />
                <Button type="submit" variant="secondary">
                  <Send className="size-4" strokeWidth={1.75} aria-hidden />
                  Send a test to me
                </Button>
              </form>
              {copy.customized ? (
                <form action={resetTemplateAction}>
                  <input type="hidden" name="kind" value={kind} />
                  <Button type="submit" variant="ghost">
                    <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden />
                    Reset to factory copy
                  </Button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>

        <Card className="self-start">
          <CardHeader title="Preview" description="Exactly what lands in the inbox, with sample values." />
          <CardBody className="bg-page/40">
            <div className="rounded-xl border border-line bg-white p-2">
              <iframe
                title={`${TEMPLATE_LABELS[kind]} preview`}
                srcDoc={preview.html}
                sandbox=""
                className="h-[600px] w-full rounded-lg"
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              Subject: <span className="font-bold text-ink">{preview.subject}</span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Factory subject: {DEFAULT_TEMPLATES[kind].subject}
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
