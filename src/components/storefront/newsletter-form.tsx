'use client'

import { useActionState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { subscribeAction } from '@/app/(storefront)/actions'
import { IDLE_FORM } from '@/app/(storefront)/form-state'

/** Newsletter signup — one field, one confirmation line. */
export function NewsletterForm({ source = 'home', dark = false }: { source?: string; dark?: boolean }) {
  const [state, formAction, pending] = useActionState(subscribeAction, IDLE_FORM)

  return (
    <div>
      <form action={formAction} className="flex flex-col gap-2.5 sm:flex-row">
        <input type="hidden" name="source" value={source} />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <label htmlFor={`newsletter-${source}`} className="sr-only">
          Email address
        </label>
        <input
          id={`newsletter-${source}`}
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={
            dark
              ? 'h-11 w-full min-w-0 rounded-full border border-ivory/25 bg-ivory/10 px-4.5 text-sm text-ivory placeholder:text-ivory/50 focus:border-ivory/60 focus-visible:outline-none'
              : 'h-11 w-full min-w-0 rounded-full border border-line bg-surface px-4.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none'
          }
        />
        <button
          type="submit"
          disabled={pending}
          className={
            dark
              ? 'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-ivory px-5 text-sm font-bold text-charcoal transition-colors hover:bg-blush disabled:opacity-60'
              : 'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60'
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowRight className="size-4" strokeWidth={2} aria-hidden />}
          Join the list
        </button>
      </form>
      {state.status === 'ok' ? (
        <p role="status" className={dark ? 'mt-3 text-sm leading-relaxed text-blush' : 'mt-3 text-sm leading-relaxed text-ink-muted'}>
          {state.message}
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p role="alert" className={dark ? 'mt-3 text-sm font-bold text-rose' : 'mt-3 text-sm font-bold text-danger-ink'}>
          {state.message}
        </p>
      ) : null}
    </div>
  )
}
