/**
 * Studio settings — the single writer behind Settings → Rental rules, Email,
 * and Hours & delivery, plus the staff-account lifecycle.
 *
 * Everything here follows the studio's rules: values are validated server-side
 * with a message a studio member can act on, every write is audit-logged, and
 * the last active Owner can never be removed or demoted.
 */
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { prisma } from './db'
import { recordAudit, staffActor } from './audit'
import type { StaffUser } from '@prisma/client'
import type { StaffRole } from './domain'
import { isStaffRole, STAFF_ROLES } from './domain'
import { parseBusinessHours, WEEKDAYS, type BusinessHours } from './business-hours'
import { parseDeliveryZones, serializeDeliveryZones, type DeliveryZone } from './delivery'
import {
  isEditableEmailKind,
  sendTemplatedEmail,
  SAMPLE_TEMPLATE_VARS,
  unknownTemplateVariables,
  type EditableEmailKind,
} from './email/templates'
import { sendEmail } from './email/send'

export class SettingsError extends Error {}

function fieldText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

function intField(
  formData: FormData,
  key: string,
  label: string,
  min: number,
  max: number,
): number {
  const raw = fieldText(formData, key).replace(/[$\s,]/g, '')
  if (!raw) throw new SettingsError(`Add the ${label}.`)
  const value = Number(raw)
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new SettingsError(`The ${label} must be a whole number.`)
  }
  if (value < min || value > max) {
    throw new SettingsError(`The ${label} must be between ${min} and ${max}.`)
  }
  return value
}

function moneyField(formData: FormData, key: string, label: string, maxDollars: number): number {
  const raw = fieldText(formData, key).replace(/[$\s,]/g, '')
  if (!raw) throw new SettingsError(`Add the ${label}.`)
  const dollars = Number(raw)
  if (!Number.isFinite(dollars) || dollars < 0 || dollars > maxDollars) {
    throw new SettingsError(`The ${label} must be between 0 and ${maxDollars} dollars.`)
  }
  return Math.round(dollars * 100)
}

function checkbox(formData: FormData, key: string): boolean {
  const value = formData.get(key)
  return value === 'on' || value === 'true' || value === '1'
}

// ── rental rules ──────────────────────────────────────────────────────────

export type RentalRulesInput = {
  rentalPercent4: number
  rentalPercent8: number
  prepDays: number
  bufferDays: number
  extensionFeePerDay: number
  lateFeePerDay: number
  lateGraceDays: number
  depositPercent: number
  cancellationWindowDays: number
  cancellationRefundPercent: number
  autoConfirmBookings: boolean
}

export function parseRentalRulesForm(formData: FormData): RentalRulesInput {
  const input: RentalRulesInput = {
    rentalPercent4: intField(formData, 'rentalPercent4', '4-day price (percent of retail)', 5, 100),
    rentalPercent8: intField(formData, 'rentalPercent8', '8-day price (percent of retail)', 5, 150),
    prepDays: intField(formData, 'prepDays', 'preparation days', 0, 3),
    bufferDays: intField(formData, 'bufferDays', 'cleaning buffer days', 0, 5),
    extensionFeePerDay: moneyField(formData, 'extensionFeePerDay', 'daily extension fee', 1000),
    lateFeePerDay: moneyField(formData, 'lateFeePerDay', 'late fee per day', 1000),
    lateGraceDays: intField(formData, 'lateGraceDays', 'late-fee grace days', 0, 14),
    depositPercent: intField(formData, 'depositPercent', 'deposit (percent of retail)', 0, 100),
    cancellationWindowDays: intField(formData, 'cancellationWindowDays', 'free-cancellation window (days)', 0, 60),
    cancellationRefundPercent: intField(formData, 'cancellationRefundPercent', 'refund inside the window (percent)', 0, 100),
    autoConfirmBookings: checkbox(formData, 'autoConfirmBookings'),
  }
  if (input.rentalPercent8 <= input.rentalPercent4) {
    throw new SettingsError('The 8-day price should be higher than the 4-day price.')
  }
  return input
}

export async function saveRentalRules(staff: StaffUser, input: RentalRulesInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } })
    await tx.studioSettings.update({ where: { id: 'studio' }, data: input })

    const changed = Object.entries(input)
      .filter(([key, value]) => (before as Record<string, unknown>)[key] !== value)
      .map(([key]) => key)
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'settings.rules_updated',
      entity: 'StudioSettings',
      entityId: 'studio',
      summary: changed.length > 0 ? `Updated rental rules — ${changed.join(', ')}` : 'Saved rental rules (no changes)',
      metadata: { changed, values: input },
    })
  })
}

// ── business hours ────────────────────────────────────────────────────────

export type HoursInput = Record<string, { open: string; close: string } | null>

