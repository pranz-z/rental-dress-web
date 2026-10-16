import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { requireCapability } from '@/lib/auth/guards'
import { prisma } from '@/lib/db'
import { moneyInputValue } from '@/lib/inventory'
import { DressForm } from '../../dress-form'
import { updateDressAction } from '../../actions'

export const metadata: Metadata = { title: 'Edit dress' }
export const dynamic = 'force-dynamic'

export default async function EditDressPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  await requireCapability('inventory.manage')
  const { id } = await params
  const { error } = await searchParams

  const dress = await prisma.dress.findUnique({
    where: { id },
    include: { sizes: { orderBy: { position: 'asc' } } },
  })
  if (!dress) notFound()

  return (
    <div className="space-y-6">
      <Link
        href={`/studio/inventory/${dress.id}`}
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
        {dress.name}
      </Link>

      <PageHeader
        title={`Edit ${dress.name}`}
        description="Changes land in the audit trail and update availability across the studio immediately."
      />

      {error ? (
        <div role="alert" className="rounded-xl border border-danger-line bg-surface px-4 py-3 text-sm font-bold text-danger-ink">
          {error}
        </div>
      ) : null}

      <DressForm
        action={updateDressAction}
        dressId={dress.id}
        submitLabel="Save changes"
        cancelHref={`/studio/inventory/${dress.id}`}
        values={{
          name: dress.name,
          designer: dress.designer,
          category: dress.category,
          color: dress.color,
          colorHex: dress.colorHex,
          sizes: dress.sizes.map((row) => row.size).join(', '),
          occasion: dress.occasion,
          fabric: dress.fabric,
          length: dress.length,
          neckline: dress.neckline,
          sleeve: dress.sleeve,
          retailValue: moneyInputValue(dress.retailValue),
          careNotes: dress.careNotes,
          fitNotes: dress.fitNotes,
        }}
      />
    </div>
  )
}
