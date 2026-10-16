import { Ban, CalendarPlus, PackageCheck, PackageOpen, PenLine, Truck } from 'lucide-react'
import type { ReactNode } from 'react'
import type { BookingStatus } from '@/lib/domain'
import { Button } from '@/components/ui/button'
import { FieldHint, FieldLabel, Input, Select, Textarea } from '@/components/ui/field'
import { EmptyState } from '@/components/ui/empty-state'
import {
  addBookingNoteAction,
  cancelBookingAction,
  confirmBookingAction,
  deliverBookingAction,
  extendBookingAction,
  returnBookingAction,
  shipBookingAction,
} from '@/app/studio/(shell)/bookings/actions'

export type BookingCapabilities = {
  confirm: boolean
  ship: boolean
  deliver: boolean
  return: boolean
  extend: boolean
  cancel: boolean
  note: boolean
}

const OUT_FOR_RENTAL: BookingStatus[] = ['SHIPPED', 'WITH_CUSTOMER', 'LATE']
const EXTENDABLE: BookingStatus[] = ['CONFIRMED', 'SHIPPED', 'WITH_CUSTOMER', 'LATE']

/** One labelled block inside the actions panel. */
function ActionBlock({
  title,
  children,
  description,
}: {
  title: ReactNode
  children: ReactNode
  description?: ReactNode
}) {
  return (
    <div className="border-b border-line px-5 py-4 last:border-b-0">
      <p className="text-sm font-bold text-ink">{title}</p>
      {description ? <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

export function BookingActions({
  bookingId,
  status,
  caps,
}: {
  bookingId: string
  status: BookingStatus
  caps: BookingCapabilities
}) {
  const nothingAvailable =
    !(caps.confirm && status === 'PENDING') &&
    !(caps.ship && status === 'CONFIRMED') &&
    !(caps.deliver && status === 'SHIPPED') &&
    !(caps.return && OUT_FOR_RENTAL.includes(status)) &&
    !(caps.extend && EXTENDABLE.includes(status)) &&
    !(caps.cancel && ['PENDING', 'CONFIRMED'].includes(status)) &&
    !caps.note

  if (nothingAvailable) {
    if (!caps.note && !caps.confirm && !caps.ship && !caps.return && !caps.extend && !caps.cancel) {
      return (
        <EmptyState
          icon={PenLine}
          title="Read-only access"
          description="Your role can review bookings but not change them. Ask a studio manager if something needs to move."
        />
      )
    }
    return (
      <EmptyState
        icon={PackageCheck}
        title="Nothing to do right now"
        description="The stage this booking is in has no actions left for your role."
      />
    )
  }

  return (
    <div>
      {caps.confirm && status === 'PENDING' ? (
        <ActionBlock
          title="Confirm booking"
          description="Checks availability once more, captures the payment on file, and reserves the dress."
        >
          <form action={confirmBookingAction}>
            <input type="hidden" name="bookingId" value={bookingId} />
            <Button type="submit" size="sm">
              <PackageCheck className="size-4" strokeWidth={1.75} aria-hidden />
              Confirm booking
            </Button>
          </form>
        </ActionBlock>
      ) : null}

      {caps.ship && status === 'CONFIRMED' ? (
        <ActionBlock title="Mark as shipped" description="Moves the dress out of the studio and onto the schedule.">
          <form action={shipBookingAction} className="flex w-full flex-wrap items-end gap-3">
            <input type="hidden" name="bookingId" value={bookingId} />
            <div className="w-40">
              <FieldLabel htmlFor="courier">Courier</FieldLabel>
              <Select id="courier" name="courier" defaultValue="UPS" required>
                <option value="UPS">UPS</option>
                <option value="FedEx">FedEx</option>
                <option value="USPS">USPS</option>
                <option value="DHL Express">DHL Express</option>
              </Select>
            </div>
            <div className="w-56 flex-1">
              <FieldLabel htmlFor="trackingNumber">Tracking number</FieldLabel>
              <Input id="trackingNumber" name="trackingNumber" placeholder="1Z999AA10123456784" />
            </div>
            <Button type="submit" size="sm">
              <Truck className="size-4" strokeWidth={1.75} aria-hidden />
              Mark as shipped
            </Button>
          </form>
        </ActionBlock>
      ) : null}

      {caps.deliver && status === 'SHIPPED' ? (
        <ActionBlock title="Mark as delivered" description="Records that the parcel reached the customer.">
          <form action={deliverBookingAction}>
            <input type="hidden" name="bookingId" value={bookingId} />
            <Button type="submit" size="sm" variant="secondary">
              <PackageCheck className="size-4" strokeWidth={1.75} aria-hidden />
              Mark delivered
            </Button>
          </form>
        </ActionBlock>
      ) : null}

      {caps.return && OUT_FOR_RENTAL.includes(status) ? (
        <ActionBlock
          title="Mark as returned"
          description="Books the dress back in — it moves to cleaning and inspection automatically. Late fees are applied if the return is overdue."
        >
          <form action={returnBookingAction} className="w-full">
            <input type="hidden" name="bookingId" value={bookingId} />
            <div className="w-full max-w-md">
              <FieldLabel htmlFor="conditionNote">Condition note (optional)</FieldLabel>
              <Textarea id="conditionNote" name="conditionNote" rows={2} placeholder="Any marks, missing pieces or fit notes from this rental." />
            </div>
            <div className="mt-3">
              <Button type="submit" size="sm">
                <PackageOpen className="size-4" strokeWidth={1.75} aria-hidden />
                Mark as returned
              </Button>
            </div>
          </form>
        </ActionBlock>
      ) : null}

      {caps.extend && EXTENDABLE.includes(status) ? (
        <ActionBlock
          title="Extend rental"
          description="Availability is checked for the new window before anything is charged."
        >
          <form action={extendBookingAction} className="flex w-full flex-wrap items-end gap-3">
            <input type="hidden" name="bookingId" value={bookingId} />
            <div className="w-36">
              <FieldLabel htmlFor="extraDays">Additional days</FieldLabel>
              <Select id="extraDays" name="extraDays" defaultValue="2" required>
                {[1, 2, 3, 4, 5, 7, 14].map((days) => (
                  <option key={days} value={days}>
                    {days} day{days === 1 ? '' : 's'}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-56 flex-1">
              <FieldLabel htmlFor="extendNote">Note (optional)</FieldLabel>
              <Input id="extendNote" name="note" placeholder="Customer requested a longer stay" />
            </div>
            <Button type="submit" size="sm" variant="secondary">
              <CalendarPlus className="size-4" strokeWidth={1.75} aria-hidden />
              Extend
            </Button>
          </form>
          <FieldHint className="w-full">
            The extension is charged at the booking’s daily rate and recorded on the timeline.
          </FieldHint>
        </ActionBlock>
      ) : null}

      {caps.cancel && ['PENDING', 'CONFIRMED'].includes(status) ? (
        <ActionBlock
          title="Cancel and refund"
          description="Refunds follow the studio’s cancellation policy — full within the free window, 50% inside it. The deposit is released either way."
        >
          <form action={cancelBookingAction} className="flex w-full flex-wrap items-end gap-3">
            <input type="hidden" name="bookingId" value={bookingId} />
            <div className="w-64 flex-1">
              <FieldLabel htmlFor="reason">Reason (optional, kept internal)</FieldLabel>
              <Input id="reason" name="reason" placeholder="Customer’s event was rescheduled" />
            </div>
            <Button type="submit" size="sm" variant="danger">
              <Ban className="size-4" strokeWidth={1.75} aria-hidden />
              Cancel booking
            </Button>
          </form>
        </ActionBlock>
      ) : null}

      {caps.note ? (
        <ActionBlock title="Add internal note" description="Notes stay inside the studio and appear on the timeline.">
          <form action={addBookingNoteAction} className="w-full">
            <input type="hidden" name="bookingId" value={bookingId} />
            <div className="w-full max-w-xl">
              <FieldLabel htmlFor="body">Note</FieldLabel>
              <Textarea id="body" name="body" rows={3} placeholder="Called the customer about the pickup window…" required />
            </div>
            <div className="mt-3">
              <Button type="submit" size="sm" variant="secondary">
                <PenLine className="size-4" strokeWidth={1.75} aria-hidden />
                Save note
              </Button>
            </div>
          </form>
        </ActionBlock>
      ) : null}
    </div>
  )
}
