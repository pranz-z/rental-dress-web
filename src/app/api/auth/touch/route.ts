import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SESSION_MINUTES, signSessionToken, verifySessionToken } from '@/lib/auth/jwt'
import { STAFF_COOKIE } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

/**
 * Session keep-alive. The studio shell pings this while a tab is open so a
 * working staff member is never signed out; away from the desk, the 30-minute
 * inactivity window runs out and the next request lands on the sign-in page.
 */
export async function POST(): Promise<NextResponse> {
  const jar = await cookies()
  const raw = jar.get(STAFF_COOKIE)?.value
  const claims = raw ? await verifySessionToken(raw) : null
  if (!claims || claims.pendingTwoFactor) {
    return NextResponse.json({ ok: false, reason: 'no-session' }, { status: 401 })
  }

  const staff = await prisma.staffUser.findFirst({
    where: { id: claims.staffId, active: true },
    select: { id: true },
  })
  if (!staff) {
    return NextResponse.json({ ok: false, reason: 'inactive' }, { status: 401 })
  }

  const fresh = await signSessionToken(staff.id)
  const response = NextResponse.json({ ok: true })
  response.cookies.set(STAFF_COOKIE, fresh, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MINUTES * 60,
  })
  return response
}
