import type { Metadata } from 'next'
import { LoginForm } from '@/components/studio/login-form'

export const metadata: Metadata = { title: 'Studio sign in' }

export default async function StudioLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams

  return (
    <main className="grid min-h-dvh place-items-center bg-page px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-64"
        style={{ background: 'radial-gradient(60% 100% at 50% 0%, var(--color-blush) 0%, transparent 70%)', opacity: 0.55 }}
      />
      <div className="relative w-full max-w-[420px]">
        <div className="text-center">
          <p className="font-serif text-[34px] leading-none tracking-tight text-ink">Maison Rêve</p>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.22em] text-gold-ink">Private studio</p>
        </div>

        <div className="mt-7 rounded-xl border border-line bg-surface p-6 shadow-soft sm:p-7">
          <LoginForm reason={reason} />
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-ink-muted">
          Staff access only. Need an account? Ask the studio owner to add you under Settings → Staff.
        </p>
      </div>
    </main>
  )
}
