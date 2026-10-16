import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentCustomer } from '@/lib/storefront/session'
import { MagicLinkForm, PasswordSignInForm } from '@/components/storefront/sign-in-forms'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Maison Rêve account to track rentals, keep measurements and save favorites.',
  robots: { index: false },
}

function safeNext(next: string | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams
  const next = safeNext(params.next)

  const customer = await currentCustomer()
  if (customer) redirect(next)

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-14 sm:px-6">
      <p className="text-[11px] font-bold tracking-[0.2em] text-gold-ink uppercase">Your account</p>
      <h1 className="mt-2 font-serif text-4xl leading-tight text-ink">Welcome back</h1>
      <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">
        Your rentals, tracking, saved measurements and event lists live here — one account, shared with the studio so everything stays in step.
      </p>

      {params.error === 'expired' ? (
        <p role="alert" className="mt-5 rounded-lg border border-gold/60 bg-gold/10 px-3.5 py-3 text-[13px] leading-relaxed text-ink">
          That sign-in link has expired or was already used. Request a fresh one below — they are good for twenty minutes.
        </p>
      ) : null}

      <div className="mt-7 rounded-2xl border border-line bg-surface p-6">
        <PasswordSignInForm next={next} />
      </div>

      <div className="mt-6 flex items-center gap-4 text-[11px] font-bold tracking-[0.2em] text-ink-muted uppercase">
        <span className="h-px flex-1 bg-line" aria-hidden />
        or
        <span className="h-px flex-1 bg-line" aria-hidden />
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-serif text-xl text-ink">No password needed</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          We will email you a link that signs you in on this device.
        </p>
        <div className="mt-4">
          <MagicLinkForm next={next} />
        </div>
      </div>

      <p className="mt-6 text-center text-[13px] leading-relaxed text-ink-muted">
        Booking as a guest? You can still reserve anything you like —{' '}
        <Link href="/shop" className="font-bold text-mulberry hover:underline">
          browse the collection
        </Link>
        .
      </p>
    </div>
  )
}
