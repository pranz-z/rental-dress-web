'use client'

/**
 * Stripe payment step.
 *
 * Only rendered when the studio's Stripe keys are configured. Stripe.js is
 * loaded from Stripe's CDN, one Payment Element is mounted per held booking,
 * and the customer confirms each authorization before the confirmation page
 * settles the ledger server-side (webhook or retrieve, whichever lands first).
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'
import type { StripeIntentSummary } from './state'

type StripeElements = {
  create: (type: 'payment') => { mount: (target: HTMLElement) => void }
  submit: () => Promise<{ error?: { message?: string } }>
}
type StripeInstance = {
  elements: (options: { clientSecret: string; appearance?: Record<string, unknown> }) => StripeElements
  confirmPayment: (options: {
    elements: StripeElements
    confirmParams: { return_url: string }
    redirect: 'if_required'
  }) => Promise<{ error?: { message?: string } }>
}

declare global {
  interface Window {
    Stripe?: (key: string) => StripeInstance
  }
}

function loadStripeJs(): Promise<(key: string) => StripeInstance> {
  if (window.Stripe) return Promise.resolve(window.Stripe)
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://js.stripe.com/v3/'
    script.async = true
    script.onload = () => (window.Stripe ? resolve(window.Stripe) : reject(new Error('Stripe.js loaded without Stripe')))
    script.onerror = () => reject(new Error('Stripe.js could not be loaded'))
    document.head.appendChild(script)
  })
}

export function StripePaymentPanel({ intents, publishableKey }: { intents: StripeIntentSummary[]; publishableKey: string | null }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const elementsRef = useRef<StripeElements[]>([])
  const stripeRef = useRef<StripeInstance | null>(null)
  const holders = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => {
    if (!publishableKey) {
      setError('Payments are not configured yet — the studio will email you a secure link to finish this reservation.')
      return
    }
    let cancelled = false
    loadStripeJs()
      .then(async (factory) => {
        if (cancelled) return
        const stripe = factory(publishableKey)
        stripeRef.current = stripe
        const created: StripeElements[] = []
        for (const [index, intent] of intents.entries()) {
          if (!intent.clientSecret) continue
          const elements = stripe.elements({
            clientSecret: intent.clientSecret,
            appearance: { variables: { colorPrimary: '#7a3e4d', fontFamily: 'Lato, sans-serif', borderRadius: '10px' } },
          })
          const payment = elements.create('payment')
          const holder = holders.current[index]
          if (holder) payment.mount(holder)
          created.push(elements)
        }
        elementsRef.current = created
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setError('The secure payment form could not start — the studio will email you a link to finish this reservation.')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishableKey])

  async function confirm() {
    const stripe = stripeRef.current
    if (!stripe) return
    setConfirming(true)
    setError(null)
    try {
      for (const elements of elementsRef.current) {
        const result = await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: `${window.location.origin}/checkout/confirmation` },
          redirect: 'if_required',
        })
        if (result.error) {
          setError(result.error.message ?? 'The payment could not be confirmed — try another card.')
          setConfirming(false)
          return
        }
      }
      router.push('/checkout/confirmation')
    } catch {
      setError('The payment could not be confirmed — the studio has your reservation and will reach out.')
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-5">
      {intents.map((intent, index) => (
        <div key={intent.bookingId} className="rounded-xl border border-line bg-surface p-4">
          <p className="text-[13px] font-bold text-ink">
            {intent.bookingId} <span className="font-normal text-ink-muted">— authorization</span>
          </p>
          <div
            ref={(node) => {
              holders.current[index] = node
            }}
            className="mt-3 min-h-[52px]"
          />
        </div>
      ))}

      {error ? (
        <p role="alert" className="rounded-xl border border-danger-line bg-surface px-4 py-3 text-sm font-bold text-danger-ink">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={confirm}
        disabled={!ready || confirming}
        className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-accent px-7 text-[15px] font-bold tracking-wide text-accent-ink shadow-soft transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-55"
      >
        {confirming || !ready ? <Loader2 className="size-4.5 animate-spin" aria-hidden /> : <Lock className="size-4.5" strokeWidth={1.75} aria-hidden />}
        Confirm payment
      </button>
    </div>
  )
}
