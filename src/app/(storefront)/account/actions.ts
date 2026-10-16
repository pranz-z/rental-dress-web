'use server'

/**
 * Customer account actions — sign-in (password and magic link), measurements,
 * event lists and sign-out. Public inputs are validated, rate-limited and
 * audit-logged; sessions ride in their own httpOnly cookie.
 */
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { callerAddress, rateLimit, waitMessage } from '@/lib/rate-limit'
import { AccountError, addToEventList, createEventList, removeFromEventList, saveMeasurements } from '@/lib/storefront/account'
import { MAGIC_LINK_MINUTES, createMagicLinkToken, currentCustomer, endCustomerSession, startCustomerSession } from '@/lib/storefront/session'
import { sendMagicLinkEmail } from '@/lib/notifications'
import type { FormState } from '../form-state'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function safeNext(next: unknown): string {
  const value = String(next ?? '')
  return value.startsWith('/') && !value.startsWith('//') ? value : '/account'
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const address = await callerAddress()
  const limit = rateLimit(`customer-signin:${address}`, 10, 15 * 60_000)
  if (!limit.ok) return { status: 'error', message: waitMessage(limit.retryAfterSeconds) }

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  const customer = await prisma.customer.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, passwordHash: true },
  })

  const valid = customer?.passwordHash ? await bcrypt.compare(password, customer.passwordHash) : false
  if (!customer || !valid) {
    return { status: 'error', message: 'That email and password do not match. You can also send yourself a sign-in link.' }
  }

  await startCustomerSession(customer.id)
  redirect(safeNext(formData.get('next')))
}

export async function requestMagicLinkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const address = await callerAddress()
  const limit = rateLimit(`magic:${address}`, 8, 30 * 60_000)
  if (!limit.ok) return { status: 'error', message: waitMessage(limit.retryAfterSeconds) }
  if (String(formData.get('website') ?? '').trim()) return { status: 'ok', message: 'If that email is in our book, a link is on its way.' }

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'error', message: 'That email address does not look right — check it and try again.' }
  }

  const customer = await prisma.customer.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, name: true },
  })

  // Same answer whether or not the email is in the book — no account probing.
  if (customer) {
    const token = await createMagicLinkToken(customer.id)
    const url = `${APP_URL}/account/magic?token=${encodeURIComponent(token)}&next=${encodeURIComponent(safeNext(formData.get('next')))}`
    await sendMagicLinkEmail(email, customer.name, url)
  }

  return {
    status: 'ok',
    message: `If ${email} is in our book, a sign-in link is on its way. It is good for ${MAGIC_LINK_MINUTES} minutes.`,
  }
}

export async function signOutAction(): Promise<void> {
  await endCustomerSession()
  redirect('/')
}

export async function saveMeasurementsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const customer = await currentCustomer()
  if (!customer) return { status: 'error', message: 'Sign in again to save your measurements.' }

  const number = (key: string) => {
    const raw = String(formData.get(key) ?? '').trim()
    if (!raw) return null
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  try {
    await saveMeasurements(customer.id, {
      heightCm: number('heightCm'),
      bustCm: number('bustCm'),
      waistCm: number('waistCm'),
      hipsCm: number('hipsCm'),
      dressSizeLabel: String(formData.get('dressSizeLabel') ?? ''),
      backupSize: String(formData.get('backupSize') ?? ''),
      shoeSize: String(formData.get('shoeSize') ?? ''),
      notes: String(formData.get('notes') ?? ''),
    })
    return { status: 'ok', message: 'Measurements saved — the studio uses them when advising on fit.' }
  } catch (error) {
    if (error instanceof AccountError) return { status: 'error', message: error.message }
    console.error('Measurement save failed:', error)
    return { status: 'error', message: 'That did not save — try again in a moment.' }
  }
}

export async function createEventListAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const customer = await currentCustomer()
  if (!customer) return { status: 'error', message: 'Sign in again to start an event list.' }

  try {
    const name = String(formData.get('name') ?? '')
    await createEventList(customer.id, {
      name,
      eventDate: String(formData.get('eventDate') ?? '') || null,
      occasion: String(formData.get('occasion') ?? '') || null,
      notes: String(formData.get('notes') ?? '') || null,
    })
    return { status: 'ok', message: `“${name.trim()}” is ready — add dresses from any dress page.` }
  } catch (error) {
    if (error instanceof AccountError) return { status: 'error', message: error.message }
    console.error('Event list create failed:', error)
    return { status: 'error', message: 'That did not save — try again in a moment.' }
  }
}

export async function addToEventListAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const customer = await currentCustomer()
  if (!customer) return { status: 'error', message: 'Sign in to save dresses to a list.' }

  const listId = String(formData.get('listId') ?? '')
  const dressId = String(formData.get('dressId') ?? '')
  const size = String(formData.get('size') ?? '')
  if (!listId) return { status: 'error', message: 'Choose a list first.' }

  try {
    await addToEventList(customer.id, { listId, dressId, size })
    return { status: 'ok', message: 'Saved to your list — it is waiting in your account.' }
  } catch (error) {
    if (error instanceof AccountError) return { status: 'error', message: error.message }
    console.error('Event list add failed:', error)
    return { status: 'error', message: 'That did not save — try again in a moment.' }
  }
}

export async function removeEventListItemAction(formData: FormData): Promise<void> {
  const customer = await currentCustomer()
  if (!customer) return
  const itemId = String(formData.get('itemId') ?? '')
  try {
    await removeFromEventList(customer.id, itemId)
  } catch (error) {
    console.error('Event list remove failed:', error)
  }
}
