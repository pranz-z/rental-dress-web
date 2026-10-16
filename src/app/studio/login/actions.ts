'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  clearPendingStage,
  endSession,
  readPendingStage,
  startPendingStage,
  startSession,
} from '@/lib/auth/session'
import { newTwoFactorSecret, twoFactorQrDataUrl, verifyTwoFactor } from '@/lib/auth/two-factor'
import { landingPathFor } from '@/lib/auth/guards'
import { recordAudit, staffActor } from '@/lib/audit'
import { callerAddress, rateLimit, waitMessage } from '@/lib/rate-limit'
import type { StaffUser } from '@prisma/client'
import type { SignInState } from './state'

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

/** The last leg of a sign-in: full session, then the landing screen. */
async function finishSignIn(staff: StaffUser): Promise<SignInState> {
  await clearPendingStage()
  await startSession(staff.id)
  await prisma.staffUser.update({ where: { id: staff.id }, data: { lastActiveAt: new Date() } }).catch(() => {})
  redirect(landingPathFor(staff))
}

/**
 * Starts (or resumes) first-time enrollment: the secret exists before the
 * screen does, so a scan that gets abandoned can be picked up next sign-in.
 */
async function beginEnrollment(staff: StaffUser): Promise<SignInState> {
  let secret = staff.twoFactorSecret
  if (!secret) {
    secret = newTwoFactorSecret()
    await prisma.staffUser.update({ where: { id: staff.id }, data: { twoFactorSecret: secret } })
  }
  await startPendingStage(staff.id, 'enroll')
  return {
    step: 'enroll',
    email: staff.email,
    qrDataUrl: await twoFactorQrDataUrl(staff.email, secret),
    totpKey: secret,
  }
}

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  const email = String(formData.get('email') ?? '')

  // Guessing a studio password should be slow: ten attempts per address per
  // quarter hour, counted before anything touches the database.
  const limit = rateLimit(`staff-signin:${await callerAddress()}`, 10, 15 * 60_000)
  if (!limit.ok) {
    return { step: 'credentials', email, error: waitMessage(limit.retryAfterSeconds) }
  }

  if (!parsed.success) {
    return { step: 'credentials', email, error: 'Enter the studio email and password for your account.' }
  }

  const staff = await prisma.staffUser.findUnique({ where: { email: parsed.data.email } })
  const passwordMatches = staff ? await bcrypt.compare(parsed.data.password, staff.passwordHash) : false

  if (!staff || !staff.active || !passwordMatches) {
    return { step: 'credentials', email, error: 'That email and password don’t match an active studio account.' }
  }

  // First sign-in on an invited or production account: set a password first.
  if (staff.mustChangePassword) {
    await startPendingStage(staff.id, 'password')
    return { step: 'password', email: staff.email }
  }

  // The Owner requires a second factor and this account has none yet.
  if (staff.twoFactorRequired && !staff.twoFactorEnabled) {
    return beginEnrollment(staff)
  }

  if (staff.twoFactorEnabled && staff.twoFactorSecret) {
    await startPendingStage(staff.id, 'two-factor')
    return { step: 'code', email: staff.email }
  }

  return finishSignIn(staff)
}

export async function setPasswordAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const pending = await readPendingStage()
  if (!pending || pending.stage !== 'password') {
    return { step: 'credentials', error: 'That setup window closed. Sign in again.' }
  }

  const staff = await prisma.staffUser.findUnique({ where: { id: pending.staffId } })
  if (!staff || !staff.active || !staff.mustChangePassword) {
    return { step: 'credentials', error: 'That setup window closed. Sign in again.' }
  }

  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return {
      step: 'password',
      email: staff.email,
      error: 'Choose a password of at least 10 characters, with a letter and a number.',
    }
  }
  if (password !== confirm) {
    return { step: 'password', email: staff.email, error: 'The two passwords don’t match yet.' }
  }
  if (await bcrypt.compare(password, staff.passwordHash)) {
    return { step: 'password', email: staff.email, error: 'Choose something different from the temporary password.' }
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.$transaction(async (tx) => {
    await tx.staffUser.update({ where: { id: staff.id }, data: { passwordHash, mustChangePassword: false } })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'staff.password_set',
      entity: 'StaffUser',
      entityId: staff.id,
      summary: `${staff.name} set their own password on first sign-in`,
    })
  })

  const updated = { ...staff, mustChangePassword: false, passwordHash }
  if (updated.twoFactorRequired && !updated.twoFactorEnabled) return beginEnrollment(updated)
  if (updated.twoFactorEnabled && updated.twoFactorSecret) {
    await startPendingStage(updated.id, 'two-factor')
    return { step: 'code', email: updated.email }
  }
  return finishSignIn(updated)
}

export async function verifyEnrollmentAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const limit = rateLimit(`staff-2fa:${await callerAddress()}`, 10, 15 * 60_000)
  if (!limit.ok) {
    return { step: 'credentials', error: waitMessage(limit.retryAfterSeconds) }
  }

  const pending = await readPendingStage()
  if (!pending || pending.stage !== 'enroll') {
    return { step: 'credentials', error: 'That setup window closed. Sign in again.' }
  }

  const staff = await prisma.staffUser.findUnique({ where: { id: pending.staffId } })
  if (!staff || !staff.active || !staff.twoFactorSecret) {
    return { step: 'credentials', error: 'That setup window closed. Sign in again.' }
  }

  const code = String(formData.get('code') ?? '')
  if (!verifyTwoFactor(code, staff.twoFactorSecret)) {
    return {
      step: 'enroll',
      email: staff.email,
      qrDataUrl: await twoFactorQrDataUrl(staff.email, staff.twoFactorSecret),
      totpKey: staff.twoFactorSecret,
      error: 'That code didn’t match. Enter the current code — the app rotates it every 30 seconds.',
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.staffUser.update({ where: { id: staff.id }, data: { twoFactorEnabled: true } })
    await recordAudit(tx, {
      ...staffActor(staff),
      action: 'staff.two_factor_enabled',
      entity: 'StaffUser',
      entityId: staff.id,
      summary: `${staff.name} enrolled an authenticator app`,
    })
  })

  return finishSignIn({ ...staff, twoFactorEnabled: true })
}

export async function verifyTwoFactorAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const limit = rateLimit(`staff-2fa:${await callerAddress()}`, 10, 15 * 60_000)
  if (!limit.ok) {
    return { step: 'credentials', error: waitMessage(limit.retryAfterSeconds) }
  }

  const pending = await readPendingStage()
  if (!pending || pending.stage !== 'two-factor') {
    return { step: 'credentials', error: 'The verification window closed. Sign in again.' }
  }

  const staff = await prisma.staffUser.findUnique({ where: { id: pending.staffId } })
  if (!staff || !staff.active || !staff.twoFactorSecret) {
    return { step: 'credentials', error: 'The verification window closed. Sign in again.' }
  }

  const code = String(formData.get('code') ?? '')
  if (!verifyTwoFactor(code, staff.twoFactorSecret)) {
    return { step: 'code', email: staff.email, error: 'That code didn’t match. Enter the current code from your authenticator app.' }
  }

  return finishSignIn(staff)
}

export async function signOutAction(): Promise<void> {
  await endSession()
  redirect('/studio/login')
}
