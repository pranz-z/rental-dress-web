/**
 * One vocabulary for the whole product: statuses, tones, roles and capabilities.
 * The storefront and the studio both read from here so wording and colour never
 * drift between the two.
 */

export type Tone = 'neutral' | 'gold' | 'rose' | 'mulberry' | 'clay' | 'sage' | 'blush'

// ── bookings ──────────────────────────────────────────────────────────────

export const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'SHIPPED',
  'WITH_CUSTOMER',
  'LATE',
  'RETURNED',
  'CANCELLED',
] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const BOOKING_STATUS_META: Record<
  BookingStatus,
  { label: string; tone: Tone; description: string; step: number }
> = {
  PENDING: {
    label: 'Pending',
    tone: 'gold',
    description: 'Reserved, awaiting studio confirmation and payment capture.',
    step: 1,
  },
  CONFIRMED: {
    label: 'Confirmed',
    tone: 'mulberry',
    description: 'Payment captured, dress held for the event date.',
    step: 2,
  },
  SHIPPED: {
    label: 'Shipped',
    tone: 'rose',
    description: 'Left the studio with the courier, tracking shared with the customer.',
    step: 3,
  },
  WITH_CUSTOMER: {
    label: 'With customer',
    tone: 'blush',
    description: 'Delivered and in the customer’s hands for the event.',
    step: 4,
  },
  LATE: {
    label: 'Late',
    tone: 'clay',
    description: 'Past the return date with no return scan yet.',
    step: 5,
  },
  RETURNED: {
    label: 'Returned',
    tone: 'sage',
    description: 'Back in the studio. Cleaning and inspection in progress.',
    step: 6,
  },
  CANCELLED: {
    label: 'Cancelled',
    tone: 'neutral',
    description: 'Cancelled before dispatch. Refund issued per policy.',
    step: 0,
  },
}

export const OPEN_BOOKING_STATUSES: BookingStatus[] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'WITH_CUSTOMER', 'LATE']
export const ACTIVE_RENTAL_STATUSES: BookingStatus[] = ['CONFIRMED', 'SHIPPED', 'WITH_CUSTOMER', 'LATE']

// ── dresses ───────────────────────────────────────────────────────────────

export const DRESS_STATUSES = ['AVAILABLE', 'RENTED', 'CLEANING', 'RETIRED'] as const
export type DressStatus = (typeof DRESS_STATUSES)[number]

export const DRESS_STATUS_META: Record<DressStatus, { label: string; tone: Tone; description: string }> = {
  AVAILABLE: { label: 'Available', tone: 'sage', description: 'On the rack, ready to reserve.' },
  RENTED: { label: 'Rented', tone: 'mulberry', description: 'Currently with a customer.' },
  CLEANING: { label: 'Cleaning', tone: 'gold', description: 'With the cleaning house or in inspection.' },
  RETIRED: { label: 'Retired', tone: 'neutral', description: 'Out of rotation.' },
}

export const DRESS_CATEGORIES = ['Gown', 'Midi', 'Maxi', 'Mini', 'Two-piece'] as const

export const CONDITION_SEVERITIES = ['NOTE', 'MINOR', 'MAJOR'] as const
export type ConditionSeverity = (typeof CONDITION_SEVERITIES)[number]

export const CONDITION_SEVERITY_META: Record<ConditionSeverity, { label: string; tone: Tone }> = {
  NOTE: { label: 'Note', tone: 'neutral' },
  MINOR: { label: 'Minor', tone: 'gold' },
  MAJOR: { label: 'Major', tone: 'clay' },
}

export const DRESS_IMAGE_KIND_LABEL = {
  FRONT: 'Front',
  BACK: 'Back',
  DETAIL: 'Detail',
  ON_BODY: 'On body',
  MOVEMENT: 'In movement',
} as const

// ── inquiries ─────────────────────────────────────────────────────────────

export const INQUIRY_TOPICS = [
  'SIZING',
  'BOOKING_CHANGE',
  'GROUP_BOOKING',
  'DELIVERY',
  'DAMAGE',
  'GENERAL',
] as const
export type InquiryTopic = (typeof INQUIRY_TOPICS)[number]

export const INQUIRY_TOPIC_META: Record<InquiryTopic, { label: string; tone: Tone }> = {
  SIZING: { label: 'Sizing', tone: 'rose' },
  BOOKING_CHANGE: { label: 'Booking change', tone: 'gold' },
  GROUP_BOOKING: { label: 'Group booking', tone: 'mulberry' },
  DELIVERY: { label: 'Delivery', tone: 'blush' },
  DAMAGE: { label: 'Damage', tone: 'clay' },
  GENERAL: { label: 'General', tone: 'neutral' },
}

export const INQUIRY_CHANNELS = ['CONTACT_FORM', 'DRESS_PAGE', 'EMAIL', 'PHONE'] as const
export type InquiryChannel = (typeof INQUIRY_CHANNELS)[number]

export const INQUIRY_CHANNEL_LABEL: Record<InquiryChannel, string> = {
  CONTACT_FORM: 'Contact form',
  DRESS_PAGE: 'Dress page',
  EMAIL: 'Email',
  PHONE: 'Phone',
}

export const INQUIRY_STATUSES = ['OPEN', 'RESOLVED'] as const
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number]

export const INQUIRY_STATUS_META: Record<InquiryStatus, { label: string; tone: Tone }> = {
  OPEN: { label: 'Open', tone: 'blush' },
  RESOLVED: { label: 'Resolved', tone: 'sage' },
}

// ── customers ─────────────────────────────────────────────────────────────

