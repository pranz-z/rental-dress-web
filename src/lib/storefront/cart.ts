/**
 * The storefront cart.
 *
 * The cart is a small JSON cookie that carries *references only* — dress, size,
 * rental length, event date. It never carries a price: every figure shown or
 * charged is derived from the database at render or checkout time, so a
 * tampered cookie can change its mind about a dress but never about money.
 */
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { isoDay, toDay, todayUtc } from '@/lib/dates'
import type { Occupancy } from '@/lib/availability'
import { depositFor, rentalPriceFor } from '@/lib/pricing'
import { loadStorefrontOccupancies, storefrontWindow, availabilityFor } from './availability'

export const CART_COOKIE = 'mr_cart'
const CART_VERSION = 1
const MAX_ITEMS = 6
const MAX_AGE_DAYS = 30

export type CartItem = {
  dressId: string
  size: string
  backupSize: string | null
  rentalDays: 4 | 8
  /** ISO calendar day of the event itself. */
  eventDate: string
}

type CartPayload = { v: number; items: CartItem[] }

export const EMPTY_CART: CartItem[] = []

export function cartItemKey(item: Pick<CartItem, 'dressId' | 'size' | 'rentalDays'>): string {
  return `${item.dressId}:${item.size}:${item.rentalDays}`
}

function parseCart(raw: string | undefined): CartItem[] {
  if (!raw) return []
  try {
    const payload = JSON.parse(raw) as CartPayload
    if (payload.v !== CART_VERSION || !Array.isArray(payload.items)) return []
    return payload.items.filter(
      (item): item is CartItem =>
        typeof item.dressId === 'string' &&
        typeof item.size === 'string' &&
        typeof item.rentalDays === 'number' &&
        (item.rentalDays === 4 || item.rentalDays === 8) &&
        typeof item.eventDate === 'string',
    )
  } catch {
    return []
  }
}

export async function readCart(): Promise<CartItem[]> {
  const jar = await cookies()
  return parseCart(jar.get(CART_COOKIE)?.value)
}

export async function writeCart(items: CartItem[]): Promise<void> {
  const jar = await cookies()
  const payload: CartPayload = { v: CART_VERSION, items: items.slice(0, MAX_ITEMS) }
  jar.set(CART_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_DAYS * 24 * 60 * 60,
  })
}

export async function clearCart(): Promise<void> {
  const jar = await cookies()
  jar.delete(CART_COOKIE)
}

export async function addToCart(item: CartItem): Promise<{ replaced: boolean }> {
  const items = await readCart()
  const key = cartItemKey(item)
  const existing = items.findIndex((entry) => cartItemKey(entry) === key)
  const replaced = existing !== -1
  if (replaced) items[existing] = item
  else items.push(item)
  await writeCart(items)
  return { replaced }
}

export async function removeFromCart(index: number): Promise<void> {
  const items = await readCart()
  if (index < 0 || index >= items.length) return
  items.splice(index, 1)
  await writeCart(items)
}

// ── priced lines ──────────────────────────────────────────────────────────

export type CartLine = {
  index: number
  item: CartItem
  dress: {
    id: string
    slug: string
    name: string
    designer: string
    color: string
    colorHex: string
    artTone: string
    rentalPrice: number
    retailValue: number
    deposit: number
  }
  deliveryDate: string
  returnDate: string
  /** What the studio would say at checkout time. */
  available: boolean
  issue?: string
}

/**
 * Re-hydrates the cookie into real lines: current price, current availability,
 * current dress status. A retired dress or a lost size shows as unavailable
 * with the reason, and checkout refuses to proceed until it is fixed.
 */
export async function hydrateCart(items: CartItem[]): Promise<{ lines: CartLine[]; subtotal: number; depositTotal: number }> {
  if (items.length === 0) return { lines: [], subtotal: 0, depositTotal: 0 }

  const dresses = await prisma.dress.findMany({
    where: { id: { in: [...new Set(items.map((item) => item.dressId))] } },
    include: { sizes: { orderBy: { position: 'asc' } } },
  })
  const dressById = new Map(dresses.map((dress) => [dress.id, dress]))

  const settings = await prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } })
  const occupanciesByDress = await loadStorefrontOccupancies(prisma, [...dressById.keys()], settings.prepDays, settings.bufferDays)

  const lines: CartLine[] = items.map((item, index) => {
    const dress = dressById.get(item.dressId)
    if (!dress) {
      return {
        index,
        item,
        dress: { id: item.dressId, slug: '', name: 'A dress no longer carried', designer: '', color: '', colorHex: '#d8a7a7', artTone: 'blush', rentalPrice: 0, retailValue: 0, deposit: 0 },
        deliveryDate: item.eventDate,
        returnDate: item.eventDate,
        available: false,
        issue: 'This piece has left the wardrobe — remove it to continue.',
      }
    }

    const { deliveryDate, returnDate } = storefrontWindow(toDay(item.eventDate), item.rentalDays)
    const rentalPrice = rentalPriceFor(dress.retailValue, item.rentalDays, settings)
    const line: CartLine = {
      index,
      item,
      dress: {
        id: dress.id,
        slug: dress.slug,
        name: dress.name,
        designer: dress.designer,
        color: dress.color,
        colorHex: dress.colorHex,
        artTone: dress.artTone,
        rentalPrice,
        retailValue: dress.retailValue,
        deposit: depositFor(dress.retailValue, settings),
      },
      deliveryDate: isoDay(deliveryDate),
      returnDate: isoDay(returnDate),
      available: true,
    }

    if (dress.status === 'RETIRED') {
      line.available = false
      line.issue = 'This piece has been retired from the collection.'
    } else if (!dress.sizes.some((size) => size.size === item.size)) {
      line.available = false
      line.issue = `Size ${item.size} is no longer carried in this dress.`
    } else if (toDay(item.eventDate).getTime() < todayUtc().getTime()) {
      line.available = false
      line.issue = 'That event date is in the past — choose a new one.'
    } else {
      const occupancies = occupanciesByDress.get(dress.id) ?? []
      const result = availabilityFor(occupancies, deliveryDate, returnDate, item.size, settings.prepDays, settings.bufferDays)
      if (!result.available) {
        line.available = false
        line.issue = `Reserved for ${result.conflictLabel} in that window. Choose another date or size.`
      }
      if (item.backupSize && line.available) {
        const backupResult = availabilityFor(occupancies, deliveryDate, returnDate, item.backupSize, settings.prepDays, settings.bufferDays)
        if (!backupResult.available) {
          line.available = false
          line.issue = `Backup size ${item.backupSize} is taken for those dates — choose another backup or drop it.`
        }
      }
    }
    return line
  })

  const subtotal = lines.reduce((sum, line) => (line.available ? sum + line.dress.rentalPrice : sum), 0)
  const depositTotal = lines.reduce((sum, line) => (line.available ? sum + line.dress.deposit : sum), 0)
  return { lines, subtotal, depositTotal }
}
