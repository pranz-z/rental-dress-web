/**
 * Customer sessions for the storefront.
 *
 * A separate cookie from the studio's, so a customer browser can never reach
 * studio surfaces and staff can stay signed in side by side. Sessions are
 * signed JWTs (HS256) with the customer id inside, verified against the
 * database on every read. Magic-link tokens are the same signature with a
 * short life and a distinct purpose claim.
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SignJWT, jwtVerify } from 'jose'
import type { Customer } from '@prisma/client'
import { prisma } from '../db'

export const CUSTOMER_COOKIE = 'mr_customer'
export const SESSION_DAYS = 30
export const MAGIC_LINK_MINUTES = 20

const PURPOSES = ['session', 'magic'] as const
type Purpose = (typeof PURPOSES)[number]

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is missing or too short — set it in .env (at least 16 characters).')
  }
  return new TextEncoder().encode(secret)
}

async function signCustomerToken(customerId: string, purpose: Purpose, minutes: number): Promise<string> {
  return new SignJWT({ customerId, purpose })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${minutes}m`)
    .sign(secretKey())
}

async function verifyCustomerToken(token: string, purpose: Purpose): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
    if (payload.purpose !== purpose) return null
    return typeof payload.customerId === 'string' && payload.customerId.length > 0 ? payload.customerId : null
  } catch {
    return null
  }
}

const cookieDefaults = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

export async function startCustomerSession(customerId: string): Promise<void> {
  const token = await signCustomerToken(customerId, 'session', SESSION_DAYS * 24 * 60)
  const jar = await cookies()
  jar.set(CUSTOMER_COOKIE, token, { ...cookieDefaults, maxAge: SESSION_DAYS * 24 * 60 * 60 })
  await prisma.customer.update({ where: { id: customerId }, data: { lastActiveAt: new Date() } }).catch(() => {})
}

export async function endCustomerSession(): Promise<void> {
  const jar = await cookies()
  jar.delete(CUSTOMER_COOKIE)
}

export function createMagicLinkToken(customerId: string): Promise<string> {
  return signCustomerToken(customerId, 'magic', MAGIC_LINK_MINUTES)
}

export async function readMagicLinkToken(token: string): Promise<string | null> {
  return verifyCustomerToken(token, 'magic')
}

/** The signed-in customer, or null. */
export async function currentCustomer(): Promise<Customer | null> {
  const jar = await cookies()
  const token = jar.get(CUSTOMER_COOKIE)?.value
  if (!token) return null
  const customerId = await verifyCustomerToken(token, 'session')
  if (!customerId) return null
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return null

  const oneHourAgo = Date.now() - 60 * 60_000
  if (!customer.lastActiveAt || customer.lastActiveAt.getTime() < oneHourAgo) {
    await prisma.customer.update({ where: { id: customer.id }, data: { lastActiveAt: new Date() } }).catch(() => {})
  }
  return customer
}

export async function requireCustomer(returnTo: string): Promise<Customer> {
  const customer = await currentCustomer()
  if (!customer) redirect(`/account/sign-in?next=${encodeURIComponent(returnTo)}`)
  return customer
}
