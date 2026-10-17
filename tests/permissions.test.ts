/**
 * Role permissions — who may do what in the studio.
 *
 * The spec pins the risky edges: only Owners touch staff accounts and rental
 * rules; Managers may view settings and edit email templates; Stylists and
 * Fulfillment see no Settings at all.
 */
import { describe, expect, it } from 'vitest'
import { can, capabilitiesFor, CAPABILITIES } from '@/lib/domain'

describe('Owner', () => {
  it('holds every capability', () => {
    for (const capability of CAPABILITIES) {
      expect(can('OWNER', capability), `owner should have ${capability}`).toBe(true)
    }
  })
})

describe('Studio manager', () => {
  it('may view settings and edit email templates', () => {
    expect(can('STUDIO_MANAGER', 'settings.view')).toBe(true)
    expect(can('STUDIO_MANAGER', 'settings.templates')).toBe(true)
  })

  it('may not touch staff accounts or rental rules', () => {
    expect(can('STUDIO_MANAGER', 'settings.staff')).toBe(false)
    expect(can('STUDIO_MANAGER', 'settings.policies')).toBe(false)
  })

  it('runs the day-to-day booking desk', () => {
    expect(can('STUDIO_MANAGER', 'bookings.confirm')).toBe(true)
    expect(can('STUDIO_MANAGER', 'bookings.cancel')).toBe(true)
    expect(can('STUDIO_MANAGER', 'inventory.manage')).toBe(true)
    expect(can('STUDIO_MANAGER', 'audit.view')).toBe(true)
  })
})

describe('Stylist', () => {
  it('has no Settings access at all', () => {
    expect(can('STYLIST', 'settings.view')).toBe(false)
    expect(can('STYLIST', 'settings.templates')).toBe(false)
    expect(can('STYLIST', 'settings.staff')).toBe(false)
    expect(can('STYLIST', 'settings.policies')).toBe(false)
  })

  it('works customers and inquiries but not the booking ledger', () => {
    expect(can('STYLIST', 'inquiries.reply')).toBe(true)
    expect(can('STYLIST', 'customers.note')).toBe(true)
    expect(can('STYLIST', 'bookings.view')).toBe(true)
    expect(can('STYLIST', 'bookings.confirm')).toBe(false)
    expect(can('STYLIST', 'bookings.note')).toBe(false)
    expect(can('STYLIST', 'inventory.manage')).toBe(false)
  })
})

describe('Fulfillment', () => {
  it('has no Settings access at all', () => {
    for (const capability of ['settings.view', 'settings.templates', 'settings.staff', 'settings.policies'] as const) {
      expect(can('FULFILLMENT', capability), `fulfillment should not have ${capability}`).toBe(false)
    }
  })

  it('ships, delivers and receives returns — but never confirms or cancels', () => {
    expect(can('FULFILLMENT', 'bookings.ship')).toBe(true)
    expect(can('FULFILLMENT', 'bookings.deliver')).toBe(true)
    expect(can('FULFILLMENT', 'bookings.return')).toBe(true)
    expect(can('FULFILLMENT', 'inventory.cleaning')).toBe(true)
    expect(can('FULFILLMENT', 'bookings.confirm')).toBe(false)
    expect(can('FULFILLMENT', 'bookings.cancel')).toBe(false)
    expect(can('FULFILLMENT', 'inquiries.view')).toBe(false)
    expect(can('FULFILLMENT', 'customers.view')).toBe(false)
  })
})

describe('signed-out visitors', () => {
  it('have no capabilities', () => {
    expect(can(null, 'bookings.view')).toBe(false)
    expect(can(undefined, 'settings.view')).toBe(false)
  })

  it('every role only ever holds declared capabilities', () => {
    for (const role of ['OWNER', 'STUDIO_MANAGER', 'STYLIST', 'FULFILLMENT'] as const) {
      for (const capability of capabilitiesFor(role)) {
        expect(CAPABILITIES).toContain(capability)
      }
    }
  })
})
