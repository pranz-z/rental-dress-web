import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, Search, SearchX, Shirt } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/table'
import { requireCapability } from '@/lib/auth/guards'
import { prisma } from '@/lib/db'
import { DRESS_STATUS_META, can, type DressStatus } from '@/lib/domain'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/cn'

export const metadata: Metadata = { title: 'Inventory' }
export const dynamic = 'force-dynamic'

const FILTER_STATUSES: DressStatus[] = ['AVAILABLE', 'RENTED', 'CLEANING', 'RETIRED']

function parseStatuses(raw: string | undefined): DressStatus[] {
  if (!raw) return []
  const wanted = new Set(raw.split(','))
  return FILTER_STATUSES.filter((status) => wanted.has(status))
}

function parseCategories(raw: string | undefined): string[] {
  if (!raw) return []
  return [...new Set(raw.split(',').map((part) => part.trim()).filter(Boolean))]
}

function inventoryHref(params: { q?: string; statuses?: DressStatus[]; categories?: string[] }): string {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.statuses && params.statuses.length > 0) search.set('status', params.statuses.join(','))
  if (params.categories && params.categories.length > 0) search.set('category', params.categories.join(','))
  const query = search.toString()
  return query ? `/studio/inventory?${query}` : '/studio/inventory'
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; category?: string }>
}) {
  const staff = await requireCapability('inventory.view')
  const showValues = can(staff.role, 'bookings.payments')
  const params = await searchParams
  const q = (params.q ?? '').trim()
  const statuses = parseStatuses(params.status)
  const categories = parseCategories(params.category)

  const searchFilter = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { designer: { contains: q, mode: 'insensitive' as const } },
          { category: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {}
  const statusFilter = statuses.length > 0 ? { status: { in: statuses } } : {}
  const categoryFilter = categories.length > 0 ? { category: { in: categories } } : {}

  const [statusCounts, categoryCounts, categoryTotals, totalAll, dresses] = await Promise.all([
    prisma.dress.groupBy({ by: ['status'], where: { ...searchFilter, ...categoryFilter }, _count: { _all: true } }),
    prisma.dress.groupBy({ by: ['category'], where: { ...searchFilter, ...statusFilter }, _count: { _all: true } }),
    prisma.dress.groupBy({ by: ['category'], _count: { _all: true } }),
    prisma.dress.count(),
    prisma.dress.findMany({
      where: { ...searchFilter, ...statusFilter, ...categoryFilter },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: { sizes: { orderBy: { position: 'asc' } } },
    }),
  ])

  const countsByStatus = new Map(statusCounts.map((row) => [row.status, row._count._all]))
  const countsByCategory = new Map(categoryCounts.map((row) => [row.category, row._count._all]))
  const allCategories = categoryTotals.map((row) => row.category).sort()
  const filtersActive = q.length > 0 || statuses.length > 0 || categories.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description={`${totalAll} pieces in the wardrobe — search by name, designer or category.`}
      >
        {can(staff.role, 'inventory.manage') ? (
          <ButtonLink href="/studio/inventory/new">
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            Add dress
          </ButtonLink>
        ) : null}
      </PageHeader>

      <div className="space-y-3.5">
        <form action="/studio/inventory" method="get" className="flex max-w-md items-center gap-2">
          {statuses.length > 0 ? <input type="hidden" name="status" value={statuses.join(',')} /> : null}
          {categories.length > 0 ? <input type="hidden" name="category" value={categories.join(',')} /> : null}
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted"
              strokeWidth={1.75}
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Valentina, Delacroix, Midi…"
              aria-label="Search the wardrobe"
              className="h-11 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
            />
          </div>
          <button
            type="submit"
            className="h-11 rounded-full bg-accent px-5 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={inventoryHref({ q })}
            className={cn(
              'chip transition-shadow',
              statuses.length === 0 && categories.length === 0
                ? 'ring-2 ring-accent/45 ring-offset-2 ring-offset-page'
                : 'hover:ring-2 hover:ring-accent/20',
            )}
          >
            All · {totalAll}
          </Link>
          {FILTER_STATUSES.map((status) => {
            const active = statuses.includes(status)
            const nextStatuses = active ? statuses.filter((s) => s !== status) : [...statuses, status]
            const meta = DRESS_STATUS_META[status]
            return (
              <Link
                key={status}
                href={inventoryHref({ q, statuses: nextStatuses, categories })}
                data-tone={meta.tone}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'chip transition-shadow',
                  active ? 'ring-2 ring-accent/45 ring-offset-2 ring-offset-page' : 'hover:ring-2 hover:ring-accent/20',
                )}
              >
                {meta.label} · {countsByStatus.get(status) ?? 0}
              </Link>
            )
          })}
        </div>

        {allCategories.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">Category</span>
            {allCategories.map((category) => {
              const active = categories.includes(category)
              const nextCategories = active ? categories.filter((c) => c !== category) : [...categories, category]
              return (
                <Link
                  key={category}
                  href={inventoryHref({ q, statuses, categories: nextCategories })}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'chip transition-shadow',
                    active ? 'ring-2 ring-accent/45 ring-offset-2 ring-offset-page' : 'hover:ring-2 hover:ring-accent/20',
                  )}
                >
                  {category} · {countsByCategory.get(category) ?? 0}
                </Link>
              )
            })}
            {filtersActive ? (
              <Link
                href="/studio/inventory"
                className="ml-1 text-[13px] font-bold text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                Clear
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
        {dresses.length === 0 ? (
          <EmptyState
            icon={filtersActive ? SearchX : Shirt}
            title={filtersActive ? 'No pieces match' : 'The rack is empty'}
            description={
              filtersActive
                ? 'Try a different name or category, or clear the filters.'
                : 'Add the first dress and it will appear here with its rental calendar.'
            }
            action={
              filtersActive ? (
                <Link href="/studio/inventory" className="text-sm font-bold text-accent underline-offset-4 hover:underline">
                  Clear filters
                </Link>
              ) : null
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Dress</Th>
                  <Th>Category</Th>
                  <Th>Sizes</Th>
                  <Th>Status</Th>
                  <Th>Times rented</Th>
                  {showValues ? <Th className="text-right">Retail value</Th> : null}
                </tr>
              </thead>
              <tbody>
                {dresses.map((dress) => {
                  const meta = DRESS_STATUS_META[dress.status]
                  const sizeLabel =
                    dress.sizes.length > 0
                      ? dress.sizes.map((row) => (row.quantity > 1 ? `${row.size} ×${row.quantity}` : row.size)).join(' · ')
                      : '—'
                  return (
                    <Tr key={dress.id} className="relative">
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span
                            aria-hidden
                            className="size-3 shrink-0 rounded-full border border-line-strong"
                            style={{ backgroundColor: dress.colorHex }}
                          />
                          <div className="min-w-0">
                            <Link
                              href={`/studio/inventory/${dress.id}`}
                              className="font-bold text-ink after:absolute after:inset-0 after:content-['']"
                            >
                              {dress.name}
                            </Link>
                            <p className="mt-0.5 text-xs text-ink-muted">
                              {[dress.designer, dress.color].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </div>
                      </Td>
                      <Td className="text-ink-muted">{dress.category}</Td>
                      <Td className="whitespace-nowrap text-ink">{sizeLabel}</Td>
                      <Td>
                        <Chip tone={meta.tone}>{meta.label}</Chip>
                      </Td>
                      <Td className="whitespace-nowrap text-ink">
                        <span className="font-bold tabular-nums">{dress.timesRented}</span>{' '}
                        <span className="text-ink-muted">{dress.timesRented === 1 ? 'rental' : 'rentals'}</span>
                      </Td>
                      {showValues ? (
                        <Td className="text-right font-bold tabular-nums text-ink">{formatMoney(dress.retailValue)}</Td>
                      ) : null}
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </div>
    </div>
  )
}
