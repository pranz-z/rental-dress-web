import type { Metadata } from 'next'
import Link from 'next/link'
import { Search, SearchX, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/table'
import { requireCapability } from '@/lib/auth/guards'
import { prisma } from '@/lib/db'
import { CUSTOMER_TIERS, TIER_META, can, type CustomerTier } from '@/lib/domain'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/cn'

export const metadata: Metadata = { title: 'Customers' }
export const dynamic = 'force-dynamic'

function parseTiers(raw: string | undefined): CustomerTier[] {
  if (!raw) return []
  const wanted = new Set(raw.split(','))
  return CUSTOMER_TIERS.filter((tier) => wanted.has(tier))
}

function customersHref(params: { q?: string; tiers?: CustomerTier[] }): string {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.tiers && params.tiers.length > 0) search.set('tier', params.tiers.join(','))
  const query = search.toString()
  return query ? `/studio/customers?${query}` : '/studio/customers'
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tier?: string }>
}) {
  const staff = await requireCapability('customers.view')
  const showValues = can(staff.role, 'bookings.payments')
  const params = await searchParams
  const q = (params.q ?? '').trim()
  const tiers = parseTiers(params.tier)

  const searchFilter = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {}
  const tierFilter = tiers.length > 0 ? { tier: { in: tiers } } : {}

  const [tierCounts, totalAll, customers] = await Promise.all([
    prisma.customer.groupBy({ by: ['tier'], where: searchFilter, _count: { _all: true } }),
    prisma.customer.count(),
    prisma.customer.findMany({
      where: { ...searchFilter, ...tierFilter },
      orderBy: [{ lifetimeSpend: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        tier: true,
        rentalsCount: true,
        lifetimeSpend: true,
        city: true,
        region: true,
      },
    }),
  ])

  const countsByTier = new Map(tierCounts.map((row) => [row.tier, row._count._all]))
  const filtersActive = q.length > 0 || tiers.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={`${totalAll} clients on the books — search by name or email.`}
      />

      <div className="space-y-3.5">
        <form action="/studio/customers" method="get" className="flex max-w-md items-center gap-2">
          {tiers.length > 0 ? <input type="hidden" name="tier" value={tiers.join(',')} /> : null}
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
              placeholder="Camille Dubois, elena.rossi@gmail.com…"
              aria-label="Search clients"
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
            href={customersHref({ q })}
            className={cn(
              'chip transition-shadow',
              tiers.length === 0
                ? 'ring-2 ring-accent/45 ring-offset-2 ring-offset-page'
                : 'hover:ring-2 hover:ring-accent/20',
            )}
          >
            All · {totalAll}
          </Link>
          {CUSTOMER_TIERS.map((tier) => {
            const active = tiers.includes(tier)
            const nextTiers = active ? tiers.filter((t) => t !== tier) : [...tiers, tier]
            const meta = TIER_META[tier]
            return (
              <Link
                key={tier}
                href={customersHref({ q, tiers: nextTiers })}
                data-tone={meta.tone}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'chip transition-shadow',
                  active ? 'ring-2 ring-accent/45 ring-offset-2 ring-offset-page' : 'hover:ring-2 hover:ring-accent/20',
                )}
              >
                {meta.label} · {countsByTier.get(tier) ?? 0}
              </Link>
            )
          })}
          {filtersActive ? (
            <Link
              href="/studio/customers"
              className="ml-1 text-[13px] font-bold text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
        {customers.length === 0 ? (
          <EmptyState
            icon={filtersActive ? SearchX : Users}
            title={filtersActive ? 'No clients match' : 'No clients yet'}
            description={
              filtersActive
                ? 'Try a different name or email, or clear the filters.'
                : 'Profiles appear here as soon as the first inquiry or booking comes in.'
            }
            action={
              filtersActive ? (
                <Link href="/studio/customers" className="text-sm font-bold text-accent underline-offset-4 hover:underline">
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
                  <Th>Customer</Th>
                  <Th>Email</Th>
                  <Th>Tier</Th>
                  <Th>Rentals</Th>
                  {showValues ? <Th className="text-right">Lifetime spend</Th> : null}
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const meta = TIER_META[customer.tier]
                  const location = [customer.city, customer.region].filter(Boolean).join(', ')
                  return (
                    <Tr key={customer.id} className="relative">
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={customer.name} size="sm" />
                          <div className="min-w-0">
                            <Link
                              href={`/studio/customers/${customer.id}`}
                              className="font-bold text-ink after:absolute after:inset-0 after:content-['']"
                            >
                              {customer.name}
                            </Link>
                            {location ? <p className="mt-0.5 text-xs text-ink-muted">{location}</p> : null}
                          </div>
                        </div>
                      </Td>
                      <Td className="text-ink-muted">{customer.email}</Td>
                      <Td>
                        <Chip tone={meta.tone}>{meta.label}</Chip>
                      </Td>
                      <Td className="whitespace-nowrap text-ink">
                        <span className="font-bold tabular-nums">{customer.rentalsCount}</span>{' '}
                        <span className="text-ink-muted">{customer.rentalsCount === 1 ? 'rental' : 'rentals'}</span>
                      </Td>
                      {showValues ? (
                        <Td className="text-right font-bold tabular-nums text-ink">{formatMoney(customer.lifetimeSpend)}</Td>
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