export function parseHoursForm(formData: FormData): HoursInput {
  const hours: HoursInput = {}
  for (const day of WEEKDAYS) {
    const closed = checkbox(formData, `${day}_closed`)
    if (closed) {
      hours[day] = null
      continue
    }
    const open = fieldText(formData, `${day}_open`)
    const close = fieldText(formData, `${day}_close`)
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(close)) {
      throw new SettingsError(`Set both opening and closing times for ${day.charAt(0).toUpperCase() + day.slice(1)}.`)
    }
    if (close <= open) {
      throw new SettingsError(`On ${day.charAt(0).toUpperCase() + day.slice(1)} the closing time must be after the opening time.`)
    }
    hours[day] = { open, close }
  }
  if (WEEKDAYS.every((day) => hours[day] === null)) {
    throw new SettingsError('Keep at least one open day so the reply clock has time to run.')
  }
  return hours
}

export async function saveBusinessHours(staff: StaffUser, hours: HoursInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } })
    const previous = parseBusinessHours(before.businessHours)
    await tx.studioSettings.update({ where: { id: 'studio' }, data: { businessHours: hours } })

    const changed = WEEKDAYS.filter((day) => {
      const a = previous[day]
      const b = hours[day] ?? null
      return JSON.stringify(a) !== JSON.stringify(b)
    })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'settings.hours_updated',
      entity: 'StudioSettings',
      entityId: 'studio',
      summary: changed.length > 0 ? `Updated business hours — ${changed.join(', ')}` : 'Saved business hours (no changes)',
      metadata: { changed },
    })
  })
}

// ── delivery zones ────────────────────────────────────────────────────────

const MAX_ZONES = 8

export function parseZonesForm(formData: FormData): DeliveryZone[] {
  const zones: DeliveryZone[] = []
  for (let index = 0; index < MAX_ZONES; index += 1) {
    const name = fieldText(formData, `zone_name_${index}`)
    const courier = fieldText(formData, `zone_courier_${index}`)
    const etaRaw = fieldText(formData, `zone_eta_${index}`)
    const feeRaw = fieldText(formData, `zone_fee_${index}`)
    const cutoff = fieldText(formData, `zone_cutoff_${index}`)
    const empty = !name && !courier && !etaRaw && !feeRaw
    if (empty) continue

    if (name.length < 2 || name.length > 60) {
      throw new SettingsError(`Zone ${index + 1}: give the zone a name between 2 and 60 characters.`)
    }
    if (courier.length < 2 || courier.length > 40) {
      throw new SettingsError(`Zone ${index + 1}: name the courier (2–40 characters).`)
    }
    const etaDays = Number(etaRaw)
    if (!Number.isInteger(etaDays) || etaDays < 0 || etaDays > 14) {
      throw new SettingsError(`Zone ${index + 1}: the ETA must be 0–14 business days.`)
    }
    const feeDollars = Number(feeRaw.replace(/[$\s,]/g, ''))
    if (!Number.isFinite(feeDollars) || feeDollars < 0 || feeDollars > 500) {
      throw new SettingsError(`Zone ${index + 1}: the courier fee must be between 0 and 500 dollars.`)
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff)) {
      throw new SettingsError(`Zone ${index + 1}: set a dispatch cutoff as a 24-hour time such as 14:00.`)
    }
    zones.push({ name, courier, etaDays, fee: Math.round(feeDollars * 100), cutoff })
  }

  if (zones.length === 0) throw new SettingsError('Keep at least one delivery zone — checkout offers them to customers.')
  const names = new Set(zones.map((zone) => zone.name.toLowerCase()))
  if (names.size !== zones.length) throw new SettingsError('Two zones share a name — zone names must be unique.')
  return zones
}

export async function saveDeliveryZones(staff: StaffUser, zones: DeliveryZone[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } })
    const previous = parseDeliveryZones(before.deliveryZones)
    await tx.studioSettings.update({ where: { id: 'studio' }, data: { deliveryZones: serializeDeliveryZones(zones) } })

    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'settings.zones_updated',
      entity: 'StudioSettings',
      entityId: 'studio',
      summary: `Updated delivery zones — now ${zones.length}: ${zones.map((zone) => zone.name).join(', ')}`,
      metadata: { before: previous, after: zones },
    })
  })
}

// ── email templates ───────────────────────────────────────────────────────

const MAX_SUBJECT = 160
const MAX_BODY = 4000

