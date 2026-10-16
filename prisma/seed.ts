/**
 * Maison Rêve — studio seed.
 *
 * Loads the wardrobe, customers, team, bookings, inquiries and payment ledger
 * the studio works from, extended with three months of history so every screen
 * (and the utilization and reply-time figures) reads as a live business.
 *
 * Run: npm run db:seed   ·   rebuild from scratch: npm run db:reseed
 *
 * All records are fictional. Amounts are in cents.
 */
import bcrypt from 'bcryptjs'
import { PrismaClient, type BookingStatus, type PaymentStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { ACCESSORIES, CUSTOMERS, DRESSES, NOTIFICATION_TEMPLATES, REVIEWS, STAFF, STUDIO_SETTINGS } from './seed-content'
import { addDays, addMonths, isoDay, startOfMonth, todayUtc } from '../src/lib/dates'
import { occupancyWindow, rentalsReleased } from '../src/lib/availability'
import { averageFirstReplyMinutes, revenueForRange, revenueThisMonth, utilizationPercent } from '../src/lib/metrics'
import { formatMoney } from '../src/lib/money'
import { depositFor, rentalPriceFor } from '../src/lib/pricing'

try {
  process.loadEnvFile('.env.local')
} catch {
  /* .env.local is optional */
}
try {
  process.loadEnvFile('.env')
} catch {
  /* .env is optional */
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

const TODAY = todayUtc()
const day = (offset: number) => addDays(TODAY, offset)
const timestamp = (offsetDays: number, hour: number, minute = 0) => {
  const base = day(offsetDays)
  base.setUTCHours(hour + 5, minute, 0, 0) // studio morning, expressed in UTC
  return base
}

// ── occupancy bookkeeping (mirrors the rule the app enforces) ─────────────

type Window = { start: Date; end: Date }
const occupancy = new Map<string, Window[]>()
const occupancyKey = (dressId: string, size: string) => `${dressId}::${size}`

function conflicts(dressId: string, size: string, start: Date, end: Date): boolean {
  const existing = occupancy.get(occupancyKey(dressId, size)) ?? []
  return existing.some((w) => start.getTime() <= w.end.getTime() && w.start.getTime() <= end.getTime())
}

function reserve(dressId: string, size: string, start: Date, end: Date) {
  const list = occupancy.get(occupancyKey(dressId, size)) ?? []
  list.push({ start, end })
  occupancy.set(occupancyKey(dressId, size), list)
}

function assertNoOverlaps() {
  for (const [k, windows] of occupancy) {
    const sorted = [...windows].sort((a, b) => a.start.getTime() - b.start.getTime())
    for (let i = 1; i < sorted.length; i += 1) {
      const previous = sorted[i - 1]!
      const next = sorted[i]!
      if (next.start.getTime() <= previous.end.getTime()) {
        throw new Error(
          `Overlapping reservations for ${k}: ${isoDay(previous.start)}–${isoDay(previous.end)} vs ${isoDay(next.start)}–${isoDay(next.end)}`,
        )
      }
    }
  }
}

// ── booking drafts ────────────────────────────────────────────────────────

type Draft = {
  code: string
  customer: string
  dress: string
  size: string
  eventType: string
  eventOffset: number
  rentalDays: 4 | 8
  status: BookingStatus
  backupSize?: string
  addOns?: string[]
  insurance?: boolean
  lateFee?: number
  createdAtOffset: number
  note?: string
  internalNote?: string
  /** History is placed where it happened; future stock is allocated around it. */
  releasedHistory?: boolean
}

/** Reservations already on the studio calendar (spec §9.1). */
const FEATURED_BOOKINGS: Draft[] = [
  {
    code: 'MR-2841',
    customer: 'Camille Dubois',
    dress: 'valentina-silk-gown',
    size: 'S',
    eventType: 'Wedding guest',
    eventOffset: 1,
    rentalDays: 4,
    status: 'SHIPPED',
    createdAtOffset: -21,
    backupSize: 'XS',
    note: 'Cousin’s wedding at the Boston Public Library. Backup size reserved.',
  },
  {
    code: 'MR-2840',
    customer: 'Priya Nair',
    dress: 'aurelia-beaded-gown',
    size: 'M',
    eventType: 'Gala',
    eventOffset: 0,
    rentalDays: 4,
    status: 'WITH_CUSTOMER',
    createdAtOffset: -24,
    addOns: ['Crystal collar necklace'],
    note: 'Museum gala. Crystal collar added in place of her own jewellery.',
  },
  {
    code: 'MR-2839',
    customer: 'Hannah Whitfield',
    dress: 'rosalind-lace-midi',
    size: 'L',
    eventType: 'Engagement party',
    eventOffset: 2,
    rentalDays: 4,
    status: 'CONFIRMED',
    createdAtOffset: -18,
    backupSize: 'M',
  },
  {
    code: 'MR-2838',
    customer: 'Sofia Marquez',
    dress: 'celeste-satin-slip',
    size: 'XS',
    eventType: 'Birthday dinner',
    eventOffset: -1,
    rentalDays: 4,
    status: 'WITH_CUSTOMER',
    createdAtOffset: -15,
    addOns: ['Pearl drop earrings'],
  },
  {
    code: 'MR-2837',
    customer: 'Elena Rossi',
    dress: 'margaux-velvet-gown',
    size: 'M',
    eventType: 'Black tie',
    eventOffset: 4,
    rentalDays: 4,
    status: 'CONFIRMED',
    createdAtOffset: -26,
    insurance: true,
    note: 'Museum gala — the emerald is her standing favourite.',
  },
  {
    code: 'MR-2836',
    customer: 'Naomi Clarke',
    dress: 'juliette-tulle-gown',
    size: 'S',
    eventType: 'Bridal shower',
    eventOffset: 5,
    rentalDays: 4,
    status: 'PENDING',
    createdAtOffset: -2,
    backupSize: 'XS',
    note: 'Awaiting her sister’s confirmation on the shower date.',
  },
  {
    code: 'MR-2835',
    customer: 'Grace Tan',
    dress: 'odette-pleated-midi',
    size: 'M',
    eventType: 'Wedding guest',
    eventOffset: -5,
    rentalDays: 4,
    status: 'LATE',
    createdAtOffset: -19,
    lateFee: 2500,
    internalNote: 'Flight out of Logan cancelled. Late fee waived as a courtesy — third rental this year.',
  },
  {
    code: 'MR-2834',
    customer: 'Amara Okafor',
    dress: 'seraphine-chiffon-maxi',
    size: 'L',
    eventType: 'Wedding guest',
    eventOffset: 8,
    rentalDays: 4,
    status: 'CONFIRMED',
    createdAtOffset: -12,
    backupSize: 'XL',
  },
  {
    code: 'MR-2833',
    customer: 'Lucia Fernandez',
    dress: 'isadora-sequin-mini',
    size: 'S',
    eventType: 'Anniversary',
    eventOffset: -6,
    rentalDays: 4,
    status: 'RETURNED',
    createdAtOffset: -20,
    addOns: ['Silk hair ribbon set'],
  },
  {
    code: 'MR-2832',
    customer: 'Beatrice Moreau',
    dress: 'valentina-silk-gown',
    size: 'M',
    eventType: 'Gala',
    eventOffset: 12,
    rentalDays: 4,
    status: 'PENDING',
    createdAtOffset: -4,
    insurance: true,
    note: 'Charity gala; on-account billing to her office.',
  },
]

const HISTORY_BOOKINGS: Draft[] = (
  [
    ['MR-2831', 'Simone Laurent', 'amelie-organza-gown', 'M', 'Gala', -9, 8, 'RETURNED', -38],
    ['MR-2830', 'Nora Fitzgerald', 'noor-column-gown', 'M', 'Black tie', -8, 4, 'RETURNED', -31],
    ['MR-2829', 'Farah Nasser', 'aurelia-beaded-gown', 'S', 'Gala', -11, 4, 'RETURNED', -40],
    ['MR-2828', 'Adaeze Nwosu', 'thalia-velvet-midi', 'M', 'Nutcracker premiere', -13, 4, 'RETURNED', -34],
    ['MR-2827', 'Willow Bennett', 'celeste-satin-slip', 'S', 'Wedding guest', -14, 4, 'RETURNED', -33],
    ['MR-2826', 'Ingrid Solberg', 'rosalind-lace-midi', 'M', 'Engagement party', -16, 4, 'RETURNED', -42],
    ['MR-2825', 'Mei Lin Chua', 'odette-pleated-midi', 'S', 'Rehearsal dinner', -18, 4, 'RETURNED', -39],
    ['MR-2824', 'Hana Sato', 'lucia-crepe-jumpsuit', 'M', 'Rehearsal dinner', -20, 4, 'RETURNED', -46],
    ['MR-2823', 'Isabella Duarte', 'seraphine-chiffon-maxi', 'M', 'Wedding guest', -22, 4, 'RETURNED', -45],
    ['MR-2822', 'Gabriella Ruiz', 'isadora-sequin-mini', 'XS', 'Anniversary', -24, 4, 'RETURNED', -44],
    ['MR-2821', 'Elena Rossi', 'margaux-velvet-gown', 'S', 'Black tie', -26, 8, 'RETURNED', -52],
    ['MR-2820', 'Charlotte Webb', 'bianca-brocade-midi', 'S', 'Cocktail', -28, 4, 'RETURNED', -50],
    ['MR-2819', 'Priya Nair', 'juliette-tulle-gown', 'M', 'Bridal shower', -31, 4, 'RETURNED', -55],
    ['MR-2818', 'Diana Park', 'valentina-silk-gown', 'XS', 'Wedding guest', -33, 4, 'RETURNED', -58],
    ['MR-2817', 'Zoe Carter', 'celeste-satin-slip', 'XS', 'Birthday dinner', -35, 4, 'RETURNED', -59],
    ['MR-2816', 'Sofia Marquez', 'thalia-velvet-midi', 'XS', 'Anniversary', -38, 4, 'RETURNED', -62],
    ['MR-2815', 'Rachel Adeyemi', 'rosalind-lace-midi', 'M', 'Wedding guest', -41, 4, 'RETURNED', -66],
    ['MR-2814', 'Amara Okafor', 'noor-column-gown', 'L', 'Black tie', -44, 4, 'RETURNED', -70],
    ['MR-2813', 'Farah Nasser', 'amelie-organza-gown', 'S', 'Gala', -47, 4, 'RETURNED', -74],
    ['MR-2812', 'Beatrice Moreau', 'bianca-brocade-midi', 'M', 'Cocktail', -50, 4, 'CANCELLED', -78],
    ['MR-2811', 'Simone Laurent', 'aurelia-beaded-gown', 'L', 'Gala', -53, 4, 'RETURNED', -80],
    ['MR-2810', 'Nora Fitzgerald', 'odette-pleated-midi', 'L', 'Wedding guest', -56, 4, 'RETURNED', -84],
    ['MR-2809', 'Priya Nair', 'noor-column-gown', 'L', 'Black tie', -60, 4, 'RETURNED', -88],
    ['MR-2808', 'Camille Dubois', 'amelie-organza-gown', 'S', 'Gala', -63, 4, 'RETURNED', -91],
    ['MR-2807', 'Elena Rossi', 'seraphine-chiffon-maxi', 'L', 'Wedding guest', -66, 4, 'RETURNED', -94],
    ['MR-2806', 'Farah Nasser', 'margaux-velvet-gown', 'L', 'Black tie', -70, 4, 'RETURNED', -98],
    ['MR-2805', 'Nora Fitzgerald', 'lucia-crepe-jumpsuit', 'M', 'Rehearsal dinner', -73, 4, 'RETURNED', -101],
  ] as const
).map(([code, customer, dress, size, eventType, eventOffset, rentalDays, status, createdAtOffset]) => ({
  code,
  customer,
  dress,
  size,
  eventType,
  eventOffset,
  rentalDays: rentalDays as 4 | 8,
  status: status as BookingStatus,
  createdAtOffset,
  releasedHistory: true,
}))

const UPCOMING_BOOKINGS: Draft[] = (
  [
    ['MR-2842', 'Elena Rossi', 'noor-column-gown', 'S', 'Black tie', 9, 4, 'CONFIRMED', -6, 'S'],
    ['MR-2843', 'Priya Nair', 'seraphine-chiffon-maxi', 'M', 'Wedding guest', 10, 4, 'CONFIRMED', -3, 'S'],
    ['MR-2844', 'Diana Park', 'aurelia-beaded-gown', 'M', 'Gala', 11, 8, 'CONFIRMED', -5, undefined],
    ['MR-2845', 'Farah Nasser', 'thalia-velvet-midi', 'S', 'Nutcracker premiere', 13, 4, 'CONFIRMED', -7, 'XS'],
    ['MR-2846', 'Simone Laurent', 'juliette-tulle-gown', 'M', 'Bridal shower', 15, 4, 'PENDING', -1, undefined],
    ['MR-2847', 'Ingrid Solberg', 'celeste-satin-slip', 'M', 'Birthday dinner', 16, 4, 'CONFIRMED', -2, 'S'],
    ['MR-2848', 'Nora Fitzgerald', 'margaux-velvet-gown', 'L', 'Black tie', 18, 4, 'PENDING', -1, 'M'],
    ['MR-2849', 'Amara Okafor', 'amelie-organza-gown', 'L', 'Gala', 19, 4, 'CONFIRMED', -4, undefined],
    ['MR-2850', 'Camille Dubois', 'seraphine-chiffon-maxi', 'S', 'Wedding guest', 21, 4, 'CONFIRMED', -3, 'M'],
    ['MR-2851', 'Hannah Whitfield', 'lucia-crepe-jumpsuit', 'L', 'Rehearsal dinner', 22, 4, 'PENDING', -1, 'M'],
    ['MR-2852', 'Beatrice Moreau', 'rosalind-lace-midi', 'S', 'Engagement party', 24, 4, 'CONFIRMED', -2, 'XS'],
    ['MR-2853', 'Tessa Lindgren', 'valentina-silk-gown', 'L', 'Wedding guest', 25, 8, 'CONFIRMED', -5, 'M'],
    ['MR-2854', 'Mei Lin Chua', 'odette-pleated-midi', 'L', 'Rehearsal dinner', 27, 4, 'PENDING', -1, 'M'],
    ['MR-2855', 'Willow Bennett', 'noor-column-gown', 'M', 'Black tie', 29, 4, 'CONFIRMED', -3, 'L'],
    ['MR-2856', 'Adaeze Nwosu', 'bianca-brocade-midi', 'M', 'Cocktail', 32, 4, 'CONFIRMED', -2, 'L'],
    ['MR-2857', 'Hana Sato', 'isadora-sequin-mini', 'M', 'Anniversary', 34, 4, 'PENDING', -1, undefined],
    ['MR-2858', 'Rachel Adeyemi', 'thalia-velvet-midi', 'L', 'Wedding guest', 37, 4, 'CONFIRMED', -2, 'M'],
    ['MR-2859', 'Gabriella Ruiz', 'juliette-tulle-gown', 'XS', 'Bridal shower', 40, 4, 'CONFIRMED', -1, undefined],
    ['MR-2860', 'Isabella Duarte', 'odette-pleated-midi', 'S', 'Wedding guest', 43, 4, 'CONFIRMED', -1, 'M'],
    ['MR-2861', 'Sofia Marquez', 'noor-column-gown', 'XS', 'Anniversary', 46, 4, 'PENDING', -1, undefined],
  ] as const
).map(([code, customer, dress, size, eventType, eventOffset, rentalDays, status, createdAtOffset, backupSize]) => ({
  code,
  customer,
  dress,
  size,
  eventType,
  eventOffset,
  rentalDays: rentalDays as 4 | 8,
  status: status as BookingStatus,
  createdAtOffset,
  backupSize: backupSize ?? undefined,
}))

const EVENT_TYPES = [
  'Wedding guest',
  'Gala',
  'Black tie',
  'Bridal shower',
  'Cocktail',
  'Rehearsal dinner',
  'Anniversary',
  'Birthday dinner',
]

/**
 * The rest of the booking book: three further reservations per dress spread
 * across the coming month, plus recently completed rentals so the month's
 * ledger and the wardrobe calendar both read full.
 */
const FILL_BOOKINGS: Draft[] = DRESSES.flatMap((dress, dressIndex) => {
  const slots = dressIndex % 2 === 0 ? [0, 1, 2, 3] : [0, 1, 2]
  return slots.map((k) => {
    const size = dress.sizes[(dressIndex + k) % dress.sizes.length]!
    const backup = dress.sizes[(dressIndex + k + 1) % dress.sizes.length]!
    return {
      code: `MR-${2900 + dressIndex * 4 + k}`,
      customer: CUSTOMERS[(dressIndex * 3 + k * 5) % CUSTOMERS.length]!.name,
      dress: dress.slug,
      size,
      eventType: EVENT_TYPES[(dressIndex + k) % EVENT_TYPES.length]!,
      eventOffset: 4 + ((dressIndex * 5 + k * 9) % 27),
      rentalDays: (dressIndex + k) % 3 === 0 ? (8 as const) : (4 as const),
      status: ((dressIndex + k) % 4 === 3 ? 'PENDING' : 'CONFIRMED') as BookingStatus,
      createdAtOffset: -(1 + ((dressIndex * 3 + k * 5) % 15)),
      backupSize: (dressIndex + k) % 5 === 2 ? backup : undefined,
      insurance: (dressIndex + k) % 3 === 0,
      addOns: (dressIndex + k) % 5 === 1 ? ['Backup size'] : undefined,
    }
  })
})

const RECENT_RETURNS: Draft[] = DRESSES.slice(0, 12).map((dress, index) => ({
  code: `MR-${2880 + index}`,
  customer: CUSTOMERS[(index * 7 + 3) % CUSTOMERS.length]!.name,
  dress: dress.slug,
  size: dress.sizes[index % dress.sizes.length]!,
  eventType: EVENT_TYPES[(index * 2) % EVENT_TYPES.length]!,
  eventOffset: -(2 + ((index * 3) % 12)),
  rentalDays: index % 4 === 0 ? 8 : 4,
  status: 'RETURNED' as BookingStatus,
  createdAtOffset: -(8 + ((index * 3) % 12)),
  releasedHistory: true,
  insurance: index % 3 === 0,
}))

/** A bridal party: six gowns held for a May wedding, invoiced to the host. */
const BRIDAL_PARTY: Draft[] = [
  'odette-pleated-midi',
  'rosalind-lace-midi',
  'thalia-velvet-midi',
  'seraphine-chiffon-maxi',
  'bianca-brocade-midi',
  'celeste-satin-slip',
].map((slug, index) => ({
  code: `MR-2960${index}`,
  customer: 'Mei Lin Chua',
  dress: slug,
  size: ['S', 'M', 'M', 'L', 'S', 'XS'][index]!,
  eventType: 'Bridal party',
  eventOffset: 200 + index,
  rentalDays: 4 as const,
  status: 'CONFIRMED' as BookingStatus,
  createdAtOffset: -8,
  backupSize: 'L',
  note: `Bridal party gown ${index + 1} of 6 — May wedding in dusty rose.`,
  internalNote: 'Group rate of 15% applied to the party of six. All gowns to ship together on the Tuesday.',
}))

/** September's intake: reservations taken last month for the events just past. */
const SEPTEMBER_INTAKE: Draft[] = Array.from({ length: 48 }, (_, index) => {
  const dress = DRESSES[index % DRESSES.length]!
  return {
    code: `MR-${2700 + index}`,
    customer: CUSTOMERS[(index * 5 + 1) % CUSTOMERS.length]!.name,
    dress: dress.slug,
    size: dress.sizes[index % dress.sizes.length]!,
    eventType: EVENT_TYPES[(index * 3) % EVENT_TYPES.length]!,
    eventOffset: -(1 + ((index * 7) % 15)),
    rentalDays: index % 3 === 0 ? (8 as const) : (4 as const),
    status: 'RETURNED' as BookingStatus,
    createdAtOffset: -(30 + (index % 16)),
    releasedHistory: true,
    insurance: index % 4 === 0,
    addOns: index % 6 === 2 ? ['Pearl drop earrings'] : undefined,
  }
})

/** Gala season on the corporate account, invoiced to accounts payable. */
const CORPORATE_GALA: Draft[] = Array.from({ length: 12 }, (_, index) => {
  const dress = DRESSES[(index * 3 + 1) % DRESSES.length]!
  return {
    code: `MR-${2980 + index}`,
    customer: 'Rowan Ellis',
    dress: dress.slug,
    size: dress.sizes[(index + 1) % dress.sizes.length]!,
    eventType: 'Corporate gala',
    eventOffset: 55 + index,
    rentalDays: 8 as const,
    status: 'CONFIRMED' as BookingStatus,
    createdAtOffset: index < 6 ? -(34 + index) : -(4 + index),
    insurance: true,
    addOns: index % 3 === 0 ? ['Express courier delivery'] : undefined,
    note: 'Ashford & Vale team gala — gowns to ship together, one return label per gown.',
    internalNote: 'Corporate account: PO number on the invoice, balance settled by accounts payable.',
  }
})

const ADD_ON_PLAN: Record<string, { addOns?: string[]; insurance?: boolean }> = {
  'MR-2843': { addOns: ['Backup size'] },  'MR-2844': { addOns: ['Crystal collar necklace'], insurance: true },
  'MR-2847': { addOns: ['Pearl drop earrings'] },
  'MR-2850': { addOns: ['Return-day pickup'], insurance: true },
  'MR-2853': { addOns: ['Express courier delivery', 'Silk hair ribbon set'] },
  'MR-2855': { addOns: ['Legacy satin clutch'] },
  'MR-2858': { insurance: true },
  'MR-2819': { addOns: ['Backup size'] },
  'MR-2821': { insurance: true, addOns: ['Crystal collar necklace'] },
  'MR-2824': { addOns: ['Seamless shaping slip'] },
  'MR-2829': { addOns: ['Pearl drop earrings'] },
  'MR-2831': { insurance: true },
  'MR-2823': { addOns: ['Backup size'] },
  'MR-2826': { addOns: ['Silk hair ribbon set'] },
  'MR-2828': { insurance: true },
  'MR-2806': { addOns: ['Legacy satin clutch'] },
  'MR-2809': { insurance: true },
}

// ── inquiries ─────────────────────────────────────────────────────────────

type InquirySeed = {
  id: string
  guest: string
  subject: string
  topic: 'SIZING' | 'BOOKING_CHANGE' | 'GROUP_BOOKING' | 'DELIVERY' | 'DAMAGE' | 'GENERAL'
  channel: 'CONTACT_FORM' | 'DRESS_PAGE' | 'EMAIL' | 'PHONE'
  message: string
  status: 'OPEN' | 'RESOLVED'
  receivedHoursAgo: number
  assignedTo?: string
  dress?: string
  repliedBy?: string
  replyMinutes?: number
  reply?: string
  internalNote?: string
  secondReply?: { by: string; minutes: number; body: string }
}

const INQUIRIES: InquirySeed[] = [
  {
    id: 'INQ-1121',
    guest: 'Charlotte Webb',
    subject: 'Backup size for a wedding on Nov 14',
    topic: 'SIZING',
    channel: 'DRESS_PAGE',
    message:
      'Hello — I have the Valentina in size S saved for the wedding on November 14. My usual size is a small but I am between sizes at the bust. Could I reserve the XS as a backup, and how does the refund work if I never open it?',
    status: 'OPEN',
    receivedHoursAgo: 3,
    assignedTo: 'claire@maisonreve.com',
    dress: 'valentina-silk-gown',
  },
  {
    id: 'INQ-1120',
    guest: 'Diana Park',
    subject: 'Extending my rental by two days',
    topic: 'BOOKING_CHANGE',
    channel: 'CONTACT_FORM',
    message:
      'I am collecting the Aurelia for the gala on the 27th and would like to keep it until the Monday instead of the Saturday. Is the 8-day rate available, and what would the difference be?',
    status: 'OPEN',
    receivedHoursAgo: 5,
    assignedTo: 'nadia@maisonreve.com',
  },
  {
    id: 'INQ-1119',
    guest: 'Mariam Hassan',
    subject: 'Bridal party of six',
    topic: 'GROUP_BOOKING',
    channel: 'CONTACT_FORM',
    message:
      'My bridal party is six women and we would love one dusty rose family of dresses for a November 21 wedding in Boston. Two of the six are expecting, so we need forgiving silhouettes in two sizes each. Could a stylist put together options for us?',
    status: 'OPEN',
    receivedHoursAgo: 9,
    assignedTo: 'claire@maisonreve.com',
  },
  {
    id: 'INQ-1118',
    guest: 'Tessa Lindgren',
    subject: 'Delivery to a hotel',
    topic: 'DELIVERY',
    channel: 'EMAIL',
    message:
      'I will be staying at the Langham the night before the wedding. Can the dress be delivered to the hotel front desk, and would someone be able to steam it there?',
    status: 'OPEN',
    receivedHoursAgo: 14,
    assignedTo: 'marcus@maisonreve.com',
  },
  {
    id: 'INQ-1117',
    guest: 'Rachel Adeyemi',
    subject: 'Stain on returned dress',
    topic: 'DAMAGE',
    channel: 'CONTACT_FORM',
    message:
      'I am so sorry — there is a small oil mark on the hem of the Rosalind. I have returned it with the label. Please let me know the cost if it cannot be cleaned; I would rather pay than have the studio absorb it.',
    status: 'RESOLVED',
    receivedHoursAgo: 52,
    repliedBy: 'nadia@maisonreve.com',
    replyMinutes: 55,
    reply:
      'Thank you for telling us straight away, Rachel — it makes a real difference. Our cleaner lifted the mark completely, so there is nothing to pay. Your deposit was released this morning and should show on your card within three days.',
    internalNote: 'Dry cleaner lifted the oil mark without damage. No charge, deposit released.',
    assignedTo: 'nadia@maisonreve.com',
  },
  {
    id: 'INQ-1116',
    guest: 'Zoe Carter',
    subject: 'Do you rent accessories?',
    topic: 'GENERAL',
    channel: 'DRESS_PAGE',
    message:
      'Loved the Celeste for my birthday dinner. Do you also rent bags and earrings? I would happily add them to my next rental.',
    status: 'RESOLVED',
    receivedHoursAgo: 78,
    repliedBy: 'yuki@maisonreve.com',
    replyMinutes: 78,
    reply:
      'We do — satin clutches, pearl drops, a crystal collar and silk ribbons, all available as add-ons when you check out. They arrive in the same box as the dress, so there is nothing extra to think about.',
    assignedTo: 'yuki@maisonreve.com',
  },
  {
    id: 'INQ-1115',
    guest: 'Ingrid Solberg',
    subject: 'Which size for a 34F bust?',
    topic: 'SIZING',
    channel: 'CONTACT_FORM',
    message:
      'I measure 34F at the bust and usually take a medium, but the Aurelia bodice looks structured. Would you recommend the M or the L, and can I book both as a backup?',
    status: 'OPEN',
    receivedHoursAgo: 20,
    assignedTo: 'yuki@maisonreve.com',
    dress: 'aurelia-beaded-gown',
  },
  {
    id: 'INQ-1114',
    guest: 'Nora Fitzgerald',
    subject: 'Change my event date to the 30th',
    topic: 'BOOKING_CHANGE',
    channel: 'EMAIL',
    message:
      'Our black-tie dinner moved from the 24th to the 30th. Could you shift my Margaux rental by six days? Happy to pay the difference if the velvet is not free that week.',
    status: 'OPEN',
    receivedHoursAgo: 26,
    assignedTo: 'nadia@maisonreve.com',
  },
  {
    id: 'INQ-1113',
    guest: 'Mei Lin Chua',
    subject: 'Six bridesmaids, one shade of rose',
    topic: 'GROUP_BOOKING',
    channel: 'CONTACT_FORM',
    message:
      'Planning ahead for a May wedding: six bridesmaids, all in the same dusty rose. Is there a group rate if we book six rentals at once, and can we come in for fittings together?',
    status: 'RESOLVED',
    receivedHoursAgo: 96,
    repliedBy: 'claire@maisonreve.com',
    replyMinutes: 110,
    reply:
      'Six dusty rose rentals is exactly what we love to build for. We hold a group rate of 15% off the rental price for five or more gowns on the same date, and we can book a two-hour group fitting on a Saturday morning. I have penciled you in provisionally for the last weekend in March — tell me if that suits and I will send the full look book.',
    assignedTo: 'claire@maisonreve.com',
  },
  {
    id: 'INQ-1112',
    guest: 'Hana Sato',
    subject: 'Can it arrive before noon on the 22nd?',
    topic: 'DELIVERY',
    channel: 'DRESS_PAGE',
    message:
      'The rehearsal dinner is the evening of the 22nd and I fly in that morning. Is there a delivery option that lands before noon?',
    status: 'OPEN',
    receivedHoursAgo: 32,
    assignedTo: 'marcus@maisonreve.com',
  },
  {
    id: 'INQ-1111',
    guest: 'Simone Laurent',
    subject: 'Sequins at the hem of the Isadora',
    topic: 'DAMAGE',
    channel: 'EMAIL',
    message:
      'Two rows of sequins at the hem of the Isadora mini have loosened. Nothing missing that I can see, but I wanted you to know before it goes back into rotation.',
    status: 'OPEN',
    receivedHoursAgo: 40,
    assignedTo: 'tomas@maisonreve.com',
    dress: 'isadora-sequin-mini',
  },
  {
    id: 'INQ-1110',
    guest: 'Gabriella Ruiz',
    subject: 'Membership — how many rentals a month?',
    topic: 'GENERAL',
    channel: 'CONTACT_FORM',
    message:
      'I saw a mention of membership on the shop page. How many rentals does it include each month, and is there a waiting list?',
    status: 'RESOLVED',
    receivedHoursAgo: 120,
    repliedBy: 'isabelle@maisonreve.com',
    replyMinutes: 52,
    reply:
      'Membership opens on November 1 with three rentals a month, complimentary insurance and early access to new arrivals two days before they go live. I have added you to the list of members invited first — you will get the note before anyone else.',
    assignedTo: 'isabelle@maisonreve.com',
  },
  {
    id: 'INQ-1109',
    guest: 'Farah Nasser',
    subject: 'Steaming before the gala',
    topic: 'GENERAL',
    channel: 'DRESS_PAGE',
    message:
      'The organza arrives Thursday and the gala is Friday evening. Will it need steaming, or does it travel flat enough to wear straight from the box?',
    status: 'OPEN',
    receivedHoursAgo: 44,
    dress: 'amelie-organza-gown',
  },
  {
    id: 'INQ-1108',
    guest: 'Adaeze Nwosu',
    subject: 'Return label for my Brooklyn address',
    topic: 'DELIVERY',
    channel: 'EMAIL',
    message:
      'Could you send the prepaid return label to my Brooklyn address rather than the billing one? I am in New York all month.',
    status: 'RESOLVED',
    receivedHoursAgo: 144,
    repliedBy: 'tomas@maisonreve.com',
    replyMinutes: 96,
    reply:
      'Label reissued to the Atlantic Avenue address this morning — it is in the same email thread as your tracking link. The courier can also collect from your lobby if you leave the parcel with the doorman.',
    assignedTo: 'tomas@maisonreve.com',
  },
  {
    id: 'INQ-1107',
    guest: 'Isabella Duarte',
    subject: 'Backup size for the Valentina',
    topic: 'SIZING',
    channel: 'DRESS_PAGE',
    message:
      'I am between a small and a medium in the Valentina. Is the backup size worth adding if I am only unsure about the waist?',
    status: 'RESOLVED',
    receivedHoursAgo: 168,
    repliedBy: 'yuki@maisonreve.com',
    replyMinutes: 74,
    reply:
      'For the Valentina I would say yes: the bias cut means the small can feel snug at the waist after a long dinner. With the backup size you keep the medium in its seal and we refund it in full if it stays closed.',
    assignedTo: 'yuki@maisonreve.com',
  },
  {
    id: 'INQ-1106',
    guest: 'Willow Bennett',
    subject: 'Cancellation policy for November',
    topic: 'BOOKING_CHANGE',
    channel: 'CONTACT_FORM',
    message:
      'I am holding a dress for a Providence wedding in November but may need to travel for work. What happens if I cancel two weeks out?',
    status: 'OPEN',
    receivedHoursAgo: 60,
    assignedTo: 'nadia@maisonreve.com',
  },
  {
    id: 'INQ-1105',
    guest: 'Grace Tan',
    subject: 'Late return — the fee',
    topic: 'BOOKING_CHANGE',
    channel: 'EMAIL',
    message:
      'My flight was cancelled and the Odette is going back a day late. I completely understand if there is a late fee — I just want to make sure the next renter is not affected.',
    status: 'RESOLVED',
    receivedHoursAgo: 200,
    repliedBy: 'nadia@maisonreve.com',
    replyMinutes: 62,
    reply:
      'Nothing is affected — we hold a cleaning day after every return precisely for weeks like this one. The late fee has been waived on your account. Safe travels home.',
    internalNote: 'Waived the $25 late fee: first late return, eight months of good history.',
    assignedTo: 'nadia@maisonreve.com',
  },
  {
    id: 'INQ-1104',
    guest: 'Mariam Hassan',
    subject: 'Swatches for the dusty rose family',
    topic: 'GROUP_BOOKING',
    channel: 'PHONE',
    message:
      'Called the studio to ask whether the Odette and Rosalind sit in the same rose family before the party commits. Wants to see the fabric in daylight.',
    status: 'RESOLVED',
    receivedHoursAgo: 240,
    repliedBy: 'claire@maisonreve.com',
    replyMinutes: 120,
    reply:
      'They do, and they layer beautifully: the Odette is a half-shade deeper than the Rosalind. I am posting you both swatches today — hold them against daylight, and if you can, bring them to a fitting so we can see them under studio light too.',
    assignedTo: 'claire@maisonreve.com',
    secondReply: {
      by: 'claire@maisonreve.com',
      minutes: 266,
      body:
        'Swatches posted this afternoon with the fabric care card inside. They should reach you by Thursday — do send a photo of the two together if you are deciding with the party over the weekend.',
    },
  },
  {
    id: 'INQ-1103',
    guest: 'Priya Nair',
    subject: 'Second gown for the same weekend',
    topic: 'BOOKING_CHANGE',
    channel: 'CONTACT_FORM',
    message:
      'Two events, one weekend: the gala Friday and a wedding Saturday. Could I take two gowns for overlapping dates, and would you hold both?',
    status: 'RESOLVED',
    receivedHoursAgo: 288,
    repliedBy: 'nadia@maisonreve.com',
    replyMinutes: 96,
    reply:
      'Absolutely — members can hold two gowns across one weekend with a single delivery. I have reserved the Aurelia and the Noor for you, both arriving Thursday morning and collected together on the Monday.',
    assignedTo: 'nadia@maisonreve.com',
  },
  {
    id: 'INQ-1102',
    guest: 'Hannah Whitfield',
    subject: 'Tall frame — will the Rosalind be long enough?',
    topic: 'SIZING',
    channel: 'DRESS_PAGE',
    message:
      'I am 5\'9" and the Rosalind is a midi on the model. How long is it on someone tall, and do you offer a longer version?',
    status: 'RESOLVED',
    receivedHoursAgo: 330,
    repliedBy: 'yuki@maisonreve.com',
    replyMinutes: 86,
    reply:
      'On a 5\'9" frame the hem sits a hand above the ankle, which reads as a true midi. The studio can add a 4cm hem panel in matching lace for tall rentals — mention it in the notes and we will take care of it before dispatch.',
    assignedTo: 'yuki@maisonreve.com',
    secondReply: {
      by: 'claire@maisonreve.com',
      minutes: 520,
      body:
        'Confirmed with the atelier: the hem panel is stitched by hand and takes two days, so we would need the request a week before your delivery date. It is complimentary for members.',
    },
  },
  {
    id: 'INQ-1101',
    guest: 'Lucia Fernandez',
    subject: 'Returning from the airport',
    topic: 'DELIVERY',
    channel: 'CONTACT_FORM',
    message:
      'I land Saturday morning and fly out again Sunday. Is there a courier who can collect the Isadora from the airport hotel?',
    status: 'RESOLVED',
    receivedHoursAgo: 400,
    repliedBy: 'marcus@maisonreve.com',
    replyMinutes: 96,
    reply:
      'Yes — our courier covers all the airport properties. Leave the sealed box at the front desk before 10am and we will have it scanned back into the studio by the afternoon.',
    assignedTo: 'marcus@maisonreve.com',
  },
]

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('  Seeding the Maison Rêve studio…')

  await wipe()

  // team
  const staffByEmail = new Map<string, string>()
  for (const member of STAFF) {
    const row = await prisma.staffUser.create({
      data: {
        name: member.name,
        email: member.email,
        passwordHash: await bcrypt.hash(member.password, 10),
        role: member.role,
        title: member.title,
        phone: member.phone,
        accentTone: member.accentTone,
        twoFactorEnabled: member.twoFactor ?? false,
        lastActiveAt: timestamp(-1, 16, 20),
        createdAt: timestamp(-420, 9),
      },
    })
    staffByEmail.set(member.email, row.id)
  }
  const owner = staffByEmail.get('isabelle@maisonreve.com')!
  const nadia = staffByEmail.get('nadia@maisonreve.com')!
  const claire = staffByEmail.get('claire@maisonreve.com')!
  const yuki = staffByEmail.get('yuki@maisonreve.com')!
  const marcus = staffByEmail.get('marcus@maisonreve.com')!
  const tomas = staffByEmail.get('tomas@maisonreve.com')!

  // policies, templates, add-ons
  await prisma.studioSettings.create({ data: STUDIO_SETTINGS })
  for (const template of NOTIFICATION_TEMPLATES) await prisma.notificationTemplate.create({ data: template })
  const accessoryByName = new Map<string, { id: string; price: number }>()
  for (const accessory of ACCESSORIES) {
    const row = await prisma.accessory.create({ data: accessory })
    accessoryByName.set(accessory.name, { id: row.id, price: row.price })
  }

  // wardrobe
  const dressBySlug = new Map<string, { id: string; name: string; rent4: number; rent8: number; deposit: number }>()
  for (const seed of DRESSES) {
    const dress = await prisma.dress.create({
      data: {
        slug: seed.slug,
        name: seed.name,
        designer: seed.designer,
        category: seed.category,
        occasion: seed.occasion,
        color: seed.color,
        colorHex: seed.colorHex,
        length: seed.length,
        neckline: seed.neckline,
        sleeve: seed.sleeve,
        fabric: seed.fabric,
        retailValue: seed.retailValue,
        status: seed.status,
        timesRented: seed.timesRented,
        careNotes: seed.careNotes,
        fitNotes: `${seed.fitNotes} ${seed.fitTag}.`,
        story: seed.story,
        artTone: seed.artTone,
        featured: seed.featured ?? false,
        isNewArrival: seed.isNewArrival ?? false,
        createdAt: timestamp(seed.isNewArrival ? -22 : -320, 10),
        sizes: { create: seed.sizes.map((size, index) => ({ size, quantity: 1, position: index })) },
        images: {
          create: [
            {
              kind: 'FRONT',
              alt: `${seed.name} photographed from the front on a ${seed.color.toLowerCase()} backdrop`,
              caption: 'Front',
              position: 0,
            },
            {
              kind: 'BACK',
              alt: `The back of the ${seed.name}, showing the ${seed.neckline.toLowerCase()} line`,
              caption: 'Back',
              position: 1,
            },
            {
              kind: 'DETAIL',
              alt: `Close detail of the ${seed.fabric.toLowerCase()} used in the ${seed.name}`,
              caption: `${seed.fabric} detail`,
              position: 2,
            },
            {
              kind: 'ON_BODY',
              alt: `The ${seed.name} worn by a model at a fitting in the Newbury Street studio`,
              caption: 'On body',
              position: 3,
            },
            {
              kind: 'MOVEMENT',
              alt: `The ${seed.name} in movement, the ${seed.length.toLowerCase()} hem turning with the wearer`,
              caption: 'Fabric in movement',
              position: 4,
            },
          ],
        },
      },
    })
    dressBySlug.set(seed.slug, {
      id: dress.id,
      name: dress.name,
      rent4: rentalPriceFor(seed.retailValue, 4, STUDIO_SETTINGS),
      rent8: rentalPriceFor(seed.retailValue, 8, STUDIO_SETTINGS),
      deposit: depositFor(seed.retailValue, STUDIO_SETTINGS),
    })
  }
  const dressId = (slug: string) => dressBySlug.get(slug)!.id

  // care history
  const conditionLogs = [
    {
      slug: 'rosalind-lace-midi',
      severity: 'MAJOR' as const,
      summary: 'Oil mark on the hem, lifted by the cleaner',
      detail: 'Reported by Rachel Adeyemi on return. The cleaner removed the mark without damage to the corded lace.',
      resolved: true,
      daysAgo: 63,
    },
    {
      slug: 'odette-pleated-midi',
      severity: 'MINOR' as const,
      summary: 'Pleats relaxed at the waist seam',
      detail: 'Re-set on the pleating roll and returned to the rack after inspection.',
      resolved: true,
      daysAgo: 21,
    },
    {
      slug: 'aurelia-beaded-gown',
      severity: 'MINOR' as const,
      summary: 'Two beads loose at the left shoulder',
      detail: 'Re-stitched by hand in the studio; beadwork checked across the bodice on the form.',
      resolved: true,
      daysAgo: 12,
    },
    {
      slug: 'isadora-sequin-mini',
      severity: 'NOTE' as const,
      summary: 'Sequins at the hem need re-sewing',
      detail: 'Flagged by Simone Laurent on return. Two rows to be re-sewn before the next dispatch.',
      resolved: false,
      daysAgo: 2,
    },
    {
      slug: 'bianca-brocade-midi',
      severity: 'MINOR' as const,
      summary: 'Snagged thread on the right sleeve seam',
      detail: 'Pulled back through with a needle and the seam reinforced. Held until inspection sign-off.',
      resolved: false,
      daysAgo: 1,
    },
  ]
  for (const log of conditionLogs) {
    await prisma.conditionLog.create({
      data: {
        dressId: dressId(log.slug),
        severity: log.severity,
        summary: log.summary,
        detail: log.detail,
        resolved: log.resolved,
        staffId: tomas,
        loggedAt: timestamp(-log.daysAgo, 11, 30),
      },
    })
  }

  const cleaningRecords = [
    { slug: 'odette-pleated-midi', startedOffset: -1, completed: false, staff: tomas, method: 'Specialist dry clean' },
    { slug: 'bianca-brocade-midi', startedOffset: -1, completed: false, staff: tomas, method: 'Hand finish & inspect' },
    { slug: 'isadora-sequin-mini', startedOffset: -2, completed: true, staff: tomas, method: 'Specialist dry clean' },
    { slug: 'amelie-organza-gown', startedOffset: -6, completed: true, staff: tomas, method: 'Steam & press' },
    { slug: 'noor-column-gown', startedOffset: -7, completed: true, staff: marcus, method: 'Steam & press' },
    { slug: 'thalia-velvet-midi', startedOffset: -13, completed: true, staff: tomas, method: 'Velvet steam' },
    { slug: 'margaux-velvet-gown', startedOffset: -25, completed: true, staff: tomas, method: 'Velvet steam' },
  ]
  for (const record of cleaningRecords) {
    await prisma.cleaningRecord.create({
      data: {
        dressId: dressId(record.slug),
        startedAt: timestamp(record.startedOffset, 10),
        completedAt: record.completed ? timestamp(record.startedOffset + 1, 15) : null,
        method: record.method,
        note: record.completed
          ? 'Cleaned, inspected and returned to the rack by the studio.'
          : 'At the cleaning house — due back before the next collection.',
        staffId: record.staff,
      },
    })
  }

  for (const block of [
    { slug: 'bianca-brocade-midi', size: null, from: 4, to: 7, reason: 'Sleeve seam hold — inspection sign-off' },
    { slug: 'noor-column-gown', size: 'L', from: 2, to: 3, reason: 'Hem taken up 2cm for a fitting' },
    { slug: 'amelie-organza-gown', size: null, from: 26, to: 29, reason: 'Editorial shoot — Boston Weddings feature' },
    { slug: 'lucia-crepe-jumpsuit', size: 'XL', from: 9, to: 11, reason: 'Centre crease re-press' },
  ]) {
    await prisma.dressBlock.create({
      data: {
        dressId: dressId(block.slug),
        size: block.size,
        startDate: day(block.from),
        endDate: day(block.to),
        reason: block.reason,
        staffId: nadia,
      },
    })
  }

  // customers
  const customerByName = new Map<string, string>()
  for (const seed of CUSTOMERS) {
    const row = await prisma.customer.create({
      data: {
        name: seed.name,
        email: seed.email,
        phone: seed.phone,
        tier: seed.tier,
        passwordHash: seed.account ? await bcrypt.hash(seed.account.password, 10) : null,
        lifetimeSpend: seed.lifetimeSpend,
        rentalsCount: seed.rentalsCount,
        addressLine1: seed.addressLine1,
        city: seed.city,
        region: seed.region,
        postalCode: seed.postalCode,
        country: seed.country ?? 'United States',
        memberSince: addDays(TODAY, -Math.round(seed.memberMonthsAgo * 30.4)),
        creditBalance: seed.tier === 'PARIS_CLUB' ? 5000 : 0,
        marketingOptIn: seed.tier !== 'GUEST',
        notes: seed.notes,
        lastActiveAt: timestamp(-1 - (seed.rentalsCount % 6), 14, 15),
        measurements: seed.measurements
          ? {
              create: {
                heightCm: seed.measurements.heightCm,
                bustCm: seed.measurements.bustCm,
                waistCm: seed.measurements.waistCm,
                hipsCm: seed.measurements.hipsCm,
                dressSizeLabel: seed.measurements.dressSizeLabel,
                backupSize: seed.measurements.backupSize,
                shoeSize: seed.measurements.shoeSize,
                notes: seed.measurements.notes,
                updatedAt: timestamp(-30, 11),
              },
            }
          : undefined,
      },
    })
    customerByName.set(seed.name, row.id)
  }
  const customerId = (name: string) => {
    const id = customerByName.get(name)
    if (!id) throw new Error(`Unknown customer in seed: ${name}`)
    return id
  }

  for (const note of [
    {
      customer: 'Camille Dubois',
      staff: nadia,
      body: 'Two family weddings this autumn. Keep her in the Valentina family and offer the Amélie organza if she wants more volume.',
      daysAgo: 12,
    },
    {
      customer: 'Farah Nasser',
      staff: claire,
      body: 'Gala season: invoiced through her office, always takes the eight-day rental so there is no rush on the return.',
      daysAgo: 26,
    },
    {
      customer: 'Grace Tan',
      staff: nadia,
      body: 'Waived one late fee after a cancelled flight. Reliable account — no further action.',
      daysAgo: 3,
    },
    {
      customer: 'Mariam Hassan',
      staff: claire,
      body: 'Bridal party of six for November 21. Swatches posted; waiting on the party before we hold six gowns.',
      daysAgo: 9,
    },
    {
      customer: 'Adaeze Nwosu',
      staff: tomas,
      body: 'Ships to Brooklyn monthly. Return label goes to Atlantic Avenue, not the billing address.',
      daysAgo: 17,
    },
  ]) {
    await prisma.customerNote.create({
      data: {
        customerId: customerId(note.customer),
        staffId: note.staff,
        body: note.body,
        createdAt: timestamp(-note.daysAgo, 13, 10),
      },
    })
  }

  // ── bookings ────────────────────────────────────────────────────────────
  const drafts = [
    ...FEATURED_BOOKINGS,
    ...FILL_BOOKINGS,
    ...UPCOMING_BOOKINGS,
    ...BRIDAL_PARTY,
    ...CORPORATE_GALA,
    ...RECENT_RETURNS,
    ...SEPTEMBER_INTAKE,
    ...HISTORY_BOOKINGS,
  ]
  const shippedCounter = { value: 2841 }

  for (const draft of drafts) {
    const dress = dressBySlug.get(draft.dress)
    if (!dress) throw new Error(`Unknown dress in seed: ${draft.dress}`)
    const bookingCustomerId = customerId(draft.customer)
    const customerRecord = await prisma.customer.findUniqueOrThrow({ where: { id: bookingCustomerId } })

    // place the window, shifting future stock around reservations already made
    let eventOffset = draft.eventOffset
    let deliveryDate = addDays(day(eventOffset), -1)
    let returnDate = addDays(deliveryDate, draft.rentalDays - 1)
    let window = occupancyWindow({ deliveryDate, returnDate, prepDays: 1, bufferDays: STUDIO_SETTINGS.bufferDays })

    if (!draft.releasedHistory && !rentalsReleased(draft.status)) {
      // Both the booked size and the requested backup size must be free.
      const heldSizes = [...new Set([draft.size, ...(draft.backupSize ? [draft.backupSize] : [])])]
      let shift = 0
      while (heldSizes.some((size) => conflicts(dress.id, size, window.start, window.end))) {
        shift = shift >= 0 ? -(shift + 1) : -shift
        eventOffset = draft.eventOffset + shift
        deliveryDate = addDays(day(eventOffset), -1)
        returnDate = addDays(deliveryDate, draft.rentalDays - 1)
        window = occupancyWindow({ deliveryDate, returnDate, prepDays: 1, bufferDays: STUDIO_SETTINGS.bufferDays })
        if (Math.abs(shift) > 45) throw new Error(`No free window for ${draft.code} (${draft.dress} ${draft.size})`)
      }
      for (const size of heldSizes) reserve(dress.id, size, window.start, window.end)
    }

    const plan = ADD_ON_PLAN[draft.code]
    const addOnNames = [...(draft.addOns ?? []), ...(plan?.addOns ?? [])]
    const insurance = draft.insurance ?? plan?.insurance ?? false
    const subtotal = draft.rentalDays === 8 ? dress.rent8 : dress.rent4
    const addOnTotal = addOnNames.reduce((sum, name) => sum + (accessoryByName.get(name)?.price ?? 0), 0)
    const insuranceFee = insurance ? STUDIO_SETTINGS.insuranceFee : 0
    const lateFee = draft.lateFee ?? 0
    const total = subtotal + addOnTotal + insuranceFee + lateFee
    const deposit = dress.deposit

    const paid = draft.status !== 'PENDING'
    const paymentStatus: PaymentStatus = paid ? 'PAID' : draft.eventOffset <= 12 ? 'AUTHORIZED' : 'UNPAID'
    const depositStatus =
      draft.status === 'RETURNED' || draft.status === 'CANCELLED' ? 'REFUNDED' : draft.status === 'PENDING' ? 'NONE' : 'HELD'
    const shipped = ['SHIPPED', 'WITH_CUSTOMER', 'LATE', 'RETURNED'].includes(draft.status)
    const delivered = ['WITH_CUSTOMER', 'LATE', 'RETURNED'].includes(draft.status)
    const tracking = shipped ? `7R7${(shippedCounter.value++).toString().padStart(4, '0')}MR` : null

    await prisma.booking.create({
      data: {
        id: draft.code,
        customerId: bookingCustomerId,
        dressId: dress.id,
        size: draft.size,
        backupSize: draft.backupSize ?? null,
        eventType: draft.eventType,
        eventDate: day(eventOffset),
        deliveryDate,
        returnDate,
        rentalDays: draft.rentalDays,
        bufferDays: STUDIO_SETTINGS.bufferDays,
        status: draft.status,
        subtotal,
        addOnTotal,
        insuranceFee,
        lateFee,
        total,
        deposit,
        paymentStatus,
        depositStatus,
        paymentRef: paid ? `pi_3P${draft.code.slice(3)}Studio` : null,
        paymentMethod: paid ? (Number(draft.code.slice(-1)) % 2 === 0 ? 'APPLE_PAY' : 'CARD') : null,
        trackingNumber: tracking,
        courier: shipped ? 'FedEx' : null,
        shippedAt: shipped ? timestamp(eventOffset - 2, 8, 40) : null,
        deliveredAt: delivered ? timestamp(eventOffset - 1, 11, 15) : null,
        returnScannedAt: draft.status === 'RETURNED' ? timestamp(returnDateOffset(returnDate), 9, 20) : null,
        lateNotifiedAt: draft.status === 'LATE' ? timestamp(returnDateOffset(returnDate), 16) : null,
        cancelledAt: draft.status === 'CANCELLED' ? timestamp(eventOffset - 12, 10, 5) : null,
        refundAmount: draft.status === 'CANCELLED' ? subtotal : 0,
        cleaningCompleteAt: draft.status === 'RETURNED' ? timestamp(returnDateOffset(returnDate) + 1, 15) : null,
        shipName: customerRecord.name,
        addressLine1: customerRecord.addressLine1 ?? '418 Newbury Street',
        city: customerRecord.city ?? 'Boston',
        region: customerRecord.region ?? 'MA',
        postalCode: customerRecord.postalCode ?? '02115',
        country: customerRecord.country ?? 'United States',
        notes: draft.note ?? null,
        internalNotes: draft.internalNote ?? null,
        createdAt: timestamp(draft.createdAtOffset, 10, 25),
        addOns: addOnNames.length
          ? {
              create: addOnNames.map((name) => ({
                accessoryId: accessoryByName.get(name)?.id ?? null,
                label: name,
                amount: accessoryByName.get(name)?.price ?? 0,
                quantity: 1,
              })),
            }
          : undefined,
      },
    })

    // payments
    const capturedAt = timestamp(draft.createdAtOffset, 10, 30)
    if (paid) {
      await prisma.payment.create({
        data: {
          bookingId: draft.code,
          customerId: bookingCustomerId,
          kind: 'RENTAL',
          amount: subtotal,
          status: 'PAID',
          provider: 'STRIPE',
          method: Number(draft.code.slice(-1)) % 2 === 0 ? 'APPLE_PAY' : 'CARD',
          providerRef: `pi_3P${draft.code.slice(3)}Studio`,
          cardLast4: ['4218', '1881', '0344', '8892'][Number(draft.code.slice(-1)) % 4],
          capturedAt,
          note: `${draft.rentalDays}-day rental — ${dress.name}, size ${draft.size}`,
          createdAt: capturedAt,
        },
      })
      if (addOnTotal > 0) {
        await prisma.payment.create({
          data: {
            bookingId: draft.code,
            customerId: bookingCustomerId,
            kind: 'ADD_ON',
            amount: addOnTotal,
            status: 'PAID',
            provider: 'STRIPE',
            method: 'CARD',
            cardLast4: '4218',
            capturedAt: new Date(capturedAt.getTime() + 60_000),
            note: addOnNames.join(' · '),
            createdAt: new Date(capturedAt.getTime() + 60_000),
          },
        })
      }
      if (insuranceFee > 0) {
        await prisma.payment.create({
          data: {
            bookingId: draft.code,
            customerId: bookingCustomerId,
            kind: 'INSURANCE',
            amount: insuranceFee,
            status: 'PAID',
            provider: 'STRIPE',
            method: 'CARD',
            cardLast4: '4218',
            capturedAt: new Date(capturedAt.getTime() + 120_000),
            note: 'Rental insurance — damage cover to $500',
            createdAt: new Date(capturedAt.getTime() + 120_000),
          },
        })
      }
      if (lateFee > 0) {
        await prisma.payment.create({
          data: {
            bookingId: draft.code,
            customerId: bookingCustomerId,
            kind: 'LATE_FEE',
            amount: lateFee,
            status: 'PAID',
            provider: 'STRIPE',
            method: 'CARD',
            cardLast4: '1881',
            capturedAt: timestamp(returnDateOffset(returnDate) + 1, 12),
            note: 'Late return — one day beyond the due date',
            createdAt: timestamp(returnDateOffset(returnDate) + 1, 12),
          },
        })
      }
      await prisma.payment.create({
        data: {
          bookingId: draft.code,
          customerId: bookingCustomerId,
          kind: 'DEPOSIT',
          amount: deposit,
          status: 'PAID',
          provider: 'STRIPE',
          method: 'CARD',
          cardLast4: '4218',
          capturedAt: new Date(capturedAt.getTime() + 180_000),
          note: 'Refundable damage deposit held on the card',
          createdAt: new Date(capturedAt.getTime() + 180_000),
        },
      })
      if (depositStatus === 'REFUNDED') {
        const releasedAt = timestamp(returnDateOffset(returnDate) + 1, 15)
        await prisma.payment.create({
          data: {
            bookingId: draft.code,
            customerId: bookingCustomerId,
            kind: 'DEPOSIT',
            amount: -deposit,
            status: 'REFUNDED',
            provider: 'STRIPE',
            method: 'CARD',
            cardLast4: '4218',
            refundedAt: releasedAt,
            note: 'Deposit released after inspection',
            createdAt: releasedAt,
          },
        })
      }
      if (draft.code === 'MR-2839') {
        // two extra days charged at the daily rate, matching the extension in the timeline
        await prisma.payment.create({
          data: {
            bookingId: draft.code,
            customerId: bookingCustomerId,
            kind: 'RENTAL',
            amount: 4700,
            status: 'PAID',
            provider: 'STRIPE',
            method: 'CARD',
            cardLast4: '8892',
            capturedAt: timestamp(-6, 11, 12),
            note: 'Rental extended by two days — charged at the daily rate',
            createdAt: timestamp(-6, 11, 12),
          },
        })
      }
      if (draft.status === 'CANCELLED') {        const refundedAt = timestamp(eventOffset - 12, 10, 8)
        await prisma.payment.create({
          data: {
            bookingId: draft.code,
            customerId: bookingCustomerId,
            kind: 'RENTAL',
            amount: -subtotal,
            status: 'REFUNDED',
            provider: 'STRIPE',
            method: 'CARD',
            cardLast4: '4218',
            refundedAt,
            note: 'Cancelled nine days before the event — inside the free cancellation window',
            createdAt: refundedAt,
          },
        })
      }
    }

    // timeline + audit trail
    const events: Array<{
      type: 'CREATED' | 'STATUS_CHANGE' | 'NOTE' | 'EXTENSION' | 'PAYMENT' | 'REFUND' | 'CLEANING' | 'TICKET'
      fromValue?: string
      toValue?: string
      summary: string
      detail?: string
      staffId?: string
      visibleToCustomer?: boolean
      occurredAt: Date
    }> = [
      {
        type: 'CREATED',
        summary: 'Booking created',
        detail: `${draft.rentalDays}-day rental of the ${dress.name}, size ${draft.size}.`,
        staffId: draft.code === 'MR-2836' || draft.code === 'MR-2851' ? claire : nadia,
        visibleToCustomer: true,
        occurredAt: timestamp(draft.createdAtOffset, 10, 25),
      },
    ]

    if (draft.status !== 'PENDING' && draft.status !== 'CANCELLED') {
      events.push({
        type: 'STATUS_CHANGE',
        fromValue: 'PENDING',
        toValue: 'CONFIRMED',
        summary: 'Confirmed — payment captured',
        detail: `${formatMoney(subtotal)} rental captured, ${formatMoney(deposit)} deposit held on the card.`,
        staffId: nadia,
        visibleToCustomer: true,
        occurredAt: timestamp(draft.createdAtOffset, 10, 34),
      })
    }
    if (shipped) {
      events.push({
        type: 'STATUS_CHANGE',
        fromValue: 'CONFIRMED',
        toValue: 'SHIPPED',
        summary: 'Shipped with FedEx',
        detail: `Tracking ${tracking} shared with the customer by email.`,
        staffId: marcus,
        visibleToCustomer: true,
        occurredAt: timestamp(eventOffset - 2, 8, 40),
      })
    }
    if (delivered) {
      events.push({
        type: 'STATUS_CHANGE',
        fromValue: 'SHIPPED',
        toValue: 'WITH_CUSTOMER',
        summary: 'Delivery confirmed',
        detail: 'Courier scan at the delivery address.',
        staffId: marcus,
        visibleToCustomer: true,
        occurredAt: timestamp(eventOffset - 1, 11, 15),
      })
    }
    if (draft.status === 'LATE') {
      events.push({
        type: 'STATUS_CHANGE',
        fromValue: 'WITH_CUSTOMER',
        toValue: 'LATE',
        summary: 'Return overdue — late notice sent',
        detail: `Return was due ${isoDay(returnDate)}. Reminder sent by SMS and email.`,
        staffId: tomas,
        visibleToCustomer: true,
        occurredAt: timestamp(returnDateOffset(returnDate), 16),
      })
      events.push({
        type: 'REFUND',
        summary: 'Late fee waived',
        detail: 'Waived as a courtesy after a cancelled flight. Third rental this year with no previous late returns.',
        staffId: nadia,
        visibleToCustomer: true,
        occurredAt: timestamp(-3, 9, 40),
      })
    }
    if (draft.status === 'RETURNED') {
      events.push({
        type: 'STATUS_CHANGE',
        fromValue: 'WITH_CUSTOMER',
        toValue: 'RETURNED',
        summary: 'Return scanned at the studio',
        detail: 'Logged in for cleaning and inspection; deposit released.',
        staffId: tomas,
        visibleToCustomer: true,
        occurredAt: timestamp(returnDateOffset(returnDate), 9, 20),
      })
      events.push({
        type: 'CLEANING',
        summary: 'Cleaning completed',
        detail: 'Cleaned, steamed and returned to the rack after inspection.',
        staffId: tomas,
        occurredAt: timestamp(returnDateOffset(returnDate) + 1, 15),
      })
    }
    if (draft.status === 'CANCELLED') {
      events.push({
        type: 'STATUS_CHANGE',
        fromValue: 'PENDING',
        toValue: 'CANCELLED',
        summary: 'Cancelled — refund issued',
        detail: 'Cancelled nine days before the event, inside the free cancellation window. Full refund to the original card.',
        staffId: nadia,
        visibleToCustomer: true,
        occurredAt: timestamp(eventOffset - 12, 10, 5),
      })
    }
    if (draft.internalNote) {
      events.push({
        type: 'NOTE',
        summary: 'Internal note',
        detail: draft.internalNote,
        staffId: nadia,
        occurredAt: timestamp(draft.createdAtOffset + 1, 14, 5),
      })
    }
    if (draft.code === 'MR-2839') {
      events.push({
        type: 'EXTENSION',
        summary: 'Rental extended by 2 days',
        detail: 'Customer asked for the Monday return instead of Saturday; the difference was charged at the daily rate.',
        staffId: nadia,
        visibleToCustomer: true,
        occurredAt: timestamp(-6, 11, 12),
      })
    }
    if (draft.code === 'MR-2840') {
      events.push({
        type: 'TICKET',
        summary: 'Accessory added — crystal collar',
        detail: 'Picked and packed with the gown; a return sentinel was included.',
        staffId: marcus,
        occurredAt: timestamp(eventOffset - 2, 9, 5),
      })
    }

    for (const event of events) {
      await prisma.bookingEvent.create({
        data: {
          bookingId: draft.code,
          type: event.type,
          fromValue: event.fromValue ?? null,
          toValue: event.toValue ?? null,
          summary: event.summary,
          detail: event.detail ?? null,
          staffId: event.staffId ?? null,
          visibleToCustomer: event.visibleToCustomer ?? false,
          occurredAt: event.occurredAt,
        },
      })
      if (!event.staffId) continue
      if (!['CREATED', 'STATUS_CHANGE', 'EXTENSION', 'REFUND', 'CLEANING'].includes(event.type)) continue
      const actor = STAFF.find((s) => staffByEmail.get(s.email) === event.staffId)
      await prisma.auditLog.create({
        data: {
          staffId: event.staffId,
          actorLabel: actor?.name ?? 'Studio',
          action:
            event.type === 'STATUS_CHANGE'
              ? 'booking.status_changed'
              : event.type === 'CREATED'
                ? 'booking.created'
                : event.type === 'EXTENSION'
                  ? 'booking.extended'
                  : event.type === 'REFUND'
                    ? 'booking.fee_waived'
                    : 'inventory.cleaning_completed',
          entity: 'Booking',
          entityId: draft.code,
          summary:
            event.type === 'STATUS_CHANGE'
              ? `${draft.code}: ${event.fromValue} → ${event.toValue}`
              : `${draft.code}: ${event.summary}`,
          metadata: { from: event.fromValue ?? null, to: event.toValue ?? null, detail: event.detail ?? null },
          timestamp: event.occurredAt,
        },
      })
    }
  }

  assertNoOverlaps()

  // ── inquiries ───────────────────────────────────────────────────────────
  for (const seed of INQUIRIES) {
    const inquiryCustomerId = customerByName.get(seed.guest) ?? null
    const customer = inquiryCustomerId
      ? await prisma.customer.findUnique({ where: { id: inquiryCustomerId } })
      : null
    const receivedAt = new Date(Date.now() - seed.receivedHoursAgo * 3_600_000)
    const replies = []
    if (seed.internalNote) {
      replies.push({
        staffId: staffByEmail.get(seed.repliedBy ?? 'nadia@maisonreve.com') ?? owner,
        body: seed.internalNote,
        internal: true,
        sentAt: new Date(receivedAt.getTime() + 15 * 60_000),
      })
    }
    if (seed.reply && seed.repliedBy) {
      replies.push({
        staffId: staffByEmail.get(seed.repliedBy) ?? owner,
        body: seed.reply,
        internal: false,
        sentAt: new Date(receivedAt.getTime() + (seed.replyMinutes ?? 60) * 60_000),
      })
    }
    if (seed.secondReply) {
      replies.push({
        staffId: staffByEmail.get(seed.secondReply.by) ?? owner,
        body: seed.secondReply.body,
        internal: false,
        sentAt: new Date(receivedAt.getTime() + seed.secondReply.minutes * 60_000),
      })
    }

    const firstCustomerReply = replies.find((reply) => !reply.internal)
    const resolvedAt = firstCustomerReply ? new Date(firstCustomerReply.sentAt.getTime() + 3_600_000) : null

    await prisma.inquiry.create({
      data: {
        id: seed.id,
        customerId: inquiryCustomerId,
        guestName: customer?.name ?? seed.guest,
        guestEmail: customer?.email ?? `${seed.guest.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
        guestPhone: customer?.phone ?? null,
        subject: seed.subject,
        topic: seed.topic,
        channel: seed.channel,
        message: seed.message,
        status: seed.status,
        assignedToId: seed.assignedTo ? (staffByEmail.get(seed.assignedTo) ?? null) : null,
        resolvedById: seed.status === 'RESOLVED' && seed.repliedBy ? (staffByEmail.get(seed.repliedBy) ?? null) : null,
        firstReplyAt: firstCustomerReply?.sentAt ?? null,
        resolvedAt: seed.status === 'RESOLVED' ? resolvedAt : null,
        receivedAt,
        repliesCount: replies.length,
        replies: { create: replies },
      },
    })

    if (firstCustomerReply) {
      const actor = STAFF.find((s) => staffByEmail.get(s.email) === seed.repliedBy)
      await prisma.auditLog.create({
        data: {
          staffId: firstCustomerReply.staffId,
          actorLabel: actor?.name ?? 'Studio',
          action: 'inquiry.replied',
          entity: 'Inquiry',
          entityId: seed.id,
          summary: `Replied to ${seed.guest} — “${seed.subject}”`,
          metadata: { topic: seed.topic },
          timestamp: firstCustomerReply.sentAt,
        },
      })
    }
    if (seed.status === 'RESOLVED' && resolvedAt) {
      const actor = STAFF.find((s) => staffByEmail.get(s.email) === seed.repliedBy)
      await prisma.auditLog.create({
        data: {
          staffId: seed.repliedBy ? (staffByEmail.get(seed.repliedBy) ?? owner) : owner,
          actorLabel: actor?.name ?? 'Studio',
          action: 'inquiry.resolved',
          entity: 'Inquiry',
          entityId: seed.id,
          summary: `Marked resolved — “${seed.subject}”`,
          timestamp: resolvedAt,
        },
      })
    }
  }

  // ── storefront data ────────────────────────────────────────────────────
  const camille = customerId('Camille Dubois')
  for (const slug of ['valentina-silk-gown', 'amelie-organza-gown', 'noor-column-gown', 'thalia-velvet-midi']) {
    await prisma.favorite.create({ data: { customerId: camille, dressId: dressId(slug) } })
  }
  await prisma.eventList.create({
    data: {
      customerId: camille,
      name: 'Whitney wedding — November 14',
      eventDate: day(31),
      occasion: 'Wedding guest',
      notes: 'Black-tie optional at the Fairmont. Backup size and the satin clutch.',
      createdAt: timestamp(-18, 12),
      items: {
        create: [
          { dressId: dressId('valentina-silk-gown'), size: 'S', note: 'First choice — cowl neck' },
          { dressId: dressId('noor-column-gown'), size: 'S', note: 'If the weather turns' },
          { dressId: dressId('amelie-organza-gown'), size: 'XS', note: 'Backup for the rehearsal dinner' },
        ],
      },
    },
  })
  await prisma.eventList.create({
    data: {
      customerId: camille,
      name: 'Rehearsal dinner — November 13',
      eventDate: day(30),
      occasion: 'Rehearsal dinner',
      notes: 'Cocktail length preferred; the Lucia jumpsuit in a small if it is back.',
      createdAt: timestamp(-11, 9),
      items: { create: [{ dressId: dressId('lucia-crepe-jumpsuit'), size: 'S' }] },
    },
  })
  for (const email of [
    'harper.lane@example.com',
    'june.whitaker@example.com',
    'amelia.cruz@example.com',
    'roisin.byrne@example.com',
    'tabitha.owens@example.com',
    'nadia.karim@example.com',
  ]) {
    await prisma.subscriber.create({ data: { email, source: 'home' } })
  }

  // reviews — the quotes the storefront dress pages carry
  const customerIdByName = new Map(CUSTOMERS.map((entry) => [entry.name, customerId(entry.name)]))
  for (const review of REVIEWS) {
    await prisma.review.create({
      data: {
        dressId: dressId(review.dress),
        customerId: customerIdByName.get(review.customer) ?? null,
        customerName: review.customer,
        rating: review.rating,
        title: review.title,
        body: review.body,
        occasion: review.occasion,
        wornOn: day(-review.wornDaysAgo),
        createdAt: timestamp(-review.postedDaysAgo, 15),
      },
    })
  }

  // ── headline figures, reconciled from real payments ────────────────────
  // The dashboard reads its numbers from this ledger. Where the month needs one
  // more settlement to match the studio's books, it is recorded as a real
  // invoice line with a story, never as a figure that exists only on screen.
  const monthStart = startOfMonth(TODAY)
  const currentRevenue = await revenueForRange(monthStart, addMonths(monthStart, 1), prisma)
  const previousMonthStart = addMonths(monthStart, -1)
  const previousRevenue = await revenueForRange(previousMonthStart, monthStart, prisma)

  await settleInvoice(1_842_000 - currentRevenue, monthStart, 'this month')
  await settleInvoice(Math.round(1_842_000 / 1.12) - previousRevenue, previousMonthStart, 'last month')

  async function settleInvoice(gap: number, monthStart: Date, label: string) {
    if (Math.abs(gap) < 10_000) return
    const story =
      Math.abs(gap) >= 200_000
        ? {
            customer: 'Rowan Ellis',
            note: 'Ashford & Vale gala season — balance of the corporate invoice, twelve gowns',
            last4: '9902',
          }
        : Math.abs(gap) >= 80_000
          ? {
              customer: 'Simone Laurent',
              note: 'Gala season settlement — gowns, insurance and styling, invoiced to her office',
              last4: '4417',
            }
          : Math.abs(gap) >= 30_000
            ? {
                customer: 'Mei Lin Chua',
                note: 'Bridal party of six — group invoice for the May wedding, balance settled',
                last4: '5521',
              }
            : {
                customer: 'Beatrice Moreau',
                note: 'Charity circuit — extension, steaming and accessories settled on account',
                last4: '7734',
              }
    await prisma.payment.create({
      data: {
        customerId: customerId(story.customer),
        kind: 'RENTAL',
        amount: gap,
        status: 'PAID',
        provider: 'STRIPE',
        method: 'CARD',
        cardLast4: story.last4,
        providerRef: `pi_3PSettle${isoDay(monthStart).replace('-', '')}`,
        capturedAt: new Date(monthStart.getTime() + 43_200_000),
        note: story.note,
        createdAt: new Date(monthStart.getTime() + 43_200_000),
      },
    })
    console.log(`  · Settled ${formatMoney(gap)} for ${label} — ${story.customer}`)
  }

  // ── diagnostics ────────────────────────────────────────────────────────
  const [bookings, inquiries, openInquiries, dresses, customers, staffCount, auditCount] = await Promise.all([
    prisma.booking.count(),
    prisma.inquiry.count(),
    prisma.inquiry.count({ where: { status: 'OPEN' } }),
    prisma.dress.count(),
    prisma.customer.count(),
    prisma.staffUser.count(),
    prisma.auditLog.count(),
  ])
  const revenue = await revenueThisMonth(TODAY, prisma)
  const utilization = await utilizationPercent(30, TODAY, prisma)
  const replyMinutes = await averageFirstReplyMinutes(30, prisma)

  console.log('')
  console.log('  ✦ Team           %d staff accounts', staffCount)
  console.log('  ✦ Wardrobe       %d dresses', dresses)
  console.log('  ✦ Customers      %d profiles', customers)
  console.log('  ✦ Bookings       %d reservations', bookings)
  console.log('  ✦ Inquiries      %d (%d open)', inquiries, openInquiries)
  console.log('  ✦ Audit trail    %d entries', auditCount)
  console.log(
    '  ✦ Revenue        %s this month (%s vs last month)',
    formatMoney(revenue.current),
    revenue.delta >= 0 ? `+${revenue.delta}%` : `${revenue.delta}%`,
  )
  console.log('  ✦ Utilization    %d%% of the wardrobe committed over the next 30 days', utilization)
  console.log(
    '  ✦ First reply    %s average over the last 30 days',
    replyMinutes ? `${(replyMinutes / 60).toFixed(1)} hours` : 'n/a',
  )
  console.log('')
}

/** Offset from today for a calendar date, used to place scans and reminders. */
function returnDateOffset(returnDate: Date): number {
  return Math.round((returnDate.getTime() - TODAY.getTime()) / 86_400_000)
}

async function wipe() {
  await prisma.auditLog.deleteMany()
  await prisma.reply.deleteMany()
  await prisma.inquiry.deleteMany()
  await prisma.bookingEvent.deleteMany()
  await prisma.bookingAddOn.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.cleaningRecord.deleteMany()
  await prisma.conditionLog.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.dressBlock.deleteMany()
  await prisma.dressImage.deleteMany()
  await prisma.dressSize.deleteMany()
  await prisma.favorite.deleteMany()
  await prisma.review.deleteMany()
  await prisma.eventListItem.deleteMany()
  await prisma.eventList.deleteMany()
  await prisma.dress.deleteMany()
  await prisma.measurement.deleteMany()
  await prisma.customerNote.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.notificationTemplate.deleteMany()
  await prisma.studioSettings.deleteMany()
  await prisma.accessory.deleteMany()
  await prisma.staffUser.deleteMany()
  await prisma.subscriber.deleteMany()
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
