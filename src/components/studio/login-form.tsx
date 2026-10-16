'use client'

import { useActionState } from 'react'
import { KeyRound, Loader2, LockKeyhole, Mail } from 'lucide-react'
import { FieldError, FieldLabel, Input } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { signInAction, verifyTwoFactorAction } from '@/app/studio/login/actions'
import { initialSignInState } from '@/app/studio/login/state'

export function LoginForm({ reason }: { reason?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initialSignInState)
  const [codeState, codeAction, codePending] = useActionState(verifyTwoFactorAction, initialSignInState)

  if (state.step === 'code') {
    return (
      <form action={codeAction} className="space-y-5">
        <div className="space-y-1.5 text-center">
          <Chip tone="gold">Two-factor</Chip>
          <p className="pt-2 text-sm leading-relaxed text-ink-muted">
            Enter the six-digit code from the authenticator app for <span className="font-bold text-ink">{state.email}</span>.
          </p>
        </div>
        <div>
          <FieldLabel htmlFor="code">Verification code</FieldLabel>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000 000"
            autoFocus
            required
            className="text-center font-sans text-lg tracking-[0.4em]"
          />
          <FieldError>{codeState.error}</FieldError>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={codePending}>
          {codePending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
          Verify and continue
        </Button>
      </form>
    )
  }

  return (
    <form action={formAction} className="space-y-5">
      {reason === 'timeout' ? (
        <p className="rounded-lg border border-line bg-surface-muted px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-muted">
          The studio signs out after 30 minutes of inactivity. Sign in again to pick up where you left off.
        </p>
      ) : null}

      <div>
        <FieldLabel htmlFor="email">Studio email</FieldLabel>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.75} aria-hidden />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@maisonreve.com"
            defaultValue={state.email ?? ''}
            required
            className="pl-10"
          />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="password">Password</FieldLabel>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.75} aria-hidden />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            className="pl-10"
          />
        </div>
        <FieldError>{state.error}</FieldError>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Sign in to the studio
      </Button>
    </form>
  )
}
