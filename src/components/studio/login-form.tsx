'use client'

import { useActionState } from 'react'
import { KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { FieldError, FieldHint, FieldLabel, Input } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { setPasswordAction, signInAction, verifyEnrollmentAction, verifyTwoFactorAction } from '@/app/studio/login/actions'
import { initialSignInState } from '@/app/studio/login/state'

export function LoginForm({ reason }: { reason?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initialSignInState)
  const [passwordState, passwordAction, passwordPending] = useActionState(setPasswordAction, initialSignInState)
  const [enrollState, enrollAction, enrollPending] = useActionState(verifyEnrollmentAction, initialSignInState)
  const [codeState, codeAction, codePending] = useActionState(verifyTwoFactorAction, initialSignInState)

  // Every stage keeps its own action state, and the screen follows whichever
  // stage most recently moved the flow — setPasswordAction, for instance,
  // hands off straight to enrollment by returning that step.
  const view =
    codeState.step !== 'credentials'
      ? codeState
      : enrollState.step !== 'credentials'
        ? enrollState
        : passwordState.step !== 'credentials'
          ? passwordState
          : state

  // Step 2 on an invited or production account: pick a password.
  if (view.step === 'password') {
    return (
      <form action={passwordAction} className="space-y-5">
        <div className="space-y-1.5 text-center">
          <Chip tone="gold">Welcome</Chip>
          <p className="pt-2 text-sm leading-relaxed text-ink-muted">
            Before you go further, choose your own password for{' '}
            <span className="font-bold text-ink">{view.email}</span>.
          </p>
        </div>
        <div>
          <FieldLabel htmlFor="new-password">New password</FieldLabel>
          <Input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 10 characters"
            autoFocus
            required
          />
          <FieldHint>A letter and a number, at least 10 characters.</FieldHint>
        </div>
        <div>
          <FieldLabel htmlFor="confirm-password">Repeat password</FieldLabel>
          <Input id="confirm-password" name="confirm" type="password" autoComplete="new-password" required />
          <FieldError>{passwordState.error}</FieldError>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={passwordPending}>
          {passwordPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LockKeyhole className="size-4" aria-hidden />}
          Save password and continue
        </Button>
      </form>
    )
  }

  // Step 3 when the Owner requires it: enroll an authenticator app.
  if (view.step === 'enroll') {
    return (
      <form action={enrollAction} className="space-y-5">
        <div className="space-y-1.5 text-center">
          <Chip tone="gold">Two-factor</Chip>
          <p className="pt-2 text-sm leading-relaxed text-ink-muted">
            This studio requires a second factor for <span className="font-bold text-ink">{view.email}</span>. Scan the
            code with any authenticator app, then enter the six-digit number it shows.
          </p>
        </div>

        {view.qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data-URL QR is not an optimizable asset
          <img
            src={view.qrDataUrl}
            alt="Two-factor enrollment QR code"
            width={232}
            height={232}
            className="mx-auto rounded-xl border border-line bg-white p-2"
          />
        ) : null}

        {view.totpKey ? (
          <p className="text-center text-[13px] leading-relaxed text-ink-muted">
            Can’t scan? Type this key into the app:{' '}
            <span className="font-mono font-bold tracking-wide text-ink break-all">{view.totpKey}</span>
          </p>
        ) : null}

        <div>
          <FieldLabel htmlFor="enroll-code">Six-digit code</FieldLabel>
          <Input
            id="enroll-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000 000"
            autoFocus
            required
            className="text-center font-sans text-lg tracking-[0.4em]"
          />
          <FieldError>{enrollState.error}</FieldError>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={enrollPending}>
          {enrollPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
          Turn on two-factor and sign in
        </Button>
      </form>
    )
  }

  // Step 3 on later sign-ins: verify the rotated code.
  if (view.step === 'code') {
    return (
      <form action={codeAction} className="space-y-5">
        <div className="space-y-1.5 text-center">
          <Chip tone="gold">Two-factor</Chip>
          <p className="pt-2 text-sm leading-relaxed text-ink-muted">
            Enter the six-digit code from the authenticator app for <span className="font-bold text-ink">{view.email}</span>.
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
