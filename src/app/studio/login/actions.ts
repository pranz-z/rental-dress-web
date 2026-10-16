'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  clearPendingTwoFactor,
  endSession,
  readPendingTwoFactor,
  startPendingTwoFactor,
  startSession,
} from '@/lib/auth/session'
import { verifyTwoFactor } from '@/lib/auth/two-factor'
import { landingPathFor } from '@/lib/auth/guards'
import type { SignInState } from './state'

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  const email = String(formData.get('email') ?? '')

  if (!parsed.success) {
    return { step: 'credentials', email, error: 'Enter the studio email and password for your account.' }
  }

  const staff = await prisma.staffUser.findUnique({ where: { email: parsed.data.email } })
  const passwordMatches = staff ? await bcrypt.compare(parsed.data.password, staff.passwordHash) : false

  if (!staff || !staff.active || !passwordMatches) {
    return { step: 'credentials', email, error: 'That email and password don’t match an active studio account.' }
  }

  if (staff.twoFactorEnabled && staff.twoFactorSecret) {
    await startPendingTwoFactor(staff.id)
    return { step: 'code', email: staff.email }
  }

  await startSession(staff.id)
  await prisma.staffUser.update({ where: { id: staff.id }, data: { lastActiveAt: new Date() } }).catch(() => {})
  redirect(landingPathFor(staff))
}

export async function verifyTwoFactorAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const pending = await readPendingTwoFactor()
  if (!pending) {
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

  await clearPendingTwoFactor()
  await startSession(staff.id)
  await prisma.staffUser.update({ where: { id: staff.id }, data: { lastActiveAt: new Date() } }).catch(() => {})
  redirect(landingPathFor(staff))
}

export async function signOutAction(): Promise<void> {
  await endSession()
  redirect('/studio/login')
}
