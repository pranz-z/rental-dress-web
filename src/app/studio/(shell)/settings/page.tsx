import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Clock, Mail, Percent, Truck, Users } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { requireCapability } from '@/lib/auth/guards'
import { businessHoursSummary, parseBusinessHours } from '@/lib/business-hours'
import { prisma } from '@/lib/db'
import { parseDeliveryZones } from '@/lib/delivery'
import { can } from '@/lib/domain'
import { EDITABLE_EMAIL_KINDS } from '@/lib/email/templates'
import { formatMoney } from '@/lib/money'

export const metadata: Metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-bold text-ink">{value}</dd>
    </div>
  )
}

export default async function SettingsOverviewPage() {
  const staff = await requireCapability('settings.view')

  const [settings, activeStaff, activeOwners, templateRows] = await Promise.all([
    prisma.studioSettings.findUniqueOrThrow({ where: { id: 'studio' } }),
    prisma.staffUser.count({ where: { active: true } }),
    prisma.staffUser.count({ where: { active: true, role: 'OWNER' } }),
    prisma.notificationTemplate.findMany({ where: { channel: 'EMAIL', active: true }, select: { id: true } }),
  ])

  const hours = parseBusinessHours(settings.businessHours)
  const zones = parseDeliveryZones(settings.deliveryZones)
  const editableKinds = new Set<string>(EDITABLE_EMAIL_KINDS)
  const customizedTemplates = templateRows.filter((row) => editableKinds.has(row.id)).length

  const editRules = can(staff.role, 'settings.policies')
  const manageStaff = can(staff.role, 'settings.staff')
  const editTemplates = can(staff.role, 'settings.templates')

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Rental rules"
          description="Percent-based prices, fees and cancellation policy — read by the storefront and the studio."
          action={
            <Link
              href="/studio/settings/rental-rules"
              className="inline-flex items-center gap-1 text-[13px] font-bold text-ink-muted transition-colors hover:text-ink"
            >
              {editRules ? 'Edit' : 'View'}
              <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
            </Link>
          }
        />
        <CardBody>
          <dl className="divide-y divide-line">
            <Row label="4-day rental" value={`${settings.rentalPercent4}% of retail value`} />
            <Row label="8-day rental" value={`${settings.rentalPercent8}% of retail value`} />
            <Row label="Refundable deposit" value={`${settings.depositPercent}% of retail value`} />
            <Row label="Daily extension fee" value={`${formatMoney(settings.extensionFeePerDay)} per extra day`} />
            <Row
              label="Late fee"
              value={`${formatMoney(settings.lateFeePerDay)} per day after ${settings.lateGraceDays} grace ${
                settings.lateGraceDays === 1 ? 'day' : 'days'
              }`}
            />
            <Row
              label="Cancellation"
              value={`Full refund ${settings.cancellationWindowDays}+ days out · ${settings.cancellationRefundPercent}% inside the window`}
            />
            <Row
              label="Booking confirmation"
              value={settings.autoConfirmBookings ? 'Confirmed automatically when paid' : 'Studio confirms each booking'}
            />
          </dl>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-muted">
            <Percent className="size-3.5" strokeWidth={1.75} aria-hidden />
            Prices follow the retail value of each piece — one change here moves the whole wardrobe.
          </p>
        </CardBody>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Hours & delivery"
            description="When the studio is open and how dresses reach customers."
            action={
              <Link
                href="/studio/settings/hours"
                className="inline-flex items-center gap-1 text-[13px] font-bold text-ink-muted transition-colors hover:text-ink"
              >
                {editRules ? 'Edit' : 'View'}
                <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
              </Link>
            }
          />
          <CardBody className="space-y-3">
            <p className="inline-flex items-start gap-2 text-sm text-ink">
              <Clock className="mt-0.5 size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden />
              <span>{businessHoursSummary(hours)}</span>
            </p>
            <p className="inline-flex items-start gap-2 text-sm text-ink">
              <Truck className="mt-0.5 size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden />
              <span>
                {zones.length} delivery {zones.length === 1 ? 'zone' : 'zones'} offered at checkout —{' '}
                {zones.map((zone) => zone.name).join(' · ')}
              </span>
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Email templates"
            description="The wording of every message customers receive."
            action={
              <Link
                href="/studio/settings/templates"
                className="inline-flex items-center gap-1 text-[13px] font-bold text-ink-muted transition-colors hover:text-ink"
              >
                {editTemplates ? 'Edit' : 'View'}
                <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
              </Link>
            }
          />
          <CardBody>
            <p className="inline-flex items-start gap-2 text-sm text-ink">
              <Mail className="mt-0.5 size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden />
              <span>
                {EDITABLE_EMAIL_KINDS.length} editable templates
                {customizedTemplates > 0
                  ? ` · ${customizedTemplates} customized from the factory copy`
                  : ' · all on the factory copy'}
              </span>
            </p>
          </CardBody>
        </Card>

        {manageStaff ? (
          <Card>
            <CardHeader
              title="Staff accounts"
              description="Invite, deactivate and set who needs a second factor."
              action={
                <Link
                  href="/studio/settings/staff"
                  className="inline-flex items-center gap-1 text-[13px] font-bold text-ink-muted transition-colors hover:text-ink"
                >
                  Manage
                  <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
                </Link>
              }
            />
            <CardBody>
              <p className="inline-flex items-center gap-2 text-sm text-ink">
                <Users className="size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden />
                {activeStaff} active {activeStaff === 1 ? 'account' : 'accounts'} · {activeOwners}{' '}
                {activeOwners === 1 ? 'Owner' : 'Owners'}
                {activeOwners === 1 ? <Chip tone="gold">Last Owner is protected</Chip> : null}
              </p>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
