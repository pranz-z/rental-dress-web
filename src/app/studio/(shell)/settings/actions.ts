'use server'

/**
 * Settings actions. Every write funnels through the domain operations in
 * lib/settings.ts, so validation, the audit trail and the last-Owner guards
 * are enforced exactly once; outcomes travel back through the URL, keeping
 * every page a plain refresh.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireCapability } from '@/lib/auth/guards'
import { isEditableEmailKind } from '@/lib/email/templates'
import {
  SettingsError,
  inviteStaff,
  parseHoursForm,
  parseRentalRulesForm,
  parseTemplateForm,
  parseZonesForm,
  resetStaffPassword,
  resetStaffTwoFactor,
  resetTemplate,
  saveBusinessHours,
  saveDeliveryZones,
  saveRentalRules,
  saveTemplate,
  sendTestTemplate,
  setStaffActive,
  setStaffRole,
  setTwoFactorRequired,
} from '@/lib/settings'

function pathWith(base: string, params: { done?: string; error?: string; temp?: string }): string {
  const search = new URLSearchParams()
  if (params.done) search.set('done', params.done)
  if (params.error) search.set('error', params.error)
  if (params.temp) search.set('temp', params.temp)
  const query = search.toString()
  return query ? `${base}?${query}` : base
}

function revalidateSettings(): void {
  for (const path of [
    '/studio/settings',
    '/studio/settings/staff',
    '/studio/settings/rental-rules',
    '/studio/settings/templates',
    '/studio/settings/hours',
  ]) {
    revalidatePath(path)
  }
  revalidatePath('/studio')
  revalidatePath('/studio/inquiries')
  // The same values surface on the storefront.
  revalidatePath('/')
  revalidatePath('/shop')
  revalidatePath('/contact')
  revalidatePath('/checkout')
}

/** Runs an operation, bouncing back to `target` with a plain-language message. */
async function attempt<T>(target: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof SettingsError) {
      redirect(pathWith(target, { error: error.message }))
    }
    console.error('Settings action failed:', error)
    redirect(pathWith(target, { error: 'Something went wrong — the change was not saved.' }))
  }
}

// ── rental rules ──────────────────────────────────────────────────────────

export async function saveRentalRulesAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('settings.policies')
  await attempt('/studio/settings/rental-rules', () => saveRentalRules(staff, parseRentalRulesForm(formData)))
  revalidateSettings()
  redirect(pathWith('/studio/settings/rental-rules', { done: 'rules' }))
}

// ── hours & delivery ──────────────────────────────────────────────────────

export async function saveHoursAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('settings.policies')
  await attempt('/studio/settings/hours', () => saveBusinessHours(staff, parseHoursForm(formData)))
  revalidateSettings()
  redirect(pathWith('/studio/settings/hours', { done: 'hours' }))
}

export async function saveZonesAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('settings.policies')
  await attempt('/studio/settings/hours', () => saveDeliveryZones(staff, parseZonesForm(formData)))
  revalidateSettings()
  redirect(pathWith('/studio/settings/hours', { done: 'zones' }))
}

// ── email templates ───────────────────────────────────────────────────────

function templateTarget(rawKind: string): string {
  return isEditableEmailKind(rawKind) ? `/studio/settings/templates/${rawKind}` : '/studio/settings/templates'
}

export async function saveTemplateAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('settings.templates')
  const kind = String(formData.get('kind') ?? '')
  const target = templateTarget(kind)
  await attempt(target, () => saveTemplate(staff, parseTemplateForm(formData)))
  revalidateSettings()
  redirect(pathWith(target, { done: 'template' }))
}

export async function resetTemplateAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('settings.templates')
  const kind = String(formData.get('kind') ?? '')
  const target = templateTarget(kind)
  await attempt(target, async () => {
    if (!isEditableEmailKind(kind)) throw new SettingsError('That template is not part of the editable set.')
    await resetTemplate(staff, kind)
  })
  revalidateSettings()
  redirect(pathWith(target, { done: 'template_reset' }))
}

export async function sendTemplateTestAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('settings.templates')
  const kind = String(formData.get('kind') ?? '')
  const target = templateTarget(kind)
  await attempt(target, async () => {
    if (!isEditableEmailKind(kind)) throw new SettingsError('That template is not part of the editable set.')
    await sendTestTemplate(staff, kind)
  })
  redirect(pathWith(target, { done: 'test_sent' }))
}

// ── staff accounts ────────────────────────────────────────────────────────

export async function inviteStaffAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('settings.staff')
  const result = await attempt('/studio/settings/staff', () =>
    inviteStaff(staff, {
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      role: String(formData.get('role') ?? ''),
      title: String(formData.get('title') ?? ''),
      phone: String(formData.get('phone') ?? ''),
    }),
  )
  revalidateSettings()
  redirect(pathWith('/studio/settings/staff', { done: 'invited', temp: result.tempPassword }))
}

export async function setStaffActiveAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('settings.staff')
  const staffId = String(formData.get('staffId') ?? '')
  const active = String(formData.get('active') ?? '') === 'true'
  await attempt('/studio/settings/staff', () => setStaffActive(staff, staffId, active))
  revalidateSettings()
  redirect(pathWith('/studio/settings/staff', { done: 'active' }))
}

export async function changeStaffRoleAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('settings.staff')
  const staffId = String(formData.get('staffId') ?? '')
  const role = String(formData.get('role') ?? '')
  await attempt('/studio/settings/staff', () => setStaffRole(staff, staffId, role))
  revalidateSettings()
  redirect(pathWith('/studio/settings/staff', { done: 'role' }))
}

export async function resetStaffPasswordAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('settings.staff')
  const staffId = String(formData.get('staffId') ?? '')
  const result = await attempt('/studio/settings/staff', () => resetStaffPassword(staff, staffId))
  revalidateSettings()
  redirect(pathWith('/studio/settings/staff', { done: 'password_reset', temp: result.tempPassword }))
}

export async function setTwoFactorRequiredAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('settings.staff')
  const staffId = String(formData.get('staffId') ?? '')
  const required = String(formData.get('required') ?? '') === 'true'
  await attempt('/studio/settings/staff', () => setTwoFactorRequired(staff, staffId, required))
  revalidateSettings()
  redirect(pathWith('/studio/settings/staff', { done: 'two_factor_required' }))
}

export async function resetTwoFactorAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('settings.staff')
  const staffId = String(formData.get('staffId') ?? '')
  await attempt('/studio/settings/staff', () => resetStaffTwoFactor(staff, staffId))
  revalidateSettings()
  redirect(pathWith('/studio/settings/staff', { done: 'two_factor_reset' }))
}
