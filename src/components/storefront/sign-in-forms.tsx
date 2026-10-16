'use client'

/**
 * Two ways in, one quiet page: password for regulars, a sign-in link for
 * everyone else. Both report back inline; nothing reveals whether an email is
 * in the studio's book.
 */
import { useActionState } from 'react'
import { KeyRound, Loader2, MailCheck } from 'lucide-react'
import { requestMagicLinkAction, signInAction } from '@/app/(storefront)/account/actions'
import { IDLE_FORM } from '@/app/(storefront)/form-state'
import { FieldLabel, Input } from '@/components/ui/field'

function useSignIn(next: string) {
  const [passwordState, passwordAction, passwordPending] = useActionState(signInAction, IDLE_FORM)
  const [linkState, linkAction, linkPending] = useActionState(requestMagicLinkAction, IDLE_FORM)
  return { next, passwordState, passwordAction, passwordPending, linkState, linkAction, linkPending }
}

export function ClockField() {
  return <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
}

export function PasswordSignInForm({ next }: { next: string }) {
  const { passwordState, passwordAction, passwordPending } = useSignIn(next)
  return (
    <form action={passwordAction} className="space-y-4">
      <ClockField />
      <input type="hidden" name="next" value={next} />
      <div>
        <FieldLabel htmlFor="signin-email">Email</FieldLabel>
        <Input id="signin-email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      </div>
      <div>
        <FieldLabel htmlFor="signin-password">Password</FieldLabel>
        <Input id="signin-password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {passwordState.status === 'error' ? (
        <p role="alert" className="text-xs font-bold text-danger-ink">
          {passwordState.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={passwordPending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-bold text-accent-ink shadow-soft transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {passwordPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" strokeWidth={1.75} aria-hidden />}
        Sign in
      </button>
    </form>
  )
}

export function MagicLinkForm({ next }: { next: string }) {
  const { linkState, linkAction, linkPending } = useSignIn(next)
  return (
    <form action={linkAction} className="space-y-4">
      <ClockField />
      <input type="hidden" name="next" value={next} />
      <div>
        <FieldLabel htmlFor="magic-email">Email</FieldLabel>
        <Input id="magic-email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      </div>
      {linkState.status === 'ok' ? (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-line bg-surface-muted/60 px-3.5 py-3 text-[13px] leading-relaxed text-ink">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-mulberry" strokeWidth={1.75} aria-hidden />
          {linkState.message}
        </p>
      ) : null}
      {linkState.status === 'error' ? (
        <p role="alert" className="text-xs font-bold text-danger-ink">
          {linkState.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={linkPending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line-strong bg-surface text-[15px] font-bold text-ink transition-colors hover:border-rose hover:text-mulberry disabled:opacity-60"
      >
        {linkPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MailCheck className="size-4" strokeWidth={1.75} aria-hidden />}
        Email me a sign-in link
      </button>
    </form>
  )
}