export const CUSTOMER_TIERS = ['GUEST', 'MEMBER', 'PARIS_CLUB'] as const
export type CustomerTier = (typeof CUSTOMER_TIERS)[number]

export const TIER_META: Record<CustomerTier, { label: string; tone: Tone; blurb: string }> = {
  GUEST: { label: 'Guest', tone: 'neutral', blurb: 'First rental, no membership yet.' },
  MEMBER: { label: 'Member', tone: 'rose', blurb: 'Two or more rentals · early access to new arrivals.' },
  PARIS_CLUB: { label: 'Paris Club', tone: 'gold', blurb: 'Top tier · complimentary insurance and styling.' },
}

// ── staff roles and access ────────────────────────────────────────────────

export const STAFF_ROLES = ['OWNER', 'STUDIO_MANAGER', 'STYLIST', 'FULFILLMENT'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

export const ROLE_META: Record<StaffRole, { label: string; blurb: string; tone: Tone }> = {
  OWNER: { label: 'Owner', tone: 'gold', blurb: 'Everything, including revenue, pricing and staff accounts.' },
  STUDIO_MANAGER: {
    label: 'Studio manager',
    tone: 'mulberry',
    blurb: 'Bookings, schedule, inquiries, inventory and customers.',
  },
  STYLIST: { label: 'Stylist', tone: 'rose', blurb: 'Inquiries, customers, and read-only bookings.' },
  FULFILLMENT: { label: 'Fulfillment', tone: 'blush', blurb: 'Schedule, shipping, returns and the cleaning queue.' },
}

export const CAPABILITIES = [
  'overview.view',
  'overview.revenue',
  'bookings.view',
  'bookings.create',
  'bookings.confirm',
  'bookings.ship',
  'bookings.deliver',
  'bookings.return',
  'bookings.extend',
  'bookings.cancel',
  'bookings.note',
  'bookings.payments',
  'schedule.view',
  'inquiries.view',
  'inquiries.reply',
  'inquiries.assign',
  'inventory.view',
  'inventory.manage',
  'inventory.cleaning',
  'customers.view',
  'customers.note',
  'settings.view',
  'settings.staff',
  'settings.policies',
  'settings.templates',
  'audit.view',
] as const
export type Capability = (typeof CAPABILITIES)[number]

const ALL: Capability[] = [...CAPABILITIES]

const ROLE_CAPABILITIES: Record<StaffRole, Capability[]> = {
  OWNER: ALL,
  STUDIO_MANAGER: [
    'overview.view',
    'overview.revenue',
    'bookings.view',
    'bookings.create',
    'bookings.confirm',
    'bookings.ship',
    'bookings.deliver',
    'bookings.return',
    'bookings.extend',
    'bookings.cancel',
    'bookings.note',
    'bookings.payments',
    'schedule.view',
    'inquiries.view',
    'inquiries.reply',
    'inquiries.assign',
    'inventory.view',
    'inventory.manage',
    'inventory.cleaning',
    'customers.view',
    'customers.note',
    'settings.view',
    'settings.templates',
    'audit.view',
  ],
  STYLIST: [
    'overview.view',
    'bookings.view',
    'bookings.payments',
    'schedule.view',
    'inquiries.view',
    'inquiries.reply',
    'inquiries.assign',
    'inventory.view',
    'customers.view',
    'customers.note',
  ],
  FULFILLMENT: [
    'overview.view',
    'bookings.view',
    'bookings.ship',
    'bookings.deliver',
    'bookings.return',
    'schedule.view',
    'inventory.view',
    'inventory.cleaning',
  ],
}

export function can(role: StaffRole | null | undefined, capability: Capability): boolean {
  if (!role) return false
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false
}

export function capabilitiesFor(role: StaffRole): Capability[] {
  return ROLE_CAPABILITIES[role] ?? []
}

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value)
}

// ── studio sections ───────────────────────────────────────────────────────

export type SectionKey =
  | 'overview'
  | 'bookings'
  | 'schedule'
  | 'inquiries'
  | 'inventory'
  | 'customers'
  | 'settings'

export const SECTION_CAPABILITY: Record<SectionKey, Capability> = {
  overview: 'overview.view',
  bookings: 'bookings.view',
  schedule: 'schedule.view',
  inquiries: 'inquiries.view',
  inventory: 'inventory.view',
  customers: 'customers.view',
  settings: 'settings.view',
}

export function landingSection(role: StaffRole): SectionKey {
  if (can(role, 'schedule.view') && !can(role, 'inquiries.view')) return 'schedule'
  return 'overview'
}

// ── payments ──────────────────────────────────────────────────────────────

export const PAYMENT_KIND_LABEL: Record<string, string> = {
  RENTAL: 'Rental',
  DEPOSIT: 'Damage deposit',
  ADD_ON: 'Add-ons',
  INSURANCE: 'Rental insurance',
  LATE_FEE: 'Late fee',
  REFUND: 'Refund',
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Unpaid',
  AUTHORIZED: 'Authorized',
  PAID: 'Paid',
  REFUNDED: 'Refunded',
  FAILED: 'Failed',
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CARD: 'Card',
  APPLE_PAY: 'Apple Pay',
  GOOGLE_PAY: 'Google Pay',
  BNPL: 'Pay in 4',
  STUDIO_CREDIT: 'Studio credit',
}

export const DEPOSIT_STATUS_LABEL: Record<string, string> = {
  NONE: 'No deposit',
  HELD: 'Held',
  REFUNDED: 'Refunded',
  FORFEITED: 'Forfeited',
}
