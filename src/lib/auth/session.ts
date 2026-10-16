/**
 * Studio session plumbing: cookie I/O plus the Prisma-backed identity.
 */
import { cookies } from 'next/headers'
import type { StaffUser } from '@prisma/client'
import { prisma } from '../db'
import { PENDING_2FA_MINUTES, SESSION_MINUTES, signSessionToken, verifySessionToken } from './jwt'

export const STAFF_COOKIE = 'mr_studio_session'
export const PENDING_2FA_COOKIE = 'mr_studio_2fa'

const cookieDefaults = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

export async function startSession(staffId: string): Promise<void> {
  const token = await signSessionToken(staffId)
  const jar = await cookies()
  jar.set(STAFF_COOKIE, token, { ...cookieDefaults, maxAge: SESSION_MINUTES * 60 })
}

export async function endSession(): Promise<void> {
  const jar = await cookies()
  jar.delete(STAFF_COOKIE)
  jar.delete(PENDING_2FA_COOKIE)
}

export async function startPendingTwoFactor(staffId: string): Promise<void> {
  const token = await signSessionToken(staffId, { minutes: PENDING_2FA_MINUTES, pendingTwoFactor: true })
  const jar = await cookies()
  jar.set(PENDING_2FA_COOKIE, token, { ...cookieDefaults, maxAge: PENDING_2FA_MINUTES * 60 })
}

export async function readPendingTwoFactor(): Promise<{ staffId: string } | null> {
  const jar = await cookies()
  const token = jar.get(PENDING_2FA_COOKIE)?.value
  if (!token) return null
  const claims = await verifySessionToken(token)
  if (!claims || !claims.pendingTwoFactor) return null
  return { staffId: claims.staffId }
}

export async function clearPendingTwoFactor(): Promise<void> {
  const jar = await cookies()
  jar.delete(PENDING_2FA_COOKIE)
}

/** How recently we write lastActiveAt — keeps navigation cheap. */
const ACTIVE_TOUCH_MS = 2 * 60_000

/**
 * The signed-in staff member, verified against the database (so deactivating
 * an account ends its sessions). Returns null when there is no valid session.
 */
export async function currentStaff(): Promise<StaffUser | null> {
  const jar = await cookies()
  const token = jar.get(STAFF_COOKIE)?.value
  if (!token) return null
  const claims = await verifySessionToken(token)
  if (!claims || claims.pendingTwoFactor) return null

  const staff = await prisma.staffUser.findFirst({ where: { id: claims.staffId, active: true } })
  if (!staff) return null

  if (!staff.lastActiveAt || Date.now() - staff.lastActiveAt.getTime() > ACTIVE_TOUCH_MS) {
    await prisma.staffUser.update({ where: { id: staff.id }, data: { lastActiveAt: new Date() } }).catch(() => {})
  }
  return staff
}
