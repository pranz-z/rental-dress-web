'use client'

/**
 * Guided single-page checkout.
 *
 * Three steps — details, add-ons, payment — on one page with a progress
 * indicator, so nothing hides behind a wizard. The summary column recomputes
 * live; the server re-prices everything again when the order is placed.
 */
import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, CreditCard, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { placeOrderAction } from './actions'
import { IDLE_CHECKOUT, type CheckoutAddOn, type CheckoutFees, type CheckoutLine, type CheckoutZone } from './state'
import { FieldLabel, Input, Textarea } from '@/components/ui/field'
import { formatMoney } from '@/lib/money'
import { formatWeekday } from '@/lib/dates'
import { cn } from '@/lib/cn'
import { StripePaymentPanel } from './stripe-payment-panel'

type Prefill = {
  name: string
  email: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  region: string
  postalCode: string
  country: string
}

function StepHeading({ step, title, copy, done }: { step: number; title: string; copy: string; done?: boolean }) {
  return (
    <div className="flex items-start gap-3.5">
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full border font-serif text-sm',
          done ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface text-ink-muted',
        )}
        aria-hidden
      >
        {done ? <Check className="size-4" strokeWidth={2.5} /> : step}
      </span>
      <div>
        <h2 className="font-serif text-2xl leading-tight text-ink">{title}</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">{copy}</p>
      </div>
    </div>
  )
}

