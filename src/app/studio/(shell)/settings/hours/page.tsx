import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { Checkbox, FieldHint, FieldLabel, Input } from '@/components/ui/field'
import { requireCapability } from '@/lib/auth/guards'
import { dayLabel, parseBusinessHours, WEEKDAYS } from '@/lib/business-hours'
import { prisma } from '@/lib/db'
import { parseDeliveryZones } from '@/lib/delivery'
import { can } from '@/lib/domain'
import { moneyInputValue } from '@/lib/inventory'
import { saveHoursAction, saveZonesAction } from '../actions'
import { SETTINGS_DONE_MESSAGES } from '../messages'

export const metadata: Metadata = { title: 'Hours & delivery · Settings' }
export const dynamic = 'force-dynamic'

const MAX_ZONE_ROWS = 8

export default async function HoursPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>
}) {
  const staff = await requireCapability('settings.view')
  const { done, error } = await searchParams
  const settings = await prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } })

  const editable = can(staff.role, 'settings.policies')
  const disabled = !editable
  const hours = parseBusinessHours(settings.businessHours)
  const zones = parseDeliveryZones(settings.deliveryZones)
  const zoneRows = Array.from({ length: MAX_ZONE_ROWS }, (_, index) => zones[index] ?? null)
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
          Hours and delivery zones are set by the Owner. You are seeing the live values — ask an Owner to change them.
        </p>
      ) : null}

      <form action={saveHoursAction}>
        <Card>
          <CardHeader
            title="Business hours"
            description="Shown on the storefront, and the inquiry reply clock counts only this time — a note sent on Friday evening is due within the target hours from the next open morning."
            action={disabled ? <Chip tone="neutral">Read only</Chip> : undefined}
          />
          <CardBody className="divide-y divide-line">
            {WEEKDAYS.map((day) => (
              <div key={day} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3 first:pt-1 last:pb-1">
                <span className="w-24 text-sm font-bold text-ink">{dayLabel(day)}</span>
                <label className="inline-flex items-center gap-2 text-[13px] text-ink-muted">
                  <Checkbox name={`${day}_closed`} defaultChecked={hours[day] === null} disabled={disabled} />
                  Closed
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    name={`${day}_open`}
                    defaultValue={hours[day]?.open ?? '09:00'}
                    disabled={disabled}
                    aria-label={`${dayLabel(day)} opening time`}
                    className="w-32"
                  />
                  <span className="text-ink-muted">–</span>
                  <Input
                    type="time"
                    name={`${day}_close`}
                    defaultValue={hours[day]?.close ?? '18:00'}
                    disabled={disabled}
                    aria-label={`${dayLabel(day)} closing time`}
                    className="w-32"
                  />
                </div>
              </div>
            ))}
          </CardBody>
          {editable ? (
            <CardFooter>
              <Button type="submit">Save business hours</Button>
            </CardFooter>
          ) : null}
        </Card>
      </form>

      <form action={saveZonesAction}>
        <Card>
          <CardHeader
            title="Delivery zones"
            description="Checkout offers these zones and adds the courier fee to the order. Leave a row blank to drop it."
          />
          <CardBody className="space-y-5">
            {zoneRows.map((zone, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-line bg-surface-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="lg:col-span-2">
                  <FieldLabel htmlFor={`zone-name-${index}`}>Zone {index + 1}</FieldLabel>
                  <Input
                    id={`zone-name-${index}`}
                    name={`zone_name_${index}`}
                    defaultValue={zone?.name ?? ''}
                    placeholder={index === 0 ? 'Boston & Cambridge' : 'Optional zone'}
                    disabled={disabled}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor={`zone-courier-${index}`}>Courier</FieldLabel>
                  <Input
                    id={`zone-courier-${index}`}
                    name={`zone_courier_${index}`}
                    defaultValue={zone?.courier ?? ''}
                    placeholder="UPS Ground"
                    disabled={disabled}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor={`zone-eta-${index}`}>ETA (business days)</FieldLabel>
                  <Input
                    id={`zone-eta-${index}`}
                    name={`zone_eta_${index}`}
                    type="number"
                    min={0}
                    max={14}
                    step={1}
                    defaultValue={zone?.etaDays ?? ''}
                    placeholder="1"
                    disabled={disabled}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel htmlFor={`zone-fee-${index}`}>Fee ($)</FieldLabel>
                    <Input
                      id={`zone-fee-${index}`}
                      name={`zone_fee_${index}`}
                      inputMode="decimal"
                      defaultValue={zone ? moneyInputValue(zone.fee) : ''}
                      placeholder="0"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`zone-cutoff-${index}`}>Cutoff</FieldLabel>
                    <Input
                      id={`zone-cutoff-${index}`}
                      name={`zone_cutoff_${index}`}
                      type="time"
                      defaultValue={zone?.cutoff ?? '14:00'}
                      disabled={disabled}
                    />
                  </div>
                </div>
              </div>
            ))}
            <FieldHint>
              The cutoff is the latest studio time a dispatch can still catch the courier — checkout shows it next to the
              zone.
            </FieldHint>
          </CardBody>
          {editable ? (
            <CardFooter>
              <Button type="submit">Save delivery zones</Button>
            </CardFooter>
          ) : null}
        </Card>
      </form>
    </div>
  )
}
