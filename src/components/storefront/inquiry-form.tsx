'use client'

import { useActionState } from 'react'
import { Loader2, Send } from 'lucide-react'
import type { InquiryTopic } from '@prisma/client'
import { FieldError, FieldHint, FieldLabel, Input, Select, Textarea } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { sendInquiryAction } from '@/app/(storefront)/actions'
import { IDLE_FORM, INQUIRY_TOPIC_CHOICES } from '@/app/(storefront)/form-state'

/**
 * The inquiry form shared by the contact page and every dress page. Posts to
 * the same action, lands in the same studio inbox with the two-hour clock.
 */
export function InquiryForm({
  channel,
  subject,
  topicDefault = 'GENERAL',
  lockTopic = false,
  defaultName = '',
  defaultEmail = '',
  context,
  replyTargetHours,
}: {
  channel: 'CONTACT_FORM' | 'DRESS_PAGE'
  subject?: string
  topicDefault?: InquiryTopic
  lockTopic?: boolean
  defaultName?: string
  defaultEmail?: string
  /** e.g. “About the Valentina Silk Gown” shown above the form. */
  context?: string
  /** Studio reply target, from Settings → Hours & delivery. */
  replyTargetHours?: number
}) {
  const [state, formAction, pending] = useActionState(sendInquiryAction, IDLE_FORM)

  if (state.status === 'ok') {
    return (
      <div role="status" className="rounded-xl border border-line bg-surface-muted/60 p-5">
        <p className="font-serif text-lg text-ink">Your note is with the studio</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{state.message}</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="channel" value={channel} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {subject ? <input type="hidden" name="subject" value={subject} /> : null}

      {context ? <p className="text-[11px] font-bold tracking-[0.14em] text-gold-ink uppercase">{context}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="inquiry-name">Your name</FieldLabel>
          <Input id="inquiry-name" name="name" defaultValue={defaultName} required minLength={2} maxLength={120} autoComplete="name" />
        </div>
        <div>
          <FieldLabel htmlFor="inquiry-email">Email</FieldLabel>
          <Input id="inquiry-email" name="email" type="email" defaultValue={defaultEmail} required autoComplete="email" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="inquiry-phone">Phone (optional)</FieldLabel>
          <Input id="inquiry-phone" name="phone" type="tel" autoComplete="tel" />
        </div>
        {!subject ? (
          <div>
            <FieldLabel htmlFor="inquiry-subject">Subject</FieldLabel>
            <Input id="inquiry-subject" name="subject" required minLength={3} maxLength={160} placeholder="Backup size for Nov 14" />
          </div>
        ) : (
          <div>
            <FieldLabel htmlFor="inquiry-topic-display">Topic</FieldLabel>
            <Input id="inquiry-topic-display" value={INQUIRY_TOPIC_CHOICES.find((choice) => choice.value === topicDefault)?.label ?? ''} readOnly disabled />
          </div>
        )}
      </div>

      {!lockTopic && !subject ? (
        <div>
          <FieldLabel htmlFor="inquiry-topic">What is it about?</FieldLabel>
          <Select id="inquiry-topic" name="topic" defaultValue={topicDefault}>
            {INQUIRY_TOPIC_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <input type="hidden" name="topic" value={topicDefault} />
      )}

      <div>
        <FieldLabel htmlFor="inquiry-message">Your note</FieldLabel>
        <Textarea
          id="inquiry-message"
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          placeholder="Tell the studio about your event, your usual size, and anything you are deciding between."
        />
        <FieldHint>
          {replyTargetHours
            ? `A stylist replies within ${replyTargetHours === 1 ? 'an hour' : `${replyTargetHours} hours`} during studio hours.`
            : 'A stylist replies within a couple of hours during studio hours.'}
        </FieldHint>
      </div>

      <FieldError>{state.status === 'error' ? state.message : null}</FieldError>

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" strokeWidth={1.75} aria-hidden />}
        Send to the studio
      </Button>
    </form>
  )
}
