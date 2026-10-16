/**
 * Delivery zones.
 *
 * The studio keeps its zones in Settings → Hours & delivery. Checkout offers
 * them, adds the courier fee to the order, and shows the dispatch cutoff.
 * Rows written before courier labels existed still parse — the missing fields
 * fall back to studio defaults so a zone never breaks checkout.
 */

export type DeliveryZone = {
  name: string
  /** Courier line shown at checkout, e.g. "UPS Ground". */
  courier: string
  /** Business days from dispatch to the customer's door. */
  etaDays: number
  /** Cents added to the order when this zone is chosen. */
  fee: number
  /** Latest studio time (24 h "HH:MM") a dispatch can still catch the courier. */
  cutoff: string
}

export const DEFAULT_ZONE_COURIER = 'Studio courier'
export const DEFAULT_ZONE_CUTOFF = '14:00'

export function parseDeliveryZones(json: unknown): DeliveryZone[] {
  if (!Array.isArray(json)) return []
  const zones: DeliveryZone[] = []
  for (const raw of json) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!name) continue
    zones.push({
      name,
      courier:
        typeof row.courier === 'string' && row.courier.trim() ? row.courier.trim() : DEFAULT_ZONE_COURIER,
      etaDays:
        typeof row.etaDays === 'number' && Number.isFinite(row.etaDays)
          ? Math.min(14, Math.max(0, Math.round(row.etaDays)))
          : 1,
      fee:
        typeof row.courierFee === 'number' && Number.isFinite(row.courierFee)
          ? Math.max(0, Math.round(row.courierFee))
          : 0,
      cutoff:
        typeof row.cutoff === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.cutoff)
          ? row.cutoff
          : DEFAULT_ZONE_CUTOFF,
    })
  }
  return zones
}

/** Serialize back into the settings JSON shape (courierFee is the stored key). */
export function serializeDeliveryZones(
  zones: DeliveryZone[],
): Array<{ name: string; courier: string; etaDays: number; courierFee: number; cutoff: string }> {
  return zones.map((zone) => ({
    name: zone.name,
    courier: zone.courier,
    etaDays: zone.etaDays,
    courierFee: zone.fee,
    cutoff: zone.cutoff,
  }))
}

export function zoneByName(zones: DeliveryZone[], name: string | undefined | null): DeliveryZone | null {
  if (!name) return null
  return zones.find((zone) => zone.name === name) ?? null
}

/** "14:00" → "2:00 PM" */
export function formatCutoff(cutoff: string): string {
  const [h, m] = cutoff.split(':').map(Number)
  const period = (h ?? 0) >= 12 ? 'PM' : 'AM'
  const hour12 = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12
  return `${hour12}:${String(m ?? 0).padStart(2, '0')} ${period}`
}

export function formatEta(etaDays: number): string {
  if (etaDays <= 0) return 'same day'
  if (etaDays === 1) return 'next day'
  return `${etaDays} business days`
}
