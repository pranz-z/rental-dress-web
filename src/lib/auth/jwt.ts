/**
 * Session tokens.
 *
 * A session is a signed JWT (HS256) inside an httpOnly cookie. It expires
 * after 30 minutes of inactivity: the studio shell's keep-alive pings
 * `/api/auth/touch`, which re-issues the cookie while the tab is open, so the
 * clock only runs out when nobody is actually working.
 *
 * This module is runtime-agnostic (no Prisma, no next/headers) so it can be
 * imported from anywhere on the server.
 */
import { SignJWT, jwtVerify } from 'jose'

export const SESSION_MINUTES = 30
export const PENDING_2FA_MINUTES = 10

const ALG = 'HS256'

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is missing or too short — set it in .env (at least 16 characters).')
  }
  return new TextEncoder().encode(secret)
}

export type SessionClaims = {
  staffId: string
  /** true while the visitor has cleared their password but not yet their 2FA code */
  pendingTwoFactor: boolean
  issuedAt: number
  expiresAt: number
}

export async function signSessionToken(
  staffId: string,
  options: { minutes?: number; pendingTwoFactor?: boolean } = {},
): Promise<string> {
  const minutes = options.minutes ?? SESSION_MINUTES
  return new SignJWT({ staffId, twoFactorStage: options.pendingTwoFactor ?? false })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${minutes}m`)
    .sign(secretKey())
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALG] })
    if (typeof payload.staffId !== 'string' || payload.staffId.length === 0) return null
    if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') return null
    return {
      staffId: payload.staffId,
      pendingTwoFactor: payload.twoFactorStage === true,
      issuedAt: payload.iat * 1000,
      expiresAt: payload.exp * 1000,
    }
  } catch {
    return null
  }
}
