/**
 * Transactional email templates.
 *
 * The subject and body of every message live in the NotificationTemplate table
 * so the studio can edit them under Settings; this module carries the factory
 * copy for the same five-to-eight messages and assembles the finished HTML.
 * Placeholders are {{doubleBrace}} variables — unknown ones render empty.
 */
import { prisma } from '@/lib/db'
import { renderEmailHtml, renderEmailText } from './design'
import { sendEmail, type SendEmailResult } from './send'

export type EmailKind =
  | 'booking_received'
  | 'confirmation'
  | 'shipped'
  | 'return_reminder_2day'
  | 'return_reminder_1day'
  | 'returned'
  | 'inquiry_received'
  | 'inquiry_reply'
  | 'magic_link'

type TemplateDefinition = {
  heading: string
  subject: string
  body: string
  cta?: { label: string; url: string }
  preheader?: string
}

const ACCOUNT_CTA = { label: 'View your rental', url: '{{accountUrl}}' }

export const DEFAULT_TEMPLATES: Record<EmailKind, TemplateDefinition> = {
  booking_received: {
    heading: 'We have your reservation',
    subject: 'We have your reservation — {{bookingId}}',
    body: `Hi {{firstName}},

Your {{dressName}} in size {{size}} is reserved for {{eventDate}}. The studio is reviewing it now, and you will have a confirmation — with payment captured and delivery details — within a few hours.

Nothing is charged until we confirm, and cancelling is free up to {{cancellationWindow}} days before your event.

Warmly,
The Maison Rêve studio`,
    cta: ACCOUNT_CTA,
    preheader: 'Reserved and awaiting the studio’s confirmation.',
  },
  confirmation: {
    heading: 'Your dress is reserved',
    subject: 'Your dress is reserved for {{eventDate}}',
    body: `Hi {{firstName}},

Your {{dressName}} in size {{size}} is confirmed and leaves the studio on {{deliveryDate}}, ready to wear for {{eventDate}}.

Included with every rental: the prepaid return label, professional cleaning, and a stylist on call if the fit needs adjusting.

Warmly,
The Maison Rêve studio`,
    cta: ACCOUNT_CTA,
    preheader: 'Confirmed — delivery details inside.',
  },
  shipped: {
    heading: 'Your dress is on its way',
    subject: 'Your dress is on its way',
    body: `Hi {{firstName}},

Your {{dressName}} left the studio with {{courier}}. Tracking: {{trackingNumber}}.

Unwrap it, let it hang for an hour, and steam out any travel creases with the sachet included. If anything is not right before the big day, reply to this note.

Warmly,
The Maison Rêve studio`,
    cta: { label: 'Track your rental', url: '{{accountUrl}}' },
    preheader: 'On the courier van and heading to you.',
  },
  return_reminder_2day: {
    heading: 'A gentle note about your return',
    subject: '{{dressName}} is due back in two days',
    body: `Hi {{firstName}},

Your {{dressName}} is due back on {{returnDate}}, two days from now. The prepaid label is in the box — drop it with any UPS point, or reply here and a courier can collect it from your address.

We hope the evening was everything you wanted.

Warmly,
The Maison Rêve studio`,
    cta: ACCOUNT_CTA,
    preheader: 'The return date is two days away.',
  },
  return_reminder_1day: {
    heading: 'Your return is due tomorrow',
    subject: '{{dressName}} is due back tomorrow',
    body: `Hi {{firstName}},

A last nudge that your {{dressName}} is due back tomorrow, {{returnDate}}. Pop the prepaid label on the box and hand it to any UPS point — or reply here and we will arrange a collection.

Warmly,
The Maison Rêve studio`,
    cta: ACCOUNT_CTA,
    preheader: 'Due back tomorrow.',
  },
  returned: {
    heading: 'We have your dress — thank you',
    subject: 'We have your {{dressName}} — thank you',
    body: `Hi {{firstName}},

Your return scanned in at the studio and your deposit is already on its way back to your card.

Thank you for treating the {{dressName}} so well — we would love to see a photo from the evening.

Warmly,
The Maison Rêve studio`,
    preheader: 'Return received; cleaning has started.',
  },
  inquiry_received: {
    heading: 'We have your note',
    subject: 'We have your note — {{subject}}',
    body: `Hi {{firstName}},

Thank you for writing to Maison Rêve. A stylist is reading your note now and will reply within a couple of hours — sooner if the studio is quiet.

If your question is about a particular dress, you can answer this email and it lands straight on your inquiry in our studio.

Warmly,
The Maison Rêve studio`,
    preheader: 'A stylist will reply shortly.',
  },
  inquiry_reply: {
    heading: 'A note from the studio',
    subject: 'Re: {{subject}}',
    body: `Hi {{firstName}},

Thank you for writing to the studio — a stylist has answered you below.

{{reply}}

If anything else comes up before your event, reply to this email and it lands straight in our studio inbox.

Warmly,
{{staffName}}
Maison Rêve`,
    preheader: 'The studio has answered your note.',
  },
  magic_link: {
    heading: 'Your sign-in link',
    subject: 'Your Maison Rêve sign-in link',
    body: `Hi {{firstName}},

Tap the button below to sign in to your Maison Rêve account — your rentals, favorites and measurements are all there. The link is good for the next 20 minutes.

If you did not ask for this, nothing happens — you can safely ignore this email.`,
    cta: { label: 'Sign in to your account', url: '{{url}}' },
    preheader: 'One tap and you are in.',
  },
}