export function CheckoutForm({
  lines,
  accessories,
  fees,
  zones,
  prefill,
  stripeMode,
  publishableKey,
}: {
  lines: CheckoutLine[]
  accessories: CheckoutAddOn[]
  fees: CheckoutFees
  zones: CheckoutZone[]
  prefill: Prefill | null
  stripeMode: boolean
  publishableKey: string | null
}) {
  const [state, formAction, pending] = useActionState(placeOrderAction, IDLE_CHECKOUT)
  const [insurance, setInsurance] = useState<Set<number>>(new Set())
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [express, setExpress] = useState(false)
  const [pickup, setPickup] = useState(false)
  const [zone, setZone] = useState(zones[0]?.name ?? '')

  const totals = useMemo(() => {
    let rental = 0
    let addOns = 0
    let insuranceTotal = 0
    let deposit = 0
    for (const line of lines) {
      rental += line.price
      deposit += line.deposit
      if (line.backupSize) addOns += fees.backupPerLine
      if (insurance.has(line.index)) insuranceTotal += fees.insurance
      for (const accessory of accessories) {
        if (chosen.has(`${line.index}-${accessory.id}`)) addOns += accessory.price
      }
    }
    if (express) addOns += fees.express * lines.length
    if (pickup) addOns += fees.pickup * lines.length
    const delivery = zones.find((candidate) => candidate.name === zone)?.fee ?? 0
    return { rental, addOns, insuranceTotal, deposit, delivery, total: rental + addOns + insuranceTotal + delivery }
  }, [lines, accessories, fees, zones, insurance, chosen, express, pickup, zone])

  if (state.status === 'ok' && state.stripe) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <p className="text-[11px] font-bold tracking-[0.2em] text-gold-ink uppercase">Step three</p>
          <h2 className="mt-1.5 font-serif text-3xl text-ink">Confirm the payment</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Your reservation is held. {state.stripe.intents.length === 1 ? 'A secure card form' : 'Secure card forms'} from Stripe confirm the
            authorization — nothing is captured until the studio confirms.
          </p>
          <div className="mt-6">
            <StripePaymentPanel intents={state.stripe.intents} publishableKey={publishableKey} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {lines.map((line) => (
        <input key={line.index} type="hidden" name={`line-${line.index}`} value={line.dressId} />
      ))}

      <div className="space-y-10">
        {/* progress */}
        <ol aria-label="Checkout steps" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-bold text-ink-muted">
          {['Your details', 'Delivery and add-ons', 'Payment'].map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn('grid size-6 place-items-center rounded-full border font-serif text-xs', index === 0 ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong')}
                aria-hidden
              >
                {index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>

        {/* one — details */}
        <section aria-labelledby="checkout-details" className="space-y-5">
          <StepHeading step={1} title="Who is wearing it" copy="Where should the box arrive, and how does the studio reach you?" done={Boolean(prefill)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="co-name">Full name</FieldLabel>
              <Input id="co-name" name="name" defaultValue={prefill?.name ?? ''} required minLength={2} maxLength={120} autoComplete="name" />
            </div>
            <div>
              <FieldLabel htmlFor="co-email">Email</FieldLabel>
              <Input id="co-email" name="email" type="email" defaultValue={prefill?.email ?? ''} required autoComplete="email" />
            </div>
            <div>
              <FieldLabel htmlFor="co-phone">Phone (optional)</FieldLabel>
              <Input id="co-phone" name="phone" type="tel" defaultValue={prefill?.phone ?? ''} autoComplete="tel" />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="co-address1">Street address</FieldLabel>
              <Input id="co-address1" name="addressLine1" defaultValue={prefill?.addressLine1 ?? ''} required autoComplete="address-line1" />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="co-address2">Apartment, floor, delivery notes (optional)</FieldLabel>
              <Input id="co-address2" name="addressLine2" defaultValue={prefill?.addressLine2 ?? ''} autoComplete="address-line2" />
            </div>
            <div>
              <FieldLabel htmlFor="co-city">City</FieldLabel>
              <Input id="co-city" name="city" defaultValue={prefill?.city ?? ''} required autoComplete="address-level2" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="co-region">State</FieldLabel>
                <Input id="co-region" name="region" defaultValue={prefill?.region ?? ''} required autoComplete="address-level1" />
              </div>
              <div>
                <FieldLabel htmlFor="co-zip">ZIP</FieldLabel>
                <Input id="co-zip" name="postalCode" defaultValue={prefill?.postalCode ?? ''} required autoComplete="postal-code" inputMode="numeric" />
              </div>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="co-country">Country</FieldLabel>
              <Input id="co-country" name="country" defaultValue={prefill?.country || 'United States'} required autoComplete="country-name" />
            </div>
          </div>
        </section>

        {/* two — dates + add-ons */}
        <section aria-labelledby="checkout-addons" className="space-y-6">
          <StepHeading step={2} title="Dates, and the little things" copy="Confirm the windows and choose anything that should ride along." done />

          <ul className="space-y-3">
            {lines.map((line) => (
              <li key={line.index} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-serif text-lg text-ink">
                    {line.name} <span className="text-sm text-ink-muted">· size {line.size}{line.backupSize ? ` (backup ${line.backupSize})` : ''}</span>
                  </p>
                  <p className="text-sm font-bold text-ink">{formatMoney(line.price)}</p>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                  Arrives {formatWeekday(line.deliveryDate)} · your event {formatWeekday(line.eventDate)} · due back {formatWeekday(line.returnDate)}
                </p>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-3 text-[13px]">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name={`insurance-${line.index}`}
                      checked={insurance.has(line.index)}
                      onChange={(event) => {
                        setInsurance((previous) => {
                          const next = new Set(previous)
                          if (event.target.checked) next.add(line.index)
                          else next.delete(line.index)
                          return next
                        })
                      }}
                      className="size-4 rounded-[5px] border-line-strong accent-[var(--accent)]"
                    />
                    <span className="text-ink">
                      Insurance <span className="text-ink-muted">— {formatMoney(fees.insurance)}</span>
                    </span>
                  </label>
                  {accessories.map((accessory) => {
                    const key = `${line.index}-${accessory.id}`
                    return (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name={`accessory-${line.index}-${accessory.id}`}
                          checked={chosen.has(key)}
                          onChange={(event) => {
                            setChosen((previous) => {
                              const next = new Set(previous)
                              if (event.target.checked) next.add(key)
                              else next.delete(key)
                              return next
                            })
                          }}
                          className="size-4 rounded-[5px] border-line-strong accent-[var(--accent)]"
                        />
                        <span className="text-ink">
                          {accessory.name} <span className="text-ink-muted">— {formatMoney(accessory.price)}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>

          {zones.length > 0 ? (
            <fieldset className="border-0 p-0">
              <legend className="mb-2 text-[11px] font-bold tracking-[0.1em] text-ink-muted uppercase">
                Where the box is going
              </legend>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {zones.map((candidate) => (
                  <label
                    key={candidate.name}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border bg-surface p-4 transition-colors',
                      zone === candidate.name ? 'border-line-strong shadow-soft' : 'border-line',
                    )}
                  >
                    <input
                      type="radio"
                      name="zone"
                      value={candidate.name}
                      checked={zone === candidate.name}
                      onChange={() => setZone(candidate.name)}
                      className="mt-0.5 size-4 accent-[var(--accent)]"
                      required
                    />
                    <span>
                      <span className="block text-sm font-bold text-ink">
                        {candidate.name}{' '}
                        <span className="font-normal text-ink-muted">
                          — {candidate.fee > 0 ? formatMoney(candidate.fee) : 'Included'}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                        {candidate.courier} · arrives in{' '}
                        {candidate.etaDays === 0
                          ? 'same day'
                          : candidate.etaDays === 1
                            ? 'a day'
                            : `${candidate.etaDays} business days`}{' '}
                        · dispatch cutoff {candidate.cutoffLabel}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <fieldset className="border-0 p-0">
            <legend className="mb-2 text-[11px] font-bold tracking-[0.1em] text-ink-muted uppercase">Delivery, if you would like a hand</legend>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
                <input
                  type="checkbox"
                  name="express"
                  checked={express}
                  onChange={(event) => setExpress(event.target.checked)}
                  className="mt-0.5 size-4 rounded-[5px] border-line-strong accent-[var(--accent)]"
                />
                <span>
                  <span className="block text-sm font-bold text-ink">
                    Express courier <span className="font-normal text-ink-muted">{formatMoney(fees.express)} per dress</span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                    Same-day dispatch and before-noon delivery within Boston and Cambridge.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
                <input
                  type="checkbox"
                  name="pickup"
                  checked={pickup}
                  onChange={(event) => setPickup(event.target.checked)}
                  className="mt-0.5 size-4 rounded-[5px] border-line-strong accent-[var(--accent)]"
                />
                <span>
                  <span className="block text-sm font-bold text-ink">
                    Return-day pickup <span className="font-normal text-ink-muted">{formatMoney(fees.pickup)} per dress</span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                    A courier collects the box from your address on the return date.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <div>
            <FieldLabel htmlFor="co-notes">Notes for the studio (optional)</FieldLabel>
            <Textarea
              id="co-notes"
              name="notes"
              rows={3}
              placeholder="Anything the studio should know — stairs at the delivery address, a fitting question, a surprise to keep quiet."
            />
          </div>
        </section>

        {/* three — payment */}
        <section aria-labelledby="checkout-payment" className="space-y-5">
          <StepHeading step={3} title="Payment" copy="An authorization now; the studio captures it when the reservation is confirmed." />

          {stripeMode ? (
            <p className="rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink-muted">
              Continuing takes you to Stripe&rsquo;s secure payment form — cards and wallets, whichever your device offers.
            </p>
          ) : (
            <div className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
                <CreditCard className="size-4 text-mulberry" strokeWidth={1.75} aria-hidden />
                Card details
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-normal text-ink-muted">
                  <Lock className="size-3.5" strokeWidth={2} aria-hidden /> Encrypted in transit · only the last four digits are kept
                </span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-[1.6fr_1fr_1fr]">
                <div>
                  <FieldLabel htmlFor="co-card">Card number</FieldLabel>
                  <Input id="co-card" name="cardNumber" required inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" maxLength={23} />
                </div>
                <div>
                  <FieldLabel htmlFor="co-expiry">Expiry</FieldLabel>
                  <Input id="co-expiry" name="cardExpiry" required autoComplete="cc-exp" placeholder="MM / YY" maxLength={7} />
                </div>
                <div>
                  <FieldLabel htmlFor="co-cvc">Security code</FieldLabel>
                  <Input id="co-cvc" name="cardCvc" required inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4} />
                </div>
              </div>
              <p className="mt-3.5 flex items-center gap-2 text-xs leading-relaxed text-ink-muted">
                <ShieldCheck className="size-4 shrink-0 text-gold-ink" strokeWidth={1.75} aria-hidden />
                The authorization holds the amount without charging it. If the studio cannot confirm your dates, it is released immediately.
              </p>
            </div>
          )}

          <label className="flex items-start gap-3 text-sm text-ink">
            <input type="checkbox" name="acceptTerms" required className="mt-0.5 size-4 rounded-[5px] border-line-strong accent-[var(--accent)]" />
            <span className="leading-relaxed">
              I have read and agree to the{' '}
              <Link href="/policies/rental-terms" className="font-bold text-mulberry hover:underline" target="_blank">
                rental terms
              </Link>{' '}
              — including what happens if a dress cannot be returned on time.
            </span>
          </label>

          {state.status === 'error' ? (
            <div role="alert" className="rounded-xl border border-danger-line bg-surface px-4 py-3.5 text-sm leading-relaxed text-danger-ink">
              <p className="font-bold">{state.message}</p>
              {state.suggestions && state.suggestions.length > 0 ? (
                <p className="mt-1.5 text-ink-muted">Try: {state.suggestions.join(', or ')}.</p>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-accent px-7 text-[15px] font-bold tracking-wide text-accent-ink shadow-soft transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-55 sm:w-auto"
          >
            {pending ? <Loader2 className="size-4.5 animate-spin" aria-hidden /> : <Lock className="size-4.5" strokeWidth={1.75} aria-hidden />}
            {stripeMode ? 'Continue to secure payment' : `Reserve and authorize ${formatMoney(totals.total)}`}
          </button>
        </section>
      </div>

      {/* summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-serif text-2xl text-ink">Your order</h2>
          <ul className="mt-4 space-y-3">
            {lines.map((line) => (
              <li key={line.index} className="flex justify-between gap-4 text-sm">
                <span className="text-ink-muted">
                  {line.name} · {line.rentalDays} days
                  {line.backupSize ? ` + backup ${line.backupSize}` : ''}
                </span>
                <span className="shrink-0 font-bold text-ink">{formatMoney(line.price)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-3.5 text-sm">
            {totals.addOns > 0 ? (
              <div className="flex justify-between">
                <dt className="text-ink-muted">Add-ons</dt>
                <dd className="text-ink">{formatMoney(totals.addOns)}</dd>
              </div>
            ) : null}
            {totals.insuranceTotal > 0 ? (
              <div className="flex justify-between">
                <dt className="text-ink-muted">Insurance</dt>
                <dd className="text-ink">{formatMoney(totals.insuranceTotal)}</dd>
              </div>
            ) : null}
            {totals.delivery > 0 ? (
              <div className="flex justify-between">
                <dt className="text-ink-muted">Delivery — {zone}</dt>
                <dd className="text-ink">{formatMoney(totals.delivery)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-line pt-2.5 text-base">
              <dt className="font-bold text-ink">Authorized today</dt>
              <dd className="font-bold text-ink">{formatMoney(totals.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Refundable deposit</dt>
              <dd className="text-ink-muted">{formatMoney(totals.deposit)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            Deposits are authorized but never captured unless something returns damaged. Cancel free up to{' '}
            {fees.cancellationWindowDays} days before delivery — inside the window, {fees.cancellationRefundPercent}% of
            the rental is refunded.
          </p>
          <ul className="mt-4 space-y-2 border-t border-line pt-3.5 text-xs leading-relaxed text-ink-muted">
            <li>Prepaid return label in every box.</li>
            <li>Cleaning and inspection included.</li>
            <li>Free exchanges while your dress is in transit.</li>
          </ul>
        </div>
      </aside>
    </form>
  )
}