export function parseTemplateForm(formData: FormData): { kind: EditableEmailKind; subject: string; body: string } {
  const kind = fieldText(formData, 'kind')
  if (!isEditableEmailKind(kind)) throw new SettingsError('That template is not part of the editable set.')
  const subject = fieldText(formData, 'subject')
  const body = String(formData.get('body') ?? '').trim()
  if (!subject) throw new SettingsError('The subject line cannot be empty.')
  if (subject.length > MAX_SUBJECT) throw new SettingsError(`Keep the subject under ${MAX_SUBJECT} characters.`)
  if (!body) throw new SettingsError('The message body cannot be empty.')
  if (body.length > MAX_BODY) throw new SettingsError(`Keep the body under ${MAX_BODY} characters.`)
  const unknown = [...unknownTemplateVariables(kind, subject), ...unknownTemplateVariables(kind, body)]
  if (unknown.length > 0) {
    throw new SettingsError(`These variables are not available in this template: ${[...new Set(unknown)].join(', ')}.`)
  }
  return { kind, subject, body }
}

export async function saveTemplate(
  staff: StaffUser,
  input: { kind: EditableEmailKind; subject: string; body: string },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.notificationTemplate.upsert({
      where: { id: input.kind },
      create: {
        id: input.kind,
        name: input.kind,
        channel: 'EMAIL',
        subject: input.subject,
        body: input.body,
        active: true,
      },
      update: { subject: input.subject, body: input.body, active: true },
    })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'settings.template_updated',
      entity: 'NotificationTemplate',
      entityId: input.kind,
      summary: `Updated the “${input.kind}” email template`,
      metadata: { subject: input.subject },
    })
  })
}

export async function resetTemplate(staff: StaffUser, kind: EditableEmailKind): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.notificationTemplate.deleteMany({ where: { id: kind } })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'settings.template_reset',
      entity: 'NotificationTemplate',
      entityId: kind,
      summary: `Reset the “${kind}” email template to the factory copy`,
    })
  })
}

/** Sends the template, with sample values, to the signed-in staff member. */
export async function sendTestTemplate(staff: StaffUser, kind: EditableEmailKind): Promise<string> {
  const result = await sendTemplatedEmail({
    kind,
    to: staff.email,
    toName: staff.name,
    vars: SAMPLE_TEMPLATE_VARS,
    reference: 'template-test',
  })
  await prisma.auditLog.create({
    data: {
      ...staffActor(staff),
      action: 'settings.template_test_sent',
      entity: 'NotificationTemplate',
      entityId: kind,
      summary: `Sent a test of the “${kind}” email to ${staff.email} (${result.provider})`,
    },
  })
  return result.provider === 'outbox'
    ? `Test sent to ${staff.email} — it lands in the local outbox while no email provider key is set.`
    : `Test sent to ${staff.email}.`
}

// ── staff accounts ────────────────────────────────────────────────────────

function tempPassword(): string {
  const raw = crypto.randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, '')
  const token = raw.slice(0, 8).toUpperCase()
  return `MR-${token.slice(0, 4)}-${token.slice(4, 8)}`
}

async function sendStaffInvite(
  email: string,
  name: string,
  password: string,
  options: { reset: boolean },
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const intro = options.reset
    ? 'Your studio password was reset by an owner. Sign in with the temporary password below — you will choose a new one immediately.'
    : 'You have been invited to the Maison Rêve studio. Sign in with the temporary password below and choose your own on the spot.'
  try {
    await sendEmail({
      to: email,
      toName: name,
      subject: options.reset ? 'Your Maison Rêve studio password was reset' : 'Your Maison Rêve studio account',
      kind: 'staff_invite',
      html: `<p>Hi ${name.split(/\s+/)[0] || name},</p><p>${intro}</p><p><strong>Temporary password:</strong> ${password}</p><p>Sign in at <a href="${appUrl}/studio/login">${appUrl}/studio/login</a>.</p>`,
      text: `Hi ${name.split(/\s+/)[0] || name},\n\n${intro}\n\nTemporary password: ${password}\n\nSign in at ${appUrl}/studio/login`,
    })
  } catch (error) {
    console.error(`Staff invite email to ${email} failed:`, error)
  }
}

const MAX_STAFF_NAME = 80

export async function inviteStaff(
  staff: StaffUser,
  input: { name: string; email: string; role: string; title: string; phone?: string },
): Promise<{ tempPassword: string }> {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  const title = input.title.trim()
  const role = input.role.trim()
  if (name.length < 2 || name.length > MAX_STAFF_NAME) throw new SettingsError('Give the new teammate a name.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SettingsError('That email address does not look right.')
  if (!isStaffRole(role)) throw new SettingsError('Choose a role for the new teammate.')
  if (title.length < 2 || title.length > 80) throw new SettingsError('Add a short title, such as “Stylist”.')

  const existing = await prisma.staffUser.findUnique({ where: { email }, select: { id: true } })
  if (existing) throw new SettingsError('A studio account with that email already exists.')

  const password = tempPassword()
  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.$transaction(async (tx) => {
    const created = await tx.staffUser.create({
      data: {
        name,
        email,
        passwordHash,
        role: role as StaffRole,
        title,
        phone: input.phone?.trim() || null,
        accentTone: 'rose',
        mustChangePassword: true,
      },
      select: { id: true },
    })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'staff.invited',
      entity: 'StaffUser',
      entityId: created.id,
      summary: `Invited ${name} (${email}) as ${role.toLowerCase().replace('_', ' ')} — must set a password on first sign-in`,
      metadata: { email, role },
    })
  })

  await sendStaffInvite(email, name, password, { reset: false })
  return { tempPassword: password }
}

