import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { requireCapability } from '@/lib/auth/guards'
import { DressForm } from '../dress-form'
import { createDressAction } from '../actions'

export const metadata: Metadata = { title: 'Add a dress' }
export const dynamic = 'force-dynamic'

export default async function NewDressPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await requireCapability('inventory.manage')
  const { error } = await searchParams

  return (
    <div className="space-y-6">
      <Link
        href="/studio/inventory"
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
        All inventory
      </Link>

      <PageHeader
        title="Add a dress"
        description="A new piece for the rack. Its calendar, pricing and care notes go live the moment you save."
      />

      {error ? (
        <div role="alert" className="rounded-xl border border-danger-line bg-surface px-4 py-3 text-sm font-bold text-danger-ink">
          {error}
        </div>
      ) : null}

      <DressForm action={createDressAction} submitLabel="Add to the wardrobe" cancelHref="/studio/inventory" />
    </div>
  )
}
