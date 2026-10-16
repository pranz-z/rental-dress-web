import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { Checkbox, FieldHint, FieldLabel, Input } from '@/components/ui/field'
import { requireCapability } from '@/lib/auth/guards'
import { prisma } from '@/lib/db'
import { can } from '@/lib/domain'
import { moneyInputValue } from '@/lib/inventory'
import { formatMoney } from '@/lib/money'
import { depositFor, rentalPriceFor } from '@/lib/pricing'
import { saveRentalRulesAction } from '../actions'
import { SETTINGS_DONE_MESSAGES } from '../messages'

export const metadata: Metadata = { title: 'Rental rules · Settings' }
export const dynamic = 'force-dynamic'

/** Sample retail values so the studio sees what the percentages mean in dollars. */
const SAMPLE_RETAILS = [32000, 52000, 90000]

export default async function RentalRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>
}) {
  const staff = await requireCapability('settings.view')
  const { done, error } = await searchParams
  const settings = await prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } })

  const editable = can(staff.role, 'settings.policies')
  const disabled = !editable
  const doneMessage = done ? (SETTINGS_DONE_MESSAGES[done] ?? null) : null

  return (
    <div className="space-y-5">
      {error ? (
        <div role="alert" className="rounded-xl border border-danger-line bg-surface px-4 py-3 text-sm font-bold text-danger-ink">
          {error}
        </div>
      ) : null}
      {doneMessage ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden />
            {doneMessage}
          </span>
        </div>
      ) : null}

      {!editable ? (
        <p className="rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink-muted">
          Rental rules are set by the Owner. You are seeing the live values — ask an Owner to change them.
        </p>
      ) : null}

      <form action={saveRentalRulesAction} className="space-y-5">
        <Card>
          <CardHeader
            title="Prices"
            description="Rental rates are a share of each piece’s retail value, so the wardrobe prices itself."
            action={disabled ? <Chip tone="neutral">Read only</Chip> : undefined}
          />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <FieldLabel htmlFor="rules-percent4">4-day rental (% of retail)</FieldLabel>
              <Input
                id="rules-percent4"
                name="rentalPercent4"
                type="number"
                min={5}
                max={100}
                step={1}
                required
                disabled={disabled}
                defaultValue={settings.rentalPercent4}
              />
              <FieldHint>Charged for a standard four-day rental.</FieldHint>
            </div>
            <div>
              <FieldLabel htmlFor="rules-percent8">8-day rental (% of retail)</FieldLabel>
              <Input
                id="rules-percent8"
                name="rentalPercent8"
                type="number"
                min={5}
                max={150}
                step={1}
                required
                disabled={disabled}
                defaultValue={settings.rentalPercent8}
              />
              <FieldHint>Must be higher than the 4-day rate.</FieldHint>
            </div>
            <div>
              <FieldLabel htmlFor="rules-deposit">Refundable deposit (% of retail)</FieldLabel>
              <Input
                id="rules-deposit"
                name="depositPercent"
                type="number"
                min={0}
                max={100}
                step={1}
                required
                disabled={disabled}
                defaultValue={settings.depositPercent}
              />
              <FieldHint>Held on the card and released when the dress is returned.</FieldHint>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Timing & fees" description="How fast a dress can turn around, and what time costs." />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <FieldLabel htmlFor="rules-prep">Preparation days before a rental</FieldLabel>
              <Input
                id="rules-prep"
                name="prepDays"
                type="number"
                min={0}
                max={3}
                step={1}
                required
                disabled={disabled}
                defaultValue={settings.prepDays}
              />
              <FieldHint>Pressing and inspection between rentals. Blocks availability ahead of delivery.</FieldHint>
            </div>
            <div>
              <FieldLabel htmlFor="rules-buffer">Cleaning buffer days after a rental</FieldLabel>
              <Input
                id="rules-buffer"
                name="bufferDays"
                type="number"
                min={0}
                max={5}
                step={1}
                required
                disabled={disabled}
                defaultValue={settings.bufferDays}
              />
              <FieldHint>Held out of the calendar after the return — storefront availability follows this live.</FieldHint>
            </div>
            <div>
              <FieldLabel htmlFor="rules-extension">Daily extension fee ($)</FieldLabel>
              <Input
                id="rules-extension"
                name="extensionFeePerDay"
                inputMode="decimal"
                required
                disabled={disabled}
                defaultValue={moneyInputValue(settings.extensionFeePerDay)}
              />
              <FieldHint>Flat fee per extra day when the studio extends a live booking.</FieldHint>
            </div>
            <div>
              <FieldLabel htmlFor="rules-late">Late fee per day ($)</FieldLabel>
              <Input
                id="rules-late"
                name="lateFeePerDay"
                inputMode="decimal"
                required
                disabled={disabled}
                defaultValue={moneyInputValue(settings.lateFeePerDay)}
              />
              <FieldHint>Charged for each day past the return date, after the grace days below.</FieldHint>
            </div>
            <div>
              <FieldLabel htmlFor="rules-grace">Late-fee grace days</FieldLabel>
              <Input
                id="rules-grace"
                name="lateGraceDays"
                type="number"
                min={0}
                max={14}
                step={1}
                required
                disabled={disabled}
                defaultValue={settings.lateGraceDays}
              />
              <FieldHint>Days the return can run before a late fee applies.</FieldHint>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Cancellation" description="How far out a full refund runs, and what the window holds back." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="rules-window">Free-cancellation window (days before delivery)</FieldLabel>
              <Input
                id="rules-window"
                name="cancellationWindowDays"
                type="number"
                min={0}
                max={60}
                step={1}
                required
                disabled={disabled}
                defaultValue={settings.cancellationWindowDays}
              />
              <FieldHint>Cancel at least this many days before delivery for a full rental refund.</FieldHint>
            </div>
            <div>
              <FieldLabel htmlFor="rules-refund">Refund inside the window (%)</FieldLabel>
              <Input
                id="rules-refund"
                name="cancellationRefundPercent"
                type="number"
                min={0}
                max={100}
                step={1}
                required
                disabled={disabled}
                defaultValue={settings.cancellationRefundPercent}
              />
              <FieldHint>Share of the rental fee refunded when a booking is cancelled closer in. The deposit always returns in full.</FieldHint>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Booking confirmation" description="What happens the moment a paid booking lands." />
          <CardBody>
            <label className="flex items-start gap-3 text-sm text-ink">
              <Checkbox
                name="autoConfirmBookings"
                defaultChecked={settings.autoConfirmBookings}
                disabled={disabled}
                className="mt-0.5"
              />
              <span>
                <span className="block font-bold">Confirm paid, available bookings automatically</span>
                <span className="mt-0.5 block text-ink-muted">
                  Off by default: every booking arrives as <strong className="text-ink">Pending</strong> for the studio to
                  confirm. On, a booking whose payment cleared and whose dates are free is confirmed on the spot.
                </span>
              </span>
            </label>
          </CardBody>
          {editable ? (
            <CardFooter>
              <Button type="submit">Save rental rules</Button>
            </CardFooter>
          ) : null}
        </Card>
      </form>

      <Card>
        <CardHeader
          title="What these numbers mean in dollars"
          description="Priced live from the current rules — a change moves these the moment it is saved."
        />
        <CardBody>
          <dl className="divide-y divide-line text-sm">
            {SAMPLE_RETAILS.map((retail) => (
              <div key={retail} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <dt className="font-bold text-ink">{formatMoney(retail)} retail</dt>
                <dd className="text-ink-muted">
                  {formatMoney(rentalPriceFor(retail, 4, settings))} · 4 days{' '}
                  <span className="px-1">|</span> {formatMoney(rentalPriceFor(retail, 8, settings))} · 8 days{' '}
                  <span className="px-1">|</span> {formatMoney(depositFor(retail, settings))} deposit
                </dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>
    </div>
  )
}