export function renderTemplate(text: string, vars: Record<string, string | number | undefined>): string {
  return text.replaceAll(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key]
    return value === undefined || value === null ? '' : String(value)
  })
}

// ── the studio-editable set ───────────────────────────────────────────────

/**
 * The customer-facing templates the studio may edit under Settings → Email.
 * magic_link stays system-owned: it carries a security token and is never
 * opened for editing.
 */
export const EDITABLE_EMAIL_KINDS = [
  'booking_received',
  'confirmation',
  'shipped',
  'return_reminder_2day',
  'return_reminder_1day',
  'returned',
  'inquiry_received',
  'inquiry_reply',
] as const

export type EditableEmailKind = (typeof EDITABLE_EMAIL_KINDS)[number]

export const TEMPLATE_LABELS: Record<EditableEmailKind, string> = {
  booking_received: 'Booking received',
  confirmation: 'Booking confirmed',
  shipped: 'Shipped',
  return_reminder_2day: 'Return reminder — two days out',
  return_reminder_1day: 'Return reminder — due tomorrow',
  returned: 'Return received',
  inquiry_received: 'Inquiry received',
  inquiry_reply: 'Inquiry reply',
}

/** The variables each template may use; the editor refuses unknown ones. */
export const TEMPLATE_VARIABLES: Record<EditableEmailKind, string[]> = {
  booking_received: [
    'firstName',
    'dressName',
    'size',
    'bookingId',
    'eventDate',
    'deliveryDate',
    'returnDate',
    'cancellationWindow',
  ],
  confirmation: ['firstName', 'dressName', 'size', 'bookingId', 'eventDate', 'deliveryDate', 'returnDate'],
  shipped: ['firstName', 'dressName', 'bookingId', 'courier', 'trackingNumber'],
  return_reminder_2day: ['firstName', 'dressName', 'returnDate'],
  return_reminder_1day: ['firstName', 'dressName', 'returnDate'],
  returned: ['firstName', 'dressName', 'bookingId', 'returnDate'],
  inquiry_received: ['firstName', 'subject'],
  inquiry_reply: ['firstName', 'subject', 'reply', 'staffName'],
}

export function isEditableEmailKind(value: string): value is EditableEmailKind {
  return (EDITABLE_EMAIL_KINDS as readonly string[]).includes(value)
}

/** Every {{variable}} in the text that this template may not use. */
export function unknownTemplateVariables(kind: EditableEmailKind, text: string): string[] {
  const allowed = new Set(TEMPLATE_VARIABLES[kind])
  const unknown = new Set<string>()
  for (const match of text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
    const key = match[1]!
    if (!allowed.has(key)) unknown.add(key)
  }
  return [...unknown]
}