async function activeOwnerCount(): Promise<number> {
  return prisma.staffUser.count({ where: { role: 'OWNER', active: true } })
}

export async function setStaffActive(staff: StaffUser, targetId: string, active: boolean): Promise<void> {
  if (targetId === staff.id) throw new SettingsError('You cannot deactivate your own account.')
  const target = await prisma.staffUser.findUnique({ where: { id: targetId } })
  if (!target) throw new SettingsError('That account no longer exists.')
  if (target.active === active) return
  if (!active && target.role === 'OWNER' && (await activeOwnerCount()) <= 1) {
    throw new SettingsError('The last active Owner cannot be deactivated — promote another Owner first.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.staffUser.update({ where: { id: targetId }, data: { active } })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: active ? 'staff.activated' : 'staff.deactivated',
      entity: 'StaffUser',
      entityId: targetId,
      summary: `${active ? 'Reactivated' : 'Deactivated'} ${target.name} (${target.email})`,
    })
  })
}

export async function setStaffRole(staff: StaffUser, targetId: string, role: string): Promise<void> {
  if (!isStaffRole(role)) throw new SettingsError('That is not a studio role.')
  if (targetId === staff.id) throw new SettingsError('You cannot change your own role — ask another Owner.')
  const target = await prisma.staffUser.findUnique({ where: { id: targetId } })
  if (!target) throw new SettingsError('That account no longer exists.')
  if (target.role === role) return
  if (target.role === 'OWNER' && target.active && role !== 'OWNER' && (await activeOwnerCount()) <= 1) {
    throw new SettingsError('The last active Owner cannot be demoted — promote another Owner first.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.staffUser.update({ where: { id: targetId }, data: { role: role as StaffRole } })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'staff.role_changed',
      entity: 'StaffUser',
      entityId: targetId,
      summary: `Changed ${target.name}’s role from ${target.role.toLowerCase().replace('_', ' ')} to ${role.toLowerCase().replace('_', ' ')}`,
      metadata: { from: target.role, to: role },
    })
  })
}

export async function resetStaffPassword(staff: StaffUser, targetId: string): Promise<{ tempPassword: string }> {
  const target = await prisma.staffUser.findUnique({ where: { id: targetId } })
  if (!target) throw new SettingsError('That account no longer exists.')

  const password = tempPassword()
  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.$transaction(async (tx) => {
    await tx.staffUser.update({ where: { id: targetId }, data: { passwordHash, mustChangePassword: true } })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'staff.password_reset',
      entity: 'StaffUser',
      entityId: targetId,
      summary: `Reset the password for ${target.name} (${target.email}) — must set a new one on next sign-in`,
    })
  })

  await sendStaffInvite(target.email, target.name, password, { reset: true })
  return { tempPassword: password }
}

export async function setTwoFactorRequired(staff: StaffUser, targetId: string, required: boolean): Promise<void> {
  const target = await prisma.staffUser.findUnique({ where: { id: targetId } })
  if (!target) throw new SettingsError('That account no longer exists.')
  if (target.twoFactorRequired === required) return

  await prisma.$transaction(async (tx) => {
    await tx.staffUser.update({ where: { id: targetId }, data: { twoFactorRequired: required } })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: required ? 'staff.two_factor_required' : 'staff.two_factor_optional',
      entity: 'StaffUser',
      entityId: targetId,
      summary: `${required ? 'Now requires' : 'No longer requires'} two-factor sign-in for ${target.name}${required && !target.twoFactorEnabled ? ' — they enroll at next sign-in' : ''}`,
    })
  })
}

/** Clears the authenticator so a lost phone can be replaced at next sign-in. */
export async function resetStaffTwoFactor(staff: StaffUser, targetId: string): Promise<void> {
  const target = await prisma.staffUser.findUnique({ where: { id: targetId } })
  if (!target) throw new SettingsError('That account no longer exists.')
  if (!target.twoFactorEnabled && !target.twoFactorSecret) throw new SettingsError('That account has no authenticator to reset.')

  await prisma.$transaction(async (tx) => {
    await tx.staffUser.update({
      where: { id: targetId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'staff.two_factor_reset',
      entity: 'StaffUser',
      entityId: targetId,
      summary: `Cleared the authenticator for ${target.name} — it is re-enrolled at next sign-in${target.twoFactorRequired ? ' (required)' : ''}`,
    })
  })
}

export { STAFF_ROLES }
