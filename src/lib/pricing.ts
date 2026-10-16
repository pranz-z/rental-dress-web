/**
 * Settings-driven pricing.
 *
 * Rental prices and refundable deposits are never stored per dress: they derive
 * from the dress retail value and the percentages the studio keeps in
 * Settings → Rental rules. The storefront, checkout and studio quotes all read
 * these helpers, so one change in Settings moves every price together.
 */

export type PricingSettings = {
  rentalPercent4: number
  rentalPercent8: number
  depositPercent: number
}

/** Prices land on whole dollars — a quote should never read $182.14. */
export function roundToDollar(cents: number): number {
  return Math.round(cents / 100) * 100
}

/** What the studio charges for a 4- or 8-day rental of this dress. */
export function rentalPriceFor(retailValue: number, rentalDays: number, settings: PricingSettings): number {
  const percent = rentalDays >= 8 ? settings.rentalPercent8 : settings.rentalPercent4
  return roundToDollar(Math.round((retailValue * percent) / 100))
}

/** The refundable damage deposit a booking holds on the card. */
export function depositFor(retailValue: number, settings: PricingSettings): number {
  return roundToDollar(Math.round((retailValue * settings.depositPercent) / 100))
}