/** Values that make a preview or a test send read like a real message. */
export const SAMPLE_TEMPLATE_VARS: Record<string, string> = {
  firstName: 'Camille',
  dressName: 'Valentina Silk Gown',
  size: 'S',
  bookingId: 'MR-2841',
  eventDate: 'Nov 7',
  deliveryDate: 'Nov 5',
  returnDate: 'Nov 9',
  cancellationWindow: '7',
  courier: 'UPS',
  trackingNumber: '1Z999AA10123456784',
  subject: 'Fit advice for the Valentina',
  reply:
    'The Valentina runs true to size — the S will sit exactly like the model photograph at your height. If you are between sizes, take the M and we will pin the waist before dispatch.',
  staffName: 'Claire Fontaine',
  accountUrl: 'https://maisonreve.com/account',
  url: 'https://maisonreve.com/account/sign-in?token=sample',
}

export type TemplateCopy = {
  subject: string
  body: string
  customized: boolean
  updatedAt: Date | null
}

/** Settings-edited copy when it exists, factory copy otherwise. */
export async function templateCopy(kind: EmailKind): Promise<TemplateCopy> {
  const definition = DEFAULT_TEMPLATES[kind]
  try {
    const stored = await prisma.notificationTemplate.findUnique({ where: { id: kind } })
    if (stored && stored.channel === 'EMAIL') {
      return { subject: stored.subject, body: stored.body, customized: true, updatedAt: stored.updatedAt }
    }
  } catch {
    /* factory copy is always safe */
  }
  return { subject: definition.subject, body: definition.body, customized: false, updatedAt: null }
}

/** The branded HTML/text a template produces, with sample or given values. */
export async function renderEmailPreview(
  kind: EmailKind,
  vars: Record<string, string | number | undefined> = SAMPLE_TEMPLATE_VARS,
): Promise<{ subject: string; html: string; text: string }> {
  const definition = DEFAULT_TEMPLATES[kind]
  const copy = await templateCopy(kind)
  const design = {
    heading: renderTemplate(definition.heading, vars),
    preheader: definition.preheader ? renderTemplate(definition.preheader, vars) : undefined,
    body: renderTemplate(copy.body, vars),
    cta: definition.cta
      ? { label: renderTemplate(definition.cta.label, vars), url: renderTemplate(definition.cta.url, vars) }
      : undefined,
    footnote: undefined,
  }
  return {
    subject: renderTemplate(copy.subject, vars),
    html: renderEmailHtml(design),
    text: renderEmailText(design),
  }
}

export async function sendTemplatedEmail(input: {
  kind: EmailKind
  to: string
  toName?: string
  vars: Record<string, string | number | undefined>
  replyTo?: string
  reference?: string
}): Promise<SendEmailResult> {
  const definition = DEFAULT_TEMPLATES[input.kind]

  // Settings-edited copy wins when present; the factory text is the fallback.
  let subject = definition.subject
  let body = definition.body
  try {
    const stored = await prisma.notificationTemplate.findUnique({ where: { id: input.kind } })
    if (stored && stored.active && stored.channel === 'EMAIL') {
      subject = stored.subject
      body = stored.body
    }
  } catch {
    /* a missing table on a first run just falls back to the factory copy */
  }

  const vars = input.vars
  const design = {
    heading: renderTemplate(definition.heading, vars),
    preheader: definition.preheader ? renderTemplate(definition.preheader, vars) : undefined,
    body: renderTemplate(body, vars),
    cta: definition.cta
      ? { label: renderTemplate(definition.cta.label, vars), url: renderTemplate(definition.cta.url, vars) }
      : undefined,
    footnote: undefined,
  }

  return sendEmail({
    to: input.to,
    toName: input.toName,
    subject: renderTemplate(subject, vars),
    html: renderEmailHtml(design),
    text: renderEmailText(design),
    kind: input.kind,
    reference: input.reference,
    replyTo: input.replyTo,
  })
}
